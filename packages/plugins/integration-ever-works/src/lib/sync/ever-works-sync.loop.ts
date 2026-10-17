import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, Optional } from '@nestjs/common';
import { hostname } from 'node:os';
import { randomBytes } from 'node:crypto';
import { DataSource, IsNull, LessThan } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { EverWorksConnection, EverWorksConnectionStatus } from '../connection/ever-works-connection.entity';
import { isEverWorksEnabled } from '../ever-works-enabled';
import { EVER_WORKS_ENV } from '../ever-works.tokens';
import { EVER_WORKS_SYNC_LEASE_MS, EverWorksLeaseLostError, everWorksLease, withLeaseFence } from './ever-works-lease-fence';
import { ensureRequestContextStore, EverWorksProcessCapability } from './ever-works-process';
import { EverWorksSyncLogService } from './ever-works-sync-log.service';
import { EverWorksFeedPoller } from './inbound/ever-works-feed.poller';
import { EverWorksInboundApplier } from './inbound/ever-works-inbound.applier';
import { EverWorksOutboundPusher } from './outbound/ever-works-outbound.pusher';

/**
 * A failure's cause for the log: its name and the start of its message, with anything that looks like a
 * key or a bearer token masked (the client's own errors never carry them; a driver error might).
 */
export function describeSyncError(error: unknown): string {
	if (!(error instanceof Error)) return 'error';
	const message = (error.message ?? '')
		.replace(/(bearer\s+)\S+/gi, '$1<redacted>')
		.replace(/\bew_(int|live)_[A-Za-z0-9_-]+/g, 'ew_$1_<redacted>')
		.slice(0, 200);
	return message ? `${error.name}: ${message}` : error.name;
}

/**
 * A periodic pass a handler runs for a connection the loop holds (e.g. the team membership sweep): due
 * every `sweepIntervalMs`, after the inbound and outbound drains, under the same lease.
 */
export interface EverWorksSyncSweeper {
	readonly sweepIntervalMs: number;
	/** `stillOwner` renews the lease (and says whether this process still holds it) for a long sweep. */
	sweep(connection: EverWorksConnection, stillOwner?: () => Promise<boolean>): Promise<void>;
}

/** How often a process looks for work. */
export const SYNC_TICK_MS = 5_000;
/** How long a lease on a connection lasts; renewed during the work, and the work stops once it is lost. */
export const SYNC_LEASE_MS = EVER_WORKS_SYNC_LEASE_MS;
/** How often a pass renews its lease while it works. */
export const SYNC_RENEW_MS = 30_000;

/**
 * The sync loop (plan 03 §C.7): every process that loads the plugin (each API replica and the worker)
 * ticks, and for each active connection it holds a **database lease** on (`leaseOwner`/`leaseUntil` on
 * the connection row, claimed with a conditional update) it polls the change feed when due, applies
 * pending events and pushes pending changes. One process works a connection at a time, on every
 * dialect, with or without Redis — so the order of events per connection holds across replicas.
 *
 * Off with the plugin (`EVER_WORKS_ENABLED` not `true`), and also with `EVER_WORKS_SYNC_LOOP=off` (for a
 * process that should only serve the API). Nothing is sent while no connection exists.
 *
 * The loop runs only in a process that can make the sync's Gauzy writes (`ever-works-process.ts`): every
 * write opens a tenant-scoped request context of its own, in any process, and dispatches to the platform's
 * task, project and employee services. A process that does not host those (the worker today: its module
 * graph is the documents pipeline and the commerce sweeps) stays out on its own and says so once, so the
 * lease is never held by a process that could only defer the writes; a process that serves the API runs it.
 *
 * **Lease fence** (`ever-works-lease-fence.ts`): every handler, push and sweep runs fenced on the lease, so
 * each of its Gauzy writes checks in its own transaction that this process still holds it — a unit that
 * outlived the lease writes nothing once another process has claimed it.
 */
