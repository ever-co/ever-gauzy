/**
 * Test-only harness for creating a workspace from Ever: the plugin's provisioning services on an
 * in-memory SQLite database (with the real migrations), with stand-ins for the request verifier (it
 * answers the claims a test registered for a document), the Ever ID sign-in plugin's hand-off and its
 * workspace creation (which runs the caller's last step in a real transaction). Excluded from the
 * library build.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import type {
	CreateUserPreLinkedHooks,
	CreateUserPreLinkedInput,
	CreateUserPreLinkedResult,
	ZitadelHandoffReaderPort,
	ZitadelProvisionerPort,
	ZitadelProvisionHandoff
} from '@gauzy/plugin-auth-zitadel';
import { readEverConnectConfig } from '../ever-connect-config';
import { EverConnectProvisionStore } from '../ever-connect-provision.store';
import { IntentRefusedError, ProvisionIntentClaims } from '../services/ever-connect-intent-verifier.service';
import { EverConnectProvisionGate } from '../services/ever-connect-provision-gate.service';
import { EverConnectProvisionService } from '../services/ever-connect-provision.service';
import { identityHarness, IdentityHarness } from './identity-harness';
import { intentClaims, TEST_SUBJECT } from './provision-intents';

export const EVER_ID_ISSUER = 'https://auth.ever.test';
export const OWNER_EMAIL = 'owner@acme.example';
export const CLIENT_BASE_URL = 'https://app.gauzy.test';

/** The request verifier: answers the claims registered for a document, refuses anything else. */
export class FakeVerifier {
	private readonly documents = new Map<string, ProvisionIntentClaims>();
	calls = 0;

	register(claims: Record<string, unknown>): string {
		const jws = `jws.${randomBytes(8).toString('hex')}.sig`;
		this.documents.set(jws, claims as unknown as ProvisionIntentClaims);
		return jws;
	}

	async verify(jws: unknown): Promise<ProvisionIntentClaims> {
		this.calls += 1;
		const claims = typeof jws === 'string' ? this.documents.get(jws) : undefined;
		if (!claims) throw new IntentRefusedError(401, 'intent_invalid', 'bad_signature');
		return claims;
	}
}

/** The Ever ID sign-in plugin's hand-offs ({@link ZitadelHandoffReaderPort}). */
export class FakeHandoffs implements ZitadelHandoffReaderPort {
	readonly records = new Map<string, ZitadelProvisionHandoff>();
	readonly signIns: Array<{ handoffKey: string; userId: string }> = [];

	/** A sign-in of `subject` that started with `provisionKey`; answers its key. */
	add(provisionKey: string, subject = TEST_SUBJECT, email = OWNER_EMAIL): string {
		const key = randomBytes(32).toString('base64url');
		this.records.set(key, {
			issuer: EVER_ID_ISSUER,
			subject,
			email,
			givenName: 'Ada',
			familyName: 'Owner',
			provisionKey,
			signedInAt: Date.now()
		});
		return key;
	}

	async peek(key: string): Promise<ZitadelProvisionHandoff | null> {
		return this.records.get(key) ?? null;
	}

	async consume(key: string): Promise<ZitadelProvisionHandoff | null> {
		const record = this.records.get(key) ?? null;
		this.records.delete(key);
		return record;
	}

	async signIn(key: string, userId: string): Promise<string | null> {
		if (!this.records.delete(key)) return null;
		this.signIns.push({ handoffKey: key, userId });
		return `signin-${this.signIns.length}`;
	}
}

/**
 * The sign-in plugin's workspace creation ({@link ZitadelProvisionerPort}): each step makes an id and
 * reports it (`checkpoint`), a retry resumes from the ids it is given, and the last step runs the
 * caller's rows in a real transaction. `failAt` injects a failure after a step.
 */
export class FakeProvisioner implements ZitadelProvisionerPort {
	readonly inputs: CreateUserPreLinkedInput[] = [];
	readonly resumes: Array<Partial<CreateUserPreLinkedResult> | undefined> = [];
	readonly provisioned = new Map<string, CreateUserPreLinkedResult & { everOrgId: string }>();
	users = 0;
	tenants = 0;
	organizations = 0;
	failAt: 'user' | 'tenant' | 'organization' | 'finalize' | null = null;
	delayMs = 0;

	constructor(private readonly dataSource: DataSource) {}

	async findProvisioned(key: string): Promise<CreateUserPreLinkedResult | null> {
		const found = this.provisioned.get(key);
		if (!found) return null;
		return {
			userId: found.userId,
			tenantId: found.tenantId,
			organizationId: found.organizationId,
			employeeId: found.employeeId,
			teamId: found.teamId,
			existing: true
		};
	}

