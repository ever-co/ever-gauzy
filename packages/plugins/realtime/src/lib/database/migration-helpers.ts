// cspell:ignore hashtext schemaname tablename indexname
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

/** One index of a plugin table. */
export interface IndexSpec {
	name: string;
	columns: string[];
	unique?: boolean;
}

/** A plugin table: its own columns (beside the base ones), its indexes and its foreign keys (CASCADE on delete). */
export interface TableSpec {
	table: string;
	prefix: string;
	columns: (d: RealtimeDialect) => string;
	indexes: IndexSpec[];
	foreignKeys: Array<{ name: string; column: string; references: string }>;
}

/**
 * The columns every tenant- and organization-scoped Gauzy entity carries (`TenantOrganizationBaseEntity`), as each
 * dialect's `CREATE TABLE` writes them — the same spellings as the platform's own migrations.
 */
export function baseColumns(dialect: RealtimeDialect): string {
	if (dialect === 'postgres') {
		return `"deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid`;
	}
	if (dialect === 'mysql') {
		return '`deletedAt` datetime(6) NULL, `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), `createdByUserId` varchar(36) NULL, `updatedByUserId` varchar(36) NULL, `deletedByUserId` varchar(36) NULL, `id` varchar(36) NOT NULL, `isActive` tinyint NULL DEFAULT 1, `isArchived` tinyint NULL DEFAULT 0, `archivedAt` datetime NULL, `tenantId` varchar(36) NULL, `organizationId` varchar(36) NULL';
	}
	return `"deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar`;
}

/** Whether an index of that name exists on the table. */
export async function hasIndex(queryRunner: QueryRunner, table: string, name: string): Promise<boolean> {
	const dialect = dialectOf(queryRunner);
	let rows: unknown[];
	if (dialect === 'postgres') {
		rows = await queryRunner.query(`SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND tablename = $1 AND indexname = $2`, [table, name]);
	} else if (dialect === 'mysql') {
		rows = await queryRunner.query(
			'SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
			[table, name]
		);
	} else {
		rows = await queryRunner.query(`SELECT 1 FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND name = ?`, [table, name]);
	}
	return rows.length > 0;
}

/** Creates the index when it does not exist (re-running issues no DDL). */
export async function createIndexIfMissing(queryRunner: QueryRunner, table: string, spec: IndexSpec): Promise<void> {
	const dialect = dialectOf(queryRunner);
	const columns = spec.columns.map((name) => q(dialect, name)).join(', ');
	const unique = spec.unique ? 'UNIQUE ' : '';
	if (dialect !== 'mysql') {
		// Said in the statement: a failed statement would abort the migration's transaction on Postgres.
		await queryRunner.query(`CREATE ${unique}INDEX IF NOT EXISTS ${q(dialect, spec.name)} ON ${q(dialect, table)} (${columns})`);
		return;
	}
	if (await hasIndex(queryRunner, table, spec.name)) return;
	try {
		await queryRunner.query(`CREATE ${unique}INDEX ${q(dialect, spec.name)} ON ${q(dialect, table)} (${columns})`);
	} catch (error) {
		// MySQL has no IF NOT EXISTS for an index and its DDL auto-commits: another process created it meanwhile.
		if (await hasIndex(queryRunner, table, spec.name)) return;
		throw error;
	}
}

/**
 * Creates the table with its base columns, its primary key and its foreign keys (tenant, organization and the table's
 * own, all CASCADE on delete) in one statement when it does not exist, then the base indexes (idempotent).
 */
export async function createTableIfMissing(queryRunner: QueryRunner, spec: TableSpec): Promise<void> {
	const d = dialectOf(queryRunner);
	const foreignKeys = [
		{ name: `FK_${spec.prefix}_tenant`, column: 'tenantId', references: 'tenant' },
		{ name: `FK_${spec.prefix}_organization`, column: 'organizationId', references: 'organization' },
		...spec.foreignKeys
	]
		.map(
			(fk) =>
				`CONSTRAINT ${q(d, fk.name)} FOREIGN KEY (${q(d, fk.column)}) REFERENCES ${q(d, fk.references)} (${q(d, 'id')}) ON DELETE CASCADE ON UPDATE NO ACTION`
		)
		.join(', ');
	// SQLite declares the key with the id column (see `baseColumns`); the others name it here.
	const primaryKey = d === 'sqlite' ? '' : `CONSTRAINT ${q(d, `PK_${spec.prefix}`)} PRIMARY KEY (${q(d, 'id')}), `;
	const engine = d === 'mysql' ? ' ENGINE=InnoDB' : '';
	await queryRunner.query(`CREATE TABLE IF NOT EXISTS ${q(d, spec.table)} (${baseColumns(d)}, ${spec.columns(d)}, ${primaryKey}${foreignKeys})${engine}`);
	for (const index of [
		{ name: `IDX_${spec.prefix}_tenant`, columns: ['tenantId'] },
		{ name: `IDX_${spec.prefix}_organization`, columns: ['organizationId'] },
		{ name: `IDX_${spec.prefix}_is_active`, columns: ['isActive'] },
		{ name: `IDX_${spec.prefix}_is_archived`, columns: ['isArchived'] }
	]) {
		await createIndexIfMissing(queryRunner, spec.table, index);
	}
}

/** Drops the table when it exists (its indexes and constraints go with it). */
export async function dropTableIfExists(queryRunner: QueryRunner, table: string): Promise<void> {
	await queryRunner.query(`DROP TABLE IF EXISTS ${q(dialectOf(queryRunner), table)}`);
}