@Injectable()
export class EverWorksSyncLoop implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger('EverWorksSync');
	readonly owner = `${hostname()}:${process.pid}:${randomBytes(4).toString('hex')}`;
	private timer: NodeJS.Timeout | null = null;
	private running = false;
	private lastPrune = 0;
	private readonly sweepers: EverWorksSyncSweeper[] = [];
	private readonly lastSweep = new Map<string, number>();
	private readonly env: Record<string, string | undefined>;

	constructor(
		private readonly dataSource: DataSource,
		private readonly feed: EverWorksFeedPoller,
		private readonly applier: EverWorksInboundApplier,
		private readonly pusher: EverWorksOutboundPusher,
		private readonly log: EverWorksSyncLogService,
		@Optional() @Inject(EVER_WORKS_ENV) env?: Record<string, string | undefined>,
		@Optional() private readonly capability?: EverWorksProcessCapability
	) {
		this.env = env ?? process.env;
	}

	/** Registers a periodic sweep (run per connection, under its lease). */
	registerSweeper(sweeper: EverWorksSyncSweeper): void {
		this.sweepers.push(sweeper);
	}

	onApplicationBootstrap(): void {
		if (!this.start()) return;
		this.timer = setInterval(() => void this.tick(), SYNC_TICK_MS);
		this.timer.unref?.();
	}

	/**
	 * Whether this process runs the loop: the plugin is on, `EVER_WORKS_SYNC_LOOP` is not `off`, and the
	 * process hosts the platform services the sync's Gauzy writes dispatch to. Where it runs, the process
	 * is also given a request context store if it has none yet, so each write's tenant-scoped context opens.
	 */
	start(): boolean {
		if (!isEverWorksEnabled(this.env) || this.env['EVER_WORKS_SYNC_LOOP'] === 'off') return false;
		const missing = this.capability?.missingWriteServices() ?? [];
		if (missing.length) {
			this.logger.warn(
				`This process does not host ${missing.join(', ')}, which the sync's Gauzy writes go through, so it stays out of the sync loop; a process that serves the API runs it (EVER_WORKS_SYNC_LOOP=off here silences this).`
			);
			return false;
		}
		if (!ensureRequestContextStore()) {
			this.logger.warn('This process cannot open a request context for the sync writes, so it stays out of the sync loop.');
			return false;
		}
		return true;
	}

	async onApplicationShutdown(): Promise<void> {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
		// Give the leases back so another process takes over at once.
		await this.dataSource
			.getRepository(EverWorksConnection)
			.update({ leaseOwner: this.owner } as never, { leaseOwner: null, leaseUntil: null } as never)
			.catch(() => undefined);
	}

	/** One pass over the active connections; returns the ids this process worked. */
	async tick(pinned?: Date): Promise<ID[]> {
		// Tests pin the clock; production reads it afresh for every claim.
		const now = pinned ?? new Date();
		if (this.running) return [];
		this.running = true;
		const worked: ID[] = [];
		try {
			const connections = await this.dataSource.getRepository(EverWorksConnection).find({
				where: { isActive: true, status: EverWorksConnectionStatus.ACTIVE }
			});
			for (const connection of connections) {
				// A fresh time per claim (a long pass over earlier connections must not shorten this lease).
				const at = this.timeFor(pinned);
				if (!(await this.claim(connection.id as ID, at))) continue;
				worked.push(connection.id as ID);
				await this.work(connection, pinned).catch((error) =>
					this.logger.warn(`Connection ${connection.id}: sync pass failed (${describeSyncError(error)}).`)
				);
			}
			if (now.getTime() - this.lastPrune > 60 * 60_000) {
				this.lastPrune = now.getTime();
				await this.log.prune(now).catch(() => 0);
			}
		} catch (error) {
			// The tables may not exist yet (migrations pending); the next tick tries again.
			this.logger.debug?.(`Sync tick skipped (${describeSyncError(error)}).`);
		} finally {
			this.running = false;
		}
		return worked;
	}

	/** Feed (when due), then inbound, then outbound, for one connection this process holds. */
	private async work(connection: EverWorksConnection, tickNow: Date | undefined): Promise<void> {
		const id = connection.id as ID;
		let renewedAt = Date.now();
		// Renews the lease every SYNC_RENEW_MS while working; false once another process holds it. A cached
		// `true` is safe: the lease was just extended by SYNC_LEASE_MS (5 min, ten renewals), and another
		// process can claim it only once it has run out. Every write is fenced as well: the feed cursor and
		// the inbound outcomes on `leaseOwner`, the outbound results on their claim, and every Gauzy write of
		// a handler, a push or a sweep by the lease fence (checked in the write's own transaction).
		const stillOwner = async (): Promise<boolean> => {
			if (Date.now() - renewedAt < SYNC_RENEW_MS) return true;
			renewedAt = Date.now();
			return this.claim(id, this.timeFor(tickNow));
		};
		const fresh = (await this.dataSource.getRepository(EverWorksConnection).findOne({ where: { id } })) ?? connection;
		if (this.feed.isDue(fresh)) {
			await this.feed.poll(fresh, this.owner).catch((error) =>
				this.logger.warn(`Connection ${connection.id}: feed poll failed (${describeSyncError(error)}).`)
			);
		}
		renewedAt = 0; // the feed may have taken a while: renew before applying
		if (!(await stillOwner())) return;
		// The feed poll may have found the key revoked (a 401 → needs_reauth): nothing more runs on a connection that
		// is no longer active (review F17), instead of pushing every due change with the old key.
		const current = await this.dataSource.getRepository(EverWorksConnection).findOne({ where: { id } });
		if (!current || current.status !== EverWorksConnectionStatus.ACTIVE) return;
		await this.applier.drain(current, 200, this.timeFor(tickNow), stillOwner, this.owner);
		// A drain stops quietly when its lease moved: re-check it (no cached answer) before the next stage.
		renewedAt = 0;
		if (!(await stillOwner())) return;
		await this.pusher.drain(current, 100, this.timeFor(tickNow), stillOwner, this.owner);
		renewedAt = 0;
		for (const [index, sweeper] of this.sweepers.entries()) {
			const key = `${id}:${index}`;
			if (Date.now() - (this.lastSweep.get(key) ?? 0) < sweeper.sweepIntervalMs) continue;
			if (!(await stillOwner())) return;
			this.lastSweep.set(key, Date.now());
			const lease = everWorksLease(this.dataSource, id, this.owner, this.timeFor(tickNow));
			const lost = await withLeaseFence(lease, () => sweeper.sweep(current, stillOwner)).then(
				() => false,
				(error) => {
					if (error instanceof EverWorksLeaseLostError) return true;
					this.logger.warn(`Connection ${connection.id}: a sweep failed (${describeSyncError(error)}).`);
					return false;
				}
			);
			if (lost) {
				this.logger.warn(`Connection ${connection.id}: the lease moved to another process during a sweep; the pass stopped.`);
				return;
			}
		}
	}

	/** The current time, or the time a test pins the tick to. */
	private timeFor(pinned: Date | undefined): Date {
		return pinned ?? new Date();
	}

	/** Claims (or renews) the lease on a connection; true when this process holds it now. */
	async claim(connectionId: ID, now: Date): Promise<boolean> {
		const result = await this.dataSource
			.createQueryBuilder()
			.update(EverWorksConnection)
			.set({ leaseOwner: this.owner, leaseUntil: new Date(now.getTime() + SYNC_LEASE_MS) } as never)
			// Free, expired, or already ours (property names: the builder quotes them per dialect).
			.where([
				{ id: connectionId, leaseUntil: IsNull() },
				{ id: connectionId, leaseUntil: LessThan(now) },
				{ id: connectionId, leaseOwner: this.owner }
			] as never)
			.execute();
		return (result.affected ?? 0) > 0;
	}
}
