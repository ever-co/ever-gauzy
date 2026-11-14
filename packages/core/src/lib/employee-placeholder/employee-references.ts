import { QueryRunner } from 'typeorm';

/** A unique key of a table, among those that hold the column pointing at an employee. */
export interface UniqueKey {
	/** Every column of the key, the employee column included. */
	columns: string[];
	/** The condition of a partial unique index, in the database's own SQL, when the key has one. */
	where?: string;
}

/** A column of the database that points at an employee, with the unique keys a moved row could collide on. */
export interface EmployeeReference {
	table: string;
	column: string;
	uniqueKeys: UniqueKey[];
}

/** What a transfer needs to know of a table with a column pointing at `employee.id`. */
export interface TableShape {
	name: string;
	columns: string[];
	/** Its single-column foreign keys to `employee.id`. */
	employeeColumns: string[];
	/** Its primary key and its unique constraints and indexes (with their condition when partial). */
	uniqueKeys: UniqueKey[];
}

/**
 * The references a transfer leaves alone. A claim invitation's link to the placeholder it hands over is not moved to
 * the member who claimed it: the transfer removes the other pending claims itself, and the link of the accepted one
 * clears when the placeholder is removed (`ON DELETE SET NULL`).
 */
const LEFT_ALONE = new Set(['invite.placeholderEmployeeId']);

/**
 * Keys a table holds by meaning but not by constraint: a member belongs to a team, a project, a module or a sprint
 * once, answers a request or sits on an interview once, and keeps one favorite or subscription per record. The
 * databases do not enforce them, so a moved row would make a duplicate of the member's own (the member listed twice in
 * a team both belonged to). The columns besides the one pointing at the employee.
 */
const KEYS_BY_MEANING: Readonly<Record<string, ReadonlyArray<ReadonlyArray<string>>>> = {
	organization_team_employee: [['organizationTeamId']],
	organization_project_employee: [['organizationProjectId']],
	organization_project_module_employee: [['organizationProjectModuleId']],
	organization_sprint_employee: [['organizationSprintId']],
	request_approval_employee: [['requestApprovalId']],
	candidate_interviewer: [['interviewId']],
	favorite: [['entity', 'entityId']],
	entity_subscription: [['entity', 'entityId', 'type']]
};

/** The table's name without the schema the database may prefix it with. */
export function bareTableName(name: string): string {
	const parts = name.split('.');
	return parts[parts.length - 1];
}

/**
 * Every column of the database that points at `employee.id`, read from the tables' own foreign keys (so a table of a
 * plugin counts as much as a table of the core), with the unique keys of its table that hold the column.
 *
 * Read straight from the database's catalog rather than through TypeORM's table reader: that reader loads every table
 * of the schema (tens of seconds), and on Postgres it asks for TypeORM's own metadata table as soon as a table has a
 * generated column, which fails where that table does not exist.
 *
 * @param queryRunner A query runner of the connection.
 * @returns One reference per foreign key column.
 */
export async function readEmployeeReferences(queryRunner: QueryRunner): Promise<EmployeeReference[]> {
	const type: string = queryRunner.connection.options.type;
	switch (type) {
		case 'postgres':
			return employeeReferences(await readPostgresTables(queryRunner));
		case 'mysql':
		case 'mariadb':
			return employeeReferences(await readMysqlTables(queryRunner));
		case 'sqlite':
		case 'better-sqlite3':
			return employeeReferences(await readSqliteTables(queryRunner));
		default:
			throw new Error(`Unsupported database: ${type}`);
	}
}

/** The references of the tables, with the unique keys that hold each column (and the keys held by meaning). */
export function employeeReferences(tables: TableShape[]): EmployeeReference[] {
	const references: EmployeeReference[] = [];
	for (const table of tables) {
		for (const column of table.employeeColumns) {
			if (LEFT_ALONE.has(`${bareTableName(table.name)}.${column}`)) {
				continue;
			}
			references.push({ table: table.name, column, uniqueKeys: uniqueKeysHolding(table, column) });
		}
	}
	return references;
}

