import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { boolLiteral, dialectOf, placeholder, quote, runSql, SqlDialect, toNumber } from '@gauzy/plugin-ever-instance';
import { CURRENCY_CODE, MAX_SAFE_AMOUNT, toMinorUnits } from './currency-exponent';

/** Injection token: Gauzy's module switches (`FEATURE_*` → boolean). */
export const STATS_FEATURE_FLAGS = 'EVER_STATS_FEATURE_FLAGS';

/** A calendar month in UTC. */
export interface StatsPeriod {
	/** `YYYY-MM`. */
	label: string;
	/** First instant of the month. */
	start: Date;
	/** First instant of the next month. */
	end: Date;
}

/** What the report says about this installation (allow-listed keys only). */
export interface CollectedStats {
	counts: Record<string, number | Record<string, number>>;
	features: Record<string, boolean>;
	aggregates: Record<string, number | Record<string, number>>;
}

/** The integration names of Gauzy, as the report's closed list spells them. Anything else counts as `other`. */
const INTEGRATION_KEYS: Readonly<Record<string, string>> = Object.freeze({
	Import_Export: 'import_export',
	Upwork: 'upwork',
	Hubstaff: 'hubstaff',
	Gauzy_AI: 'gauzy_ai',
	Github: 'github',
	Jira: 'jira',
	MakeCom: 'makecom',
	Zapier: 'zapier',
	ActivePieces: 'activepieces',
	Sim: 'sim',
	Plane: 'plane',
	Ever_Async: 'ever_async',
	Ever_Connect: 'ever_connect'
});

/** The module switches the report may carry (the schema's closed list for Gauzy). */
const FEATURE_KEYS = new Set([
	'dashboard', 'time_tracking', 'estimate', 'estimate_received', 'invoice', 'invoice_recurring', 'invoice_received', 'income',
	'expense', 'payment', 'proposal', 'proposal_template', 'pipeline', 'pipeline_deal', 'dashboard_task', 'team_task', 'my_task', 'job',
	'employees', 'employee_time_activity', 'employee_timesheets', 'employee_appointment', 'employee_approval', 'employee_approval_policy',
	'employee_level', 'employee_position', 'employee_timeoff', 'employee_recurring_expense', 'employee_candidate', 'manage_interview',
	'manage_invite', 'organization', 'organization_equipment', 'organization_inventory', 'organization_tag', 'organization_vendor',
	'organization_project', 'organization_department', 'organization_team', 'organization_document', 'documents',
	'organization_employment_type', 'organization_recurring_expense', 'organization_help_center', 'contact', 'goal', 'goal_report',
	'goal_setting', 'report', 'user', 'organizations', 'app_integration', 'setting', 'email_history', 'email_template', 'import_export',
	'file_storage', 'payment_gateway', 'sms_gateway', 'smtp', 'roles_permission', 'email_verification', 'open_stats'
]);

/** The largest count the schema accepts. */
const MAX_COUNT = 1_000_000_000;
/** At most this many currencies per amount map. */
const MAX_CURRENCIES = 20;
/** The whole collection may take this long. */
const COLLECTION_TIMEOUT_MS = 120_000;
/** On Postgres, one statement of the collection may take this long. */
const STATEMENT_TIMEOUT_MS = 30_000;

/** Injection token (tests): the Postgres statement timeout of the collection, in milliseconds. */
export const STATS_STATEMENT_TIMEOUT_MS = 'EVER_STATS_STATEMENT_TIMEOUT_MS';
/** "Active" users signed in within this many days before the collection. */
const ACTIVE_USER_DAYS = 30;

/** Runs one read of the collection and returns its rows. */
type Query = <T = Record<string, unknown>>(sql: string, parameters?: unknown[]) => Promise<T[]>;

/** The calendar month (UTC) that contains `at`, or the one before it. */
export function statsPeriod(at: Date, monthsBack = 0): StatsPeriod {
	const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() - monthsBack, 1));
	const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
	const label = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
	return { label, start, end };
}

/** `YYYY-MM-DD HH:MM:SS` in UTC: a form every supported database compares correctly with its timestamps. */
export function sqlTimestamp(date: Date): string {
	return date.toISOString().slice(0, 19).replace('T', ' ');
}

