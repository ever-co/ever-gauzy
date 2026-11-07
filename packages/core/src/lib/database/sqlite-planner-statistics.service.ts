import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';

/** How often `PRAGMA optimize` runs on a long-lived connection, as SQLite recommends (hourly). */
export const SQLITE_OPTIMIZE_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Rows `ANALYZE` reads per index (`PRAGMA analysis_limit`): approximate statistics, bounded cost. SQLite's own
 * `PRAGMA optimize` uses 400; the statistics the planner needs (how selective each index is) come out the same.
 */
export const SQLITE_ANALYSIS_LIMIT = 1000;

/**
 * Keeps the SQLite query planner's statistics current.
 *
 * Without `sqlite_stat1` the planner guesses every index's selectivity. On the demo database (SQLite) it answered
 * the activity report (`GET /timesheet/activity/report`, the Apps & URLs page of Ever Teams) by walking every
 * activity row of the organization and, for each, every time log of the organization through the tenant index
 * instead of the primary key: 4 s for a week; with statistics the same statement takes 80 ms and answers the
 * same rows. Statistics change nothing but the plan.
 *
 * `ANALYZE` runs once the application has started (the migrations have run by then) and again after the demo
 * seed, which fills an empty database; `PRAGMA optimize`, which re-analyzes the tables whose statistics are
 * missing or stale, runs every hour. Both read a bounded number of rows per index. Opt out with
 * `DB_SQLITE_PLANNER_STATISTICS=false`. On every other database this service does nothing.
 */
@Injectable()
export class SqlitePlannerStatisticsService implements OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger(SqlitePlannerStatisticsService.name);
	private timer: ReturnType<typeof setInterval> | undefined;

	constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

	/** Whether the connection is SQLite and the statistics are not opted out of. */
	get enabled(): boolean {
		const type = this.dataSource?.options?.type as DatabaseTypeEnum | undefined;
		const sqlite = type === DatabaseTypeEnum.sqlite || type === DatabaseTypeEnum.betterSqlite3;
		return sqlite && !['false', '0', 'no', 'off'].includes(String(process.env.DB_SQLITE_PLANNER_STATISTICS ?? '').toLowerCase());
	}

	async onApplicationBootstrap(): Promise<void> {
		if (!this.enabled) {
			return;
		}
		await this.analyze();
		this.timer = setInterval(() => void this.optimize(), SQLITE_OPTIMIZE_INTERVAL_MS);
		this.timer.unref?.();
	}

	onApplicationShutdown(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = undefined;
		}
	}

	/**
	 * Gathers the planner statistics of every table (`ANALYZE`, bounded by `PRAGMA analysis_limit`). Call it after
	 * a bulk load, such as the demo seed. A failure is logged, never thrown: the statistics are an optimization.
	 */
	async analyze(): Promise<void> {
		if (!this.enabled) {
			return;
		}
		try {
			const started = Date.now();
			await this.dataSource.query(`PRAGMA analysis_limit = ${SQLITE_ANALYSIS_LIMIT}`);
			await this.dataSource.query('ANALYZE');
			this.logger.log(`SQLite planner statistics gathered in ${Date.now() - started} ms`);
		} catch (error) {
			this.logger.warn(`SQLite ANALYZE failed: ${error?.message ?? error}`);
		}
	}

	/** Re-analyzes the tables whose statistics are missing or stale (`PRAGMA optimize`). */
	async optimize(): Promise<void> {
		if (!this.enabled) {
			return;
		}
		try {
			await this.dataSource.query('PRAGMA optimize');
		} catch (error) {
			this.logger.warn(`SQLite PRAGMA optimize failed: ${error?.message ?? error}`);
		}
	}
}
