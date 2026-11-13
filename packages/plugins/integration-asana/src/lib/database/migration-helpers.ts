// cspell:ignore sqljs schemaname tablename conrelid relnamespace nspname relname conname
import { QueryRunner } from 'typeorm';

/** The three SQL families the plugin's migrations are written for. */
export type AsanaDialect = 'postgres' | 'sqlite' | 'mysql';

/** The dialect of a query runner; anything else is refused (the platform supports these three). */
export function dialectOf(queryRunner: QueryRunner): AsanaDialect {
	const type = String(queryRunner.connection.options.type);
	if (type === 'postgres') return 'postgres';
	if (type === 'sqlite' || type === 'better-sqlite3' || type === 'sqljs') return 'sqlite';
	if (type === 'mysql' || type === 'mariadb') return 'mysql';
	throw new Error(`Unsupported database: ${type}`);
}

/** Quotes an identifier for the dialect. */
export function q(dialect: AsanaDialect, name: string): string {
	return dialect === 'mysql' ? `\`${name}\`` : `"${name}"`;
}

/** Serialises the plugin's migrations on Postgres (several API processes may start at once). No-op elsewhere. */
export async function lockMigrations(queryRunner: QueryRunner): Promise<void> {
	if (dialectOf(queryRunner) === 'postgres') {
		await queryRunner.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['integration-asana:migrations']);
	}
}

/** Whether an index of that name exists on the table. */
export async function hasIndex(queryRunner: QueryRunner, table: string, name: string): Promise<boolean> {
	const dialect = dialectOf(queryRunner);
	if (dialect === 'postgres') {
		const rows = await queryRunner.query(
			`SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND tablename = $1 AND indexname = $2`,
			[table, name]
		);
		return rows.length > 0;
	}
	if (dialect === 'mysql') {
		const rows = await queryRunner.query(
			'SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
			[table, name]
		);
		return rows.length > 0;
	}
	const rows = await queryRunner.query(`SELECT 1 FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND name = ?`, [table, name]);
	return rows.length > 0;
}

export interface IndexSpec {
	name: string;
	columns: string[];
	unique?: boolean;
}

/** Creates the index when it does not exist (re-running issues no DDL). */
export async function createIndexIfMissing(queryRunner: QueryRunner, table: string, spec: IndexSpec): Promise<void> {
	if (await hasIndex(queryRunner, table, spec.name)) return;
	const dialect = dialectOf(queryRunner);
	const columns = spec.columns.map((column) => q(dialect, column)).join(', ');
	try {
		await queryRunner.query(`CREATE ${spec.unique ? 'UNIQUE ' : ''}INDEX ${q(dialect, spec.name)} ON ${q(dialect, table)} (${columns})`);
	} catch (error) {
		// Another process created it between the probe and here.
		if (await hasIndex(queryRunner, table, spec.name)) return;
		throw error;
	}
}

/** Whether a foreign key (constraint) of that name exists on the table (Postgres and MySQL). */
export async function hasConstraint(queryRunner: QueryRunner, table: string, name: string): Promise<boolean> {
	const dialect = dialectOf(queryRunner);
	if (dialect === 'postgres') {
		const rows = await queryRunner.query(
			`SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = current_schema() AND t.relname = $1 AND c.conname = $2`,
			[table, name]
		);
		return rows.length > 0;
	}
	if (dialect === 'mysql') {
		const rows = await queryRunner.query(
			'SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? LIMIT 1',
			[table, name]
		);
		return rows.length > 0;
	}
	return false;
}

export interface ForeignKeySpec {
	name: string;
	column: string;
	references: string;
	onDelete: 'CASCADE' | 'SET NULL';
}

