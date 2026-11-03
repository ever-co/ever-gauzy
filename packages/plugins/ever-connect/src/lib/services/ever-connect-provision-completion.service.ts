import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { EverConnectAuditService } from '../ever-connect-audit.service';
import type { EverConnectConfig } from '../ever-connect-config';
import { EVER_CONNECT_CLOCK, EVER_CONNECT_SETTINGS } from '../ever-connect.constants';
import { EverConnectEntitlementService } from '../ever-connect-entitlement.service';
import { EverConnectIntegrationStateService } from '../ever-connect-integration-state.service';
import {
	EverConnectPlatformService,
	errorCode,
	isCredentialRevoked,
	isUnreachable
} from '../ever-connect-platform.service';
import { EverConnectProvisionStore, ProvisionResultRecord } from '../ever-connect-provision.store';
import { EverConnectSignals } from '../ever-connect-signals';
import { EverConnectStore, LiveLinkExistsError } from '../ever-connect.store';

/**
 * The waits between the attempts of a completion report: 1 minute, then longer, at most 4 hours; after
 * the 8th failed attempt the report is given up (`failed`, with its code, on the result row).
 */
export const COMPLETION_RETRY_MS: ReadonlyArray<number> = Object.freeze([
	60_000,
	4 * 60_000,
	15 * 60_000,
	30 * 60_000,
	3_600_000,
	2 * 3_600_000,
	4 * 3_600_000
]);

/** How many attempts a completion report gets. */
export const COMPLETION_MAX_ATTEMPTS = COMPLETION_RETRY_MS.length + 1;

/** How many due reports one pass sends at most. */
const COMPLETION_BATCH = 20;

/** How long one attempt holds a report (then another may take it, as for a stopped process). */
const COMPLETION_LEASE_MS = 2 * 60_000;

/** What an id of Ever Platform's (a link) may look like; anything else is not kept. */
const LINK_ID_SHAPE = /^[0-9A-Za-z_-]{8,64}$/;

/** How long a request stays after it ended (its claims name a person's Ever ID subject). */
export const INTENT_RETENTION_MS = 24 * 3_600_000;

/** How often the requests that ended are removed. */
const INTENT_PURGE_EVERY_MS = 3_600_000;

/**
 * Tells Ever Platform that a workspace it asked for exists
 * (`POST /v1/provision-intents/{jti}/complete`, with the instance token): the request's `jti`, this
 * installation's Registry id, the new tenant, organization and owner ids, and the addresses of this
 * installation's web app and API (`CLIENT_BASE_URL`, `API_BASE_URL`). Nothing else: no name, no
 * e-mail. Ever Platform records the link between the Ever organization and the workspace and answers
 * its id; the plugin then keeps that link like one made with a link code (its entitlement document and
 * integration states are read as for any link).
 *
 * The first attempt is made right after the workspace was created; a report that could not be sent
 * (no answer, a 5xx, a 429) is retried by the API process that holds the connection's lease, after 1
 * minute, then longer, at most 4 hours apart, 8 attempts in all. A repeat answers `already_completed`,
 * which counts as done. A refusal (another 4xx) is final and kept as a code.
 *
 * The owner's link between their Ever ID and the new account is not reported here: a `provisioned`
 * link is Ever Platform's own (it made the request for that person), and Ever Platform does not take
 * it from an installation.
 */
@Injectable()
export class EverConnectProvisionCompletion {
	private readonly logger = new Logger('EverConnect');
	private readonly now: () => number;
	private running: Promise<void> | null = null;
	private lastPurgeAt = 0;

	constructor(
		private readonly provisions: EverConnectProvisionStore,
		private readonly store: EverConnectStore,
		private readonly platform: EverConnectPlatformService,
		private readonly audit: EverConnectAuditService,
		private readonly signals: EverConnectSignals,
		@Inject(EVER_CONNECT_SETTINGS) private readonly config: EverConnectConfig,
		@Optional() private readonly entitlements?: EverConnectEntitlementService,
		@Optional() private readonly states?: EverConnectIntegrationStateService,
		@Optional() @Inject(EVER_CONNECT_CLOCK) clock?: { now: () => number }
	) {
		this.now = clock?.now ?? (() => Date.now());
	}