const count = (value: unknown): number => {
	const n = Math.floor(toNumber(value) ?? 0);
	return Math.min(Math.max(n, 0), MAX_COUNT);
};

/**
 * Builds the counts, module switches and monthly totals of a report.
 *
 * Every number is instance-wide (all tenants together, never one tenant's): each is one `COUNT(*)`
 * or `SUM()` over a whole table, read with the plugin's own SQL through the database connection, so
 * no request context or tenant filter of Gauzy's services can narrow it, wherever the collection
 * runs (the daily timer, or an operator's request for *What is sent* or *Send now*). Amounts are per
 * currency, in integer minor units, for one UTC month. Nothing that names or identifies a person, a
 * company or a record is read. On Postgres every statement runs under a 30 s statement timeout, in
 * one transaction.
 */
@Injectable()
export class EverStatsCollector {
	private readonly logger = new Logger('EverStats');

	private readonly statementTimeoutMs: number;

	constructor(
		private readonly dataSource: DataSource,
		@Inject(STATS_FEATURE_FLAGS) private readonly featureFlags: Record<string, boolean>,
		@Optional() @Inject(STATS_STATEMENT_TIMEOUT_MS) statementTimeoutMs?: number
	) {
		this.statementTimeoutMs = Number.isInteger(statementTimeoutMs) && (statementTimeoutMs as number) > 0 ? (statementTimeoutMs as number) : STATEMENT_TIMEOUT_MS;
	}

	/**
	 * Collects everything for `period`; "active" users are counted back from `now`. Throws when the
	 * collection fails or takes over 120 s.
	 */
	async collect(period: StatsPeriod, now: Date = new Date()): Promise<CollectedStats> {
		let timer: NodeJS.Timeout | undefined;
		const timeout = new Promise<never>((_, reject) => {
			timer = setTimeout(() => reject(new Error('collection_timeout')), COLLECTION_TIMEOUT_MS);
			timer.unref?.();
		});
		try {
			return await Promise.race([this.withQuery((query) => this.collectNow(query, period, now)), timeout]);
		} finally {
			clearTimeout(timer);
		}
	}

	/**
	 * Runs `work` with a query function. On Postgres: one connection, one transaction, and a statement
	 * timeout, so a slow query on a large database is stopped by the database itself.
	 */
	private async withQuery<T>(work: (query: Query) => Promise<T>): Promise<T> {
		if (dialectOf(this.dataSource) !== 'postgres') {
			return work(async <R>(sql: string, parameters: unknown[] = []) => (await runSql<R>(this.dataSource, sql, parameters)).rows);
		}
		const runner = this.dataSource.createQueryRunner();
		try {
			await runner.connect();
			await runner.startTransaction();
			await runner.query(`SET LOCAL statement_timeout = ${this.statementTimeoutMs}`);
			const result = await work(async <R>(sql: string, parameters: unknown[] = []) => {
				const answer = await runner.query(sql, parameters, true);
				return (Array.isArray(answer?.records) ? answer.records : []) as R[];
			});
			await runner.commitTransaction();
			return result;
		} catch (error) {
			if (runner.isTransactionActive) {
				await runner.rollbackTransaction().catch(() => undefined);
			}
			throw error;
		} finally {
			await runner.release();
		}
	}

	/** The module switches, `FEATURE_` removed and lower-cased, as far as the schema lists them. */
	features(): Record<string, boolean> {
		const out: Record<string, boolean> = {};
		for (const [name, enabled] of Object.entries(this.featureFlags ?? {})) {
			const key = name.replace(/^FEATURE_/, '').toLowerCase();
			if (FEATURE_KEYS.has(key)) {
				out[key] = enabled === true;
			}
		}
		return out;
	}

