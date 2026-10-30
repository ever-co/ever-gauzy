/**
 * Test-only harness for Sign in with Ever ID and a person's requests: the plugin's services on an
 * in-memory SQLite database (with the real migrations), talking through the real SDK client (which
 * checks every request body against the SDK's request schemas before it is sent) to a recording
 * stand-in for Ever Platform. Excluded from the library build.
 */
import { createHash, generateKeyPairSync, sign as edSign } from 'node:crypto';
import { DataSource } from 'typeorm';
import type { EverIdAccountLink, EverIdAccountsPort } from '@gauzy/plugin-auth-zitadel';
import { EverConnectAuditService } from '../ever-connect-audit.service';
import { readEverConnectConfig } from '../ever-connect-config';
import { EverConnectIdentityStore } from '../ever-connect-identity.store';
import { EverConnectSignals } from '../ever-connect-signals';
import { EverConnectStore } from '../ever-connect.store';
import { EverIdLoginHandler } from '../handlers/ever-id-login.handler';
import { createEverPlatformClient } from '../sdk';
import { createCoreTables, migrateUp, openTestDataSource } from './test-db';

export const INSTANCE_ID = '01JNE7V9J03J6XQ2WN8H0Z88R5';
export const ISSUER = 'https://auth.ever.co';
export const ENV = { ENCRYPTION_KEY: 'identity-spec-encryption-key-0123456789', API_BASE_URL: 'https://gauzy.example.com' };

/** One request the stand-in received. */
export interface PlatformCall {
	method: string;
	path: string;
	body: Record<string, unknown> | null;
	headers: Record<string, string>;
}

type Answer = { status: number; body?: unknown };
type Route = (call: PlatformCall) => Answer | Promise<Answer>;

/** A problem answer as Ever Platform sends one. */
export const problem = (status: number, code: string): Answer => ({
	status,
	body: { type: `https://ever.co/problems/${code}`, title: code, status, code }
});

/** A recording stand-in for Ever Platform: answers by `METHOD path`, records every call but the token's. */
export class FakePlatform {
	readonly calls: PlatformCall[] = [];
	readonly routes = new Map<string, Route>();
	/** When set, every call (but the token's) fails as a network error. */
	offline = false;

	on(key: string, route: Route | Answer): this {
		this.routes.set(key, typeof route === 'function' ? route : () => route);
		return this;
	}

	callsTo(key: string): PlatformCall[] {
		return this.calls.filter((call) => `${call.method} ${call.path}` === key);
	}

	readonly fetch = async (input: unknown, init?: { method?: string; body?: unknown; headers?: unknown }) => {
		const url = new URL(String(input instanceof URL ? input.href : typeof input === 'string' ? input : (input as { url: string }).url));
		const method = (init?.method ?? 'GET').toUpperCase();
		const headers: Record<string, string> = {};
		new Headers(init?.headers as never).forEach((value, key) => (headers[key] = value));
		const raw = init?.body ? Buffer.from(init.body as Uint8Array).toString('utf8') : '';
		const call: PlatformCall = { method, path: url.pathname, body: raw ? JSON.parse(raw) : null, headers };
		if (call.path === '/v1/instances/token') {
			return json({ status: 200, body: { access_token: 'evit_test_token', token_type: 'Bearer', expires_in: 3600 } });
		}
		this.calls.push(call);
		if (this.offline) {
			throw new TypeError('fetch failed');
		}
		const route = this.routes.get(`${method} ${call.path}`);
		return json(route ? await route(call) : problem(404, 'not_found'));
	};
}

function json(answer: Answer): Response {
	const failed = answer.status >= 400;
	return new Response(answer.body === undefined || answer.status === 204 ? null : JSON.stringify(answer.body), {
		status: answer.status,
		headers: { 'content-type': failed ? 'application/problem+json' : 'application/json', 'x-request-id': 'req-test' }
	});
}

/** A test connection key (Ed25519), as `EverInstanceService.connectSigner()` gives one. */
export function testSigner() {
	const { publicKey, privateKey } = generateKeyPairSync('ed25519');
	const x = (publicKey.export({ format: 'jwk' }) as { x: string }).x;
	const raw = Buffer.from(x, 'base64url');
	return {
		kid: createHash('sha256').update(raw).digest().subarray(0, 8).toString('base64url'),
		publicKeyRaw: new Uint8Array(raw),
		publicKey,
		sign: async (bytes: Uint8Array) => new Uint8Array(edSign(null, Buffer.from(bytes), privateKey))
	};
}

