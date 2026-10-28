import {
	detachEmployeeReferences,
	detachUserReferences,
	isMissingTableOrColumn,
	queryUnlessSchemaLacks
} from './user-authorship';

/**
 * A minimal stand-in for the parts of TypeORM's EntityManager the helpers read. The database has every table and
 * column of the metadata (plus `id`), except the `missing` ones (`table` or `table.column`).
 */
function managerWith(entityMetadatas: any[], type = 'postgres', missing: string[] = []) {
	const schema = entityMetadatas
		.flatMap((metadata) =>
			['id', ...metadata.columns.map((column: any) => column.databaseName)].map((c) => ({
				t: metadata.tablePath,
				c
			}))
		)
		.filter((row) => !missing.includes(row.t) && !missing.includes(`${row.t}.${row.c}`));
	const query = jest.fn(async (sql: string) => {
		if (sql.includes('information_schema')) return schema;
		if (sql.startsWith('SELECT "id"')) return [{ id: 'row-1' }];
		return [[], 2];
	});
	const manager = {
		query,
		connection: {
			entityMetadatas,
			driver: { options: { type }, escape: (name: string) => `"${name}"` }
		}
	};
	/** The statements the helpers ran, without the one read of the database's columns. */
	const statements = () => query.mock.calls.filter(([sql]) => !String(sql).includes('information_schema'));
	return { manager: manager as any, query, statements };
}

const fk = (column: string, referencedTablePath = 'user', onDelete = 'CASCADE') => ({
	columnNames: [column],
	referencedTablePath,
	onDelete
});
const col = (databaseName: string, isNullable = true) => ({ databaseName, isNullable });
const table = (tablePath: string, foreignKeys: any[], columns: any[], tableType = 'regular') => ({
	tablePath,
	tableType,
	foreignKeys,
	columns
});

describe('detachUserReferences', () => {
	it('clears every nullable reference to the user except userId, whatever its delete rule', async () => {
		const { manager, query, statements } = managerWith([
			table(
				'task',
				[fk('createdByUserId'), fk('updatedByUserId'), fk('deletedByUserId', 'user', 'NO ACTION')],
				[col('createdByUserId'), col('updatedByUserId'), col('deletedByUserId')]
			),
			table('timesheet', [fk('approvedById', 'user', 'NO ACTION')], [col('approvedById')])
		]);

		const changed = await detachUserReferences(manager, 'u1');

		expect(statements()).toHaveLength(4);
		expect(query).toHaveBeenCalledWith(
			'UPDATE "task" SET "createdByUserId" = NULL WHERE "createdByUserId" IN ($1)',
			['u1']
		);
		expect(query).toHaveBeenCalledWith(
			'UPDATE "timesheet" SET "approvedById" = NULL WHERE "approvedById" IN ($1)',
			['u1']
		);
		expect(changed).toBe(8);
	});

	it('leaves the user’s own rows (userId) and other tables’ keys to the cascade', async () => {
		const { manager, query } = managerWith([
			table('user_organization', [fk('userId')], [col('userId', false)]),
			table(
				'task',
				[fk('tenantId', 'tenant'), fk('createdByUserId', 'role')],
				[col('tenantId'), col('createdByUserId')]
			),
			table('some_view', [fk('createdByUserId')], [col('createdByUserId')], 'view')
		]);

		await detachUserReferences(manager, 'u1');

		expect(query).not.toHaveBeenCalled();
	});

	it('uses ? placeholders outside Postgres', async () => {
		const { manager, query } = managerWith(
			[table('task', [fk('createdByUserId')], [col('createdByUserId')])],
			'better-sqlite3'
		);

		await detachUserReferences(manager, 'u1');

		expect(query).toHaveBeenCalledWith(
			'UPDATE "task" SET "createdByUserId" = NULL WHERE "createdByUserId" IN (?)',
			['u1']
		);
	});
});

