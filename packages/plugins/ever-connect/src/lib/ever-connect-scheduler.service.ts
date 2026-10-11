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
import { EverConnectLinkService } from './ever-connect-link.service';
import { EverConnectPlatformService, errorCode, isCredentialRevoked } from './ever-connect-platform.service';
import { EverConnectSignals } from './ever-connect-signals';
import { EverConnectStore } from './ever-connect.store';
import { EventEnvelope, ProblemError } from './sdk';

/** What the dispatcher did with one event. */
export type DispatchOutcome = 'states' | 'entitlements' | 'link' | 'connection' | 'ignored';

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
 *   so an event read twice changes nothing more. Types this release has no handler for are
 *   acknowledged and ignored, and so are connection events of another installation or of before
 *   this connection (a cursor read again from the start replays them).
 */
/** How far Ever Platform's clock may be ahead of this one when an event's time is compared. */
const CLOCK_SKEW_MS = 300_000;

@Injectable()
export class EverConnectScheduler implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger('EverConnect');
	private readonly holder = randomUUID();
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
		@Optional() @Inject(EVER_CONNECT_CLOCK) clock?: { now: () => number }
	) {
		this.now = clock?.now ?? (() => Date.now());
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
		let states = false;
		let entitlements = false;
		for (const event of events) {
			if (this.seen.has(event.id)) {
				outcomes.push('ignored');
				continue;
			}
			const outcome = await this.dispatch(event, connection);
			outcomes.push(outcome);
			states ||= outcome === 'states';
			entitlements ||= outcome === 'entitlements';
			this.remember(event.id);
		}
		if (states) await this.states.sync({ force: true });
		if (entitlements) await this.entitlements.refreshAll();
		return outcomes;
	}

	/** What one event of the catalog means for this installation. */
	async dispatch(
		event: EventEnvelope,
		connection?: { platformInstanceId: string | null; connectedAt: number | null }
	): Promise<DispatchOutcome> {
		const data = (event.data ?? {}) as Record<string, unknown>;
		const linkId = typeof data['tenant_link_id'] === 'string' ? data['tenant_link_id'] : event.subject?.id;
		if (event.type.startsWith('ever.registry.instance.') && connection && !this.forThisConnection(event, connection)) {
			// A connection event of another installation, or of before this connection: ignored.
			return 'ignored';
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
				// Deletion and export requests, memberships, managed operations and every other type:
				// acknowledged and ignored by this release.
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
	 * events read again change nothing).
	 */
	async resync(
		client: { instances: { ackEvents: (lastId: string) => Promise<unknown> } },
		lastId: string | undefined
	): Promise<void> {
		await this.states.sync({ force: true });
		await this.entitlements.refreshAll();
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
