let mockDbType = 'postgres';
jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	getConfig: () => ({ dbConnectionOptions: { type: mockDbType } }),
	isMySQL: () => mockDbType === 'mysql'
}));

import '../core/entities/internal';

import { EntityManager as TypeOrmEntityManager } from 'typeorm';
import { EntityManager as MikroOrmEntityManager } from '@mikro-orm/core';
import { MultiORMEnum } from '../core/utils';
import { recountMembersOfEmployeeProjects } from './organization-project-members-count';

/**
 * Two members of one project whose work ends at the same instant must not leave its `membersCount` one too high.
 *
 * Under READ COMMITTED the second recount's `UPDATE` waits for the first one's row lock, then evaluates its count
 * on a snapshot taken before the first one committed. So on Postgres and MySQL the recount first locks the
 * employee's projects in id order, in a statement of its own, inside a transaction that lasts until the write's
 * end: the `UPDATE` that follows then sees every recount that committed before it. (On SQLite, where there is a
 * single writer, the recount is unchanged: see `organization-project-members-count.spec.ts`.)
 */

const EMPLOYEE = 'employee-1';

function typeOrmManager(transactionActive: boolean) {
	const query = jest.fn().mockResolvedValue([]);
	const transactional = Object.assign(Object.create(TypeOrmEntityManager.prototype), {
		query,
		queryRunner: { isTransactionActive: true }
	});
	const em = Object.assign(Object.create(TypeOrmEntityManager.prototype), {
		query,
		queryRunner: transactionActive ? { isTransactionActive: true } : undefined,
		transaction: jest.fn(async (work: (manager: unknown) => Promise<unknown>) => work(transactional))
	});
	return { em, query, transactional };
}

describe.each(['postgres', 'mysql'])('recountMembersOfEmployeeProjects on %s, TypeORM', (type) => {
	beforeEach(() => {
		mockDbType = type;
	});

	it("locks the employee's projects in id order before recounting them, in the write's transaction", async () => {
		const { em, query } = typeOrmManager(true);

		await recountMembersOfEmployeeProjects(em, EMPLOYEE);

		expect(em.transaction).not.toHaveBeenCalled();
		expect(query).toHaveBeenCalledTimes(2);
		const [[lock, lockParams], [update, updateParams]] = query.mock.calls;
		expect(lock).toMatch(/ORDER BY[\s\S]+\sFOR UPDATE\s*$/);
		expect(lock).toContain('organization_project_employee');
		expect(lockParams).toEqual([EMPLOYEE]);
		expect(update).toContain('UPDATE');
		expect(update).toContain('membersCount');
		expect(updateParams).toEqual([EMPLOYEE]);
		if (type === 'mysql') {
			expect(lock).not.toMatch(/\$\d/);
		}
	});

	it('opens a transaction of its own when the caller has none, so the locks last through the recount', async () => {
		const { em, query, transactional } = typeOrmManager(false);

		await recountMembersOfEmployeeProjects(em, EMPLOYEE);

		expect(em.transaction).toHaveBeenCalledTimes(1);
		expect(query).toHaveBeenCalledTimes(2);
		expect(query.mock.contexts.every((context) => context === transactional)).toBe(true);
	});
});

describe('recountMembersOfEmployeeProjects on Postgres, MikroORM', () => {
	const previous = process.env.DB_ORM;

	beforeEach(() => {
		mockDbType = 'postgres';
		process.env.DB_ORM = MultiORMEnum.MikroORM;
	});

	afterEach(() => {
		if (previous === undefined) {
			delete process.env.DB_ORM;
		} else {
			process.env.DB_ORM = previous;
		}
	});

	function mikroOrmManager(transaction: unknown) {
		const execute = jest.fn().mockResolvedValue(undefined);
		const forked = { name: 'the recount transaction' };
		const inner = Object.assign(Object.create(MikroOrmEntityManager.prototype), {
			getConnection: () => ({ execute }),
			getTransactionContext: () => forked
		});
		const em = Object.assign(Object.create(MikroOrmEntityManager.prototype), {
			getConnection: () => ({ execute }),
			getTransactionContext: () => transaction,
			transactional: jest.fn(async (work: (manager: unknown) => Promise<unknown>) => work(inner))
		});
		return { em, execute, forked };
	}

	it("locks, then recounts, in the write's transaction", async () => {
		const transaction = { name: 'the flush transaction' };
		const { em, execute } = mikroOrmManager(transaction);

		await recountMembersOfEmployeeProjects(em, EMPLOYEE);

		expect(em.transactional).not.toHaveBeenCalled();
		expect(execute).toHaveBeenCalledTimes(2);
		const [[lock, , lockMethod, lockContext], [update, , updateMethod, updateContext]] = execute.mock.calls;
		expect(lock).toContain('FOR UPDATE');
		expect(lock).not.toMatch(/\$\d/);
		expect(lockMethod).toBe('all');
		expect(lockContext).toBe(transaction);
		expect(update).toContain('UPDATE "organization_project"');
		expect(updateMethod).toBe('run');
		expect(updateContext).toBe(transaction);
	});

	it('opens a transaction of its own when the caller has none', async () => {
		const { em, execute, forked } = mikroOrmManager(undefined);

		await recountMembersOfEmployeeProjects(em, EMPLOYEE);

		expect(em.transactional).toHaveBeenCalledTimes(1);
		expect(execute.mock.calls.map(([, , , context]) => context)).toEqual([forked, forked]);
	});
});
