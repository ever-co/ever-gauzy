import {
	ForbiddenException,
	HttpException,
	HttpStatus,
	Inject,
	Injectable,
	Logger,
	OnModuleInit,
	Optional
} from '@nestjs/common';
import { EverConnectAuditService } from './ever-connect-audit.service';
import { EVER_CONNECT_CLOCK } from './ever-connect.constants';
import { EverConnectEntitlementService } from './ever-connect-entitlement.service';
import { EverConnectIntegrationStateService } from './ever-connect-integration-state.service';
import {
	EverConnectPlatformService,
	errorCode,
	isCredentialRevoked,
	isUnreachable
} from './ever-connect-platform.service';
import type { OrganizationScope } from './ever-connect-request';
import { EverConnectSignals } from './ever-connect-signals';
import { EverConnectStore, IntegrationRecord, LinkRecord } from './ever-connect.store';
import { LookupItem, LookupItemResult, LookupResponse } from './dto/lookup.dto';
import { requiredFeature } from './integrations/integration-definitions';
import { IntegrationHandler, IntegrationHandlerRegistry } from './integrations/integration-handler.registry';
import {
	CONSTANTS,
	LookupInputError,
	LookupKind,
	LookupSalt,
	lookupHash,
	normalizeIdentifier,
	NORMALIZATION_VERSION,
	ProblemError
} from './sdk';

/** The integration this service runs. */
export const COUNTERPARTY_LOOKUP = 'counterparty_lookup';

/** The setting of a link (`integration_setting` of its `integration_tenant`) that checks a contact when it is opened. */
export const LOOKUP_AUTO_CHECK = 'LOOKUP_AUTO_CHECK';

/** At most this many checks that ask Ever Platform, per organization and minute, in each API process. */
export const LOOKUP_LOCAL_PER_MINUTE = 30;

const LOOKUP = (CONSTANTS as { lookup?: Record<string, number> }).lookup ?? {};
/** How long an answer is kept: a match for a day, "none found" for an hour; the salts for a day. */
export const LOOKUP_POSITIVE_MS = (LOOKUP['cache_positive_s'] ?? 86_400) * 1000;
export const LOOKUP_NEGATIVE_MS = (LOOKUP['cache_negative_s'] ?? 3_600) * 1000;
export const LOOKUP_SALT_MS = (LOOKUP['salt_cache_s'] ?? 86_400) * 1000;

/** A handle as Ever Platform answers it (`ever.co/<handle>`). */
const HANDLE = /^[a-z](?:[a-z0-9]|-(?=[a-z0-9]))*$/;
const FEATURE = /^[a-z][a-z0-9_.]{0,63}$/;
const SALT = /^[A-Za-z0-9_-]{43}$/;

/** One active salt, with when it became active (epoch milliseconds; `null` when not stated). */
export interface ActiveSalt extends LookupSalt {
	activeFrom: number | null;
}

/** Too many checks for this organization: the answer carries `Retry-After`. */
export class LookupRateLimitedError extends HttpException {
	constructor(readonly retryAfterS: number) {
		super(
			{
				statusCode: 429,
				code: 'rate_limited',
				message: 'Too many checks for now. Try again later.',
				retry_after_s: retryAfterS
			},
			HttpStatus.TOO_MANY_REQUESTS
		);
	}
}

/** A match as it is kept in the cache and answered. */
interface Match {
	handle: string;
	features: string[];
}

/**
 * The SDK's normalisation of one identifier (version 1): the normalised value, or why it cannot be
 * checked (`empty`, `no_country`, `no_at_sign`, `bad_domain`; it is then never hashed or sent).
 */
export function normaliseItem(item: LookupItem): { normalized: string } | { reason: string } {
	try {
		return {
			normalized: normalizeIdentifier(
				item.kind as LookupKind,
				item.value,
				item.country ? { country: item.country } : undefined
			)
		};
	} catch (error) {
		if (error instanceof LookupInputError) {
			return { reason: String(error.reason) };
		}
		throw error;
	}
}

