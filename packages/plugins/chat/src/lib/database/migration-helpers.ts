// cspell:ignore sqljs schemaname tablename conrelid relnamespace nspname relname conname
import { QueryRunner } from 'typeorm';

/** The three SQL families the chat plugin's migrations are written for. */
export type ChatDialect = 'postgres' | 'sqlite' | 'mysql';

/** The dialect of a query runner; anything else is refused (Gauzy supports these three). */
export function dialectOf(queryRunner: QueryRunner): ChatDialect {
	// A string: TypeORM 1 names no 'sqlite' driver, but Gauzy's DB_TYPE=sqlite runs on better-sqlite3.
	const type = String(queryRunner.connection.options.type);
	if (type === 'postgres') return 'postgres';
	if (type === 'sqlite' || type === 'better-sqlite3' || type === 'sqljs') return 'sqlite';
	if (type === 'mysql' || type === 'mariadb') return 'mysql';
	throw new Error(`Unsupported database: ${type}`);
}

/** The n-th (1-based) bind parameter of the dialect. */
export function param(dialect: ChatDialect, n: number): string {
	return dialect === 'postgres' ? `$${n}` : '?';
}

/** Quotes an identifier for the dialect. */
export function q(dialect: ChatDialect, name: string): string {
	return dialect === 'mysql' ? `\`${name}\`` : `"${name}"`;
}

/**
 * Serialises the chat plugin's migrations on Postgres (several API processes may start at once); a
 * transaction-scoped lock, released with the migration transaction. No-op elsewhere: SQLite has one
 * writer and MySQL's DDL is guarded by the probes below.
 */
export async function lockMigrations(queryRunner: QueryRunner): Promise<void> {
	if (dialectOf(queryRunner) === 'postgres') {
		await queryRunner.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['gauzy-chat:migrations']);
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
	const rows = await queryRunner.query(
		`SELECT 1 FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND name = ?`,
		[table, name]
	);
	return rows.length > 0;
}

export interface IndexSpec {
	name: string;
	columns: string[];
	unique?: boolean;
	/**
	 * A partial-index predicate per dialect family (`postgres` and `sqlite` support it). MySQL has no partial
	 * indexes: the index is created there without the predicate, and stays UNIQUE — the predicates used here
	 * only exclude NULL keys, which a MySQL unique index admits any number of.
	 */
	where?: { postgres: string; sqlite: string };
}

/** Creates the index when it does not exist (re-running issues no DDL). */
export async function createIndexIfMissing(queryRunner: QueryRunner, table: string, spec: IndexSpec): Promise<void> {
	if (await hasIndex(queryRunner, table, spec.name)) return;
	const dialect = dialectOf(queryRunner);
	const columns = spec.columns.map((column) => q(dialect, column)).join(', ');
	const partial = dialect !== 'mysql' && spec.where ? ` WHERE ${spec.where[dialect]}` : '';
	const unique = spec.unique ? 'UNIQUE ' : '';
	if (dialect !== 'mysql') {
		// Postgres and SQLite say it in the statement: a failed statement would abort the migration's transaction
		// on Postgres, after which no probe can run.
		await queryRunner.query(
			`CREATE ${unique}INDEX IF NOT EXISTS ${q(dialect, spec.name)} ON ${q(dialect, table)} (${columns})${partial}`
		);
		return;
	}
	try {
		await queryRunner.query(`CREATE ${unique}INDEX ${q(dialect, spec.name)} ON ${q(dialect, table)} (${columns})`);
	} catch (error) {
		// MySQL has no IF NOT EXISTS for an index and its DDL auto-commits: another process (the API and the worker
		// start together) created it between the probe and here.
		if (await hasIndex(queryRunner, table, spec.name)) return;
		throw error;
	}
}

