import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, Optional } from '@nestjs/common';
import { hostname } from 'node:os';
import { randomBytes } from 'node:crypto';
import { DataSource, IsNull, LessThan } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { EverWorksConnection, EverWorksConnectionStatus } from '../connection/ever-works-connection.entity';
import { isEverWorksEnabled } from '../ever-works-enabled';
import { EVER_WORKS_ENV } from '../ever-works.tokens';
import { EverWorksSyncLogService } from './ever-works-sync-log.service';
import { EverWorksFeedPoller } from './inbound/ever-works-feed.poller';
import { EverWorksInboundApplier } from './inbound/ever-works-inbound.applier';
import { EverWorksOutboundPusher } from './outbound/ever-works-outbound.pusher';

/** How often a process looks for work. */
export const SYNC_TICK_MS = 5_000;
/** How long a lease on a connection lasts (renewed every tick while held). */
export const SYNC_LEASE_MS = 60_000;

/**
 * The sync loop (plan 03 §C.7): every process that loads the plugin (each API replica and the worker)
 * ticks, and for each active connection it holds a **database lease** on (`leaseOwner`/`leaseUntil` on
 * the connection row, claimed with a conditional update) it polls the change feed when due, applies
 * pending events and pushes pending changes. One process works a connection at a time, on every
 * dialect, with or without Redis — so the order of events per connection holds across replicas.
 *
 * Off with the plugin (`EVER_WORKS_ENABLED` not `true`), and also with `EVER_WORKS_SYNC_LOOP=off` (for a
 * process that should only serve the API). Nothing is sent while no connection exists.
 */
@Injectable()
export class EverWorksSyncLoop implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger('EverWorksSync');
	readonly owner = `${hostname()}:${process.pid}:${randomBytes(4).toString('hex')}`;
	private timer: NodeJS.Timeout | null = null;
	private running = false;
	private lastPrune = 0;
	private readonly env: Record<string, string | undefined>;

	constructor(
		private readonly dataSource: DataSource,
		private readonly feed: EverWorksFeedPoller,
		private readonly applier: EverWorksInboundApplier,
		private readonly pusher: EverWorksOutboundPusher,
		private readonly log: EverWorksSyncLogService,
		@Optional() @Inject(EVER_WORKS_ENV) env?: Record<string, string | undefined>
	) {
		this.env = env ?? process.env;
	}

	onApplicationBootstrap(): void {
		if (!isEverWorksEnabled(this.env) || this.env['EVER_WORKS_SYNC_LOOP'] === 'off') return;
		this.timer = setInterval(() => void this.tick(), SYNC_TICK_MS);
		this.timer.unref?.();
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
	async tick(now: Date = new Date()): Promise<ID[]> {
		if (this.running) return [];
		this.running = true;
		const worked: ID[] = [];
		try {
			const connections = await this.dataSource.getRepository(EverWorksConnection).find({
				where: { isActive: true, status: EverWorksConnectionStatus.ACTIVE }
			});
			for (const connection of connections) {
				if (!(await this.claim(connection.id as ID, now))) continue;
				worked.push(connection.id as ID);
				await this.work(connection).catch((error) =>
					this.logger.warn(`Connection ${connection.id}: sync pass failed (${error instanceof Error ? error.name : 'error'}).`)
				);
			}
			if (now.getTime() - this.lastPrune > 60 * 60_000) {
				this.lastPrune = now.getTime();
				await this.log.prune(now).catch(() => 0);
			}
		} catch (error) {
			// The tables may not exist yet (migrations pending); the next tick tries again.
			this.logger.debug?.(`Sync tick skipped (${error instanceof Error ? error.name : 'error'}).`);
		} finally {
			this.running = false;
		}
		return worked;
	}

	/** Feed (when due), then inbound, then outbound, for one connection this process holds. */
	private async work(connection: EverWorksConnection): Promise<void> {
		const fresh = (await this.dataSource.getRepository(EverWorksConnection).findOne({ where: { id: connection.id as ID } })) ?? connection;
		if (this.feed.isDue(fresh)) {
			await this.feed.poll(fresh).catch((error) =>
				this.logger.warn(`Connection ${connection.id}: feed poll failed (${error instanceof Error ? error.name : 'error'}).`)
			);
		}
		await this.applier.drain(fresh);
		await this.pusher.drain(fresh);
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
