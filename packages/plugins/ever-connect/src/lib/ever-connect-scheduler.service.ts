import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Subscription } from 'rxjs';
import { EverConnectKeyUnreadableError, EverInstanceKeyError } from '@gauzy/plugin-ever-instance';
import { EverConnectCleanupService } from './ever-connect-cleanup.service';
import type { EverConnectConfig } from './ever-connect-config';
import { EverConnectConnectionService } from './ever-connect-connection.service';
import {
	EVER_CONNECT_CLOCK,
	EVER_CONNECT_SETTINGS,
	FEED_INTERVAL_MS,
	FEED_RETRY_MS,
	FEED_WAIT_S,
	FIRST_HEARTBEAT_DELAY_MS,
	HEARTBEAT_INTERVAL_MS,
	LEASE_MS,
	MAX_FEED_CURSOR_LENGTH,
	MODULE_VERSION
} from './ever-connect.constants';
import { EverConnectEntitlementService } from './ever-connect-entitlement.service';
import { EverConnectIntegrationStateService } from './ever-connect-integration-state.service';
import { EverConnectLease } from './ever-connect-lease';
import { EverConnectLinkService } from './ever-connect-link.service';
import { EverConnectPlatformService, errorCode, isCredentialRevoked } from './ever-connect-platform.service';
import { EverConnectSignals } from './ever-connect-signals';
import { EverConnectStore } from './ever-connect.store';
import { personRequestKind, PersonRequestsHandler } from './handlers/person-requests.handler';
import { membershipChangeOf } from './membership/membership-sync.config';
import { MembershipSyncHandler } from './membership/membership-sync.handler';
import { EverConnectProvisionCompletion } from './services/ever-connect-provision-completion.service';
import { EventEnvelope, ProblemError } from './sdk';

/** What the dispatcher did with one event. */
export type DispatchOutcome = 'states' | 'entitlements' | 'link' | 'connection' | 'person' | 'membership' | 'ignored';

/**
 * The heartbeat and the event feed, run by one API process at a time (a lease on the connection
 * row), and only while the installation is connected: before a connection exists, no timer is
 * scheduled and nothing is sent.
 *
 * - Heartbeat: at most a minute after start (or connect), then every 24 hours: the version, the
 *   products served, the operator's deny list; integrations switched off while Ever Platform could
 *   not be reached are retried; the documents and keys are refreshed.
 * - Feed: a long poll of 25 seconds (or one read every 15 minutes with
 *   `EVER_CONNECT_FEED_MODE=interval`). Each event is dispatched by its catalog type, then the
 *   cursor is kept and acknowledged (in that order); handlers are idempotent (they re-read state),
 *   so an event read twice changes nothing more. A person's deletion or export request is recorded
 *   by its event id and answered once. A membership change of a linked Ever organization is applied
 *   to its Gauzy organization when the membership sync is on (`EVER_CONNECT_MEMBERSHIP_SYNC_ENABLED`),
 *   and acknowledged and ignored otherwise; with it on, the current members of each linked organization are
 *   read again and applied once after each start and after each `410 resync_required`, before the feed is
 *   read (`MembershipSyncHandler.resync`). Types this release has no handler for are acknowledged and
 *   ignored, and so are connection events (and a person's requests and membership changes) of another
 *   installation or of before this connection (a cursor read again from the start replays them).
 */
/** How far Ever Platform's clock may be ahead of this one when an event's time is compared. */
const CLOCK_SKEW_MS = 300_000;