/** The salted hash of a normalised identifier (64 lowercase hex), by the SDK. */
export function hashOf(kind: LookupItem['kind'], normalized: string, salt: LookupSalt): string {
	return lookupHash(kind as LookupKind, normalized, salt).hash;
}

/** The salt a check uses: the newest one already active (during a rotation the next one is listed before it starts). */
export function currentSalt(salts: ActiveSalt[], now: number): ActiveSalt {
	const active = salts.filter((salt) => salt.activeFrom === null || salt.activeFrom <= now);
	const pool = active.length ? active : salts;
	return pool.reduce((best, salt) => (salt.version > best.version ? salt : best));
}

/**
 * The counterparty check: "is this client or supplier on Ever Platform?", without uploading
 * contacts. The handler of `counterparty_lookup`.
 *
 * - Only while the integration is enabled for the organization's link (consented in app.ever.co,
 *   not denied here) and its entitlement grants `features.lookup`: otherwise 403 and no request.
 * - Each identifier (a VAT number, a registration number, an e-mail address) is normalised and
 *   hashed here, with the published salt, by the SDK; one that cannot be normalised is answered
 *   "cannot be checked" and never sent. Ever Platform receives the salt version and the hashes only
 *   (`POST /v1/lookup`, with the link's id), and answers the handles of the organizations that chose
 *   to be discoverable.
 * - The salts are read at most once a day (`GET /v1/lookup/salt`); answers are kept per organization
 *   (a match for a day, "none found" for an hour) in `ever_connect_lookup_cache`; at most 30 checks a
 *   minute per organization ask Ever Platform from one API process.
 * - Switching the integration off removes the organization's kept answers. No value or hash is
 *   ever logged.
 */
@Injectable()
export class EverConnectLookupService implements IntegrationHandler, OnModuleInit {
	readonly key = COUNTERPARTY_LOOKUP;
	private readonly logger = new Logger('EverConnect');
	private readonly now: () => number;
	private saltDoc: { fetchedAt: number; salts: ActiveSalt[] } | null = null;
	private saltRead: Promise<ActiveSalt[]> | null = null;
	/** When this process asked Ever Platform for each organization in the last minute. */
	private readonly recent = new Map<string, number[]>();

	constructor(
		private readonly platform: EverConnectPlatformService,
		private readonly store: EverConnectStore,
		private readonly states: EverConnectIntegrationStateService,
		private readonly entitlements: EverConnectEntitlementService,
		private readonly audit: EverConnectAuditService,
		private readonly signals: EverConnectSignals,
		private readonly handlers: IntegrationHandlerRegistry,
		@Optional() @Inject(EVER_CONNECT_CLOCK) clock?: { now: () => number }
	) {
		this.now = clock?.now ?? (() => Date.now());
	}

	onModuleInit(): void {
		this.handlers.register(this);
	}

	// ── The integration's handler ──────────────────────────────────────────────

	/** Switched off (here or in app.ever.co): the organization's kept answers go. */
	async onDisable(row: IntegrationRecord): Promise<void> {
		if (row.tenantId && row.organizationId) {
			await this.store.purgeLookupCache({ tenantId: row.tenantId, organizationId: row.organizationId });
		}
	}

	/** `auto_check`: whether a contact is checked when it is opened (off unless an administrator turns it on). */
	async options(link: LinkRecord): Promise<Record<string, unknown>> {
		return { auto_check: await this.autoCheck(link) };
	}

	/** Whether a contact of this link's organization is checked when it is opened. */
	async autoCheck(link: LinkRecord): Promise<boolean> {
		if (!link.integrationTenantId) return false;
		return (await this.store.linkSetting(link.integrationTenantId, LOOKUP_AUTO_CHECK)) === 'true';
	}