	/** Sends every report that is due. Concurrent calls share one pass. */
	sendDue(): Promise<void> {
		if (!this.running) {
			this.running = this.pass().finally(() => {
				this.running = null;
			});
		}
		return this.running;
	}

	private async pass(): Promise<void> {
		const connection = await this.store.connection();
		if (connection.status !== 'connected' || !connection.platformInstanceId) {
			return;
		}
		for (const record of await this.provisions.dueCompletions(COMPLETION_BATCH)) {
			await this.send(record, connection.platformInstanceId);
		}
		if (this.now() - this.lastPurgeAt >= INTENT_PURGE_EVERY_MS) {
			this.lastPurgeAt = this.now();
			await this.provisions.purgeEndedIntents(this.now() - INTENT_RETENTION_MS).catch((error) => {
				this.logger.warn(`The ended workspace requests could not be removed now (${errorCode(error)}).`);
			});
		}
	}

	/** Sends one report now (right after the workspace was created); never throws. */
	async sendNow(idempotencyKey: string): Promise<void> {
		try {
			const record = await this.provisions.result(idempotencyKey);
			const connection = await this.store.connection();
			if (
				record?.completionState === 'pending' &&
				connection.status === 'connected' &&
				connection.platformInstanceId
			) {
				await this.send(record, connection.platformInstanceId);
			}
		} catch (error) {
			this.logger.warn(
				`A workspace completion report could not be sent now (${errorCode(error)}); it is retried.`
			);
		}
	}

	/**
	 * One attempt: Ever Platform is told (once: `completedAt` marks its answer, so an attempt after a
	 * local failure does not ask again), then the link it answered is kept here; only then is the report
	 * done. A failure of either step counts an attempt and is retried.
	 */
	private async send(due: ProvisionResultRecord, instanceId: string): Promise<void> {
		if (!(await this.provisions.leaseCompletion(due, this.now() + COMPLETION_LEASE_MS))) {
			return;
		}
		const record = (await this.provisions.result(due.idempotencyKey)) as ProvisionResultRecord;
		const attempts = record.completionAttempts;
		let tenantLinkId = record.tenantLinkId;
		if (!record.completedAt) {
			try {
				const client = await this.platform.getClient();
				const answer = await client.connect.completeProvisionIntent(record.jti, {
					instance_id: instanceId,
					product_tenant_id: record.productTenantId,
					product_org_id: record.productOrgId,
					product_user_ref: record.productUserId,
					urls: { app: this.config.provision.appUrl, api: this.config.provision.apiUrl },
					result: 'created'
				} as never);
				tenantLinkId =
					typeof answer?.tenant_link_id === 'string' && LINK_ID_SHAPE.test(answer.tenant_link_id)
						? answer.tenant_link_id
						: null;
			} catch (error) {
				if (isCredentialRevoked(error)) {
					this.signals.revoked$.next();
					return;
				}
				await this.failed(record, errorCode(error), !isUnreachable(error));
				return;
			}
			await this.provisions.updateCompletion(record.idempotencyKey, attempts, {
				completedAt: this.now(),
				tenantLinkId
			});
		}
		if (!tenantLinkId) {
			// A repeat (`already_completed`, its first answer lost) may carry no id: the link is found again.
			try {
				tenantLinkId = await this.findLink(record);
			} catch (error) {
				await this.failed(record, `link_${errorCode(error)}`, false, true);
				return;
			}
			if (!tenantLinkId) {
				// Not found: the report stays open and is retried. Done here, nothing would ever repair it:
				// the entitlement refresh and the integration sync only visit links this installation keeps.
				await this.failed(record, 'link_not_found', false, true);
				return;
			}
			await this.provisions.updateCompletion(record.idempotencyKey, attempts, { tenantLinkId });
		}
		try {
			await this.keepLink(record, tenantLinkId);
		} catch (error) {
			await this.failed(record, `link_${errorCode(error)}`, false, true);
			return;
		}
		await this.provisions.updateCompletion(record.idempotencyKey, attempts, {
			completionAttempts: attempts + 1,
			completionState: 'done',
			completionNextAt: null,
			completionError: null
		});
	}