@Injectable()
export class EverConnectScheduler implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('EverConnect');
	/** This process's name on the connection's lease (shared with Sign in with Ever ID's worker). */
	private readonly holder: string;
	private readonly now: () => number;
	private heartbeatTimer: NodeJS.Timeout | null = null;
	private feedTimer: NodeJS.Timeout | null = null;
	private feedAbort: AbortController | null = null;
	private running = false;
	private feedFailures = 0;
	private entitlementFileImported = false;
	private readonly subscriptions: Subscription[] = [];
	/** Events handled by this process (their ids), so a page read twice is handled once. */
	private readonly seen = new Set<string>();
	/**
	 * A membership resync is owed (with the membership sync on): once after each start, and after each
	 * `410 resync_required`. Run by the lease holder before its next read of the feed.
	 */
	private membershipResyncOwed = true;

	constructor(
		private readonly platform: EverConnectPlatformService,
		private readonly store: EverConnectStore,
		private readonly connection: EverConnectConnectionService,
		private readonly states: EverConnectIntegrationStateService,
		private readonly links: EverConnectLinkService,
		private readonly entitlements: EverConnectEntitlementService,
		private readonly cleanup: EverConnectCleanupService,
		private readonly signals: EverConnectSignals,
		@Inject(EVER_CONNECT_SETTINGS) private readonly config: EverConnectConfig,
		@Optional() @Inject(EVER_CONNECT_CLOCK) clock?: { now: () => number },
		@Optional() private readonly personRequests?: PersonRequestsHandler,
		@Optional() lease?: EverConnectLease,
		@Optional() private readonly provisions?: EverConnectProvisionCompletion,
		// Registered only with EVER_CONNECT_MEMBERSHIP_SYNC_ENABLED=true (see `membershipSyncProviders`).
		@Optional() private readonly membership?: MembershipSyncHandler
	) {
		this.now = clock?.now ?? (() => Date.now());
		this.holder = lease?.holder ?? randomUUID();
	}

	onModuleInit(): void {
		this.subscriptions.push(
			this.signals.connected$.subscribe(() => this.start()),
			this.signals.stopped$.subscribe(() => this.stop()),
			this.signals.heartbeat$.subscribe(() => {
				if (this.running) this.scheduleHeartbeat(1_000);
			})
		);
	}

	onModuleDestroy(): void {
		for (const subscription of this.subscriptions) subscription.unsubscribe();
		this.stop();
	}

	/** Whether any timer or request of the scheduler is active. */
	get active(): boolean {
		return this.running || this.heartbeatTimer !== null || this.feedTimer !== null || this.feedAbort !== null;
	}

	start(): void {
		if (this.running) return;
		this.running = true;
		this.feedFailures = 0;
		// EVER_ENTITLEMENT_FILE: imported once per process, when the connection first starts.
		if (!this.entitlementFileImported) {
			this.entitlementFileImported = true;
			this.entitlements.importFromEnvFile().catch(() => undefined);
		}
		this.scheduleHeartbeat(FIRST_HEARTBEAT_DELAY_MS);
		this.scheduleFeed(0);
	}

	stop(): void {
		this.running = false;
		if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
		if (this.feedTimer) clearTimeout(this.feedTimer);
		this.heartbeatTimer = null;
		this.feedTimer = null;
		this.feedAbort?.abort();
		this.feedAbort = null;
		this.store.releaseLease(this.holder).catch(() => undefined);
	}

	private scheduleHeartbeat(delayMs: number): void {
		if (!this.running) return;
		if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
		this.heartbeatTimer = setTimeout(() => {
			this.heartbeatTimer = null;
			this.heartbeat()
				.catch((error) => this.logger.warn(`Heartbeat failed (${errorCode(error)}).`))
				.finally(() => this.scheduleHeartbeat(HEARTBEAT_INTERVAL_MS));
		}, delayMs);
		this.heartbeatTimer.unref?.();
	}

	private scheduleFeed(delayMs: number): void {
		if (!this.running) return;
		if (this.feedTimer) clearTimeout(this.feedTimer);
		this.feedTimer = setTimeout(() => {
			this.feedTimer = null;
			this.readFeed()
				.then((more) => {
					this.feedFailures = 0;
					const next = this.config.feedMode === 'interval' && !more ? FEED_INTERVAL_MS : 0;
					this.scheduleFeed(next);
				})
				.catch((error) => {
					this.feedFailures += 1;
					if (!this.running) return;
					this.logger.warn(`The Ever Platform event feed could not be read (${errorCode(error)}).`);
					this.scheduleFeed(Math.min(FEED_RETRY_MS * 2 ** (this.feedFailures - 1), FEED_INTERVAL_MS));
				});
		}, delayMs);
		this.feedTimer.unref?.();
	}

	/**
	 * One heartbeat, by the lease holder only: `POST /v1/instances/me/heartbeat`, then the retries of
	 * this release (integrations switched off while offline, a failed local effect), then the keys and
	 * entitlement documents.
	 */
	async heartbeat(): Promise<boolean> {
		const connection = await this.store.connection();
		if (connection.status !== 'connected' || !(await this.store.takeLease(this.holder, LEASE_MS))) {
			return false;
		}
		try {
			// A deleted Gauzy organization is cleaned up before anything is sent for it.
			await this.cleanup
				.reconcile()
				.catch((error) => this.logger.warn(`Deleted organizations could not be cleaned up now (${errorCode(error)}).`));
			const client = await this.platform.getClient();
			await client.instances.heartbeat({
				version: this.config.version,
				module_version: MODULE_VERSION,
				serves_products: this.config.serves,
				integrations_denied: await this.states.deniedKeys()
			});
			await this.store.updateConnection({
				lastHeartbeatAt: this.now(),
				nextHeartbeatAt: this.now() + HEARTBEAT_INTERVAL_MS,
				lastError: null
			});
			await this.states.retryPending();
			// Workspaces created from Ever whose report to Ever Platform is due (also every 15 seconds by Sign in with Ever ID's worker).
			await this.provisions?.sendDue().catch(() => undefined);
			await this.platform.keys().catch(() => undefined);
			await this.entitlements.refreshAll();
			return true;
		} catch (error) {
			if (isCredentialRevoked(error)) {
				this.signals.revoked$.next();
				return false;
			}
			const unreadable = error instanceof EverConnectKeyUnreadableError || error instanceof EverInstanceKeyError;
			await this.store.updateConnection({
				// The connect key cannot be read since ENCRYPTION_KEY or JWT_SECRET changed: the Connection
				// tab says so (disconnect, then connect again).
				lastError: unreadable ? 'key_unreadable' : `heartbeat_${errorCode(error).replace(/\s+/g, '_')}`.slice(0, 255)
			});
			throw error;
		}
	}

	/**
	 * One read of the event feed by the lease holder: dispatches each event, acknowledges and keeps
	 * the cursor. Returns whether more events wait.
	 */
	async readFeed(): Promise<boolean> {
		const connection = await this.store.connection();
		if (connection.status !== 'connected' || !(await this.store.takeLease(this.holder, LEASE_MS))) {
			// Another process holds the lease (or the connection stopped): look again later.
			await new Promise((resolve) => setTimeout(resolve, FEED_RETRY_MS).unref?.());
			return false;
		}
		const client = await this.platform.getClient();
		if (this.membership && this.membershipResyncOwed) {
			// Not owed again on a failure: it runs at the next 410 or start (the resync says why it stopped).
			this.membershipResyncOwed = false;
			const outcome = await this.membership
				.resync(client, () => this.store.takeLease(this.holder, LEASE_MS))
				.catch(() => 'failed' as const);
			if (outcome === 'lease_lost') {
				// Another process holds the lease now: this one runs the resync when it holds it again.
				this.membershipResyncOwed = true;
				return false;
			}
		}
		this.feedAbort = new AbortController();
		const waitS = this.config.feedMode === 'longpoll' ? FEED_WAIT_S : 0;
		let page: { events: EventEnvelope[]; last_id: string; has_more: boolean };
		try {
			page = (await client.instances.events(connection.feedCursor, {
				waitS,
				signal: this.feedAbort.signal
			})) as typeof page;
		} catch (error) {
			if (isCredentialRevoked(error)) {
				this.signals.revoked$.next();
				return false;
			}
			if (error instanceof ProblemError && error.status === 410 && error.code === 'resync_required') {
				await this.resync(client, error.lastId);
				return true;
			}
			throw error;
		} finally {
			this.feedAbort = null;
		}
		await this.cleanup
			.reconcile()
			.catch((error) => this.logger.warn(`Deleted organizations could not be cleaned up now (${errorCode(error)}).`));
		await this.dispatchPage(page.events, connection);
		if (page.last_id && page.last_id !== connection.feedCursor) {
			if (typeof page.last_id !== 'string' || page.last_id.length > MAX_FEED_CURSOR_LENGTH) {
				// A cursor this installation could not keep is never acknowledged.
				this.logger.warn('The event feed answered a cursor that cannot be kept; it is not acknowledged.');
				return false;
			}
			// Kept first, then acknowledged: an acknowledged cursor is always one this installation has.
			await this.store.updateConnection({ feedCursor: page.last_id });
			await client.instances.ackEvents(page.last_id);
		}
		return page.has_more;
	}

	/** Dispatches a page of events: each kind of follow-up runs once per page. */
	async dispatchPage(
		events: EventEnvelope[],
		connection?: { platformInstanceId: string | null; connectedAt: number | null }
	): Promise<DispatchOutcome[]> {
		const outcomes: DispatchOutcome[] = [];
		const handled: Array<{ id: string; outcome: DispatchOutcome }> = [];
		let failure: unknown = null;
		try {
			for (const event of events) {
				if (this.seen.has(event.id)) {
					outcomes.push('ignored');
					continue;
				}
				const outcome = await this.dispatch(event, connection);
				outcomes.push(outcome);
				handled.push({ id: event.id, outcome });
				this.remember(event.id);
			}
		} catch (error) {
			failure = error;
		}
		// The follow-ups of the events handled, also when a later event of the page failed; each one runs whatever the
		// other did. An event whose follow-up failed is no longer remembered as handled, so the page read again (it is
		// not acknowledged) hands it over again; the first error is the one thrown.
		const followUps: Array<[DispatchOutcome, () => Promise<unknown>]> = [
			['states', () => this.states.sync({ force: true })],
			['entitlements', () => this.entitlements.refreshAll()]
		];
		for (const [kind, run] of followUps) {
			if (!handled.some((event) => event.outcome === kind)) continue;
			try {
				await run();
			} catch (error) {
				failure ??= error;
				for (const event of handled) {
					if (event.outcome === kind) this.seen.delete(event.id);
				}
			}
		}
		if (failure !== null) {
			throw failure;
		}
		return outcomes;
	}

	/** What one event of the catalog means for this installation. */
	async dispatch(
		event: EventEnvelope,
		connection?: { platformInstanceId: string | null; connectedAt: number | null }
	): Promise<DispatchOutcome> {
		const data = (event.data ?? {}) as Record<string, unknown>;
		const linkId = typeof data['tenant_link_id'] === 'string' ? data['tenant_link_id'] : event.subject?.id;
		const personRequest = personRequestKind(event.type) !== null;
		const membershipChange = membershipChangeOf(event.type) !== null;
		if (
			(event.type.startsWith('ever.registry.instance.') || personRequest || membershipChange) &&
			connection &&
			!this.forThisConnection(event, connection)
		) {
			// A connection event (or a person's request, or a membership change) of another installation, or
			// of before this connection: ignored.
			return 'ignored';
		}
		if (personRequest) {
			// Deletion and export requests: recorded by event id, answered once (`POST /v1/instances/me/ack`).
			return this.personRequests && (await this.personRequests.handle(event)) ? 'person' : 'ignored';
		}
		if (membershipChange) {
			// Applied to the linked Gauzy organization only with the membership sync on; its handler is
			// idempotent (the last change applied per user and organization is kept in the audit).
			if (!this.membership) return 'ignored';
			await this.membership.apply(event);
			return 'membership';
		}
		switch (event.type) {
			case 'ever.consent.consent.granted':
			case 'ever.consent.consent.revoked':
			case 'ever.consent.integration.enabled':
			case 'ever.consent.integration.disabled':
			case 'ever.consent.integration.scope_bumped':
				return 'states';
			case 'ever.entitlements.entitlement.issued':
			case 'ever.entitlements.entitlement.revoked':
				return 'entitlements';
			case 'ever.registry.tenant_link.unlinked': {
				const link = linkId ? await this.store.linkById(String(linkId)) : null;
				if (link) await this.links.unlinkLocally(link, 'platform', null, true);
				return 'link';
			}
			case 'ever.registry.tenant_link.suspended':
			case 'ever.registry.tenant_link.orphaned':
			case 'ever.registry.tenant_link.resumed':
				if (linkId) {
					const status = event.type.endsWith('resumed')
						? 'linked'
						: event.type.endsWith('suspended')
							? 'suspended'
							: 'orphaned';
					await this.links.linkStateChanged(String(linkId), status);
				}
				return 'link';
			case 'ever.registry.instance.revoked':
				this.signals.revoked$.next();
				return 'connection';
			case 'ever.registry.instance.disconnected':
				await this.connection.stopLocally('disconnected', { actorLabel: 'platform', userId: null }, true);
				return 'connection';
			case 'ever.registry.instance.approved':
				await this.connection.approved();
				return 'connection';
			default:
				// Managed operations and every other type: acknowledged and ignored by this release.
				return 'ignored';
		}
	}

	/** Whether a connection event names this connection (its Registry id) and happened after it was made. */
	private forThisConnection(
		event: EventEnvelope,
		connection: { platformInstanceId: string | null; connectedAt: number | null }
	): boolean {
		const data = (event.data ?? {}) as Record<string, unknown>;
		const named = (event as { instance_id?: unknown }).instance_id ?? data['instance_id'];
		if (typeof named === 'string' && named !== connection.platformInstanceId) {
			return false;
		}
		const at = Date.parse(String(event.occurred_at ?? ''));
		if (Number.isFinite(at) && connection.connectedAt !== null && at + CLOCK_SKEW_MS < connection.connectedAt) {
			return false;
		}
		return true;
	}

	/**
	 * After `410 resync_required` (the cursor is older than what Ever Platform keeps): re-read the
	 * states and documents, then continue from the position Ever Platform names (`last_id`: kept,
	 * then acknowledged); without one, read the feed again from its start (handlers re-read state, so
	 * events read again change nothing). With the membership sync on, the membership changes the skipped
	 * part of the feed held are made up for by a membership resync, owed from here and run before the
	 * next read of the feed (`GET /v1/instances/me/tenant-links/{link}/memberships` for each linked
	 * organization).
	 */
	async resync(
		client: { instances: { ackEvents: (lastId: string) => Promise<unknown> } },
		lastId: string | undefined
	): Promise<void> {
		await this.states.sync({ force: true });
		await this.entitlements.refreshAll();
		if (this.membership) {
			this.membershipResyncOwed = true;
		}
		if (typeof lastId === 'string' && lastId.length > 0 && lastId.length <= MAX_FEED_CURSOR_LENGTH) {
			await this.store.updateConnection({ feedCursor: lastId });
			await client.instances.ackEvents(lastId);
		} else {
			await this.store.updateConnection({ feedCursor: null });
		}
	}

	private remember(id: string): void {
		this.seen.add(id);
		if (this.seen.size > 1_000) {
			const first = this.seen.values().next().value;
			if (first !== undefined) this.seen.delete(first);
		}
	}
}
