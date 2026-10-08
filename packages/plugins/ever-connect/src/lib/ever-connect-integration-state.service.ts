import {
	ConflictException,
	HttpException,
	HttpStatus,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	Optional
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { EverInstanceService } from '@gauzy/plugin-ever-instance';
import { EverConnectAuditService } from './ever-connect-audit.service';
import { deniedByEnv } from './ever-connect-config';
import type { EverConnectConfig } from './ever-connect-config';
import {
	EVER_CONNECT_CLOCK,
	EVER_CONNECT_SETTINGS,
	IntegrationLocalState,
	RevokeSource
} from './ever-connect.constants';
import {
	EverConnectPlatformService,
	errorCode,
	isCredentialRevoked,
	isUnreachable
} from './ever-connect-platform.service';
import { EverConnectSignals } from './ever-connect-signals';
import { EverConnectStore, IntegrationRecord, LinkRecord } from './ever-connect.store';
import {
	GAUZY_INTEGRATIONS,
	gauzyIntegration,
	GauzyIntegrationDefinition,
	offeredOn,
	sharedDefinition
} from './integrations/integration-definitions';
import { CONSTANTS, IntegrationKey, ProblemError, signCompactJws } from './sdk';

/** The platform's brief state of one integration. */
interface RemoteState {
	enabled: boolean;
	state: string;
	consent_id?: string | null;
	scope_version?: number | null;
}

/** Who asks, in which organization. */
export interface IntegrationContext {
	tenantId: string;
	organizationId: string;
	userId: string | null;
	isOperator: boolean;
}

/** One integration as the Integrations & data tab shows it. */
export interface IntegrationView {
	key: string;
	name: string;
	description: string;
	direction: string;
	instance_wide: boolean;
	app_ever_co_only: boolean;
	scope_version: number;
	scope: Array<{
		field_path: string;
		direction: string;
		form: string;
		frequency: string;
		purpose: string;
		retention: string;
	}>;
	revoke_effect: string;
	state: IntegrationLocalState | 'not_linked';
	enabled: boolean;
	pending_remote_revoke: boolean;
	revoke_source: string | null;
	revoked_at: string | null;
	consent: { id: string; at: string | null; source: string | null } | null;
	policy: 'allowed' | 'denied_by_env' | 'denied_by_policy';
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const isoMs = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

/** A page asking to re-read the states reads them at most once in this time (per process). */
export const SYNC_COALESCE_MS = 30_000;

/** Whether writing `values` would change nothing of `before`. */
function unchanged(before: IntegrationRecord, values: Partial<Record<keyof IntegrationRecord, unknown>>): boolean {
	return Object.entries(values).every(([column, value]) => {
		const current = before[column as keyof IntegrationRecord] ?? null;
		return (value ?? null) === current;
	});
}

/**
 * Whether a consent link from Ever Platform may be opened: https, on app.ever.co or on a host of the
 * registrable domain of `EVER_PLATFORM_API_URL` (`api-dev.ever.co` → `*.ever.co`).
 */
export function consentLinkAllowed(link: string, apiUrl: string | null): boolean {
	let url: URL;
	try {
		url = new URL(link);
	} catch {
		return false;
	}
	if (url.protocol !== 'https:' || url.username || url.password) {
		return false;
	}
	const host = url.hostname.toLowerCase();
	if (host === 'app.ever.co') {
		return true;
	}
	let apiHost: string | null = null;
	try {
		apiHost = apiUrl ? new URL(apiUrl).hostname.toLowerCase() : null;
	} catch {
		apiHost = null;
	}
	if (!apiHost || /^[0-9.]+$/.test(apiHost) || apiHost.includes(':') || !apiHost.includes('.')) {
		return false;
	}
	const domain = apiHost.split('.').slice(-2).join('.');
	return host === domain || host.endsWith(`.${domain}`);
}

/**
 * The integration states of this installation, and the only paths that change them:
 *
 * - Ever Platform's states are read (`GET /v1/instances/me/integrations`) and applied here; an
 *   integration is `enabled` only when Ever Platform holds a consent for it. Nothing switches one on
 *   from this side: an administrator consents in app.ever.co (the consent link), and an
 *   installation-wide integration also needs its operator's accept here.
 * - Switching off works offline: the local state goes off first and Ever Platform is told when it
 *   can be reached.
 * - The operator's policy (and `EVER_CONNECT_INTEGRATIONS_DENY`, which wins) denies an integration
 *   for every organization.
 *
 * In this release only `instance_url` and `stats_link` can be enabled; every other integration reads
 * "coming soon" whatever Ever Platform says, and nothing of it moves.
 */
@Injectable()
export class EverConnectIntegrationStateService {
	private readonly logger = new Logger('EverConnect');
	private readonly now: () => number;
	/** Integrations whose local effect failed and is retried at the next heartbeat. */
	private readonly retry = new Set<string>();
	/** The read of Ever Platform's states in progress, shared by concurrent callers. */
	private syncing: Promise<void> | null = null;
	/** When the states were last read (for coalescing reads from page views). */
	private lastSyncAt: number | null = null;

	constructor(
		private readonly platform: EverConnectPlatformService,
		private readonly store: EverConnectStore,
		private readonly audit: EverConnectAuditService,
		private readonly signals: EverConnectSignals,
		private readonly instance: EverInstanceService,
		@Inject(EVER_CONNECT_SETTINGS) private readonly config: EverConnectConfig,
		@Optional() @Inject(EVER_CONNECT_CLOCK) clock?: { now: () => number }
	) {
		this.now = clock?.now ?? (() => Date.now());
	}

	/** The integrations Gauzy offers on this installation (never `stats_link` on Ever Cloud). */
	offered(): GauzyIntegrationDefinition[] {
		return GAUZY_INTEGRATIONS.filter((definition) => offeredOn(definition, this.config.cloud));
	}

	/** Whether the operator (or the environment) denies `key` for every organization. */
	async deniedBy(key: string): Promise<'env' | 'policy' | null> {
		if (deniedByEnv(this.config, key)) {
			return 'env';
		}
		const policy = (await this.store.policies()).find((row) => row.integration === key);
		return policy && !policy.allowed ? 'policy' : null;
	}

	/** The whole local deny list (the heartbeat reports it): the environment's, then the operator's. */
	async deniedKeys(): Promise<string[]> {
		if (this.config.deny.includes('*')) {
			return ['*'];
		}
		const ui = (await this.store.policies()).filter((row) => !row.allowed).map((row) => row.integration);
		return [...new Set([...this.config.deny, ...ui])].sort((a, b) => a.localeCompare(b));
	}

	// ── Reading Ever Platform's states ────────────────────────────────────────

	/**
	 * Reads Ever Platform's states and applies them: a state that became `enabled` runs the
	 * integration's local effect (once), one that went off stops it, and each change is audited as
	 * Ever Platform's. Without `force` (a page asking to re-read), at most one read every 30 seconds
	 * per process; concurrent calls share one read.
	 */
	async sync(options: { force?: boolean } = {}): Promise<void> {
		if (this.syncing) {
			return this.syncing;
		}
		if (!options.force && this.lastSyncAt !== null && this.now() - this.lastSyncAt < SYNC_COALESCE_MS) {
			return;
		}
		this.syncing = this.syncOnce().finally(() => {
			this.syncing = null;
		});
		return this.syncing;
	}

	private async syncOnce(): Promise<void> {
		const connection = await this.store.connection();
		if (connection.status !== 'connected' || !connection.platformInstanceId) {
			return;
		}
		const remote = await this.guard(async () => (await this.platform.getClient()).instances.integrations());
		this.lastSyncAt = this.now();
		const instanceStates = (remote.instance ?? {}) as Record<string, RemoteState>;
		const linkStates = (remote.links ?? {}) as Record<string, Record<string, RemoteState>>;
		const links = await this.store.liveLinks();
		for (const definition of this.offered()) {
			if (definition.instanceWide) {
				await this.apply('instance', definition, instanceStates[definition.key], {});
				continue;
			}
			for (const link of links) {
				await this.apply(link.linkId, definition, linkStates[link.linkId]?.[definition.key], link);
			}
		}
	}

	private async apply(
		scope: string,
		definition: GauzyIntegrationDefinition,
		remote: RemoteState | undefined,
		owner: Partial<LinkRecord>
	): Promise<void> {
		const key = definition.key;
		const before = await this.store.integration(scope, key);
		const denied = await this.deniedBy(key);
		let state: IntegrationLocalState = 'available';
		let revokeSource: RevokeSource | null = before?.revokeSource as RevokeSource | null;
		let operatorAccept: string | null = before?.operatorAccept ?? null;
		if (!definition.available) {
			state = 'coming_soon';
		} else if (denied) {
			state = 'denied_by_policy';
			revokeSource = denied === 'env' ? 'env' : 'policy';
		} else if (remote) {
			state = this.localState(remote.state);
			const sameConsent = Boolean(remote.consent_id) && remote.consent_id === before?.consentId;
			// The operator's accept holds for one consent: a new consent waits for a new accept.
			operatorAccept = sameConsent ? (before?.operatorAccept ?? null) : null;
			if (
				definition.instanceWide &&
				!this.config.cloud &&
				state === 'enabled' &&
				operatorAccept !== 'accepted'
			) {
				// Ever Platform reads `enabled`, but the operator did not accept this consent here: an
				// installation-wide integration runs only after their local accept.
				state = 'pending_operator';
			}
			if (state === 'pending_operator' && operatorAccept !== 'accepted') {
				operatorAccept = 'pending';
			}
			if ((state === 'enabled' || state === 'pending_operator') && before?.pendingRemoteRevoke) {
				// Switched off here while Ever Platform could not be told: off it stays.
				state = 'disabled';
			}
			if (state === 'revoked_remote') {
				if (before?.revokeSource === 'operator') {
					// The operator declined it here: it reads "disabled", declined by the operator.
					state = 'disabled';
				} else {
					revokeSource = 'platform';
				}
			}
			if (state === 'enabled' || state === 'pending_operator') {
				revokeSource = null;
			}
		}
		const enabled = state === 'enabled';
		const consentId = remote?.consent_id ?? null;
		const values: Partial<Record<keyof IntegrationRecord, unknown>> = {
			state,
			enabled,
			scopeVersion: remote?.scope_version ?? before?.scopeVersion ?? null,
			consentId,
			revokeSource,
			operatorAccept
		};
		if (consentId && consentId !== before?.consentId) {
			values.consentedAt = this.now();
			values.consentSource = 'app_ever_co';
		}
		if (state === 'revoked_remote' && before?.state !== 'revoked_remote') {
			values.revokedAt = this.now();
		}
		if (before && unchanged(before, values)) {
			// Nothing changed: no write.
			return;
		}
		const after = await this.store.saveIntegration(scope, key, values, {
			tenantId: owner.tenantId ?? null,
			organizationId: owner.organizationId ?? null,
			integrationTenantId: owner.integrationTenantId ?? null
		});
		const where = {
			tenantId: owner.tenantId ?? null,
			organizationId: owner.organizationId ?? null,
			integration: key
		};
		if (consentId && consentId !== before?.consentId) {
			await this.audit.record({
				action: 'consent.grant',
				actorLabel: 'platform',
				...where,
				details: { consent_id: consentId, state }
			});
		}
		if (!before?.enabled && enabled) {
			await this.onEnable(after);
			await this.audit.record({
				action: 'integration.enable',
				actorLabel: 'platform',
				...where,
				details: { consent_id: consentId, state }
			});
		} else if (before?.enabled && !enabled) {
			await this.onDisable(after);
			await this.audit.record({
				action: 'integration.disable',
				actorLabel: 'platform',
				...where,
				details: { state, reason: revokeSource }
			});
		}
		if (state === 'revoked_remote' && before?.state !== 'revoked_remote' && before?.consentId) {
			await this.audit.record({
				action: 'consent.revoke',
				actorLabel: 'platform',
				...where,
				details: { consent_id: before.consentId, source: revokeSource }
			});
		}
	}

	private localState(remote: string): IntegrationLocalState {
		switch (remote) {
			case 'enabled':
				return 'enabled';
			case 'pending_operator':
				return 'pending_operator';
			case 'revoked':
				return 'revoked_remote';
			case 'disabled':
				return 'disabled';
			case 'denied_by_policy':
				return 'denied_by_policy';
			case 'coming_soon':
				return 'coming_soon';
			default:
				return 'available';
		}
	}

	// ── What an organization sees ─────────────────────────────────────────────

	/** Every integration offered, with this organization's state (installation-wide ones too). */
	async list(context: IntegrationContext): Promise<IntegrationView[]> {
		const link = await this.store.linkOf(context.tenantId, context.organizationId);
		const views: IntegrationView[] = [];
		for (const definition of this.offered()) {
			const scope = definition.instanceWide ? 'instance' : link?.linkId;
			const row = scope ? await this.store.integration(scope, definition.key) : null;
			views.push(await this.view(definition, row, Boolean(scope)));
		}
		return views;
	}

	private async view(
		definition: GauzyIntegrationDefinition,
		row: IntegrationRecord | null,
		scoped: boolean
	): Promise<IntegrationView> {
		const shared = sharedDefinition(definition.key);
		const denied = await this.deniedBy(definition.key);
		let state: IntegrationView['state'] = row?.state as IntegrationLocalState;
		if (!definition.available) state = 'coming_soon';
		else if (denied) state = 'denied_by_policy';
		else if (!scoped) state = 'not_linked';
		else if (!row) state = 'available';
		return {
			key: definition.key,
			name: shared.name,
			description: shared.description,
			direction: shared.direction,
			instance_wide: definition.instanceWide,
			app_ever_co_only: definition.appEverCoOnly,
			scope_version: definition.scopeVersion,
			scope: shared.scope.map((row) => ({
				field_path: row.field_path,
				direction: row.direction,
				form: row.form,
				frequency: row.frequency,
				purpose: row.purpose,
				retention: row.retention
			})),
			revoke_effect: shared.revoke_effect,
			state,
			enabled: state === 'enabled',
			pending_remote_revoke: row?.pendingRemoteRevoke ?? false,
			revoke_source: row?.revokeSource ?? null,
			revoked_at: isoMs(row?.revokedAt ?? null),
			consent: row?.consentId
				? { id: row.consentId, at: isoMs(row.consentedAt), source: row.consentSource }
				: null,
			policy: denied === 'env' ? 'denied_by_env' : denied === 'policy' ? 'denied_by_policy' : 'allowed'
		};
	}

	/** The installation-wide integrations waiting for the operator's accept. */
	async pendingApprovals(): Promise<IntegrationView[]> {
		// Accepted ones wait for Ever Platform, not for the operator.
		const rows = (await this.store.integrations({ scope: 'instance' })).filter(
			(row) => row.state === 'pending_operator' && row.operatorAccept !== 'accepted'
		);
		const views: IntegrationView[] = [];
		for (const row of rows) {
			const definition = gauzyIntegration(row.name);
			if (definition && offeredOn(definition, this.config.cloud)) {
				views.push(await this.view(definition, row, true));
			}
		}
		return views;
	}

	// ── Consent, switching off, accepting ─────────────────────────────────────

	/** The definition of an offered key, else 404. */
	private offeredDefinition(key: string): GauzyIntegrationDefinition {
		const definition = gauzyIntegration(key);
		if (!definition || !offeredOn(definition, this.config.cloud)) {
			throw new NotFoundException();
		}
		return definition;
	}

	/** The scope of `key` for this organization: `instance`, or its link (409 when it has none). */
	private async scopeOf(
		definition: GauzyIntegrationDefinition,
		context: IntegrationContext
	): Promise<{ scope: string; link: LinkRecord | null }> {
		if (definition.instanceWide) {
			return { scope: 'instance', link: null };
		}
		const link = await this.store.linkOf(context.tenantId, context.organizationId);
		if (!link || link.status !== 'linked') {
			throw new ConflictException({
				statusCode: 409,
				code: 'not_linked',
				message: 'Link this organization to an Ever organization first.'
			});
		}
		return { scope: link.linkId, link };
	}

	/**
	 * The app.ever.co consent link for `key` (`GET /v1/instances/me/consent-url`). The instance policy
	 * is checked first: a denied integration answers 409 without any call.
	 */
	async consentUrl(key: string, context: IntegrationContext): Promise<{ url: string; expires_at: string }> {
		const definition = this.offeredDefinition(key);
		if (definition.instanceWide && !context.isOperator) {
			throw new NotFoundException();
		}
		if (await this.deniedBy(key)) {
			throw new ConflictException({
				statusCode: 409,
				code: 'denied_by_policy',
				message: 'The operator of this installation does not allow this integration.'
			});
		}
		if (!definition.available) {
			throw new ConflictException({
				statusCode: 409,
				code: 'not_available',
				message: 'This integration is not available yet.'
			});
		}
		await this.requireConnected();
		const { scope, link } = await this.scopeOf(definition, context);
		const row = await this.store.integration(scope, key);
		if (row?.state === 'enabled' || row?.state === 'pending_operator') {
			throw new ConflictException({
				statusCode: 409,
				code: row.state === 'enabled' ? 'already_enabled' : 'pending_operator',
				message: 'Nothing to consent to.'
			});
		}
		let answer: { url: string; expires_at: string };
		try {
			answer = await this.guard(async () =>
				(await this.platform.getClient()).instances.consentUrl({
					integration: key,
					...(link ? { link: link.linkId } : {}),
					...(this.config.returnUrl ? { return: this.config.returnUrl } : {})
				})
			);
		} catch (error) {
			throw this.problem(error);
		}
		if (!consentLinkAllowed(String(answer?.url ?? ''), this.config.apiUrl)) {
			// Only an https link to Ever Platform's web app is passed to the browser.
			throw new HttpException(
				{ statusCode: 502, code: 'consent_url_invalid', message: 'Ever Platform answered an unusable consent link.' },
				HttpStatus.BAD_GATEWAY
			);
		}
		return { url: answer.url, expires_at: answer.expires_at };
	}

	/**
	 * `{enabled: true}` never switches an integration on from here: 409 `consent_required` (with the
	 * consent link when it can be had). `{enabled: false}` switches it off here first, always (nothing
	 * of it runs any more), then tells Ever Platform; whatever Ever Platform answers (a redirect, a
	 * refusal, no answer), the integration stays off and Ever Platform is told again at each heartbeat
	 * until it takes it.
	 */
	async setEnabled(key: string, enabled: boolean, context: IntegrationContext): Promise<IntegrationView> {
		const definition = this.offeredDefinition(key);
		if (definition.instanceWide && !context.isOperator) {
			throw new NotFoundException();
		}
		if (enabled) {
			let url: string | null = null;
			try {
				url = (await this.consentUrl(key, context)).url;
			} catch {
				url = null;
			}
			throw new ConflictException({
				statusCode: 409,
				code: 'consent_required',
				message: 'An administrator enables this integration in app.ever.co.',
				url
			});
		}
		const { scope, link } = definition.instanceWide
			? { scope: 'instance', link: null }
			: await this.scopeOf(definition, context);
		const row = await this.store.integration(scope, key);
		if (!row || (!row.enabled && row.state !== 'pending_operator')) {
			return this.view(definition, row, true);
		}
		let after = await this.store.saveIntegration(scope, key, {
			state: 'disabled',
			enabled: false,
			revokeSource: 'instance',
			revokedAt: this.now(),
			pendingRemoteRevoke: true,
			operatorAccept: row.state === 'pending_operator' ? null : row.operatorAccept
		});
		if (row.enabled) {
			await this.onDisable(after);
		}
		const remote = await this.tellOff(after);
		after = (await this.store.integration(scope, key)) ?? after;
		await this.audit.record({
			action: 'integration.disable',
			actorLabel: context.isOperator && definition.instanceWide ? 'operator' : 'user',
			actorUserId: context.userId,
			tenantId: link?.tenantId ?? null,
			organizationId: link?.organizationId ?? null,
			integration: key,
			details: { reason: 'instance', remote }
		});
		return this.view(definition, after, true);
	}

	/**
	 * The operator's local accept (or decline) of an installation-wide integration the connecting
	 * organization consented to: the only path that switches one on, also when Ever Platform already
	 * reads it as enabled. The accept is told to Ever Platform
	 * (`POST /v1/instances/me/integrations/{key}/accept`) and holds for this consent only; the local
	 * effect runs once Ever Platform reads it as enabled with this consent.
	 */
	async accept(key: string, accepted: boolean, actorUserId: string | null): Promise<IntegrationView> {
		const definition = this.offeredDefinition(key);
		if (!definition.instanceWide) {
			throw new NotFoundException();
		}
		const row = await this.store.integration('instance', key);
		if (!row || row.state !== 'pending_operator' || !row.consentId) {
			throw new ConflictException({
				statusCode: 409,
				code: 'not_pending',
				message: 'Nothing waits for your approval for this integration.'
			});
		}
		const connection = await this.requireConnected();
		const consentId = row.consentId;
		let answer: RemoteState | null;
		try {
			answer = (await this.guard(async () =>
				(await this.platform.getClient()).instances.acceptIntegration(
					key,
					{ consent_id: consentId, accepted },
					sha256(`accept|${connection.platformInstanceId}|${key}|${consentId}|${accepted}`)
				)
			)) as RemoteState;
		} catch (error) {
			if (!(accepted && error instanceof ProblemError && error.status === 409)) {
				throw this.problem(error);
			}
			// Ever Platform does not wait for this accept (it reads the consent as enabled already):
			// the accept is this installation's own, for that same consent.
			answer = await this.remoteInstanceState(key);
			if (answer?.state !== 'enabled' || answer.consent_id !== consentId) {
				throw this.problem(error);
			}
		}
		const where = { tenantId: null, organizationId: null, integration: key };
		if (accepted && (answer?.state !== 'enabled' || (answer.consent_id && answer.consent_id !== consentId))) {
			// Accepted, but Ever Platform does not read it as enabled yet: it stays waiting, accepted
			// for this consent, and starts when Ever Platform enables it.
			const waiting = await this.store.saveIntegration('instance', key, { operatorAccept: 'accepted' });
			return this.view(definition, waiting, true);
		}
		if (accepted) {
			const after = await this.store.saveIntegration('instance', key, {
				state: 'enabled',
				enabled: true,
				operatorAccept: 'accepted',
				revokeSource: null
			});
			await this.onEnable(after);
			await this.audit.record({
				action: 'integration.enable',
				actorLabel: 'operator',
				actorUserId,
				...where,
				details: { consent_id: consentId, state: 'enabled' }
			});
			return this.view(definition, after, true);
		}
		const after = await this.store.saveIntegration('instance', key, {
			state: 'disabled',
			enabled: false,
			operatorAccept: 'declined',
			revokeSource: 'operator',
			revokedAt: this.now()
		});
		await this.audit.record({
			action: 'consent.revoke',
			actorLabel: 'operator',
			actorUserId,
			...where,
			details: { consent_id: consentId, source: 'operator' }
		});
		return this.view(definition, after, true);
	}

	// ── The operator's policy ─────────────────────────────────────────────────

	async policyList(): Promise<
		Array<{ key: string; name: string; allowed: boolean; source: 'env' | 'ui' | 'default' }>
	> {
		const rows = await this.store.policies();
		return this.offered().map((definition) => {
			const row = rows.find((policy) => policy.integration === definition.key);
			const env = deniedByEnv(this.config, definition.key);
			return {
				key: definition.key,
				name: sharedDefinition(definition.key).name,
				allowed: !env && (row ? row.allowed : true),
				source: env ? 'env' : row ? 'ui' : 'default'
			};
		});
	}

	/**
	 * Allows or denies `key` for every organization. A deny switches it off everywhere at once (and on
	 * Ever Platform when it can be reached; the next heartbeat carries the deny list anyway). The
	 * environment's deny cannot be lifted here (409).
	 */
	async setPolicy(key: string, allowed: boolean, actorUserId: string | null): Promise<void> {
		this.offeredDefinition(key);
		if (deniedByEnv(this.config, key)) {
			throw new ConflictException({
				statusCode: 409,
				code: 'denied_by_env',
				message: 'EVER_CONNECT_INTEGRATIONS_DENY denies this integration.'
			});
		}
		await this.store.setPolicy(key, allowed, actorUserId);
		await this.audit.record({
			action: 'policy.change',
			actorLabel: 'operator',
			actorUserId,
			integration: key,
			details: { allowed }
		});
		if (!allowed) {
			const wereOn: IntegrationRecord[] = [];
			for (const row of await this.store.integrations({ name: key })) {
				if (row.state === 'coming_soon' || row.state === 'denied_by_policy') continue;
				const after = await this.store.saveIntegration(row.scope, key, {
					state: 'denied_by_policy',
					enabled: false,
					revokeSource: 'policy',
					revokedAt: this.now()
				});
				if (row.enabled) {
					wereOn.push(after);
					await this.onDisable(after);
					await this.audit.record({
						action: 'integration.disable',
						actorLabel: 'operator',
						actorUserId,
						tenantId: row.tenantId,
						organizationId: row.organizationId,
						integration: key,
						details: { reason: 'policy' }
					});
				}
			}
			await this.tellPolicy(key, wereOn);
		}
		this.signals.heartbeat$.next();
	}

	/**
	 * Tells Ever Platform about a deny now (`reason: policy` denies the key on every link of this
	 * installation). The heartbeat a second later carries the whole deny list anyway; when this call
	 * fails, the rows that were on are also marked to be told again at each heartbeat.
	 */
	private async tellPolicy(key: string, wereOn: IntegrationRecord[]): Promise<void> {
		const connection = await this.store.connection();
		if (connection.status !== 'connected') return;
		const definition = gauzyIntegration(key);
		const link = definition?.instanceWide ? null : (await this.store.liveLinks())[0];
		if (!definition?.instanceWide && !link) return;
		try {
			await this.guard(async () =>
				(await this.platform.getClient()).instances.setIntegration(key, {
					enabled: false,
					reason: 'policy',
					...(link ? { tenant_link_id: link.linkId } : {})
				})
			);
		} catch (error) {
			for (const row of wereOn) {
				await this.store.saveIntegration(row.scope, row.name, { pendingRemoteRevoke: true });
			}
			this.logger.warn(
				`Ever Platform was not told about the deny of ${key} now (${errorCode(error)}); the next heartbeat carries it.`
			);
		}
	}

	/**
	 * Tells Ever Platform that an integration was switched off here. Never throws: on a 2xx or a 404
	 * (already off there) the pending mark is cleared; on any other outcome it stays, for the next
	 * heartbeat. Returns whether Ever Platform took it.
	 */
	private async tellOff(row: IntegrationRecord): Promise<boolean> {
		const connection = await this.store.connection();
		if (connection.status !== 'connected' || !connection.platformInstanceId) {
			return false;
		}
		try {
			await this.guard(async () =>
				(await this.platform.getClient()).instances.setIntegration(row.name, {
					enabled: false,
					reason: 'instance',
					...(row.scope !== 'instance' ? { tenant_link_id: row.scope } : {})
				})
			);
		} catch (error) {
			if (!(error instanceof ProblemError && error.status === 404)) {
				this.logger.warn(
					`Ever Platform was not told now that ${row.name} is off (${errorCode(error)}); it is off here, and told again at the next heartbeat.`
				);
				return false;
			}
		}
		await this.store.saveIntegration(row.scope, row.name, { pendingRemoteRevoke: false });
		return true;
	}

	/** Ever Platform's state of one installation-wide integration, read now. */
	private async remoteInstanceState(key: string): Promise<RemoteState | null> {
		const remote = await this.guard(async () => (await this.platform.getClient()).instances.integrations());
		return ((remote.instance ?? {}) as Record<string, RemoteState>)[key] ?? null;
	}

	// ── Local effects ─────────────────────────────────────────────────────────

	/** Every integration off, here only (disconnect, revocation). */
	async allOffLocally(source: RevokeSource): Promise<void> {
		for (const row of await this.store.integrations()) {
			if (row.state === 'coming_soon') continue;
			const after = await this.store.saveIntegration(row.scope, row.name, {
				state: 'disabled',
				enabled: false,
				revokeSource: source,
				revokedAt: row.enabled ? this.now() : row.revokedAt,
				pendingRemoteRevoke: false,
				operatorAccept: row.state === 'pending_operator' ? null : row.operatorAccept
			});
			if (row.enabled) {
				await this.onDisable(after);
			}
		}
	}

	/** The integrations of one link off, here only (the link was removed). */
	async linkOffLocally(linkId: string): Promise<void> {
		for (const row of await this.store.integrations({ scope: linkId })) {
			if (row.state === 'coming_soon') continue;
			const after = await this.store.saveIntegration(linkId, row.name, {
				state: 'disabled',
				enabled: false,
				revokeSource: 'instance',
				pendingRemoteRevoke: false
			});
			if (row.enabled) {
				await this.onDisable(after);
			}
		}
	}

	/**
	 * At each heartbeat: tells Ever Platform about integrations switched off here that it has not
	 * taken yet, and retries a local effect that failed. One failure never stops the others, nor the
	 * rest of the heartbeat.
	 */
	async retryPending(): Promise<void> {
		for (const row of await this.store.integrations()) {
			if (!row.pendingRemoteRevoke) continue;
			await this.tellOff(row);
		}
		for (const slot of [...this.retry]) {
			const [scope, name] = slot.split('|');
			const row = await this.store.integration(scope, name);
			this.retry.delete(slot);
			if (row?.enabled) {
				await this.onEnable(row);
			}
		}
	}

	/** What an integration starts doing when it is enabled. */
	private async onEnable(row: IntegrationRecord): Promise<void> {
		try {
			if (row.name === 'stats_link' && !this.config.cloud) {
				await this.linkStatistics();
			}
		} catch (error) {
			if (isCredentialRevoked(error)) {
				this.signals.revoked$.next();
				return;
			}
			this.retry.add(`${row.scope}|${row.name}`);
			this.logger.warn(
				`The ${row.name} integration could not start (${errorCode(error)}); it is retried at the next heartbeat.`
			);
		}
	}

	/** What an integration stops doing when it is switched off. */
	private async onDisable(row: IntegrationRecord): Promise<void> {
		this.retry.delete(`${row.scope}|${row.name}`);
		if (row.name === 'instance_url') {
			await this.store.updateConnection({ publicUrl: null });
		}
	}

	/**
	 * `stats_link`: links this installation's anonymous statistics id to it (`POST
	 * /v1/instances/me/stats-link`). The statement is signed with the statistics key and names this
	 * installation; the call is made with the connect credential, so only an installation holding both
	 * keys can link them. Never on Ever Cloud.
	 */
	private async linkStatistics(): Promise<void> {
		const connection = await this.store.connection();
		const identity = await this.instance.ensure();
		const signer = await this.instance.statsSigner();
		try {
			const statsPublicJwk = { kty: 'OKP', crv: 'Ed25519', x: identity.statsPublicKey };
			const statement = await signCompactJws(
				(bytes) => signer.sign(bytes),
				{ typ: CONSTANTS.stats_link_typ },
				{
					stats_instance_id: identity.instanceId,
					stats_public_jwk: statsPublicJwk,
					sub: connection.platformInstanceId,
					iat: Math.floor(this.now() / 1000)
				}
			);
			await (
				await this.platform.getClient()
			).instances.statsLink(
				{
					stats_instance_id: identity.instanceId,
					stats_public_jwk: statsPublicJwk as never,
					statement_sig: statement
				},
				sha256(`stats-link|${connection.platformInstanceId}|${identity.instanceId}|${identity.statsKeyId}`)
			);
		} finally {
			signer.dispose();
		}
	}

	// ── The installation's public address ─────────────────────────────────────

	/**
	 * `PUT /ever-connect/public-url`: only once `instance_url` is enabled (consented in app.ever.co and
	 * accepted by the operator); 409 before. Ever Platform does not take the address from an
	 * installation yet, so nothing is sent: 503 until it does.
	 */
	async setPublicUrl(url: string): Promise<never> {
		const row = await this.store.integration('instance', 'instance_url');
		if (!row?.enabled) {
			throw new ConflictException({
				statusCode: 409,
				code: 'consent_required',
				message: 'Enable "Installation address" in app.ever.co first.'
			});
		}
		void url;
		throw new HttpException(
			{
				statusCode: 503,
				code: 'not_available',
				message: 'Ever Platform does not accept an installation address from here yet.'
			},
			HttpStatus.SERVICE_UNAVAILABLE
		);
	}

	// ── Helpers ───────────────────────────────────────────────────────────────

	/** An HTTP answer for a platform refusal: its code only, never its text. */
	private problem(error: unknown): unknown {
		if (isUnreachable(error)) {
			return new HttpException(
				{ statusCode: 502, code: 'platform_unreachable', message: 'Ever Platform could not be reached.' },
				HttpStatus.BAD_GATEWAY
			);
		}
		if (error instanceof ProblemError) {
			const status = [404, 409, 422].includes(error.status) ? error.status : 502;
			return new HttpException(
				{ statusCode: status, code: error.code, message: 'Ever Platform refused the request.' },
				status
			);
		}
		return error;
	}

	private async requireConnected() {
		const connection = await this.store.connection();
		if (connection.status !== 'connected' || !connection.platformInstanceId) {
			throw new ConflictException({
				statusCode: 409,
				code: 'not_connected',
				message: 'This installation is not connected to Ever Platform.'
			});
		}
		return connection;
	}

	/** Runs a platform call; `401 credential_revoked` signals the revocation before it is rethrown. */
	private async guard<T>(work: () => Promise<T>): Promise<T> {
		try {
			return await work();
		} catch (error) {
			if (isCredentialRevoked(error)) {
				this.signals.revoked$.next();
			}
			throw error;
		}
	}
}

/** Keys of the definitions (for specs). */
export const OFFERED_KEYS = (cloud: boolean): IntegrationKey[] =>
	GAUZY_INTEGRATIONS.filter((d) => offeredOn(d, cloud)).map((d) => d.key);