	/**
	 * The id of the link Ever Platform recorded for this workspace (`GET /v1/instances/me`: the Ever
	 * organization and the tenant it was created for), or `null`.
	 */
	private async findLink(record: ProvisionResultRecord): Promise<string | null> {
		const client = await this.platform.getClient();
		const self = await client.instances.self();
		const link = (self?.tenant_links ?? []).find(
			(candidate) =>
				candidate.org_id === record.everOrgId &&
				candidate.product_tenant_id === record.productTenantId &&
				!candidate.unlinked_at &&
				LINK_ID_SHAPE.test(candidate.id)
		);
		return link?.id ?? null;
	}

	/**
	 * Counts a failed attempt: retried after the next wait, or given up after the last one (or at once,
	 * for a refusal of Ever Platform's, unless only the local step failed).
	 */
	private async failed(record: ProvisionResultRecord, code: string, refused: boolean, local = false): Promise<void> {
		const next = record.completionAttempts + 1;
		const final = (refused && !local) || next >= COMPLETION_MAX_ATTEMPTS;
		await this.provisions.updateCompletion(record.idempotencyKey, record.completionAttempts, {
			completionAttempts: next,
			completionState: final ? 'failed' : 'pending',
			completionNextAt: final
				? null
				: this.now() + COMPLETION_RETRY_MS[Math.min(next, COMPLETION_RETRY_MS.length) - 1],
			completionError: code.replace(/\s+/g, '_').slice(0, 64)
		});
		this.logger.warn(
			final
				? `A workspace completion report was given up (${code}).`
				: `A workspace completion report could not be finished (${code}); it is retried.`
		);
	}

	/**
	 * Keeps the link Ever Platform recorded like one made with a link code: the link row (once), its id on
	 * Gauzy's record of it, its entitlement document and the integration states (both best effort: the
	 * heartbeat reads them again). Safe to run again.
	 */
	private async keepLink(record: ProvisionResultRecord, linkId: string): Promise<void> {
		if (!record.productTenantId || !record.productOrgId || !record.everOrgId) {
			return;
		}
		const owner = { tenantId: record.productTenantId, organizationId: record.productOrgId };
		let inserted = false;
		if (!(await this.store.linkById(linkId))) {
			try {
				await this.store.insertLink({
					...owner,
					integrationTenantId: record.integrationTenantId,
					linkId,
					everOrgId: record.everOrgId,
					everHandle: handleOf(await this.provisions.intent(record.jti)),
					status: 'linked',
					entitlementJwsEncrypted: null,
					entitlementSeq: null,
					entitlementIat: null,
					entitlementExp: null,
					entitlementFetchedAt: null,
					linkedByUserId: record.productUserId
				});
				inserted = true;
			} catch (error) {
				if (error instanceof LiveLinkExistsError) {
					// The organization was linked otherwise meanwhile: that link stays.
					return;
				}
				throw error;
			}
		}
		if (record.integrationTenantId) {
			await this.provisions.addLinkSettings(owner, record.integrationTenantId, { EVER_LINK_ID: linkId });
		}
		if (inserted) {
			await this.audit.record({
				action: 'link.create',
				actorLabel: 'platform',
				actorUserId: record.productUserId,
				...owner,
				details: { link_id: linkId, ever_org_id: record.everOrgId }
			});
		}
		const link = await this.store.linkById(linkId);
		if (link && this.entitlements) {
			await this.entitlements.refreshLink(link).catch(() => undefined);
		}
		await this.states?.sync({ force: true }).catch(() => undefined);
	}
}

/** The Ever organization's handle in a stored request, or `null`. */
function handleOf(intent: { intent: string } | null): string | null {
	if (!intent) return null;
	try {
		return (JSON.parse(intent.intent) as { org?: { handle?: string } }).org?.handle ?? null;
	} catch {
		return null;
	}
}
