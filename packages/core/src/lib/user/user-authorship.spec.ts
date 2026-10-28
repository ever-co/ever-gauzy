import { detachEmployeeReferences, detachUserReferences } from './user-authorship';

/** A minimal stand-in for the parts of TypeORM's EntityManager the helpers read. */
function managerWith(entityMetadatas: any[], type = 'postgres') {
	const query = jest.fn().mockResolvedValue([[], 2]);
	const manager = {
		query,
		connection: {
			entityMetadatas,
			driver: { options: { type }, escape: (name: string) => `"${name}"` }
		}
	};
	return { manager: manager as any, query };
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
		const { manager, query } = managerWith([
			table(
				'task',
				[fk('createdByUserId'), fk('updatedByUserId'), fk('deletedByUserId', 'user', 'NO ACTION')],
				[col('createdByUserId'), col('updatedByUserId'), col('deletedByUserId')]
			),
			table('timesheet', [fk('approvedById', 'user', 'NO ACTION')], [col('approvedById')])
		]);

		const changed = await detachUserReferences(manager, 'u1');

		expect(query).toHaveBeenCalledTimes(4);
		expect(query).toHaveBeenCalledWith('UPDATE "task" SET "createdByUserId" = NULL WHERE "createdByUserId" IN ($1)', [
			'u1'
		]);
		expect(query).toHaveBeenCalledWith('UPDATE "timesheet" SET "approvedById" = NULL WHERE "approvedById" IN ($1)', [
			'u1'
		]);
		expect(changed).toBe(8);
	});

	it('leaves the user’s own rows (userId) and other tables’ keys to the cascade', async () => {
		const { manager, query } = managerWith([
			table('user_organization', [fk('userId')], [col('userId', false)]),
			table('task', [fk('tenantId', 'tenant'), fk('createdByUserId', 'role')], [col('tenantId'), col('createdByUserId')]),
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

		expect(query).toHaveBeenCalledWith('UPDATE "task" SET "createdByUserId" = NULL WHERE "createdByUserId" IN (?)', ['u1']);
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
			table('comment', [fk('employeeId', 'employee')], [col('employeeId')])
		]);

		await detachEmployeeReferences(manager, ['e1', 'e2']);

		expect(query).toHaveBeenCalledTimes(3);
		// A comment's employeeId is its author, not its owner: the comment stays on the shared task.
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
