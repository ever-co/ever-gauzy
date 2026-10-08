import '../../core/entities/internal';

import { MultiORMEnum } from '../../core/utils';
import { asTenantUser, createCrossTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TimeLogService } from './time-log.service';

/**
 * The MikroORM branches of the project / client budget reports query with raw knex, which bypasses
 * MikroORM's soft-delete filter. Every query they run must therefore exclude soft-deleted rows itself,
 * as TypeORM's query builder does, or deleted time keeps counting toward the budget spent.
 *
 * The knex stand-in records each query (table + `whereNull` columns) and answers them in order.
 */
function createKnex(answers: unknown[][]) {
	const queries: { table: string; whereNull: string[] }[] = [];
	const knex = jest.fn((table: string) => {
		const query = { table, whereNull: [] as string[] };
		const answer = answers[queries.length];
		queries.push(query);
		const builder: Record<string, unknown> = {};
		for (const method of ['innerJoin', 'select', 'where', 'andWhere', 'whereIn', 'groupBy']) {
			builder[method] = jest.fn(() => builder);
		}
		builder.whereNull = jest.fn((column: string) => {
			query.whereNull.push(column);
			return builder;
		});
		// Awaiting a knex builder runs the query
		builder.then = (resolve: (rows: unknown[]) => unknown) => Promise.resolve(answer).then(resolve);
		return builder;
	});
	return { knex, queries };
}

describe('TimeLogService budget reports exclude soft-deleted rows (MikroORM)', () => {
	const { tenantA } = createCrossTenantFixture();
	const request = {
		organizationId: tenantA.organizationId,
		startDate: '2026-09-01',
		endDate: '2026-09-30'
	};
	const timeLogRow = { id: 't-1', duration: 3600, employeeId: 'e-1', employee_billRateValue: 10 };

	let restore: () => void;

	beforeEach(() => {
		({ restore } = asTenantUser(tenantA));
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	const run = (method: 'getProjectBudgetLimit' | 'getClientBudgetLimit', answers: unknown[][]) => {
		const { knex, queries } = createKnex(answers);
		const self = {
			ormType: MultiORMEnum.MikroORM,
			mikroOrmTimeLogRepository: { getKnex: () => knex },
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			getMikroOrmBudgetTargets: (TimeLogService.prototype as any).getMikroOrmBudgetTargets
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = (TimeLogService.prototype[method] as any).call(self, request);
		return { result, queries };
	};

	it('project budget: every query excludes deleted projects, time logs and employees', async () => {
		const { result, queries } = run('getProjectBudgetLimit', [
			[{ id: 'p-1' }],
			[{ id: 'p-1', name: 'Site', budget: 10, budgetType: 'hours' }],
			[{ ...timeLogRow, targetId: 'p-1' }]
		]);
		await expect(result).resolves.toEqual([expect.objectContaining({ budget: 10, spent: 1 })]);

		expect(queries.map(({ table }) => table)).toEqual(['organization_project', 'organization_project', 'time_log']);
		expect(queries[0].whereNull).toEqual(
			expect.arrayContaining(['organization_project.deletedAt', 'employee.deletedAt', 'time_log.deletedAt'])
		);
		expect(queries[1].whereNull).toEqual(['deletedAt']);
		expect(queries[2].whereNull).toEqual(expect.arrayContaining(['time_log.deletedAt', 'employee.deletedAt']));
	});

	it('client budget: every query excludes deleted contacts, time logs and employees', async () => {
		const { result, queries } = run('getClientBudgetLimit', [
			[{ id: 'c-1' }],
			[{ id: 'c-1', name: 'Acme', budget: 10, budgetType: 'hours' }],
			[{ ...timeLogRow, targetId: 'c-1' }]
		]);
		await expect(result).resolves.toHaveLength(1);

		expect(queries.map(({ table }) => table)).toEqual(['organization_contact', 'organization_contact', 'time_log']);
		expect(queries[0].whereNull).toEqual(
			expect.arrayContaining(['organization_contact.deletedAt', 'employee.deletedAt', 'time_log.deletedAt'])
		);
		expect(queries[1].whereNull).toEqual(['deletedAt']);
		expect(queries[2].whereNull).toEqual(expect.arrayContaining(['time_log.deletedAt', 'employee.deletedAt']));
	});
});
