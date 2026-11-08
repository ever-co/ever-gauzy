import { BackfillProjectTaskKeys1791000004950 } from './migrations/1791000004950-BackfillProjectTaskKeys';

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

describe('BackfillProjectTaskKeys1791000004950', () => {
	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it('writes a key only on the keyless projects, per organization, never over a key', async () => {
		const queryRunner = runner([
			{ id: 'p1', tenantId: 't', organizationId: 'o1', name: 'Gauzy', taskKey: null, taskKeyHistory: null },
			{ id: 'p2', tenantId: 't', organizationId: 'o1', name: 'Gauzy Teams', taskKey: null, taskKeyHistory: null },
			{ id: 'p3', tenantId: 't', organizationId: 'o2', name: 'Gauzy', taskKey: null, taskKeyHistory: null },
			{ id: 'p4', tenantId: 't', organizationId: 'o2', name: 'Ops', taskKey: 'OPS', taskKeyHistory: null }
		]);
		await new BackfillProjectTaskKeys1791000004950().up(queryRunner as never);
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
		await new BackfillProjectTaskKeys1791000004950().up(queryRunner as never);
		expect(queryRunner.updates.map((update) => update.params)).toEqual([
			['GAU', 'p1'],
			['GAU2', 'p1']
		]);
	});

	it('rolls back to a savepoint after a refused key on Postgres, so the migration transaction stays usable', async () => {
		const project = { id: 'p1', tenantId: 't', organizationId: 'o1', name: 'Gauzy', taskKey: null, taskKeyHistory: null };
		const queryRunner = runner([project]);
		const statements: string[] = [];
		// Postgres semantics: after a refused statement the transaction is aborted, and every statement but a
		// rollback to a savepoint fails with 25P02 until then.
		let aborted = false;
		let refused = false;
		queryRunner.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
			statements.push(sql);
			if (sql.startsWith('ROLLBACK TO SAVEPOINT')) {
				aborted = false;
				return [];
			}
			if (aborted) throw Object.assign(new Error('current transaction is aborted'), { code: '25P02' });
			if (sql.startsWith('SELECT "id"')) return [project];
			if (sql.startsWith('SELECT "name"')) return [{ name: 'Gauzy Web', taskKey: 'GAU', taskKeyHistory: null }, { ...project }];
			if (sql.startsWith('UPDATE')) {
				queryRunner.updates.push({ sql, params });
				if (!refused) {
					refused = true;
					aborted = true;
					throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
				}
			}
			return [];
		});
		await new BackfillProjectTaskKeys1791000004950().up(queryRunner as never);
		expect(queryRunner.updates.map((update) => update.params)).toEqual([
			['GAU', 'p1'],
			['GAU2', 'p1']
		]);
		expect(statements.filter((sql) => /SAVEPOINT|^UPDATE|^SELECT "name"/.test(sql)).map((sql) => sql.split(' ').slice(0, 3).join(' '))).toEqual([
			'SAVEPOINT backfill_project_task_key',
			'UPDATE "organization_project" SET',
			'ROLLBACK TO SAVEPOINT',
			'SELECT "name", "taskKey",',
			'SAVEPOINT backfill_project_task_key',
			'UPDATE "organization_project" SET',
			'RELEASE SAVEPOINT backfill_project_task_key'
		]);
	});

	it('runs no savepoint outside a transaction', async () => {
		const queryRunner = runner([{ id: 'p1', tenantId: 't', organizationId: 'o1', name: 'Gauzy', taskKey: null, taskKeyHistory: null }]);
		queryRunner.isTransactionActive = false;
		await new BackfillProjectTaskKeys1791000004950().up(queryRunner as never);
		expect(queryRunner.updates.map((update) => update.params)).toEqual([['GAU', 'p1']]);
		expect(queryRunner.query.mock.calls.some(([sql]) => String(sql).includes('SAVEPOINT'))).toBe(false);
	});

	it('does nothing where the key column is not there', async () => {
		const queryRunner = runner([]);
		queryRunner.hasColumn.mockResolvedValueOnce(false);
		await new BackfillProjectTaskKeys1791000004950().up(queryRunner as never);
		expect(queryRunner.query).not.toHaveBeenCalled();
	});
});
