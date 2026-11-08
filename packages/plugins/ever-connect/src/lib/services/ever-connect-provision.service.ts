import {
	ConflictException,
	HttpException,
	HttpStatus,
	Inject,
	Injectable,
	Logger,
	Optional,
	UnauthorizedException
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { ITermsAcceptanceClaim, ITermsAcceptanceDocument } from '@gauzy/contracts';
import {
	isEverHost,
	PROVISION_KEY_SHAPE,
	provisionKeyHash,
	ZITADEL_HANDOFF_READER,
	ZITADEL_PROVISIONER,
	ZitadelHandoffReaderPort,
	ZitadelProvisionHandoff,
	ZitadelProvisionerPort
} from '@gauzy/plugin-auth-zitadel';
import { EverConnectAuditService } from '../ever-connect-audit.service';
import type { EverConnectConfig } from '../ever-connect-config';
import { EVER_CONNECT_CLOCK, EVER_CONNECT_SETTINGS } from '../ever-connect.constants';
import { errorCode } from '../ever-connect-platform.service';
import {
	ClaimLostError,
	EverConnectProvisionStore,
	ProvisionIds,
	ProvisionIntentRecord,
	ProvisionResultRecord
} from '../ever-connect-provision.store';
import { EverConnectIntentVerifier, ProvisionIntentClaims } from './ever-connect-intent-verifier.service';
import { EverConnectProvisionCompletion } from './ever-connect-provision-completion.service';
import { EverConnectProvisionGate } from './ever-connect-provision-gate.service';

/**
 * How long one attempt holds a creation before another may take it over (a stopped process); renewed
 * after each step, so only an attempt that stopped loses it.
 */
export const CREATION_CLAIM_MS = 5 * 60_000;

/** The most documents a confirmation can carry. */
const MAX_TERMS = 20;

/** How long a second request for a creation that is running waits for its end before answering 409. */
export const CREATION_WAIT_MS = 10_000;

/** How often that request looks again. */
const CREATION_POLL_MS = 250;

/** Longest first or last name taken from the confirmation page. */
const MAX_NAME_LENGTH = 100;

/** `POST /api/ever-connect/provision/preflight`. */
export interface ProvisionPreflight {
	ok: true;
	org_display_name: string;
	handle: string;
	product_tenant_exists: boolean;
	sign_in_required: true;
	/** The opaque one-time key of this request (valid until the request expires). */
	provision_key: string;
}

/** `POST /api/ever-connect/provision/summary`: what the confirmation page shows. */
export interface ProvisionSummary {
	org_display_name: string;
	handle: string;
	legal_name: string | null;
	/** The e-mail of the person's own Ever ID sign-in: the owner's address in the new workspace. */
	email: string;
	first_name: string | null;
	last_name: string | null;
	creates: { workspace: true; organization: true; admin_account: true; employee: true; team: boolean };
	tier: string;
	product_tenant_exists: boolean;
	/** The legal documents to accept on this page (Gauzy's own list), with links to the web app's pages. */
	terms: ITermsAcceptanceDocument[];
	/** The Ever page the person goes back to. */
	return_to: string;
	/** Unix milliseconds: the confirmation must be sent before. */
	expires_at: number;
}

/** `POST /api/ever-connect/provision`. */
export interface ProvisionResponse {
	status: 'created' | 'exists';
	product_tenant_id: string;
	product_org_id: string;
	product_user_id: string;
	employee_id?: string;
	team_id?: string;
	/** `<CLIENT_BASE_URL>/#/auth/ever-id?handoff=<one-time key>`: signs the owner in (never a token). */
	sign_in_url: string | null;
	return_to: string;
}

const problem = (status: number, code: string, message: string): HttpException =>
	new HttpException({ statusCode: status, code, message }, status);

const invalid = (): HttpException =>
	new UnauthorizedException({ statusCode: 401, code: 'intent_invalid', message: 'This request is not valid.' });

const cleanName = (value: unknown): string | undefined => {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim().slice(0, MAX_NAME_LENGTH);
	return trimmed || undefined;
};

/** What a provisioning key and a sign-in key lead to. */
interface Resolved {
	claims: ProvisionIntentClaims;
	intent: ProvisionIntentRecord;
	handoff: ZitadelProvisionHandoff;
}

/**
 * Creating a workspace a person asked for in Ever (`EVER_CONNECT_PROVISION_ENABLED=true`).
 *
 * 1. `preflight`: Ever Platform's signed request (verified by {@link EverConnectIntentVerifier}) is
 *    kept by its `jti` under a new one-time key; the browser holds the key, never the request.
 * 2. The person signs in with Ever ID (the sign-in plugin carries the key and keeps the verified
 *    identity under a second one-time key, `ZITADEL_HANDOFF_READER`); the signed-in Ever ID must be
 *    the person the request names (`person.ever_id_sub`), else nothing is created.
 * 3. `summary` (no side effect) and `create`: after the entitlement check (the signed plan), the
 *    workspace is created through the sign-in plugin (`ZITADEL_PROVISIONER`), with Gauzy's record of
 *    the organization link and the audit row in the transaction of its last step; Ever Platform is
 *    then told (`EverConnectProvisionCompletion`), and the owner is signed in with a one-time key.
 *
 * The idempotency key of the request is the key of the creation: the same key answers the workspace
 * already made (`exists`) and never creates a second one; the same `jti` under another key is a replay
 * (409 `intent_replayed`); an Ever organization already linked by another creation is refused (409
 * `organization_already_linked`). One attempt creates at a time (a claim on the result row); a creation
 * that stopped half way is finished by its retry with the same tenant and organization, whether that
 * retry carries the same request or a new one for the same step (Ever Platform makes a new `jti` for
 * each attempt of a step, under the step's idempotency key).
 */
@Injectable()
export class EverConnectProvisionService {
	private readonly logger = new Logger('EverConnect');
	private readonly now: () => number;

	constructor(
		private readonly store: EverConnectProvisionStore,
		private readonly verifier: EverConnectIntentVerifier,
		private readonly gate: EverConnectProvisionGate,
		private readonly completion: EverConnectProvisionCompletion,
		@Inject(EVER_CONNECT_SETTINGS) private readonly config: EverConnectConfig,
		@Optional() @Inject(ZITADEL_HANDOFF_READER) private readonly handoffs?: ZitadelHandoffReaderPort,
		@Optional() @Inject(ZITADEL_PROVISIONER) private readonly provisioner?: ZitadelProvisionerPort,
		@Optional() @Inject(EVER_CONNECT_CLOCK) clock?: { now: () => number }
	) {
		this.now = clock?.now ?? (() => Date.now());
	}

	/** Whether this installation can create workspaces from Ever now (the switch and the Ever ID sign-in plugin). */
	get available(): boolean {
		return this.config.provision.enabled && !!this.handoffs && !!this.provisioner;
	}

	/** Verifies a request and keeps it under a new one-time key. */
	async preflight(jws: unknown): Promise<ProvisionPreflight> {
		const claims = await this.verifier.verify(jws);
		const replay = await this.store.resultByJti(claims.jti);
		if (replay && replay.idempotencyKey !== claims.idempotency_key) {
			throw this.replayed();
		}
		const key = randomBytes(32).toString('base64url');
		const saved = await this.store.saveIntent({
			jti: claims.jti,
			intent: JSON.stringify(claims),
			keyHash: provisionKeyHash(key),
			idempotencyKey: claims.idempotency_key,
			expiresAt: claims.exp * 1000
		});
		if (!saved) {
			throw this.replayed();
		}
		const result = await this.store.result(claims.idempotency_key);
		this.logger.log(`Provisioning request ${claims.jti} received.`);
		return {
			ok: true,
			org_display_name: claims.org.display_name,
			handle: claims.org.handle,
			product_tenant_exists: result?.status === 'created',
			sign_in_required: true,
			provision_key: key
		};
	}

	/** What the confirmation page shows (no side effect). */
	async summary(provisionKey: unknown, handoffKey: unknown): Promise<ProvisionSummary> {
		const { claims, intent, handoff } = await this.resolve(provisionKey, handoffKey);
		this.gate.check(claims);
		const result = await this.store.result(claims.idempotency_key);
		return {
			org_display_name: claims.org.display_name,
			handle: claims.org.handle,
			legal_name: claims.org.legal_name ?? null,
			email: handoff.email,
			first_name: handoff.givenName ?? null,
			last_name: handoff.familyName ?? null,
			creates: {
				workspace: true,
				organization: true,
				admin_account: true,
				employee: true,
				team: claims.features?.teams ?? true
			},
			tier: claims.tier,
			product_tenant_exists: result?.status === 'created',
			terms: (this.provisioner as ZitadelProvisionerPort).requiredTerms(),
			return_to: claims.return_to,
			expires_at: intent.expiresAt
		};
	}

	/** The person confirmed: creates the workspace (or answers the one created for this key). */
	async create(
		provisionKey: unknown,
		handoffKey: unknown,
		request: { first_name?: unknown; last_name?: unknown; terms?: unknown } | undefined
	): Promise<ProvisionResponse> {
		const { claims, handoff } = await this.resolve(provisionKey, handoffKey);
		this.gate.check(claims);
		const key = claims.idempotency_key;

		const byJti = await this.store.resultByJti(claims.jti);
		if (byJti && byJti.idempotencyKey !== key) {
			throw this.replayed();
		}
		const existing = await this.store.result(key);
		if (existing?.status === 'created') {
			return this.answerExisting(existing, claims, handoffKey as string);
		}
		const provisioner = this.provisioner as ZitadelProvisionerPort;
		const terms = this.acceptedTerms(request?.terms, provisioner.requiredTerms());
		if (await provisioner.isLinkedElsewhere(claims.org.id, key)) {
			throw problem(
				HttpStatus.CONFLICT,
				'organization_already_linked',
				'This Ever organization already has a workspace here.'
			);
		}

		const holder = randomUUID();
		let claim = await this.store.claim(
			{ idempotencyKey: key, jti: claims.jti, everOrgId: claims.org.id },
			holder,
			this.now() + CREATION_CLAIM_MS
		);
		if (claim.outcome === 'replayed') {
			throw this.replayed();
		}
		if (claim.outcome === 'org_linked') {
			throw problem(
				HttpStatus.CONFLICT,
				'organization_already_linked',
				'This Ever organization already has a workspace here.'
			);
		}
		if (claim.outcome === 'busy') {
			const finished = await this.waitForCreation(key);
			if (finished) {
				return this.answerExisting(finished, claims, handoffKey as string);
			}
			throw new ConflictException({
				statusCode: 409,
				code: 'provisioning_in_progress',
				message: 'This workspace is being created; try again in a moment.'
			});
		}
		if (claim.outcome === 'created') {
			return this.answerExisting(claim.record, claims, handoffKey as string);
		}

		let ids: ProvisionIds;
		try {
			ids = await this.createWorkspace(claims, handoff, claim.record, holder, request, terms);
		} catch (error) {
			if (error instanceof ClaimLostError) {
				// Another attempt took over (this one was too slow): it owns the outcome now.
				const finished = await this.waitForCreation(key);
				if (finished) return this.answerExisting(finished, claims, handoffKey as string);
				throw new ConflictException({
					statusCode: 409,
					code: 'provisioning_in_progress',
					message: 'This workspace is being created; try again in a moment.'
				});
			}
			await this.store.fail(key, holder, errorCode(error)).catch(() => undefined);
			this.logger.warn(`Provisioning request ${claims.jti} failed (${errorCode(error)}).`);
			throw problem(
				HttpStatus.INTERNAL_SERVER_ERROR,
				'provisioning_failed',
				'The workspace could not be created; try again.'
			);
		}
		await this.store.markIntent(claims.jti, 'accepted', ids).catch(() => undefined);
		claim = { outcome: 'created', record: (await this.store.result(key)) as ProvisionResultRecord };
		this.logger.log(`Provisioning request ${claims.jti} created a workspace.`);
		// After the commit: Ever Platform is told now, and again later if it cannot be reached.
		void this.completion.sendNow(key);
		return this.answer('created', claim.record, claims, handoffKey as string);
	}

	private async createWorkspace(
		claims: ProvisionIntentClaims,
		handoff: ZitadelProvisionHandoff,
		record: ProvisionResultRecord,
		holder: string,
		request: { first_name?: unknown; last_name?: unknown } | undefined,
		terms: ITermsAcceptanceClaim[]
	): Promise<ProvisionIds> {
		const key = claims.idempotency_key;
		const catalogId = await this.store.catalogId();
		const audit = { action: 'provision.accept' as const, actorLabel: 'user' as const };
		const created = await (this.provisioner as ZitadelProvisionerPort).createUserPreLinked(
			{
				issuer: handoff.issuer,
				subject: handoff.subject,
				email: handoff.email,
				firstName: cleanName(request?.first_name) ?? handoff.givenName,
				lastName: cleanName(request?.last_name) ?? handoff.familyName,
				tenant: { name: claims.org.display_name },
				organization: {
					name: claims.org.display_name,
					officialName: claims.org.legal_name,
					country: claims.org.country,
					website: claims.org.website
				},
				everOrgId: claims.org.id,
				everTenantId: claims.org.id,
				handle: claims.org.handle,
				options: { createEmployee: true, createTeam: claims.features?.teams ?? true },
				terms,
				idempotencyKey: key
			},
			{
				resume: {
					userId: record.productUserId ?? undefined,
					tenantId: record.productTenantId ?? undefined,
					organizationId: record.productOrgId ?? undefined,
					employeeId: record.employeeId ?? undefined,
					teamId: record.teamId ?? undefined
				},
				checkpoint: async (ids) => {
					// Each step renews the claim; one that was taken over stops here.
					if (
						!(await this.store.checkpoint(key, holder, toProvisionIds(ids), this.now() + CREATION_CLAIM_MS))
					) {
						throw new ClaimLostError();
					}
				},
				finalize: async (tx, ids) => {
					const details = {
						job_id: claims.job_id,
						step_seq: claims.step_seq,
						product_tenant_id: ids.tenantId,
						product_org_id: ids.organizationId
					};
					EverConnectAuditService.check({ ...audit, details });
					await this.store.writeCreated(tx, {
						idempotencyKey: key,
						holder,
						ids: toProvisionIds(ids),
						catalogId,
						settings: {
							EVER_ORG_ID: claims.org.id,
							EVER_HANDLE: claims.org.handle,
							EVER_LINK_STATUS: 'linked'
						},
						audit: { action: audit.action, actorUserId: ids.userId, details }
					});
				}
			}
		);
		const ids = toProvisionIds(created);
		if (created.existing) {
			// Another attempt finished the links (and this row) in its transaction; a row that missed it is healed.
			const current = await this.store.result(key);
			if (current?.status !== 'created') {
				await this.store.markCreated(key, ids);
			}
		}
		return ids;
	}

	/** Waits (briefly) for a creation another attempt is running; the finished row, or `null`. */
	private async waitForCreation(key: string): Promise<ProvisionResultRecord | null> {
		// Real time: this is a wait, not a validity.
		const deadline = Date.now() + CREATION_WAIT_MS;
		while (Date.now() < deadline) {
			await new Promise((resolve) => setTimeout(resolve, CREATION_POLL_MS));
			const record = await this.store.result(key);
			if (record?.status === 'created') return record;
			if (record?.status === 'failed') return null;
		}
		return null;
	}

	/**
	 * The answer for a workspace that exists. A newer request for it (`jti`) means Ever Platform has not
	 * heard of it: the report then names that request, and is sent now.
	 */
	private async answerExisting(
		record: ProvisionResultRecord,
		claims: ProvisionIntentClaims,
		handoffKey: string
	): Promise<ProvisionResponse> {
		if (record.jti !== claims.jti && (await this.store.reportUnder(record.idempotencyKey, claims.jti))) {
			void this.completion.sendNow(record.idempotencyKey);
		}
		return this.answer('exists', record, claims, handoffKey);
	}

	/** The answer for a created workspace; the person's sign-in key is used up for its one-time sign-in key. */
	private async answer(
		status: 'created' | 'exists',
		record: ProvisionResultRecord,
		claims: ProvisionIntentClaims,
		handoffKey: string
	): Promise<ProvisionResponse> {
		let signInKey: string | null = null;
		if (record.productUserId) {
			signInKey = await (this.handoffs as ZitadelHandoffReaderPort)
				.signIn(handoffKey, record.productUserId)
				.catch(() => null);
		}
		return {
			status,
			product_tenant_id: record.productTenantId as string,
			product_org_id: record.productOrgId as string,
			product_user_id: record.productUserId as string,
			...(record.employeeId ? { employee_id: record.employeeId } : {}),
			...(record.teamId ? { team_id: record.teamId } : {}),
			sign_in_url: signInKey ? `${this.config.provision.appUrl}/#/auth/ever-id?handoff=${signInKey}` : null,
			return_to: claims.return_to
		};
	}

	/**
	 * The pending request behind a provisioning key, the verified Ever ID behind a sign-in key, and the
	 * binding of the two: the signed-in Ever ID must be the person the request names.
	 */
	private async resolve(provisionKey: unknown, handoffKey: unknown): Promise<Resolved> {
		if (
			typeof provisionKey !== 'string' ||
			!PROVISION_KEY_SHAPE.test(provisionKey) ||
			typeof handoffKey !== 'string'
		) {
			throw invalid();
		}
		const intent = await this.store.intentByKey(provisionKeyHash(provisionKey));
		if (!intent || (intent.status !== 'pending' && intent.status !== 'accepted')) {
			throw invalid();
		}
		if (this.now() >= intent.expiresAt) {
			throw new UnauthorizedException({
				statusCode: 401,
				code: 'intent_expired',
				message: 'This request has expired; start again from Ever.'
			});
		}
		let claims: ProvisionIntentClaims;
		try {
			claims = JSON.parse(intent.intent) as ProvisionIntentClaims;
		} catch {
			throw invalid();
		}
		const handoff = await (this.handoffs as ZitadelHandoffReaderPort).peek(handoffKey);
		if (!handoff) {
			throw new UnauthorizedException({
				statusCode: 401,
				code: 'sign_in_required',
				message: 'Sign in with Ever ID again.'
			});
		}
		if (handoff.provisionKeyHash !== provisionKeyHash(provisionKey)) {
			throw invalid();
		}
		// The person the request names, at Ever ID (a subject is unique at its issuer only).
		if (!this.isEverIdIssuer(handoff.issuer) || handoff.subject !== claims.person?.ever_id_sub) {
			throw new UnauthorizedException({
				statusCode: 401,
				code: 'identity_mismatch',
				message: 'Signed in as a different Ever ID than the one that started this.'
			});
		}
		return { claims, intent, handoff };
	}

	/**
	 * Whether a sign-in came from Ever ID: an issuer on an Ever host (a test platform on a local address
	 * may name its own).
	 */
	private isEverIdIssuer(issuer: string): boolean {
		return isEverHost(issuer) || this.config.localPlatform;
	}

	/**
	 * The documents the person accepted (`request.terms`): each a `{documentId, version, sha256, locale}`
	 * as the summary listed it, and every required one present; Gauzy's register path checks them against
	 * the published text and records them.
	 *
	 * @throws 422 `terms_required` when a required document is missing or a claim is malformed.
	 */
	private acceptedTerms(raw: unknown, required: ITermsAcceptanceDocument[]): ITermsAcceptanceClaim[] {
		const list = Array.isArray(raw) ? raw.slice(0, MAX_TERMS) : [];
		const claims: ITermsAcceptanceClaim[] = [];
		for (const item of list) {
			const value = item as Record<string, unknown>;
			const field = (name: string, max: number) =>
				typeof value?.[name] === 'string' &&
				(value[name] as string).length > 0 &&
				(value[name] as string).length <= max
					? (value[name] as string)
					: null;
			const documentId = field('documentId', 255);
			const version = field('version', 64);
			const digest = field('sha256', 64);
			const locale = field('locale', 35);
			if (!documentId || !version || !digest || !/^[0-9a-f]{64}$/.test(digest) || !locale) {
				throw this.termsRequired();
			}
			claims.push({ documentId, version, sha256: digest, locale });
		}
		const missing = required.filter(
			(document) =>
				!claims.some((claim) => claim.documentId === document.documentId && claim.version === document.version)
		);
		if (missing.length) {
			throw this.termsRequired();
		}
		return claims;
	}

	private termsRequired(): HttpException {
		return problem(HttpStatus.UNPROCESSABLE_ENTITY, 'terms_required', 'The required terms must be accepted.');
	}

	private replayed(): HttpException {
		return problem(HttpStatus.CONFLICT, 'intent_replayed', 'This request was already used.');
	}
}

/** The ids of the provisioner, as the result row names them. */
function toProvisionIds(ids: {
	userId?: string;
	tenantId?: string;
	organizationId?: string;
	employeeId?: string;
	teamId?: string;
}): ProvisionIds {
	return {
		productUserId: ids.userId ?? null,
		productTenantId: ids.tenantId ?? null,
		productOrgId: ids.organizationId ?? null,
		employeeId: ids.employeeId ?? null,
		teamId: ids.teamId ?? null
	};
}
