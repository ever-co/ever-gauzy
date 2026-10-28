import { Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ID } from '@gauzy/contracts';

const schemaDriftLogger = new Logger('UserDeletion');

/**
 * The "who did it" columns every `BaseEntity` table carries (`BaseEntityActionByUser`).
 */
export const USER_AUTHORSHIP_COLUMNS: ReadonlyArray<string> = ['createdByUserId', 'updatedByUserId', 'deletedByUserId'];

/** The column that makes a row the user's (or the member's) own: it goes with them. */
const OWNER_COLUMNS: Record<'user' | 'employee', string> = { user: 'userId', employee: 'employeeId' };

/**
 * Tables where that same column only names the author (or uploader) of a row that is someone else's or the
 * workspace's, so it is cleared like any other reference: a departing member's comments and resource links stay
 * on the workspace's tasks, and captures an admin uploaded for another member stay with that member.
 */
const AUTHOR_NOT_OWNER: Record<'user' | 'employee', Record<string, ReadonlyArray<string>>> = {
	user: { camshots: ['userId'], soundshots: ['userId'] },
	employee: { comment: ['employeeId'], resource_link: ['employeeId'] }
};

/**
 * Tables whose rows are personal to the member (employee) they point at, under any column name: they go with
 * the member (the database cascade) instead of being kept with the reference cleared. References to the
 * *user* are always cleared, wherever they are: an admin who created someone else's row must not take it along.
 */
const PERSONAL_TABLES: ReadonlySet<string> = new Set([
	'employee_notification',
	'mention',
	'screenshot',
	'camshots',
	'soundshots',
	'video'
]);

/**
 * Clears every reference to a user from rows that are not the user's own, before the user is deleted.
 *
 * Besides `userId` (the user's own rows: memberships, sign-in data, ...), tables point at `user` from
 * columns such as `createdByUserId`, `updatedByUserId`, `deletedByUserId` (on ~220 tables), `approvedById`,
 * `invitedByUserId` or `movedById`. Most of those foreign keys say `ON DELETE CASCADE`, so deleting a user
 * outright also deleted every task, project, invoice or timesheet they had ever touched, including those of
 * the other members of a shared workspace; a few say `NO ACTION`, which made the delete fail instead (a
 * manager who had approved a timesheet could not be deleted). Setting them to NULL keeps that content with
 * the workspace (author unknown) and leaves the cascade to the user's own rows.
 *
 * The columns come from the DataSource's own metadata, so plugin entities are covered too. Raw statements,
 * so neither entity subscribers nor `updatedAt` fire for rows the user only touched.
 *
 * @param manager The entity manager to run in (pass the transaction's manager).
 * @param userId The user about to be deleted.
 * @returns The number of rows changed.
 */
export async function detachUserReferences(manager: EntityManager, userId: ID): Promise<number> {
	return await detachReferences(manager, 'user', [userId]);
}

/**
 * {@link detachUserReferences}, kept for the callers that knew it under this name.
 */
export const detachUserAuthorship = detachUserReferences;

/**
 * Clears every reference to the user's member (employee) records from rows that are not theirs, before the
 * members go with the user (`employee.userId` cascades).
 *
 * `organization_project.defaultAssigneeId`, `comment.resolvedByEmployeeId`, `goal.leadId` and the like cascade
 * from `employee`, so a shared project or a resolved comment disappeared with the person; `key_result.leadId`
 * and `goal_kpi.leadId` say `NO ACTION` and blocked the delete. Nullable ones are cleared. A required one with
 * no cascade (`key_result.ownerId`) cannot be kept without an owner: those rows are deleted, or the member
 * could never be deleted. Rows of {@link PERSONAL_TABLES} are left to the cascade.
 *
 * @param manager The entity manager to run in (pass the transaction's manager).
 * @param employeeIds The members about to be deleted.
 * @returns The number of rows changed or deleted.
 */
export async function detachEmployeeReferences(manager: EntityManager, employeeIds: ID[]): Promise<number> {
	return employeeIds.length ? await detachReferences(manager, 'employee', employeeIds) : 0;
}

/**
 * Locks one row for the rest of the transaction (`SELECT … FOR UPDATE`), so rows that would reference it
 * (they take a key-share lock on it) wait until the transaction ends. A no-op on SQLite, whose writers are
 * serialized anyway.
 *
 * @returns Whether the row exists.
 */
export async function lockRowForUpdate(manager: EntityManager, table: string, id: ID): Promise<boolean> {
	const driver = manager.connection.driver;
	const type = driver.options.type;
	if (type !== 'postgres' && type !== 'mysql') {
		const rows = await manager.query(`SELECT 1 FROM ${driver.escape(table)} WHERE ${driver.escape('id')} = ?`, [
			id
		]);
		return rows.length > 0;
	}
	const placeholder = type === 'postgres' ? '$1' : '?';
	const rows = await manager.query(
		`SELECT 1 FROM ${driver.escape(table)} WHERE ${driver.escape('id')} = ${placeholder} FOR UPDATE`,
		[id]
	);
	return rows.length > 0;
}

