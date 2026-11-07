// cspell:ignore hashtext
import { QueryRunner } from 'typeorm';

/** The three SQL families the plugin's migrations are written for. */
export type RealtimeDialect = 'postgres' | 'sqlite' | 'mysql';

/** The dialect of a query runner; anything else is refused (Gauzy supports these three). */
export function dialectOf(queryRunner: QueryRunner): RealtimeDialect {
	// A string: TypeORM 1 names no 'sqlite' driver, but Gauzy's DB_TYPE=sqlite runs on better-sqlite3.
	const type = String(queryRunner.connection.options.type);
	if (type === 'postgres') return 'postgres';
	if (type === 'sqlite' || type === 'better-sqlite3' || type === 'sqljs') return 'sqlite';
	if (type === 'mysql' || type === 'mariadb') return 'mysql';
	throw new Error(`Unsupported database: ${type}`);
}

/** Quotes an identifier for the dialect. */
export function q(dialect: RealtimeDialect, name: string): string {
	return dialect === 'mysql' ? `\`${name}\`` : `"${name}"`;
}

/** The n-th (1-based) bind parameter of the dialect. */
export function param(dialect: RealtimeDialect, n: number): string {
	return dialect === 'postgres' ? `$${n}` : '?';
}

/**
 * Serialises the plugin's migrations on Postgres (several API processes may start at once); a
 * transaction-scoped lock, released with the migration transaction. No-op elsewhere.
 */
export async function lockMigrations(queryRunner: QueryRunner): Promise<void> {
	if (dialectOf(queryRunner) === 'postgres') {
		await queryRunner.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['gauzy-realtime:migrations']);
	}
}