/** The unique keys of a table that hold a column, and the keys it holds by meaning, each once. */
export function uniqueKeysHolding(table: TableShape, column: string): UniqueKey[] {
	const candidates: UniqueKey[] = [...table.uniqueKeys];
	const columnNames = new Set(table.columns);
	for (const others of KEYS_BY_MEANING[bareTableName(table.name)] ?? []) {
		const tableHasThem = others.every((it) => columnNames.has(it));
		if (tableHasThem) {
			candidates.push({ columns: [column, ...others] });
		}
	}

	const seen = new Set<string>();
	const keys: UniqueKey[] = [];
	for (const key of candidates) {
		if (!key.columns.includes(column)) {
			continue;
		}
		const signature = `${[...key.columns].sort().join(',')}|${key.where ?? ''}`;
		if (seen.has(signature)) {
			continue;
		}
		seen.add(signature);
		keys.push(key);
	}
	return keys;
}

/** Groups catalog rows `{ table, ... }` by table. */
function byTable<T extends { table: string }>(rows: T[]): Map<string, T[]> {
	const grouped = new Map<string, T[]>();
	for (const row of rows) {
		const name = String(row.table);
		grouped.set(name, [...(grouped.get(name) ?? []), row]);
	}
	return grouped;
}

/** Postgres: the foreign keys to `employee.id` from `pg_constraint`, the columns and unique indexes of their tables. */
async function readPostgresTables(queryRunner: QueryRunner): Promise<TableShape[]> {
	const foreignKeys = (await queryRunner.query(
		`SELECT c.conrelid::regclass::text AS "table", a.attname AS "column"
		FROM pg_constraint c
		JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
		JOIN pg_attribute target ON target.attrelid = c.confrelid AND target.attnum = c.confkey[1]
		WHERE c.contype = 'f' AND c.confrelid = 'employee'::regclass AND array_length(c.conkey, 1) = 1
		AND target.attname = 'id'`
	)) as Array<{ table: string; column: string }>;
	const tables = [...new Set(foreignKeys.map((row) => row.table))];
	if (tables.length === 0) {
		return [];
	}
	const columns = (await queryRunner.query(
		`SELECT c.oid::regclass::text AS "table", a.attname AS "column"
		FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid
		WHERE c.oid::regclass::text = ANY($1::text[]) AND a.attnum > 0 AND NOT a.attisdropped`,
		[tables]
	)) as Array<{ table: string; column: string }>;
	const uniques = (await queryRunner.query(
		`SELECT i.indrelid::regclass::text AS "table",
			(SELECT string_agg(a.attname, ',' ORDER BY k.n) FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, n)
			JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum) AS "columns",
			pg_get_expr(i.indpred, i.indrelid) AS "predicate"
		FROM pg_index i
		WHERE i.indisunique AND i.indexprs IS NULL AND i.indrelid::regclass::text = ANY($1::text[])`,
		[tables]
	)) as Array<{ table: string; columns: string; predicate: string | null }>;
	return shapes(tables, foreignKeys, columns, uniques);
}

/** MySQL: the same, from `information_schema` (MySQL has no partial index). */
async function readMysqlTables(queryRunner: QueryRunner): Promise<TableShape[]> {
	const foreignKeys = (await queryRunner.query(
		`SELECT TABLE_NAME AS \`table\`, COLUMN_NAME AS \`column\` FROM information_schema.KEY_COLUMN_USAGE
		WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_SCHEMA = DATABASE()
		AND REFERENCED_TABLE_NAME = 'employee' AND REFERENCED_COLUMN_NAME = 'id'`
	)) as Array<{ table: string; column: string }>;
	const tables = [...new Set(foreignKeys.map((row) => row.table))];
	if (tables.length === 0) {
		return [];
	}
	const placeholders = tables.map(() => '?').join(', ');
	const columns = (await queryRunner.query(
		`SELECT TABLE_NAME AS \`table\`, COLUMN_NAME AS \`column\` FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})`,
		tables
	)) as Array<{ table: string; column: string }>;
	const uniques = (await queryRunner.query(
		`SELECT TABLE_NAME AS \`table\`, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS \`columns\`, NULL AS \`predicate\`
		FROM information_schema.STATISTICS
		WHERE TABLE_SCHEMA = DATABASE() AND NON_UNIQUE = 0 AND COLUMN_NAME IS NOT NULL AND TABLE_NAME IN (${placeholders})
		GROUP BY TABLE_NAME, INDEX_NAME`,
		tables
	)) as Array<{ table: string; columns: string; predicate: string | null }>;
	return shapes(tables, foreignKeys, columns, uniques);
}