describe('detachEmployeeReferences', () => {
	it('clears shared references, deletes rows a required blocking reference would keep, skips personal tables', async () => {
		const { manager, query } = managerWith([
			table('organization_project', [fk('defaultAssigneeId', 'employee')], [col('defaultAssigneeId')]),
			table('key_result', [fk('ownerId', 'employee', 'NO ACTION')], [col('ownerId', false)]),
			table('mention', [fk('mentionedEmployeeId', 'employee')], [col('mentionedEmployeeId', false)]),
			table('employee_notification', [fk('receiverEmployeeId', 'employee')], [col('receiverEmployeeId')]),
			table('time_log', [fk('employeeId', 'employee')], [col('employeeId', false)]),
			table('comment', [fk('employeeId', 'employee')], [col('employeeId')]),
			table('resource_link', [fk('employeeId', 'employee')], [col('employeeId')])
		]);

		await detachEmployeeReferences(manager, ['e1', 'e2']);

		// comment, resource_link, organization_project, and key_result (its rows read, then deleted).
		expect(query.mock.calls.filter(([sql]) => !String(sql).includes('information_schema'))).toHaveLength(5);
		// A comment's (or resource link's) employeeId is its author, not its owner: it stays on the shared task.
		expect(query).toHaveBeenCalledWith('UPDATE "comment" SET "employeeId" = NULL WHERE "employeeId" IN ($1, $2)', [
			'e1',
			'e2'
		]);
		expect(query).toHaveBeenCalledWith(
			'UPDATE "organization_project" SET "defaultAssigneeId" = NULL WHERE "defaultAssigneeId" IN ($1, $2)',
			['e1', 'e2']
		);
		expect(query).toHaveBeenCalledWith('DELETE FROM "key_result" WHERE "ownerId" IN ($1, $2)', ['e1', 'e2']);
	});

	it('does nothing without members', async () => {
		const { manager, query } = managerWith([table('goal', [fk('leadId', 'employee')], [col('leadId')])]);

		expect(await detachEmployeeReferences(manager, [])).toBe(0);
		expect(query).not.toHaveBeenCalled();
	});
});

describe('queryUnlessSchemaLacks: a table or column the database lacks does not fail a deletion', () => {
	it('skips the statements on a column the database does not have, and runs the others as they are', async () => {
		const { manager, statements } = managerWith(
			[
				table(
					'task',
					[fk('createdByUserId'), fk('deletedByUserId')],
					[col('createdByUserId'), col('deletedByUserId')]
				),
				table('plugin_table', [fk('createdByUserId')], [col('createdByUserId')])
			],
			'postgres',
			['task.deletedByUserId', 'plugin_table']
		);

		await detachUserReferences(manager, 'u1');

		expect(statements().map(([sql]) => sql)).toEqual([
			'UPDATE "task" SET "createdByUserId" = NULL WHERE "createdByUserId" IN ($1)'
		]);
	});

	it('reads the database columns once, and uses no savepoint per statement', async () => {
		const { manager, query } = managerWith([
			table(
				'task',
				[fk('createdByUserId'), fk('updatedByUserId')],
				[col('createdByUserId'), col('updatedByUserId')]
			)
		]);

		await detachUserReferences(manager, 'u1');

		const sql = query.mock.calls.map(([statement]) => String(statement));
		expect(sql.filter((statement) => statement.includes('information_schema'))).toHaveLength(1);
		expect(sql.some((statement) => statement.includes('SAVEPOINT'))).toBe(false);
	});

	it('where the columns cannot be read (SQLite), skips a missing column and fails on anything else', async () => {
		const missing = Object.assign(new Error('SQLITE_ERROR: no such column: deletedByUserId'), {
			code: 'SQLITE_ERROR'
		});
		const other = Object.assign(new Error('SQLITE_CONSTRAINT: FOREIGN KEY constraint failed'), {
			code: 'SQLITE_CONSTRAINT'
		});
		const sqlite = (error: Error) =>
			({
				query: jest.fn().mockRejectedValue(error),
				connection: { driver: { options: { type: 'better-sqlite3' } } }
			}) as any;
		const target = { table: 'task', columns: ['deletedByUserId'] };

		await expect(queryUnlessSchemaLacks(sqlite(missing), 'UPDATE ...', [], target)).resolves.toBeNull();
		await expect(queryUnlessSchemaLacks(sqlite(other), 'UPDATE ...', [], target)).rejects.toBe(other);
	});

	it('clears another table’s optional reference to rows a required reference makes it delete (goal → key result)', async () => {
		const { manager, statements } = managerWith([
			table('key_result', [fk('ownerId', 'employee', 'NO ACTION')], [col('ownerId', false)]),
			table('goal', [fk('alignedKeyResultId', 'key_result', 'NO ACTION')], [col('alignedKeyResultId')])
		]);

		await detachEmployeeReferences(manager, ['e1']);

		expect(statements()).toEqual([
			['SELECT "id" AS "id" FROM "key_result" WHERE "ownerId" IN ($1)', ['e1']],
			['UPDATE "goal" SET "alignedKeyResultId" = NULL WHERE "alignedKeyResultId" IN ($1)', ['row-1']],
			['DELETE FROM "key_result" WHERE "ownerId" IN ($1)', ['e1']]
		]);
	});

	it.each([
		[{ code: '42P01' }, true],
		[{ code: '42703' }, true],
		[{ driverError: { code: '42703' } }, true],
		[{ code: 'ER_NO_SUCH_TABLE', errno: 1146 }, true],
		[{ errno: 1054 }, true],
		[{ message: 'SQLITE_ERROR: no such column: deletedByUserId' }, true],
		[{ code: '23503', message: 'violates foreign key constraint' }, false],
		[{ code: '40P01' }, false]
	])('recognises %p as a missing table or column: %p', (error, expected) => {
		expect(isMissingTableOrColumn(error)).toBe(expected);
	});
});
