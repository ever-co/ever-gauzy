import { DataSource } from 'typeorm';

/**
 * Small helpers for the hand-written SQL of the Ever Platform modules, which run on every database
 * Gauzy supports (Postgres, MySQL, SQLite) and on either ORM: they read and write their own tables
 * through TypeORM's data source, which Gauzy always opens.
 */
export type SqlDialect = 'postgres' | 'mysql' | 'sqlite';

/** The dialect of a data source. */
export function dialectOf(dataSource: Pick<DataSource, 'options'>): SqlDialect {
	const type = String(dataSource.options.type);
	if (type === 'postgres') return 'postgres';
	if (type === 'mysql' || type === 'mariadb') return 'mysql';
	if (type === 'sqlite' || type === 'better-sqlite3' || type === 'sqljs') return 'sqlite';
	throw new Error(`Unsupported database: ${type}`);
}

/** A quoted identifier. */
export function quote(dialect: SqlDialect, name: string): string {
	return dialect === 'mysql' ? `\`${name}\`` : `"${name}"`;
}

/** The placeholder of the `index`-th parameter (1-based). */
export function placeholder(dialect: SqlDialect, index: number): string {
	return dialect === 'postgres' ? `$${index}` : '?';
}

/** A boolean literal. */
export function boolLiteral(dialect: SqlDialect, value: boolean): string {
	if (dialect === 'postgres') return value ? 'true' : 'false';
	return value ? '1' : '0';
}

/** A boolean read back from any driver (`true`, `1`, `'1'`, `'t'`). */
export function toBool(value: unknown): boolean {
	return value === true || value === 1 || value === '1' || value === 't' || value === 'true';
}

/** A number read back from any driver (Postgres and MySQL return `bigint` and `numeric` as strings). */
export function toNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : null;
}

/** The result of one statement: the rows read, or the number of rows written. */
export interface SqlResult<T> {
	rows: T[];
	affected: number;
}

/**
 * Runs one statement on its own query runner and returns rows and affected count the same way on
 * every driver.
 */
export async function runSql<T = Record<string, unknown>>(
	dataSource: DataSource,
	sql: string,
	parameters: unknown[] = []
): Promise<SqlResult<T>> {
	const runner = dataSource.createQueryRunner();
	try {
		const result = await runner.query(sql, parameters, true);
		return {
			rows: (Array.isArray(result?.records) ? result.records : []) as T[],
			affected: typeof result?.affected === 'number' ? result.affected : 0
		};
	} finally {
		await runner.release();
	}
}

/** `INSERT` that does nothing when the primary key exists, in the dialect's own words. */
export function insertIgnore(dialect: SqlDialect, table: string, columns: string[]): string {
	const cols = columns.map((c) => quote(dialect, c)).join(', ');
	const values = columns.map((_, i) => placeholder(dialect, i + 1)).join(', ');
	const target = quote(dialect, table);
	if (dialect === 'postgres') return `INSERT INTO ${target} (${cols}) VALUES (${values}) ON CONFLICT DO NOTHING`;
	if (dialect === 'mysql') return `INSERT IGNORE INTO ${target} (${cols}) VALUES (${values})`;
	return `INSERT OR IGNORE INTO ${target} (${cols}) VALUES (${values})`;
}