/** SQLite: the same, from the pragmas of each table. */
async function readSqliteTables(queryRunner: QueryRunner): Promise<TableShape[]> {
	const tables = (await queryRunner.query(
		`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
	)) as Array<{ name: string }>;
	const result: TableShape[] = [];
	for (const { name } of tables) {
		const quoted = `"${name.replace(/"/g, '""')}"`;
		const foreignKeys = (await queryRunner.query(`PRAGMA foreign_key_list(${quoted})`)) as Array<{
			table: string;
			from: string;
			to: string | null;
		}>;
		const employeeColumns = foreignKeys
			.filter((key) => key.table === 'employee' && (key.to === 'id' || key.to === null))
			.map((key) => key.from);
		if (employeeColumns.length === 0) {
			continue;
		}
		const info = (await queryRunner.query(`PRAGMA table_info(${quoted})`)) as Array<{ name: string; pk: number }>;
		const primaryKey = info
			.filter((column) => column.pk > 0)
			.sort((left, right) => left.pk - right.pk)
			.map((column) => column.name);
		const uniqueKeys: UniqueKey[] = primaryKey.length > 0 ? [{ columns: primaryKey }] : [];
		const indexes = (await queryRunner.query(`PRAGMA index_list(${quoted})`)) as Array<{
			name: string;
			unique: number;
			partial: number;
		}>;
		for (const index of indexes.filter((it) => it.unique === 1)) {
			const indexColumns = (await queryRunner.query(
				`PRAGMA index_info("${index.name.replace(/"/g, '""')}")`
			)) as Array<{ name: string | null }>;
			const isOnColumns = indexColumns.every((column) => column.name);
			if (!isOnColumns) {
				continue;
			}
			const where = index.partial === 1 ? await sqlitePartialCondition(queryRunner, index.name) : undefined;
			uniqueKeys.push({
				columns: indexColumns.map((column) => String(column.name)),
				...(where ? { where } : {})
			});
		}
		result.push({ name, columns: info.map((column) => column.name), employeeColumns, uniqueKeys });
	}
	return result;
}

/** The condition of a partial SQLite index, from its definition. */
async function sqlitePartialCondition(queryRunner: QueryRunner, indexName: string): Promise<string | undefined> {
	const [row] = (await queryRunner.query(`SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?`, [
		indexName
	])) as Array<{ sql: string | null }>;
	const match = /\bWHERE\b([\s\S]*)$/i.exec(row?.sql ?? '');
	return match?.[1]?.trim() || undefined;
}

/** The table shapes from the catalog rows of a server database. */
function shapes(
	tables: string[],
	foreignKeys: Array<{ table: string; column: string }>,
	columns: Array<{ table: string; column: string }>,
	uniques: Array<{ table: string; columns: string; predicate: string | null }>
): TableShape[] {
	const columnsByTable = byTable(columns);
	const foreignKeysByTable = byTable(foreignKeys);
	const uniquesByTable = byTable(uniques);
	return tables.map((table) => ({
		name: unquotedTableName(table),
		columns: (columnsByTable.get(table) ?? []).map((row) => String(row.column)),
		employeeColumns: (foreignKeysByTable.get(table) ?? []).map((row) => String(row.column)),
		uniqueKeys: (uniquesByTable.get(table) ?? [])
			.filter((row) => !!row.columns)
			.map((row) => ({
				columns: String(row.columns).split(','),
				...(row.predicate ? { where: String(row.predicate) } : {})
			}))
	}));
}

/** A table name as Postgres prints a `regclass` (quoted when it must be), without the quotes. */
function unquotedTableName(name: string): string {
	return name.replace(/"/g, '');
}
