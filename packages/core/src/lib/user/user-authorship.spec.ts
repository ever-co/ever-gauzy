import { detachUserAuthorship } from './user-authorship';

/** A minimal stand-in for the parts of TypeORM's EntityManager the helper reads. */
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

describe('detachUserAuthorship', () => {
	it('clears createdBy/updatedBy/deletedBy pointing at the user, whatever their delete rule', async () => {
		const { manager, query } = managerWith([
			{
				tablePath: 'task',
				tableType: 'regular',
				foreignKeys: [fk('createdByUserId'), fk('updatedByUserId'), fk('deletedByUserId', 'user', 'NO ACTION')]
			}
		]);

		const changed = await detachUserAuthorship(manager, 'u1');

		expect(query).toHaveBeenCalledTimes(3);
		expect(query).toHaveBeenCalledWith('UPDATE "task" SET "createdByUserId" = NULL WHERE "createdByUserId" = $1', ['u1']);
		expect(changed).toBe(6);
	});

	it('leaves the user’s own rows (userId, employeeId, ...) and other tables’ keys to the cascade', async () => {
		const { manager, query } = managerWith([
			{ tablePath: 'user_organization', tableType: 'regular', foreignKeys: [fk('userId')] },
			{ tablePath: 'task', tableType: 'regular', foreignKeys: [fk('tenantId', 'tenant'), fk('createdByUserId', 'role')] },
			{ tablePath: 'some_view', tableType: 'view', foreignKeys: [fk('createdByUserId')] }
		]);

		await detachUserAuthorship(manager, 'u1');

		expect(query).not.toHaveBeenCalled();
	});

	it('uses ? placeholders outside Postgres', async () => {
		const { manager, query } = managerWith(
			[{ tablePath: 'task', tableType: 'regular', foreignKeys: [fk('createdByUserId')] }],
			'better-sqlite3'
		);

		await detachUserAuthorship(manager, 'u1');

		expect(query).toHaveBeenCalledWith('UPDATE "task" SET "createdByUserId" = NULL WHERE "createdByUserId" = ?', ['u1']);
	});
});
