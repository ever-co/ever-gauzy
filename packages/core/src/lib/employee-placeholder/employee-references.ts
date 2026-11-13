import { Table } from 'typeorm';

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
 * Every column of the database that points at `employee.id`, read from the tables' own foreign keys, so that a table
 * of a plugin counts as much as a table of the core, and with the unique keys of its table that hold the column.
 *
 * @param tables The tables of the database, with their foreign keys, uniques, indices and primary key.
 * @returns One reference per foreign key column.
 */
export function employeeReferences(tables: Table[]): EmployeeReference[] {
	const references: EmployeeReference[] = [];
	for (const table of tables) {
		for (const foreignKey of table.foreignKeys) {
			const pointsAtEmployee = bareTableName(foreignKey.referencedTableName) === 'employee';
			const isSingleColumn = foreignKey.columnNames.length === 1;
			if (!pointsAtEmployee || !isSingleColumn) {
				continue;
			}
			const column = foreignKey.columnNames[0];
			if (LEFT_ALONE.has(`${bareTableName(table.name)}.${column}`)) {
				continue;
			}
			references.push({ table: table.name, column, uniqueKeys: uniqueKeysHolding(table, column) });
		}
	}
	return references;
}

/**
 * The unique keys of a table that hold a column: its unique constraints, its unique indexes (with their condition when
 * partial) and its primary key, each once.
 */
export function uniqueKeysHolding(table: Table, column: string): UniqueKey[] {
	const candidates: UniqueKey[] = [];
	for (const unique of table.uniques) {
		candidates.push({ columns: unique.columnNames });
	}
	for (const index of table.indices) {
		if (!index.isUnique) {
			continue;
		}
		candidates.push({ columns: index.columnNames, ...(index.where ? { where: index.where } : {}) });
	}
	const primaryKey = table.columns.filter((it) => it.isPrimary).map((it) => it.name);
	if (primaryKey.length > 0) {
		candidates.push({ columns: primaryKey });
	}
	const columnNames = new Set(table.columns.map((it) => it.name));
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