	private async collectNow(query: Query, period: StatsPeriod, now: Date): Promise<CollectedStats> {
		const d = dialectOf(this.dataSource);
		const activeSince = new Date(now.getTime() - ACTIVE_USER_DAYS * 86_400_000);
		const counts = {
			tenants: await this.countRows(query, d, 'tenant'),
			organizations: await this.countRows(query, d, 'organization'),
			users: await this.countRows(query, d, 'user'),
			users_active_30d: await this.countRows(query, d, 'user', `${quote(d, 'lastLoginAt')} > ${placeholder(d, 1)}`, [sqlTimestamp(activeSince)]),
			employees: await this.countRows(query, d, 'employee'),
			employees_active: await this.countRows(
				query,
				d,
				'employee',
				`${quote(d, 'isActive')} = ${boolLiteral(d, true)} AND (${quote(d, 'isArchived')} IS NULL OR ${quote(d, 'isArchived')} = ${boolLiteral(d, false)})`
			),
			teams: await this.countRows(query, d, 'organization_team'),
			projects: await this.countRows(query, d, 'organization_project'),
			tasks: await this.countRows(query, d, 'task'),
			contacts: await this.countRows(query, d, 'organization_contact'),
			integrations_in_use: await this.integrationsInUse(query, d)
		};
		const invoices = await this.amounts(
			query,
			d,
			'invoice',
			'totalValue',
			'invoiceDate',
			period,
			`(${quote(d, 'isEstimate')} IS NULL OR ${quote(d, 'isEstimate')} = ${boolLiteral(d, false)})`
		);
		const payments = await this.amounts(query, d, 'payment', 'amount', 'paymentDate', period);
		const minutes = await this.trackedMinutes(query, d, period);
		return {
			counts,
			features: this.features(),
			aggregates: {
				invoiced_minor: this.currencyMap(invoices.byCurrency, false),
				invoices: invoices.count,
				payments_minor: this.currencyMap(payments.byCurrency, true),
				payments: payments.count,
				hours_tracked_min: minutes
			}
		};
	}

	/** The rows of `table` that are not deleted (and match `where`), all tenants together. */
	private async countRows(query: Query, d: SqlDialect, table: string, where?: string, parameters: unknown[] = []): Promise<number> {
		const rows = await query<{ n: unknown }>(
			`SELECT COUNT(*) AS ${quote(d, 'n')} FROM ${quote(d, table)} WHERE ${quote(d, 'deletedAt')} IS NULL${where ? ` AND ${where}` : ''}`,
			parameters
		);
		return count(rows[0]?.n);
	}

	/** Per integration, the number of tenants that have it active. */
	private async integrationsInUse(query: Query, d: SqlDialect): Promise<Record<string, number>> {
		const q = (name: string) => quote(d, name);
		const rows = await query<{ name: unknown; n: unknown }>(
			`SELECT ${q('name')} AS ${q('name')}, COUNT(DISTINCT ${q('tenantId')}) AS ${q('n')} FROM ${q('integration_tenant')} ` +
				`WHERE ${q('deletedAt')} IS NULL AND ${q('isActive')} = ${boolLiteral(d, true)} GROUP BY ${q('name')}`
		);
		const out: Record<string, number> = {};
		for (const row of rows) {
			const key = INTEGRATION_KEYS[String(row.name)] ?? 'other';
			out[key] = count((out[key] ?? 0) + count(row.n));
		}
		return out;
	}

	/** The number of rows in the period, and their total per currency (raw decimals as the database returns them). */
	private async amounts(
		query: Query,
		d: SqlDialect,
		table: string,
		amountColumn: string,
		dateColumn: string,
		period: StatsPeriod,
		where?: string
	): Promise<{ count: number; byCurrency: Array<{ currency: string; total: unknown }> }> {
		const q = (name: string) => quote(d, name);
		// MySQL compares text case-insensitively by default, so `EUR` and `eur` would fall into one group
		// (and the whole group could be left out as `eur`). Grouping by the exact bytes keeps them apart,
		// as on Postgres and SQLite.
		const currency = d === 'mysql' ? `MIN(${q('currency')})` : q('currency');
		const groupBy = d === 'mysql' ? `HEX(${q('currency')})` : q('currency');
		const rows = await query<{ currency: unknown; n: unknown; total: unknown }>(
			`SELECT ${currency} AS ${q('currency')}, COUNT(*) AS ${q('n')}, SUM(${q(amountColumn)}) AS ${q('total')} FROM ${q(table)} ` +
				`WHERE ${q('deletedAt')} IS NULL AND ${q(dateColumn)} >= ${placeholder(d, 1)} AND ${q(dateColumn)} < ${placeholder(d, 2)}` +
				`${where ? ` AND ${where}` : ''} GROUP BY ${groupBy}`,
			[sqlTimestamp(period.start), sqlTimestamp(period.end)]
		);
		return {
			count: count(rows.reduce((sum, row) => sum + count(row.n), 0)),
			byCurrency: rows.map((row) => ({ currency: typeof row.currency === 'string' ? row.currency : '', total: row.total }))
		};
	}

