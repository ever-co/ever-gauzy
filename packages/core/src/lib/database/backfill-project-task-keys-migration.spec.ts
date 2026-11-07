import { BackfillProjectTaskKeys1791000004900 } from './migrations/1791000004900-BackfillProjectTaskKeys';

/** A Postgres query runner over a few projects that records the updates. */
function runner(rows: Array<Record<string, unknown>>) {
	const updates: Array<{ sql: string; params: unknown[] }> = [];
	return {
		updates,
		isTransactionActive: true,
		connection: { options: { type: 'postgres' } },
		hasTable: jest.fn(async () => true),
		hasColumn: jest.fn(async () => true),
		query: jest.fn(async (sql: string, params: unknown[] = []) => {
			if (sql.startsWith('SELECT "id"')) return rows;
			if (sql.startsWith('UPDATE')) updates.push({ sql, params });
			return [];
		})
	};
}

describe('BackfillProjectTaskKeys1791000004900', () => {
	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it('writes a key only on the keyless projects, per organization, never over a key', async () => {
		const queryRunner = runner([
			{ id: 'p1', tenantId: 't', organizationId: 'o1', name: 'Gauzy', taskKey: null, taskKeyHistory: null },
			{ id: 'p2', tenantId: 't', organizationId: 'o1', name: 'Gauzy Teams', taskKey: null, taskKeyHistory: null },
			{ id: 'p3', tenantId: 't', organizationId: 'o2', name: 'Gauzy', taskKey: null, taskKeyHistory: null },
			{ id: 'p4', tenantId: 't', organizationId: 'o2', name: 'Ops', taskKey: 'OPS', taskKeyHistory: null }
		]);
		await new BackfillProjectTaskKeys1791000004900().up(queryRunner as never);
		expect(queryRunner.updates.map((update) => update.params)).toEqual([
			['GAU', 'p1'],
			['GAU2', 'p2'],
			['GAU', 'p3']
		]);
		expect(queryRunner.updates[0].sql).toBe('UPDATE "organization_project" SET "taskKey" = $1 WHERE "id" = $2 AND "taskKey" IS NULL');
	});

	it('takes the next free key when a project created meanwhile holds the first one', async () => {
		const queryRunner = runner([{ id: 'p1', tenantId: 't', organizationId: 'o1', name: 'Gauzy', taskKey: null, taskKeyHistory: null }]);
		let first = true;
		queryRunner.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
			if (sql.startsWith('SELECT "id"')) return [{ id: 'p1', tenantId: 't', organizationId: 'o1', name: 'Gauzy', taskKey: null, taskKeyHistory: null }];
			if (sql.startsWith('SELECT "name"')) return [{ name: 'Gauzy Web', taskKey: 'GAU', taskKeyHistory: null }, { name: 'Gauzy', taskKey: null, taskKeyHistory: null }];
			if (sql.startsWith('UPDATE')) {
				queryRunner.updates.push({ sql, params });
				if (first) {
					first = false;
					throw Object.assign(new Error('duplicate key'), { code: '23505' });
				}
			}
			return [];
		});
		await new BackfillProjectTaskKeys1791000004900().up(queryRunner as never);
		expect(queryRunner.updates.map((update) => update.params)).toEqual([
			['GAU', 'p1'],
			['GAU2', 'p1']
		]);
	});

	it('does nothing where the key column is not there', async () => {
		const queryRunner = runner([]);
		queryRunner.hasColumn.mockResolvedValueOnce(false);
		await new BackfillProjectTaskKeys1791000004900().up(queryRunner as never);
		expect(queryRunner.query).not.toHaveBeenCalled();
	});
});