/** The Ever ID sign-in plugin's links, in memory ({@link EverIdAccountsPort}). */
export class FakeAccounts implements EverIdAccountsPort {
	links_: EverIdAccountLink[] = [];
	readonly erased: string[][] = [];
	readonly sessionsEnded: string[][] = [];

	add(link: Omit<EverIdAccountLink, 'id'> & { id?: string }): EverIdAccountLink {
		const row = { id: link.id ?? String(this.links_.length + 1).padStart(6, '0'), ...link } as EverIdAccountLink;
		this.links_.push(row);
		return row;
	}

	private matching(hashes: string[]) {
		return this.links_.filter((link) =>
			hashes.includes(createHash('sha256').update(`${link.issuer}#${link.subject}`).digest('hex'))
		);
	}

	async findUsers(hashes: string[]): Promise<string[]> {
		return [...new Set(this.matching(hashes).map((link) => link.userId))];
	}

	async erase(hashes: string[]): Promise<string[]> {
		const rows = this.matching(hashes);
		this.erased.push(hashes);
		this.links_ = this.links_.filter((link) => !rows.includes(link));
		return [...new Set(rows.map((link) => link.userId))];
	}

	async endSessions(userIds: string[]): Promise<void> {
		this.sessionsEnded.push(userIds);
	}

	async links(tenantIds: string[], after: string | null, limit: number): Promise<EverIdAccountLink[]> {
		return this.links_
			.filter((link) => link.tenantId && tenantIds.includes(link.tenantId) && (!after || link.id > after))
			.sort((a, b) => (a.id < b.id ? -1 : 1))
			.slice(0, limit);
	}
}

export interface IdentityHarness {
	dataSource: DataSource;
	clock: { t: number; now(): number };
	platform: FakePlatform;
	signer: ReturnType<typeof testSigner>;
	store: EverConnectStore;
	identity: EverConnectIdentityStore;
	audit: EverConnectAuditService;
	signals: EverConnectSignals;
	platformService: { getClient: () => Promise<ReturnType<typeof createEverPlatformClient>> };
	everIdLogin: EverIdLoginHandler;
	config: ReturnType<typeof readEverConnectConfig>;
	/** Marks the installation connected and `ever_id_login` enabled (by Ever Platform's consent). */
	connectAndEnable(): Promise<void>;
	/** The audit rows written, oldest first. */
	auditRows(): Promise<Array<{ action: string; details: Record<string, unknown> }>>;
	close(): Promise<void>;
}

/** The harness on a fresh in-memory database. */
export async function identityHarness(env: Record<string, string> = ENV): Promise<IdentityHarness> {
	const dataSource = await openTestDataSource({ name: 'better-sqlite3' });
	await createCoreTables(dataSource, 'better-sqlite3');
	await migrateUp(dataSource);
	// `now` is read off the object by the services, so it never uses `this`.
	const clock: { t: number; now(): number } = { t: Date.parse('2026-11-02T10:00:00.000Z'), now: () => clock.t };
	const platform = new FakePlatform();
	const signer = testSigner();
	const client = createEverPlatformClient({
		baseUrl: 'https://api.ever.co',
		userAgentProduct: { product: 'gauzy', version: '0.0.0' },
		signer,
		registryInstanceId: () => INSTANCE_ID,
		fetch: platform.fetch as never,
		now: () => Math.floor(clock.now() / 1000)
	});
	const platformService = { getClient: async () => client };
	const store = new EverConnectStore(dataSource, clock);
	const identity = new EverConnectIdentityStore(dataSource, clock);
	const audit = new EverConnectAuditService(dataSource, clock);
	const signals = new EverConnectSignals();
	const config = readEverConnectConfig(env);
	const everIdLogin = new EverIdLoginHandler(store, platformService as never, audit, signals, config, env, clock);
	return {
		dataSource,
		clock,
		platform,
		signer,
		store,
		identity,
		audit,
		signals,
		platformService,
		everIdLogin,
		config,
		async connectAndEnable() {
			await store.updateConnection({ status: 'connected', platformInstanceId: INSTANCE_ID, connectedAt: clock.now() });
			await store.saveIntegration('instance', 'ever_id_login', {
				state: 'enabled',
				enabled: true,
				consentId: '01JD0000000000000000000CNS',
				operatorAccept: 'accepted'
			});
		},
		async auditRows() {
			const rows = (await dataSource.query('SELECT "action", "details" FROM "ever_connect_audit" ORDER BY "at" ASC, rowid ASC')) as Array<{
				action: string;
				details: string | null;
			}>;
			return rows.map((row) => ({ action: row.action, details: row.details ? JSON.parse(row.details) : {} }));
		},
		async close() {
			await dataSource.destroy();
		}
	};
}