	/**
	 * Turns "check a contact when it is opened" on or off for the organization (its link's setting).
	 * 409 `not_linked` without a link.
	 */
	async setAutoCheck(scope: OrganizationScope, autoCheck: boolean): Promise<{ auto_check: boolean }> {
		const link = await this.store.linkOf(scope.tenantId, scope.organizationId);
		if (!link || link.status === 'unlinked' || !link.integrationTenantId) {
			throw new HttpException(
				{
					statusCode: 409,
					code: 'not_linked',
					message: 'Link this organization to an Ever organization first.'
				},
				HttpStatus.CONFLICT
			);
		}
		const before = await this.autoCheck(link);
		if (before !== autoCheck) {
			await this.store.setLinkSetting(
				{ tenantId: link.tenantId, organizationId: link.organizationId },
				link.integrationTenantId,
				LOOKUP_AUTO_CHECK,
				String(autoCheck)
			);
			await this.audit.record({
				action: 'integration.configure',
				actorLabel: 'user',
				actorUserId: scope.userId,
				tenantId: link.tenantId,
				organizationId: link.organizationId,
				integration: COUNTERPARTY_LOOKUP,
				details: {
					link_id: link.linkId,
					from: before ? 'auto_check_on' : 'auto_check_off',
					to: autoCheck ? 'auto_check_on' : 'auto_check_off'
				}
			});
		}
		return { auto_check: autoCheck };
	}

	// ── The salts ──────────────────────────────────────────────────────────────

	/**
	 * The active salts (`GET /v1/lookup/salt`), read at most once a day (or now with `refresh`);
	 * concurrent callers share one read.
	 */
	async salts(options: { refresh?: boolean } = {}): Promise<ActiveSalt[]> {
		if (!options.refresh && this.saltDoc && this.now() - this.saltDoc.fetchedAt < LOOKUP_SALT_MS) {
			return this.saltDoc.salts;
		}
		if (this.saltRead) {
			return this.saltRead;
		}
		this.saltRead = (async () => {
			const doc = (await (await this.platform.getClient()).lookup.salt()) as {
				active?: ReadonlyArray<{ version?: unknown; salt?: unknown; active_from?: unknown }>;
				normalization_version?: unknown;
			};
			if (doc?.normalization_version !== NORMALIZATION_VERSION) {
				throw new HttpException(
					{
						statusCode: 502,
						code: 'lookup_unsupported',
						message: 'Ever Platform answered salts this release cannot use.'
					},
					HttpStatus.BAD_GATEWAY
				);
			}
			const salts: ActiveSalt[] = [];
			for (const entry of doc.active ?? []) {
				if (
					Number.isSafeInteger(entry?.version) &&
					(entry.version as number) >= 1 &&
					typeof entry.salt === 'string' &&
					SALT.test(entry.salt)
				) {
					const activeFrom =
						typeof entry.active_from === 'string' ? Date.parse(entry.active_from) : Number.NaN;
					salts.push({
						version: entry.version as number,
						salt: entry.salt,
						activeFrom: Number.isFinite(activeFrom) ? activeFrom : null
					});
				}
			}
			if (!salts.length) {
				throw new HttpException(
					{ statusCode: 502, code: 'lookup_unsupported', message: 'Ever Platform answered no usable salt.' },
					HttpStatus.BAD_GATEWAY
				);
			}
			this.saltDoc = { fetchedAt: this.now(), salts };
			return salts;
		})().finally(() => {
			this.saltRead = null;
		});
		return this.saltRead;
	}

	// ── A check ────────────────────────────────────────────────────────────────