	async isLinkedElsewhere(everOrgId: string, key: string): Promise<boolean> {
		return [...this.provisioned.entries()].some(([other, ids]) => ids.everOrgId === everOrgId && other !== key);
	}

	async createUserPreLinked(
		input: CreateUserPreLinkedInput,
		hooks: CreateUserPreLinkedHooks = {}
	): Promise<CreateUserPreLinkedResult> {
		this.inputs.push(input);
		this.resumes.push(hooks.resume);
		const done = await this.findProvisioned(input.idempotencyKey);
		if (done) return done;
		if (this.delayMs) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
		const ids: Partial<CreateUserPreLinkedResult> = { ...(hooks.resume ?? {}) };
		const step = async (name: 'user' | 'tenant' | 'organization') => {
			await hooks.checkpoint?.({ ...ids });
			if (this.failAt === name) {
				this.failAt = null;
				throw new Error('connection timeout');
			}
		};
		if (!ids.userId) {
			this.users += 1;
			ids.userId = randomUUID();
		}
		await step('user');
		if (!ids.tenantId) {
			this.tenants += 1;
			ids.tenantId = randomUUID();
		}
		await step('tenant');
		if (!ids.organizationId) {
			this.organizations += 1;
			ids.organizationId = randomUUID();
		}
		await step('organization');
		if (input.options.createEmployee && !ids.employeeId) ids.employeeId = randomUUID();
		if (input.options.createTeam && !ids.teamId) ids.teamId = randomUUID();
		await hooks.checkpoint?.({ ...ids });
		const result = ids as CreateUserPreLinkedResult;
		await this.dataSource.transaction(async (manager) => {
			await hooks.finalize?.({ query: (sql, params) => manager.query(sql, params) }, result);
			if (this.failAt === 'finalize') {
				this.failAt = null;
				throw new Error('link write failed');
			}
		});
		this.provisioned.set(input.idempotencyKey, { ...result, everOrgId: input.everOrgId });
		return result;
	}
}

export interface ProvisionHarness extends IdentityHarness {
	verifier: FakeVerifier;
	handoffs: FakeHandoffs;
	provisioner: FakeProvisioner;
	provisionStore: EverConnectProvisionStore;
	completion: { sendNow: jest.Mock };
	service: EverConnectProvisionService;
	/** Unix seconds of the harness clock. */
	nowS(): number;
	/** Registers a request (claims of `intentClaims` with `overrides`) and answers its document. */
	request(overrides?: Record<string, unknown>): string;
	/** Preflight, then a sign-in of `subject` with the key it answered: the two keys of the confirmation page. */
	signedIn(jws: string, subject?: string): Promise<{ provisionKey: string; handoffKey: string }>;
	/** Rows of a table. */
	rows(table: string): Promise<Array<Record<string, unknown>>>;
}

export const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

export async function provisionHarness(options: { enabled?: boolean } = {}): Promise<ProvisionHarness> {
	const h = await identityHarness({
		ENCRYPTION_KEY: 'provision-spec-encryption-key-0123456789',
		API_BASE_URL: 'https://api.gauzy.test',
		CLIENT_BASE_URL,
		EVER_CONNECT_PROVISION_ENABLED: options.enabled === false ? 'false' : 'true'
	});
	await h.connectAndEnable();
	const verifier = new FakeVerifier();
	const handoffs = new FakeHandoffs();
	const provisioner = new FakeProvisioner(h.dataSource);
	const provisionStore = new EverConnectProvisionStore(h.dataSource, h.clock);
	const completion = { sendNow: jest.fn(async () => undefined) };
	const service = new EverConnectProvisionService(
		provisionStore,
		verifier as never,
		new EverConnectProvisionGate(),
		completion as never,
		readEverConnectConfig({
			CLIENT_BASE_URL,
			API_BASE_URL: 'https://api.gauzy.test',
			EVER_CONNECT_PROVISION_ENABLED: options.enabled === false ? 'false' : 'true'
		}),
		handoffs,
		provisioner,
		h.clock
	);
	const nowS = () => Math.floor(h.clock.now() / 1000);
	return {
		...h,
		verifier,
		handoffs,
		provisioner,
		provisionStore,
		completion,
		service,
		nowS,
		request: (overrides = {}) => verifier.register(intentClaims(nowS(), overrides)),
		async signedIn(jws, subject = TEST_SUBJECT) {
			const preflight = await service.preflight(jws);
			return {
				provisionKey: preflight.provision_key,
				handoffKey: handoffs.add(preflight.provision_key, subject)
			};
		},
		rows: (table) => h.dataSource.query(`SELECT * FROM "${table}"`)
	};
}
