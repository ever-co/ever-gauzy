import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, Optional } from '@nestjs/common';
import { DataSource, IsNull, LessThan } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { isEverWorksEnabled } from '../ever-works-enabled';
import { EVER_WORKS_ENV } from '../ever-works.tokens';
import { EverWorksConnection, EverWorksConnectionStatus } from './ever-works-connection.entity';
import { EverWorksConnectionService } from './ever-works-connection.service';

/** How often each connection is checked (plan 03 §C.7: `whoami` every 24 h). */
export const EVER_WORKS_HEALTH_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** How often a process looks for a connection that is due. */
export const EVER_WORKS_HEALTH_TICK_MS = 15 * 60 * 1000;

/**
 * The daily health check of every active connection (`whoami`; a 401 → `needs_reauth` and a notice).
 *
 * Runs in every process that loads the plugin (each API replica and the worker) and still checks each
 * connection once a day: a process claims a connection with a conditional update of its
 * `lastCheckedAt` (only one claim per day can match), so the row itself is the lease — on every
 * dialect, with or without Redis. Disconnected connections are never checked; nothing is sent while no
 * connection exists.
 */
@Injectable()
export class EverWorksHealthScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger('EverWorksHealth');
	private timer: NodeJS.Timeout | null = null;
	private running = false;
	private readonly env: Record<string, string | undefined>;

	constructor(
		private readonly dataSource: DataSource,
		private readonly connections: EverWorksConnectionService,
		@Optional() @Inject(EVER_WORKS_ENV) env?: Record<string, string | undefined>
	) {
		this.env = env ?? process.env;
	}

	onApplicationBootstrap(): void {
		if (!isEverWorksEnabled(this.env) || this.env['EVER_WORKS_HEALTH_CHECK'] === 'off') return;
		this.timer = setInterval(() => void this.tick(), EVER_WORKS_HEALTH_TICK_MS);
		this.timer.unref?.();
	}

	onApplicationShutdown(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}

	/** Checks every connection that is due and that this process wins the claim for. */
	async tick(now: Date = new Date()): Promise<number> {
		if (this.running) return 0;
		this.running = true;
		let checked = 0;
		try {
			const due = await this.dataSource.getRepository(EverWorksConnection).find({
				where: [
					{ isActive: true, lastCheckedAt: IsNull() },
					{ isActive: true, lastCheckedAt: LessThan(new Date(now.getTime() - EVER_WORKS_HEALTH_INTERVAL_MS)) }
				],
				take: 50
			});
			for (const connection of due) {
				if (connection.status === EverWorksConnectionStatus.DISCONNECTED) continue;
				if (!(await this.claim(connection, now))) continue;
				try {
					await this.connections.checkHealth(connection);
					checked++;
				} catch (error) {
					this.logger.warn(`Health check of connection ${connection.id} failed (${error instanceof Error ? error.name : 'error'}).`);
				}
			}
		} catch (error) {
			// The table may not exist yet (migrations pending); the next tick tries again.
			this.logger.debug?.(`Health tick skipped (${error instanceof Error ? error.name : 'error'}).`);
		} finally {
			this.running = false;
		}
		return checked;
	}

	/** Sets `lastCheckedAt` only while the connection is still due: one winner per connection per day. */
	private async claim(connection: EverWorksConnection, now: Date): Promise<boolean> {
		const repository = this.dataSource.getRepository(EverWorksConnection);
		const cutoff = new Date(now.getTime() - EVER_WORKS_HEALTH_INTERVAL_MS);
		const where = connection.lastCheckedAt
			? { id: connection.id as ID, lastCheckedAt: LessThan(cutoff) }
			: { id: connection.id as ID, lastCheckedAt: IsNull() };
		const result = await repository.update(where, { lastCheckedAt: now });
		return (result.affected ?? 0) > 0;
	}
}