	/**
	 * Checks the identifiers of one contact for the organization of `scope`. Throws 403
	 * `integration_disabled` / `entitlement_required` before anything is sent, 429 (with the seconds
	 * to wait) when the organization checked too often, 502 when Ever Platform cannot answer.
	 */
	async check(scope: OrganizationScope, items: LookupItem[]): Promise<LookupResponse> {
		const link = await this.gate(scope);
		const prepared = items.map((item) => this.normalise(item));
		if (!prepared.some((entry) => entry.normalized !== null)) {
			// Nothing can be checked: nothing is sent, not even a salt read.
			return { items: prepared.map((entry) => entry.result as LookupItemResult) };
		}
		try {
			return await this.attempt(scope, link, prepared, false);
		} catch (error) {
			throw this.problem(error);
		}
	}

	/**
	 * Throws unless the organization of `scope` may check now: connected, linked, the integration
	 * enabled for its link and not denied here, and `features.lookup` granted by its entitlement.
	 */
	private async gate(scope: OrganizationScope): Promise<LinkRecord> {
		const disabled = () =>
			new ForbiddenException({
				statusCode: 403,
				code: 'integration_disabled',
				message: 'Checking contacts on Ever Platform is not enabled for this organization.'
			});
		const connection = await this.store.connection();
		if (connection.status !== 'connected' || (await this.states.deniedBy(COUNTERPARTY_LOOKUP))) {
			throw disabled();
		}
		const link = await this.store.linkOf(scope.tenantId, scope.organizationId);
		if (!link || link.status !== 'linked') {
			throw disabled();
		}
		const row = await this.store.integration(link.linkId, COUNTERPARTY_LOOKUP);
		if (!row?.enabled || row.state !== 'enabled') {
			throw disabled();
		}
		const feature = requiredFeature(COUNTERPARTY_LOOKUP);
		if (feature) {
			const { features } = await this.entitlements.features(scope.tenantId, scope.organizationId);
			if (features[feature] !== true) {
				throw new ForbiddenException({
					statusCode: 403,
					code: 'entitlement_required',
					message: 'Checking contacts is not included for this organization on Ever Platform.'
				});
			}
		}
		return link;
	}

	/** One identifier, normalised; one that cannot be normalised is answered here. */
	private normalise(item: LookupItem): {
		item: LookupItem;
		normalized: string | null;
		result: LookupItemResult | null;
	} {
		const outcome = normaliseItem(item);
		return 'normalized' in outcome
			? { item, normalized: outcome.normalized, result: null }
			: {
					item,
					normalized: null,
					result: { kind: item.kind, status: 'cannot_be_checked', reason: outcome.reason }
				};
	}

	private async attempt(
		scope: OrganizationScope,
		link: LinkRecord,
		prepared: Array<{ item: LookupItem; normalized: string | null; result: LookupItemResult | null }>,
		retried: boolean
	): Promise<LookupResponse> {
		const now = this.now();
		const salt = currentSalt(await this.salts({ refresh: retried }), now);
		const hashes = prepared.map((entry) =>
			entry.normalized === null ? null : hashOf(entry.item.kind, entry.normalized, salt)
		);
		const unique = new Map<string, { kind: string; hash: string }>();
		prepared.forEach((entry, index) => {
			const hash = hashes[index];
			if (hash) unique.set(`${entry.item.kind}:${hash}`, { kind: entry.item.kind, hash });
		});
		const owner = { tenantId: scope.tenantId, organizationId: scope.organizationId };
		await this.store.purgeLookupCache(owner, now);
		const answers = await this.store.lookupCacheRead(scope.organizationId, salt.version, [...unique.values()], now);
		const missing = [...unique.entries()].filter(([slot]) => !answers.has(slot));
		if (missing.length) {
			this.takeSlot(scope.organizationId, now);
			let matches: ReadonlyArray<{ hash: string; handle: string; features: ReadonlyArray<string> }>;
			try {
				const answer = await (
					await this.platform.getClient()
				).lookup.query(link.linkId, {
					salt_version: salt.version,
					hashes: missing.map(([, entry]) => entry.hash)
				});
				matches = (answer?.matches ?? []) as typeof matches;
			} catch (error) {
				if (
					!retried &&
					error instanceof ProblemError &&
					error.status === 422 &&
					(error.code === 'salt_version_unknown' || error.code === 'salt_version_retired')
				) {
					// The salts changed since they were read: read them again, once.
					return this.attempt(scope, link, prepared, true);
				}
				throw error;
			}
			for (const [slot, entry] of missing) {
				const found = matches.find((match) => match.hash === entry.hash);
				const match = found ? this.match(found) : null;
				const result = match ? JSON.stringify(match) : null;
				answers.set(slot, result);
				await this.store.lookupCacheWrite(owner, {
					kind: entry.kind,
					hash: entry.hash,
					saltVersion: salt.version,
					result,
					expiresAt: now + (match ? LOOKUP_POSITIVE_MS : LOOKUP_NEGATIVE_MS)
				});
			}
		}
		return {
			items: prepared.map((entry, index) => {
				if (entry.result) return entry.result;
				const kept = answers.get(`${entry.item.kind}:${hashes[index]}`) ?? null;
				const match = kept ? this.parse(kept) : null;
				return match
					? { kind: entry.item.kind, status: 'match', handle: match.handle, features: match.features }
					: { kind: entry.item.kind, status: 'none' };
			})
		};
	}