/**
 * The ids of every member (employee) record of a user, in every organization, soft-deleted ones included:
 * all of them go with the user (`employee.userId` cascades).
 */
export async function employeeIdsOfUser(manager: EntityManager, userId: ID): Promise<ID[]> {
	const driver = manager.connection.driver;
	const rows: Array<{ id: ID }> = await manager.query(
		`SELECT ${driver.escape('id')} AS ${driver.escape('id')} FROM ${driver.escape('employee')} WHERE ${driver.escape(
			'userId'
		)} = ${sqlPlaceholder(manager, 1)}`,
		[userId]
	);
	return rows.map((row) => row.id);
}

/**
 * Locks rows for the rest of the transaction, so nothing can start referencing them (or change them) between
 * the scan of their references and their deletion.
 */
export async function lockRowsForUpdate(manager: EntityManager, table: string, ids: ID[]): Promise<void> {
	for (const id of ids) {
		await lockRowForUpdate(manager, table, id);
	}
}

/** The SQL placeholder for the n-th parameter (1-based) of the manager's driver. */
export function sqlPlaceholder(manager: EntityManager, n: number): string {
	return manager.connection.driver.options.type === 'postgres' ? `$${n}` : '?';
}

/** The columns of every table in the connected database, read once per data source (null where unknown). */
const databaseColumnsCache = new WeakMap<object, Promise<Map<string, Set<string>> | null>>();
const warnedMissing = new Set<string>();

async function databaseColumns(manager: EntityManager): Promise<Map<string, Set<string>> | null> {
	const key = manager.connection;
	let columns = databaseColumnsCache.get(key);
	if (!columns) {
		columns = readDatabaseColumns(manager).catch(() => null);
		databaseColumnsCache.set(key, columns);
	}
	return await columns;
}

async function readDatabaseColumns(manager: EntityManager): Promise<Map<string, Set<string>> | null> {
	const type = manager.connection.driver.options.type;
	const schema =
		type === 'postgres' ? 'current_schema()' : type === 'mysql' || type === 'mariadb' ? 'DATABASE()' : null;
	if (!schema) {
		return null; // SQLite: a failed statement does not abort its transaction, see queryUnlessSchemaLacks.
	}
	const rows: Array<Record<string, string>> = await manager.query(
		`SELECT table_name AS t, column_name AS c FROM information_schema.columns WHERE table_schema = ${schema}`
	);
	const columns = new Map<string, Set<string>>();
	for (const row of rows) {
		const table = row['t'] ?? row['T'];
		const column = row['c'] ?? row['C'];
		if (!columns.has(table)) columns.set(table, new Set());
		columns.get(table).add(column);
	}
	return columns;
}

/**
 * Runs one statement of a sweep over every entity's table, or skips it (returning null) when the database has
 * no such table or column. The sweeps are built from the entity metadata, plugins included, and a deployment's
 * schema can lag behind it (a plugin table never migrated, an entity column no migration added): without this,
 * one missing column would fail every user deletion, the admin's `DELETE /user/:id` included.
 *
 * The database's columns are read once (PostgreSQL / MySQL `information_schema`), so a statement on columns that
 * exist runs as it is, with no savepoint per statement. Where they cannot be read (SQLite), a "no such table /
 * column" failure is skipped instead; SQLite does not abort the transaction on it. Any other error still fails.
 *
 * @param target The table and the columns the statement reads or writes.
 */
export async function queryUnlessSchemaLacks<T = any>(
	manager: EntityManager,
	sql: string,
	parameters: unknown[],
	target: { table: string; columns: string[] }
): Promise<T | null> {
	const columns = await databaseColumns(manager);
	if (columns) {
		const table = columns.get(target.table);
		const missing = !table ? null : target.columns.find((column) => !table.has(column));
		if (!table || missing) {
			warnMissingOnce(target.table, missing ?? null);
			return null;
		}
		return await manager.query(sql, parameters);
	}
	try {
		return await manager.query(sql, parameters);
	} catch (error) {
		if (!isMissingTableOrColumn(error)) {
			throw error;
		}
		warnMissingOnce(target.table, null);
		return null;
	}
}

function warnMissingOnce(table: string, column: string | null): void {
	const name = column ? `${table}.${column}` : table;
	if (!warnedMissing.has(name)) {
		warnedMissing.add(name);
		schemaDriftLogger.warn(`The database has no ${column ? 'column' : 'table'} ${name}; user deletion skips it.`);
	}
}

/** Forgets the columns read for a data source (tests; a schema changed at runtime). */
export function forgetDatabaseColumns(manager: EntityManager): void {
	databaseColumnsCache.delete(manager.connection);
}

