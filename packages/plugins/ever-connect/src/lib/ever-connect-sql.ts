import { DataSource } from 'typeorm';
import {
	dialectOf,
	placeholder,
	quote,
	runSql,
	SqlDialect,
	SqlResult,
	toBool,
	toNumber
} from '@gauzy/plugin-ever-instance';

/**
 * Small, dialect-aware statements over the plugin's own tables (Postgres, MySQL, SQLite; either
 * ORM): the plugin reads and writes them through TypeORM's data source with hand-written SQL, the
 * way the instance identity does, so the same code runs on every database Gauzy supports.
 */
export type Row = Record<string, unknown>;
export type Where = Record<string, unknown>;

/** A value as every driver binds it: booleans become 1/0 except on Postgres. */
function bindable(dialect: SqlDialect, value: unknown): unknown {
	if (typeof value === 'boolean' && dialect !== 'postgres') {
		return value ? 1 : 0;
	}
	return value === undefined ? null : value;
}

export class EverConnectSql {
	/**
	 * @param dataSource - The data source the statements run on.
	 * @param executor - Runs one statement (with parameters already bound); by default on its own query runner.
	 *   {@link inTransaction} passes one that runs them in its transaction.
	 */
	constructor(
		private readonly dataSource: DataSource,
		private readonly executor?: (sql: string, params: unknown[]) => Promise<SqlResult<Row>>
	) {}

	/** One statement, on the executor of this instance. */
	private exec<T = Row>(sql: string, params: unknown[] = []): Promise<SqlResult<T>> {
		return this.executor
			? (this.executor(sql, params) as Promise<SqlResult<T>>)
			: runSql<T>(this.dataSource, sql, params);
	}

	get dialect(): SqlDialect {
		return dialectOf(this.dataSource);
	}

	q(name: string): string {
		return quote(this.dialect, name);
	}

	/** `WHERE a = $1 AND b IS NULL ...` with its parameters, numbered from `from`. */
	private where(where: Where, from: number): { sql: string; params: unknown[] } {
		const parts: string[] = [];
		const params: unknown[] = [];
		for (const [column, value] of Object.entries(where)) {
			if (value === null) {
				parts.push(`${this.q(column)} IS NULL`);
			} else {
				params.push(bindable(this.dialect, value));
				parts.push(`${this.q(column)} = ${placeholder(this.dialect, from + params.length - 1)}`);
			}
		}
		return { sql: parts.length ? ` WHERE ${parts.join(' AND ')}` : '', params };
	}

	async insert(table: string, values: Row): Promise<void> {
		const columns = Object.keys(values);
		await this.exec(
			`INSERT INTO ${this.q(table)} (${columns.map((c) => this.q(c)).join(', ')}) VALUES (${columns.map((_, i) => placeholder(this.dialect, i + 1)).join(', ')})`,
			Object.values(values).map((v) => bindable(this.dialect, v))
		);
	}

	/** `INSERT` that does nothing when a unique key already exists. Returns whether a row was written. */
	async insertIgnore(table: string, values: Row): Promise<boolean> {
		const columns = Object.keys(values);
		const cols = columns.map((c) => this.q(c)).join(', ');
		const marks = columns.map((_, i) => placeholder(this.dialect, i + 1)).join(', ');
		const d = this.dialect;
		const sql =
			d === 'postgres'
				? `INSERT INTO ${this.q(table)} (${cols}) VALUES (${marks}) ON CONFLICT DO NOTHING`
				: d === 'mysql'
					? `INSERT IGNORE INTO ${this.q(table)} (${cols}) VALUES (${marks})`
					: `INSERT OR IGNORE INTO ${this.q(table)} (${cols}) VALUES (${marks})`;
		const { affected } = await this.exec(
			sql,
			Object.values(values).map((v) => bindable(this.dialect, v))
		);
		return affected > 0;
	}

	/** `UPDATE table SET ... WHERE ...`; returns the number of rows changed. */
	async update(table: string, values: Row, where: Where): Promise<number> {
		const sets = Object.keys(values).map((c, i) => `${this.q(c)} = ${placeholder(this.dialect, i + 1)}`);
		const w = this.where(where, sets.length + 1);
		const { affected } = await this.exec(`UPDATE ${this.q(table)} SET ${sets.join(', ')}${w.sql}`, [
			...Object.values(values).map((v) => bindable(this.dialect, v)),
			...w.params
		]);
		return affected;
	}

	async select<T = Row>(
		table: string,
		where: Where = {},
		options: { orderBy?: Array<[string, 'ASC' | 'DESC']>; limit?: number; offset?: number } = {}
	): Promise<T[]> {
		const w = this.where(where, 1);
		const order = options.orderBy?.length
			? ` ORDER BY ${options.orderBy.map(([c, dir]) => `${this.q(c)} ${dir}`).join(', ')}`
			: '';
		const limit = options.limit !== undefined ? ` LIMIT ${Math.max(0, Math.floor(options.limit))}` : '';
		const offset = options.offset ? ` OFFSET ${Math.max(0, Math.floor(options.offset))}` : '';
		const { rows } = await this.exec<T>(
			`SELECT * FROM ${this.q(table)}${w.sql}${order}${limit}${offset}`,
			w.params
		);
		return rows;
	}