	/** A match with a handle of Ever Platform's shape; `null` for anything else. */
	private match(found: { handle?: unknown; features?: unknown }): Match | null {
		const handle = typeof found.handle === 'string' ? found.handle : '';
		if (handle.length < 3 || handle.length > 30 || !HANDLE.test(handle)) {
			return null;
		}
		const features = Array.isArray(found.features)
			? found.features.filter(
					(feature): feature is string => typeof feature === 'string' && FEATURE.test(feature)
				)
			: [];
		return { handle, features };
	}

	private parse(kept: string): Match | null {
		try {
			return this.match(JSON.parse(kept) as { handle?: unknown; features?: unknown });
		} catch {
			return null;
		}
	}

	/** The local limit: at most 30 checks asking Ever Platform per organization and minute (429 beyond). */
	private takeSlot(organizationId: string, now: number): void {
		const recent = (this.recent.get(organizationId) ?? []).filter((at) => at > now - 60_000);
		if (recent.length >= LOOKUP_LOCAL_PER_MINUTE) {
			this.recent.set(organizationId, recent);
			throw new LookupRateLimitedError(Math.max(1, Math.ceil((recent[0] + 60_000 - now) / 1000)));
		}
		recent.push(now);
		this.recent.set(organizationId, recent);
		if (this.recent.size > 10_000) {
			const first = this.recent.keys().next().value;
			if (first !== undefined && first !== organizationId) this.recent.delete(first);
		}
	}

	/** An HTTP answer for a failed check: codes only, never a value or a hash. */
	private problem(error: unknown): unknown {
		if (error instanceof HttpException) {
			return error;
		}
		if (isCredentialRevoked(error)) {
			this.signals.revoked$.next();
		}
		if (error instanceof ProblemError) {
			if (
				error.status === 403 &&
				['integration_disabled', 'integration_revoked', 'entitlement_required'].includes(error.code)
			) {
				return new ForbiddenException({
					statusCode: 403,
					code: error.code === 'integration_revoked' ? 'integration_disabled' : error.code,
					message: 'Ever Platform did not allow this check.'
				});
			}
			if (error.status === 429) {
				return new LookupRateLimitedError(Math.max(1, Math.ceil(error.retryAfterS ?? 60)));
			}
		}
		const code = isUnreachable(error) ? 'platform_unreachable' : 'lookup_failed';
		this.logger.warn(`A contact could not be checked on Ever Platform (${errorCode(error)}).`);
		return new HttpException(
			{
				statusCode: 502,
				code,
				message:
					code === 'platform_unreachable'
						? 'Ever Platform could not be reached.'
						: 'Ever Platform could not answer.'
			},
			HttpStatus.BAD_GATEWAY
		);
	}
}