/** Drops the index when it exists (re-running issues no DDL that can fail). */
export async function dropIndexIfExists(queryRunner: QueryRunner, table: string, name: string): Promise<void> {
	const dialect = dialectOf(queryRunner);
	if (dialect !== 'mysql') {
		// Postgres and SQLite say it in the statement, for the reason `createIndexIfMissing` gives.
		await queryRunner.query(`DROP INDEX IF EXISTS ${q(dialect, name)}`);
		return;
	}
	if (!(await hasIndex(queryRunner, table, name))) return;
	try {
		await queryRunner.query(`DROP INDEX ${q(dialect, name)} ON ${q(dialect, table)}`);
	} catch (error) {
		// MySQL has no IF EXISTS for an index: another process dropped it between the probe and here.
		if (!(await hasIndex(queryRunner, table, name))) return;
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

/**
 * Adds a foreign key when it does not exist (Postgres and MySQL; SQLite declares its foreign keys in
 * `CREATE TABLE`, which cannot be altered later).
 */
export async function addForeignKeyIfMissing(
	queryRunner: QueryRunner,
	table: string,
	fk: { name: string; column: string; references: string; onDelete: 'CASCADE' | 'SET NULL' }
): Promise<void> {
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
		// Created by another process between the probe and here.
		if (await hasConstraint(queryRunner, table, fk.name)) return;
		throw error;
	}
}

/**
 * The columns every tenant- and organization-scoped Gauzy entity carries (`TenantOrganizationBaseEntity`),
 * as each dialect's `CREATE TABLE` writes them — the same spellings as the platform's own migrations.
 */
export function baseColumns(dialect: ChatDialect): string {
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
export function baseForeignKeys(
	prefix: string
): Array<{ name: string; column: string; references: string; onDelete: 'CASCADE' }> {
	return [
		{ name: `FK_${prefix}_tenant`, column: 'tenantId', references: 'tenant', onDelete: 'CASCADE' },
		{ name: `FK_${prefix}_organization`, column: 'organizationId', references: 'organization', onDelete: 'CASCADE' }
	];
}

/** The same foreign keys written inline for SQLite's `CREATE TABLE`. */
export function sqliteForeignKeys(prefix: string): string {
	return baseForeignKeys(prefix)
		.map(
			(fk) =>
				`CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}" ("id") ON DELETE ${fk.onDelete} ON UPDATE NO ACTION`
		)
		.join(', ');
}

/** The column types the chat tables use, in each dialect's spelling. */
export function columnTypes(d: ChatDialect) {
	const uuid = d === 'postgres' ? 'uuid' : d === 'mysql' ? 'varchar(36)' : 'varchar';
	const ts = d === 'postgres' ? 'TIMESTAMP' : d === 'mysql' ? 'datetime(6)' : 'datetime';
	const bool = d === 'mysql' ? 'tinyint' : 'boolean';
	const falsy = d === 'postgres' ? 'DEFAULT false' : d === 'mysql' ? 'DEFAULT 0' : 'DEFAULT (0)';
	const nul = d === 'mysql' ? ' NULL' : '';
	const text = d === 'mysql' ? 'longtext' : 'text';
	const c = (name: string) => q(d, name);
	return {
		uuid: (name: string, required = true) => `${c(name)} ${uuid}${required ? ' NOT NULL' : nul}`,
		ts: (name: string) => `${c(name)} ${ts}${nul}`,
		bool: (name: string) => `${c(name)} ${bool} NOT NULL ${falsy}`,
		int: (name: string, defaultValue = 0) =>
			`${c(name)} ${d === 'postgres' ? 'integer' : 'int'} NOT NULL DEFAULT ${d === 'sqlite' ? `(${defaultValue})` : defaultValue}`,
		text: (name: string) => `${c(name)} ${text}${nul}`,
		requiredText: (name: string) => `${c(name)} ${text} NOT NULL`,
		varchar: (name: string, length: number, required = false, defaultValue?: string) =>
			`${c(name)} varchar(${length})${required ? ' NOT NULL' : nul}${
				defaultValue !== undefined ? ` DEFAULT '${defaultValue}'` : ''
			}`
	};
}

/** What one chat table needs beyond the base columns. */
export interface TableSpec {
	table: string;
	prefix: string;
	columns: (d: ChatDialect) => string;
	indexes: IndexSpec[];
	foreignKeys: Array<{ name: string; column: string; references: string; onDelete: 'CASCADE' | 'SET NULL' }>;
}

/** Creates the table with its base columns, indexes and foreign keys when it does not exist (idempotent). */
export async function createTableIfMissing(queryRunner: QueryRunner, spec: TableSpec): Promise<void> {
	const d = dialectOf(queryRunner);
	const own = spec.columns(d);
	if (d === 'postgres') {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "${spec.table}" (${baseColumns(d)}, ${own}, CONSTRAINT "PK_${spec.prefix}" PRIMARY KEY ("id"))`
		);
	} else if (d === 'mysql') {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS \`${spec.table}\` (${baseColumns(d)}, ${own}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
	} else {
		const fks = spec.foreignKeys
			.map(
				(fk) =>
					`CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}" ("id") ON DELETE ${fk.onDelete} ON UPDATE NO ACTION`
			)
			.join(', ');
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "${spec.table}" (${baseColumns(d)}, ${own}, ${sqliteForeignKeys(spec.prefix)}${fks ? `, ${fks}` : ''})`
		);
	}
	for (const index of [...baseIndexes(spec.prefix), ...spec.indexes]) {
		await createIndexIfMissing(queryRunner, spec.table, index);
	}
	for (const fk of [...baseForeignKeys(spec.prefix), ...spec.foreignKeys]) {
		await addForeignKeyIfMissing(queryRunner, spec.table, fk);
	}
}

/** Drops the table when it exists (its indexes and constraints go with it). */
export async function dropTableIfExists(queryRunner: QueryRunner, table: string): Promise<void> {
	await queryRunner.query(`DROP TABLE IF EXISTS ${q(dialectOf(queryRunner), table)}`);
}

/**
 * Adds a nullable column when it is missing (re-running issues no DDL). `type` is the column's spelling per dialect;
 * constant identifiers only, quoted for the dialect.
 */
export async function addColumnIfMissing(queryRunner: QueryRunner, table: string, column: string, type: Record<ChatDialect, string>): Promise<void> {
	if (await queryRunner.hasColumn(table, column)) return;
	const d = dialectOf(queryRunner);
	try {
		await queryRunner.query(`ALTER TABLE ${q(d, table)} ADD COLUMN ${q(d, column)} ${type[d]}`);
	} catch (error) {
		// Another process added it between the check and the statement (MySQL and SQLite take no lock here): only
		// that refusal, with the column really there now, counts as done. Anything else is raised as it is.
		if (!(isColumnRaceRefusal(d, error, 'duplicate') && (await queryRunner.hasColumn(table, column)))) throw error;
	}
}

/** Drops a column when it is there (re-running issues no DDL that can fail). */
export async function dropColumnIfExists(queryRunner: QueryRunner, table: string, column: string): Promise<void> {
	if (!(await queryRunner.hasColumn(table, column))) return;
	const d = dialectOf(queryRunner);
	try {
		await queryRunner.query(`ALTER TABLE ${q(d, table)} DROP COLUMN ${q(d, column)}`);
	} catch (error) {
		if (!(isColumnRaceRefusal(d, error, 'missing') && !(await queryRunner.hasColumn(table, column)))) throw error;
	}
}

/**
 * Whether an `ALTER TABLE` was refused because a concurrent run already made the change: MySQL's duplicate column
 * (1060) / can't drop a missing one (1091), SQLite's `duplicate column name` / `no such column`. Never on Postgres:
 * `lockMigrations` serializes the runs there, and a refused statement aborts the transaction, so the error is raised
 * as it is (a re-check would only fail with 25P02 and hide it). The same rule as migration `1791000006400`'s own.
 */
export function isColumnRaceRefusal(dialect: ChatDialect, error: unknown, kind: 'duplicate' | 'missing'): boolean {
	const failure = error as { errno?: unknown; code?: unknown; message?: unknown; driverError?: { errno?: unknown; code?: unknown } } | null;
	const message = String(failure?.message ?? '');
	if (dialect === 'mysql') {
		const codes = [failure?.errno, failure?.code, failure?.driverError?.errno, failure?.driverError?.code].map((code) => String(code ?? ''));
		return kind === 'duplicate'
			? codes.includes('1060') || codes.includes('ER_DUP_FIELDNAME')
			: codes.includes('1091') || codes.includes('ER_CANT_DROP_FIELD_OR_KEY');
	}
	if (dialect === 'sqlite') {
		return kind === 'duplicate' ? /duplicate column name/i.test(message) : /no such column/i.test(message);
	}
	return false;
}