	async one<T = Row>(table: string, where: Where): Promise<T | null> {
		const rows = await this.select<T>(table, where, { limit: 1 });
		return rows[0] ?? null;
	}

	async count(table: string, where: Where = {}): Promise<number> {
		const w = this.where(where, 1);
		const { rows } = await this.exec<{ n: unknown }>(
			`SELECT COUNT(*) AS ${this.q('n')} FROM ${this.q(table)}${w.sql}`,
			w.params
		);
		return toNumber(rows[0]?.n) ?? 0;
	}

	async run(sql: string, params: unknown[] = []): Promise<{ rows: Row[]; affected: number }> {
		return this.exec(
			sql,
			params.map((v) => bindable(this.dialect, v))
		);
	}

	ph(index: number): string {
		return placeholder(this.dialect, index);
	}

	/**
	 * Runs `work` in one transaction. On Postgres it first takes the transaction-scoped advisory lock
	 * named `lockName`, so concurrent API processes run it one after the other.
	 */
	async transaction<T>(
		lockName: string | null,
		work: (runner: { query: (sql: string, params?: unknown[]) => Promise<unknown> }) => Promise<T>
	): Promise<T> {
		const runner = this.dataSource.createQueryRunner();
		await runner.connect();
		await runner.startTransaction();
		try {
			if (lockName && this.dialect === 'postgres') {
				await runner.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockName]);
			}
			const result = await work({
				query: (sql, params = []) =>
					runner.query(
						sql,
						params.map((v) => bindable(this.dialect, v))
					)
			});
			await runner.commitTransaction();
			return result;
		} catch (error) {
			if (runner.isTransactionActive) {
				await runner.rollbackTransaction();
			}
			throw error;
		} finally {
			await runner.release();
		}
	}

	/**
	 * Runs `work` in one transaction, with an `EverConnectSql` whose every statement runs in it: committed when `work`
	 * resolves, rolled back when it throws. With `lockName`, concurrent API processes run it one after the other: on
	 * Postgres under the transaction-scoped advisory lock of that name, on MySQL under the named lock of that name
	 * (taken before the transaction reads anything, released after it ends); SQLite has one writer at a time.
	 */
	async inTransaction<T>(lockName: string | null, work: (sql: EverConnectSql) => Promise<T>): Promise<T> {
		if (this.dialect !== 'sqlite') {
			return this.runInTransaction(lockName, work);
		}
		// SQLite: the data source has one query runner, shared by every caller. One of these transactions runs at a
		// time, and only once no other transaction is open on that runner, so it never becomes a savepoint inside
		// someone else's transaction (whose rollback would take these writes, or this rollback theirs).
		const previous = sqliteQueue.get(this.dataSource) ?? Promise.resolve();
		const mine = previous
			.catch(() => undefined)
			.then(async () => {
				await this.untilNoOpenTransaction();
				return this.runInTransaction(lockName, work);
			});
		sqliteQueue.set(
			this.dataSource,
			mine.catch(() => undefined)
		);
		return mine;
	}

	/** Waits (up to 30 s) until no transaction is open on SQLite's shared query runner. */
	private async untilNoOpenTransaction(): Promise<void> {
		const runner = this.dataSource.createQueryRunner();
		const until = Date.now() + 30_000;
		while (runner.isTransactionActive) {
			if (Date.now() > until) {
				throw new Error('Another transaction is still open; this change is tried again.');
			}
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
	}

	private async runInTransaction<T>(lockName: string | null, work: (sql: EverConnectSql) => Promise<T>): Promise<T> {
		const runner = this.dataSource.createQueryRunner();
		let mysqlLock = false;
		try {
			await runner.connect();
			if (lockName && this.dialect === 'mysql') {
				const [row] = (await runner.query('SELECT GET_LOCK(?, 30) AS `locked`', [lockName])) as Row[];
				if (toNumber(row?.['locked']) !== 1) {
					throw new Error('The lock of this change could not be taken; it is tried again.');
				}
				mysqlLock = true;
			}
			await runner.startTransaction();
			if (lockName && this.dialect === 'postgres') {
				await runner.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockName]);
			}
			const result = await work(
				new EverConnectSql(this.dataSource, async (sql, params) => {
					const structured = await runner.query(sql, params, true);
					return {
						rows: (Array.isArray(structured?.records) ? structured.records : []) as Row[],
						affected: typeof structured?.affected === 'number' ? structured.affected : 0
					};
				})
			);
			await runner.commitTransaction();
			return result;
		} catch (error) {
			if (runner.isTransactionActive) {
				await runner.rollbackTransaction();
			}
			throw error;
		} finally {
			if (mysqlLock) {
				await runner.query('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => undefined);
			}
			await runner.release();
		}
	}
}

/** The SQLite transactions of `inTransaction`, one after the other, per data source. */
const sqliteQueue = new WeakMap<DataSource, Promise<unknown>>();

/** A number read back from any driver, or `null`. */
export const num = (value: unknown): number | null => toNumber(value);

/** A boolean read back from any driver. */
export const flag = (value: unknown): boolean => toBool(value);

/** A string, or `null` for an empty value. */
export const str = (value: unknown): string | null =>
	value === null || value === undefined || value === '' ? null : String(value);
