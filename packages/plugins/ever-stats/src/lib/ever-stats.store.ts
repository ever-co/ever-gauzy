import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { dialectOf, insertIgnore, placeholder, quote, runSql, SqlDialect, toNumber } from '@gauzy/plugin-ever-instance';
import { STATS_REPORTS_KEPT } from './ever-stats.constants';

/** What happened to a report. */
export type StatsReportStatus = 'pending' | 'sent' | 'rejected' | 'failed';

/** One stored report. `payload` is the exact bytes signed and sent. */
export interface StoredStatsReport {
	id: string;
	period: string;
	payload: string | null;
	status: StatsReportStatus;
	httpStatus: number | null;
	attempts: number;
	lastError: string | null;
	sentAt: number | null;
	createdAt: number;
}

/** The sending lease. */
export interface StatsLease {
	leasedBy: string | null;
	leaseUntil: number | null;
	lastSentAt: number | null;
}

const REPORT = 'ever_stats_report';
const LEASE = 'ever_stats_lease';
const LEASE_ID = 'sender';
const REPORT_COLUMNS = ['id', 'period', 'payload', 'status', 'httpStatus', 'attempts', 'lastError', 'sentAt', 'createdAt'] as const;

/** Reads and writes the plugin's two tables with portable SQL. */
@Injectable()
export class EverStatsStore {
	constructor(private readonly dataSource: DataSource) {}

	private get d(): SqlDialect {
		return dialectOf(this.dataSource);
	}

	private c(name: string): string {
		return quote(this.d, name);
	}

	private p(index: number): string {
		return placeholder(this.d, index);
	}

	async insertReport(report: StoredStatsReport): Promise<void> {
		const columns = REPORT_COLUMNS.map((c) => this.c(c)).join(', ');
		const values = REPORT_COLUMNS.map((_, i) => this.p(i + 1)).join(', ');
		await runSql(
			this.dataSource,
			`INSERT INTO ${this.c(REPORT)} (${columns}) VALUES (${values})`,
			REPORT_COLUMNS.map((c) => report[c])
		);
	}

	async updateReport(id: string, fields: Partial<Omit<StoredStatsReport, 'id' | 'createdAt' | 'period' | 'payload'>>): Promise<void> {
		const entries = Object.entries(fields);
		if (!entries.length) return;
		const sets = entries.map(([name], i) => `${this.c(name)} = ${this.p(i + 1)}`).join(', ');
		await runSql(this.dataSource, `UPDATE ${this.c(REPORT)} SET ${sets} WHERE ${this.c('id')} = ${this.p(entries.length + 1)}`, [
			...entries.map(([, value]) => value),
			id
		]);
	}

	/** The newest reports first. */
	async latest(limit = STATS_REPORTS_KEPT): Promise<StoredStatsReport[]> {
		const { rows } = await runSql(
			this.dataSource,
			`SELECT * FROM ${this.c(REPORT)} ORDER BY ${this.c('createdAt')} DESC, ${this.c('id')} DESC LIMIT ${Math.max(1, Math.floor(limit))}`
		);
		return rows.map((row) => this.toReport(row));
	}

	/** The last report that was accepted. */
	async lastSent(): Promise<StoredStatsReport | null> {
		const { rows } = await runSql(
			this.dataSource,
			`SELECT * FROM ${this.c(REPORT)} WHERE ${this.c('status')} = ${this.p(1)} ORDER BY ${this.c('sentAt')} DESC, ${this.c('createdAt')} DESC LIMIT 1`,
			['sent']
		);
		return rows[0] ? this.toReport(rows[0]) : null;
	}

	/** Deletes every report but the newest `keep`. */
	async prune(keep = STATS_REPORTS_KEPT): Promise<void> {
		const { rows } = await runSql<{ id: string }>(
			this.dataSource,
			`SELECT ${this.c('id')} AS ${this.c('id')} FROM ${this.c(REPORT)} ORDER BY ${this.c('createdAt')} DESC, ${this.c('id')} DESC LIMIT 100000 OFFSET ${Math.max(0, Math.floor(keep))}`
		);
		for (const { id } of rows) {
			await runSql(this.dataSource, `DELETE FROM ${this.c(REPORT)} WHERE ${this.c('id')} = ${this.p(1)}`, [id]);
		}
	}

	/** Creates the lease row once (concurrent calls are harmless). */
	async ensureLease(): Promise<void> {
		await runSql(this.dataSource, insertIgnore(this.d, LEASE, ['id']), [LEASE_ID]);
	}

	/**
	 * Takes the lease for `holder` until `now + ms` when it is free, expired, or already this holder's.
	 * Returns whether it was taken (compare and set: one process wins).
	 */
	async acquireLease(holder: string, now: number, ms: number): Promise<boolean> {
		await this.ensureLease();
		const { affected } = await runSql(
			this.dataSource,
			`UPDATE ${this.c(LEASE)} SET ${this.c('leasedBy')} = ${this.p(1)}, ${this.c('leaseUntil')} = ${this.p(2)} ` +
				`WHERE ${this.c('id')} = ${this.p(3)} AND (${this.c('leaseUntil')} IS NULL OR ${this.c('leaseUntil')} < ${this.p(4)} OR ${this.c('leasedBy')} = ${this.p(5)})`,
			[holder, now + ms, LEASE_ID, now, holder]
		);
		return affected === 1;
	}

	/** Gives the lease back (only this holder's). */
	async releaseLease(holder: string, now: number): Promise<void> {
		await runSql(
			this.dataSource,
			`UPDATE ${this.c(LEASE)} SET ${this.c('leaseUntil')} = ${this.p(1)} WHERE ${this.c('id')} = ${this.p(2)} AND ${this.c('leasedBy')} = ${this.p(3)}`,
			[now, LEASE_ID, holder]
		);
	}

	/** Records an accepted report on the lease, for every process. */
	async markSent(at: number): Promise<void> {
		await runSql(this.dataSource, `UPDATE ${this.c(LEASE)} SET ${this.c('lastSentAt')} = ${this.p(1)} WHERE ${this.c('id')} = ${this.p(2)}`, [
			at,
			LEASE_ID
		]);
	}

	async readLease(): Promise<StatsLease> {
		await this.ensureLease();
		const { rows } = await runSql(this.dataSource, `SELECT * FROM ${this.c(LEASE)} WHERE ${this.c('id')} = ${this.p(1)}`, [LEASE_ID]);
		const row = rows[0] ?? {};
		return {
			leasedBy: row['leasedBy'] ? String(row['leasedBy']) : null,
			leaseUntil: toNumber(row['leaseUntil']),
			lastSentAt: toNumber(row['lastSentAt'])
		};
	}

	private toReport(row: Record<string, unknown>): StoredStatsReport {
		return {
			id: String(row['id']),
			period: String(row['period']),
			payload: row['payload'] === null || row['payload'] === undefined ? null : String(row['payload']),
			status: String(row['status']) as StatsReportStatus,
			httpStatus: toNumber(row['httpStatus']),
			attempts: toNumber(row['attempts']) ?? 0,
			lastError: row['lastError'] ? String(row['lastError']) : null,
			sentAt: toNumber(row['sentAt']),
			createdAt: toNumber(row['createdAt']) ?? 0
		};
	}
}