/** PostgreSQL `undefined_table` / `undefined_column`, MySQL `ER_NO_SUCH_TABLE` / `ER_BAD_FIELD_ERROR`, SQLite's. */
export function isMissingTableOrColumn(error: unknown): boolean {
	const failure = error as {
		code?: unknown;
		errno?: unknown;
		message?: unknown;
		driverError?: { code?: unknown; errno?: unknown };
	};
	const code = failure?.driverError?.code ?? failure?.code;
	const errno = failure?.driverError?.errno ?? failure?.errno;
	return (
		code === '42P01' ||
		code === '42703' ||
		code === 'ER_NO_SUCH_TABLE' ||
		code === 'ER_BAD_FIELD_ERROR' ||
		errno === 1146 ||
		errno === 1054 ||
		/no such (table|column)/i.test(String(failure?.message ?? ''))
	);
}

async function detachReferences(manager: EntityManager, target: 'user' | 'employee', ids: ID[]): Promise<number> {
	const driver = manager.connection.driver;
	const inList = ids.map((_, index) => sqlPlaceholder(manager, index + 1)).join(', ');
	let changed = 0;

	for (const metadata of manager.connection.entityMetadatas) {
		if (metadata.tableType === 'view' || (target === 'employee' && PERSONAL_TABLES.has(metadata.tablePath))) {
			continue;
		}
		for (const foreignKey of metadata.foreignKeys) {
			const [column] = foreignKey.columnNames;
			if (
				foreignKey.columnNames.length !== 1 ||
				foreignKey.referencedTablePath !== target ||
				(column === OWNER_COLUMNS[target] && !AUTHOR_NOT_OWNER[target][metadata.tablePath]?.includes(column))
			) {
				continue;
			}
			const nullable = metadata.columns.find((candidate) => candidate.databaseName === column)?.isNullable;
			const blocking = foreignKey.onDelete === 'NO ACTION' || foreignKey.onDelete === 'RESTRICT';
			if (!nullable && !blocking) {
				continue; // A required reference that cascades: the row goes with the member (e.g. a mention).
			}
			const table = driver.escape(metadata.tablePath);
			const name = driver.escape(column);
			const columnTarget = { table: metadata.tablePath, columns: [column] };
			if (nullable) {
				const sql = `UPDATE ${table} SET ${name} = NULL WHERE ${name} IN (${inList})`;
				changed += affectedRows(await queryUnlessSchemaLacks(manager, sql, ids, columnTarget));
				continue;
			}
			// A required reference that blocks the delete (`key_result.ownerId`): these rows go, and so must
			// anything else's optional, non-cascading reference to them first (`goal.alignedKeyResultId`), or the
			// DELETE fails and the whole deletion rolls back.
			const rows: Array<{ id: ID }> =
				(await queryUnlessSchemaLacks(
					manager,
					`SELECT ${driver.escape('id')} AS ${driver.escape('id')} FROM ${table} WHERE ${name} IN (${inList})`,
					ids,
					{ table: metadata.tablePath, columns: ['id', column] }
				)) ?? [];
			if (!rows.length) {
				continue;
			}
			await clearBlockingReferences(
				manager,
				metadata.tablePath,
				rows.map((row) => row.id)
			);
			changed += affectedRows(
				await queryUnlessSchemaLacks(
					manager,
					`DELETE FROM ${table} WHERE ${name} IN (${inList})`,
					ids,
					columnTarget
				)
			);
		}
	}
	return changed;
}

/** Clears the optional, non-cascading references other tables hold to rows of `table` that are about to go. */
async function clearBlockingReferences(manager: EntityManager, table: string, ids: ID[]): Promise<void> {
	const driver = manager.connection.driver;
	const inList = ids.map((_, index) => sqlPlaceholder(manager, index + 1)).join(', ');
	for (const metadata of manager.connection.entityMetadatas) {
		if (metadata.tableType === 'view') continue;
		for (const foreignKey of metadata.foreignKeys) {
			const [column] = foreignKey.columnNames;
			if (foreignKey.columnNames.length !== 1 || foreignKey.referencedTablePath !== table) continue;
			if (foreignKey.onDelete !== 'NO ACTION' && foreignKey.onDelete !== 'RESTRICT') continue;
			if (!metadata.columns.find((candidate) => candidate.databaseName === column)?.isNullable) continue;
			const name = driver.escape(column);
			await queryUnlessSchemaLacks(
				manager,
				`UPDATE ${driver.escape(metadata.tablePath)} SET ${name} = NULL WHERE ${name} IN (${inList})`,
				ids,
				{ table: metadata.tablePath, columns: [column] }
			);
		}
	}
}

/** Rows changed by a raw UPDATE / DELETE, as each driver reports it (0 when it does not). */
function affectedRows(result: unknown): number {
	if (Array.isArray(result) && typeof result[1] === 'number') {
		return result[1]; // postgres: [rows, rowCount]
	}
	const value = result as { affectedRows?: number; changes?: number } | undefined;
	return value?.affectedRows ?? value?.changes ?? 0;
}