/** Adds a foreign key when it does not exist (Postgres and MySQL; SQLite declares its foreign keys in `CREATE TABLE`). */
export async function addForeignKeyIfMissing(queryRunner: QueryRunner, table: string, fk: ForeignKeySpec): Promise<void> {
	const dialect = dialectOf(queryRunner);
	if (dialect === 'sqlite' || (await hasConstraint(queryRunner, table, fk.name))) return;
	try {
		await queryRunner.query(
			`ALTER TABLE ${q(dialect, table)} ADD CONSTRAINT ${q(dialect, fk.name)} FOREIGN KEY (${q(dialect, fk.column)}) REFERENCES ${q(
				dialect,
				fk.references
			)}(${q(dialect, 'id')}) ON DELETE ${fk.onDelete} ON UPDATE NO ACTION`
		);
	} catch (error) {
		if (await hasConstraint(queryRunner, table, fk.name)) return;
		throw error;
	}
}

/**
 * The columns every tenant- and organization-scoped platform entity carries (`TenantOrganizationBaseEntity`),
 * as each dialect's `CREATE TABLE` writes them — the same spellings as the platform's own migrations.
 */
export function baseColumns(dialect: AsanaDialect): string {
	if (dialect === 'postgres') {
		return `"deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid`;
	}
	if (dialect === 'mysql') {
		return '`deletedAt` datetime(6) NULL, `createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), `createdByUserId` varchar(36) NULL, `updatedByUserId` varchar(36) NULL, `deletedByUserId` varchar(36) NULL, `id` varchar(36) NOT NULL, `isActive` tinyint NULL DEFAULT 1, `isArchived` tinyint NULL DEFAULT 0, `archivedAt` datetime NULL, `tenantId` varchar(36) NULL, `organizationId` varchar(36) NULL';
	}
	return `"deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar`;
}

/** The base indexes every plugin table gets (tenant, organization, active, archived). */
export function baseIndexes(prefix: string): IndexSpec[] {
	return [
		{ name: `IDX_${prefix}_tenant`, columns: ['tenantId'] },
		{ name: `IDX_${prefix}_organization`, columns: ['organizationId'] },
		{ name: `IDX_${prefix}_is_active`, columns: ['isActive'] },
		{ name: `IDX_${prefix}_is_archived`, columns: ['isArchived'] }
	];
}

/** Tenant and organization foreign keys (CASCADE: a deleted tenant or organization takes its rows with it). */
export function baseForeignKeys(prefix: string): ForeignKeySpec[] {
	return [
		{ name: `FK_${prefix}_tenant`, column: 'tenantId', references: 'tenant', onDelete: 'CASCADE' },
		{ name: `FK_${prefix}_organization`, column: 'organizationId', references: 'organization', onDelete: 'CASCADE' }
	];
}

/** Foreign keys written inline for SQLite's `CREATE TABLE`. */
export function sqliteForeignKeys(fks: ForeignKeySpec[]): string {
	return fks
		.map((fk) => `CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}" ("id") ON DELETE ${fk.onDelete} ON UPDATE NO ACTION`)
		.join(', ');
}

/** Drops the table when it exists (its indexes and constraints go with it). */
export async function dropTableIfExists(queryRunner: QueryRunner, table: string): Promise<void> {
	await queryRunner.query(`DROP TABLE IF EXISTS ${q(dialectOf(queryRunner), table)}`);
}

/** The column types of the plugin's own columns, per dialect. */
export function columnTypes(d: AsanaDialect) {
	return {
		varchar: (n: number) => (d === 'postgres' ? `character varying(${n})` : `varchar(${n})`),
		uuid: d === 'postgres' ? 'uuid' : d === 'mysql' ? 'varchar(36)' : 'varchar',
		timestamp: d === 'postgres' ? 'TIMESTAMP' : 'datetime',
		integer: d === 'mysql' ? 'int' : 'integer',
		boolean: (value: boolean) =>
			d === 'postgres' ? `boolean NOT NULL DEFAULT ${value}` : d === 'mysql' ? `tinyint NOT NULL DEFAULT ${value ? 1 : 0}` : `boolean NOT NULL DEFAULT (${value ? 1 : 0})`,
		text: 'text',
		nul: d === 'mysql' ? ' NULL' : '',
		def: (value: string) => (d === 'sqlite' ? `DEFAULT ('${value}')` : `DEFAULT '${value}'`)
	};
}
