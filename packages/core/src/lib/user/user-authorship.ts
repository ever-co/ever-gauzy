import { EntityManager } from 'typeorm';
import { ID } from '@gauzy/contracts';

/**
 * The "who did it" columns every `BaseEntity` table carries (`BaseEntityActionByUser`).
 */
export const USER_AUTHORSHIP_COLUMNS: ReadonlyArray<string> = ['createdByUserId', 'updatedByUserId', 'deletedByUserId'];

/**
 * Clears a user's name from every row they created, last updated or soft-deleted, before the user is
 * deleted.
 *
 * Those three columns reference `user(id)` with `ON DELETE CASCADE` on some 220 tables, so deleting a user
 * outright also deleted every row they had ever touched — including tasks, projects, invoices and comments
 * that belong to the other members of a shared workspace. Setting the columns to NULL first keeps that
 * content with the workspace (author unknown) and leaves the cascade to the user's own rows (their member
 * record, sign-in data, memberships, ...).
 *
 * The tables come from the DataSource's own metadata (every foreign key on these three columns that points
 * at `user`; a few declare `NO ACTION`, which would otherwise make the delete fail), so plugin entities are
 * covered too. Raw statements, so neither entity
 * subscribers nor the `updatedAt` column fire for rows the user only touched. Every column is indexed.
 *
 * @param manager The entity manager to run in (pass the transaction's manager).
 * @param userId The user about to be deleted.
 * @returns The number of rows changed.
 */
export async function detachUserAuthorship(manager: EntityManager, userId: ID): Promise<number> {
	const driver = manager.connection.driver;
	const placeholder = driver.options.type === 'postgres' ? '$1' : '?';
	let changed = 0;

	for (const metadata of manager.connection.entityMetadatas) {
		if (metadata.tableType === 'view') {
			continue;
		}
		for (const foreignKey of metadata.foreignKeys) {
			const [column] = foreignKey.columnNames;
			if (
				foreignKey.columnNames.length !== 1 ||
				!USER_AUTHORSHIP_COLUMNS.includes(column) ||
				foreignKey.referencedTablePath !== 'user'
			) {
				continue;
			}
			const table = driver.escape(metadata.tablePath);
			const name = driver.escape(column);
			const result = await manager.query(`UPDATE ${table} SET ${name} = NULL WHERE ${name} = ${placeholder}`, [
				userId
			]);
			changed += affectedRows(result);
		}
	}
	return changed;
}

/** Rows changed by a raw UPDATE, as each driver reports it (0 when it does not). */
function affectedRows(result: unknown): number {
	if (Array.isArray(result) && typeof result[1] === 'number') {
		return result[1]; // postgres: [rows, rowCount]
	}
	const value = result as { affectedRows?: number; changes?: number } | undefined;
	return value?.affectedRows ?? value?.changes ?? 0;
}