	/**
	 * Totals per currency in integer minor units. A key that is not three upper-case letters (or no
	 * currency) is left out; at most 20 currencies (the largest totals); an amount beyond 2^53 - 1 is
	 * capped; invoiced totals are never negative.
	 */
	currencyMap(rows: Array<{ currency: string; total: unknown }>, signed: boolean): Record<string, number> {
		const totals = new Map<string, bigint>();
		let dropped = 0;
		for (const { currency, total } of rows) {
			if (!CURRENCY_CODE.test(currency)) {
				dropped += 1;
				continue;
			}
			const minor = toMinorUnits(total ?? 0, currency);
			if (minor === null) {
				dropped += 1;
				continue;
			}
			totals.set(currency, (totals.get(currency) ?? 0n) + minor);
		}
		if (dropped) {
			this.logger.warn(`${dropped} amount group(s) without a three-letter currency code were left out of the report.`);
		}
		let clamped = false;
		const entries = [...totals.entries()].map(([currency, minor]): [string, bigint] => {
			let value = minor;
			if (!signed && value < 0n) {
				value = 0n;
				clamped = true;
			}
			if (value > MAX_SAFE_AMOUNT) {
				value = MAX_SAFE_AMOUNT;
				clamped = true;
			}
			if (value < -MAX_SAFE_AMOUNT) {
				value = -MAX_SAFE_AMOUNT;
				clamped = true;
			}
			return [currency, value];
		});
		if (clamped) {
			this.logger.warn('An amount outside the range a report can carry was capped.');
		}
		entries.sort((a, b) => {
			const abs = (v: bigint) => (v < 0n ? -v : v);
			const diff = abs(b[1]) - abs(a[1]);
			return diff > 0n ? 1 : diff < 0n ? -1 : a[0] < b[0] ? -1 : 1;
		});
		if (entries.length > MAX_CURRENCIES) {
			this.logger.warn(`More than ${MAX_CURRENCIES} currencies in one month; the ${MAX_CURRENCIES} largest totals are reported.`);
		}
		const out: Record<string, number> = {};
		for (const [currency, value] of entries.slice(0, MAX_CURRENCIES).sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
			out[currency] = Number(value);
		}
		return out;
	}

	/** Minutes of time logs that started in the period and are stopped. */
	private async trackedMinutes(query: Query, d: SqlDialect, period: StatsPeriod): Promise<number> {
		const q = (name: string) => quote(d, name);
		const seconds =
			d === 'postgres'
				? `EXTRACT(EPOCH FROM (${q('stoppedAt')} - ${q('startedAt')}))`
				: d === 'mysql'
					? `TIMESTAMPDIFF(SECOND, ${q('startedAt')}, ${q('stoppedAt')})`
					: `(julianday(${q('stoppedAt')}) - julianday(${q('startedAt')})) * 86400`;
		const rows = await query<{ s: unknown }>(
			`SELECT COALESCE(SUM(${seconds}), 0) AS ${q('s')} FROM ${q('time_log')} WHERE ${q('deletedAt')} IS NULL AND ${q('stoppedAt')} IS NOT NULL ` +
				`AND ${q('stoppedAt')} > ${q('startedAt')} AND ${q('startedAt')} >= ${placeholder(d, 1)} AND ${q('startedAt')} < ${placeholder(d, 2)}`,
			[sqlTimestamp(period.start), sqlTimestamp(period.end)]
		);
		// Whole seconds first: SQLite's julianday arithmetic is floating point (9000 s comes back as 8999.99…).
		return count(Math.floor(Math.round(toNumber(rows[0]?.s) ?? 0) / 60));
	}
}
