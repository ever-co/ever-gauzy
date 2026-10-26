import '../../core/entities/internal';

import { DatabaseTypeEnum } from '@gauzy/config';
import { IGetProjectsStatistics, IProjectsStatistics } from '@gauzy/contracts';
import { MultiORMEnum } from '../../core/utils';
import { asTenantUser, createCrossTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { StatisticService, byDurationDesc } from './statistic.service';

/**
 * The dashboard "Projects" widget shows the top 5 projects. The per-project totals used to keep the order
 * of the individual time logs (sorted by single-log duration), so a project with many short logs could be
 * cut from the top 5 even when it had the largest total.
 */
describe('StatisticService.getProjects ranking', () => {
	const { tenantA } = createCrossTenantFixture();
	// As the database returns them (ORDER BY single-log duration DESC): five projects with one 3h log each,
	// then project F with ten 2h logs (20h in total)
	const rows = [
		...['A', 'B', 'C', 'D', 'E'].map((id) => ({ projectId: id, name: id, duration: 10800 })),
		...Array.from({ length: 10 }, () => ({ projectId: 'F', name: 'F', duration: 7200 }))
	];
	const total = { duration: 5 * 10800 + 10 * 7200 };
	const request = {
		organizationId: tenantA.organizationId,
		startDate: '2026-09-28',
		endDate: '2026-10-04'
	} as IGetProjectsStatistics;

	/** Chainable stand-in for a TypeORM query builder or a knex builder: every call returns itself. */
	const builder = (result: Record<string, unknown>): Record<string, unknown> =>
		new Proxy(result, {
			get: (target, key) => (key in target ? target[key as string] : () => builder(result))
		});

	let restore: () => void;

	beforeEach(() => {
		({ restore } = asTenantUser(tenantA));
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	const getProjects = (self: object): Promise<IProjectsStatistics[]> =>
		StatisticService.prototype.getProjects.call(
			{
				configService: { dbConnectionOptions: { type: DatabaseTypeEnum.postgres } },
				_managedEmployeeService: { filterAccessibleEmployeeIds: jest.fn().mockResolvedValue([]) },
				...self
			},
			request
		);

	it('TypeORM: keeps the project with the largest total in the top 5', async () => {
		const createQueryBuilder = jest
			.fn()
			.mockReturnValueOnce(builder({ alias: 'time_log', getRawMany: () => Promise.resolve(rows) }))
			.mockReturnValueOnce(builder({ alias: 'time_log', getRawOne: () => Promise.resolve(total) }));

		const projects = await getProjects({
			ormType: MultiORMEnum.TypeORM,
			typeOrmTimeLogRepository: { createQueryBuilder }
		});

		expect(projects.map(({ id }) => id)).toEqual(['F', 'A', 'B', 'C', 'D']);
		expect(projects[0].duration).toBe(72000);
	});

	it('MikroORM: keeps the project with the largest total in the top 5', async () => {
		const knex = Object.assign(
			jest
				.fn()
				// Awaiting the first knex builder runs the per-time-log query
				.mockReturnValueOnce(builder({ then: (resolve: (r: unknown) => unknown) => resolve(rows) }))
				.mockReturnValueOnce(builder({ first: () => Promise.resolve(total) })),
			{ raw: (sql: string) => sql }
		);

		const projects = await getProjects({
			ormType: MultiORMEnum.MikroORM,
			mikroOrmTimeLogRepository: { getKnex: () => knex }
		});

		expect(projects.map(({ id }) => id)).toEqual(['F', 'A', 'B', 'C', 'D']);
		expect(projects[0].duration).toBe(72000);
	});

	it('compares durations returned as strings by the database driver numerically', () => {
		const sorted = [{ duration: '900' }, { duration: '10000' }, { duration: '7200' }].sort(byDurationDesc);
		expect(sorted.map(({ duration }) => duration)).toEqual(['10000', '7200', '900']);
	});
});

/**
 * The overall tracked time (stats endpoint) summed each time log's duration once per time slot linked to it.
 */
describe('StatisticService.getOverallTrackedTime', () => {
	const run = (self: object): Promise<number> =>
		StatisticService.prototype.getOverallTrackedTime.call({
			configService: { dbConnectionOptions: { type: DatabaseTypeEnum.postgres } },
			logger: { debug: jest.fn(), log: jest.fn() },
			...self
		});

	it('TypeORM: sums the time logs without joining their slots', async () => {
		const query = {
			innerJoin: jest.fn(),
			select: jest.fn(),
			getRawOne: jest.fn().mockResolvedValue({ overall_duration: 7200 })
		};
		const timeLogs = jest.fn(() => query);
		const timeSlots = jest.fn();

		const hours = await run({
			ormType: MultiORMEnum.TypeORM,
			typeOrmTimeLogRepository: { createQueryBuilder: timeLogs },
			typeOrmTimeSlotRepository: { createQueryBuilder: timeSlots }
		});

		expect(timeLogs).toHaveBeenCalledWith('time_log');
		expect(timeSlots).not.toHaveBeenCalled();
		expect(query.innerJoin).not.toHaveBeenCalled();
		expect(hours).toBe(2);
	});

	it('MikroORM: sums the non-deleted time logs without joining their slots', async () => {
		let calls: string[] = [];
		let knexBuilder: Record<string, jest.Mock> = {};
		for (const method of ['select', 'whereNull', 'innerJoin']) {
			knexBuilder[method] = jest.fn((...args: unknown[]) => {
				calls.push(`${method}:${String(args[0])}`);
				return knexBuilder;
			});
		}
		knexBuilder.first = jest.fn().mockResolvedValue({ overall_duration: 3600 });
		const knex = Object.assign(
			jest.fn(() => knexBuilder),
			{ raw: (sql: string) => sql }
		);

		const hours = await run({
			ormType: MultiORMEnum.MikroORM,
			mikroOrmTimeLogRepository: { getKnex: () => knex }
		});

		expect(knex).toHaveBeenCalledWith('time_log');
		expect(calls.some((call) => call.startsWith('innerJoin'))).toBe(false);
		expect(knexBuilder.whereNull).toHaveBeenCalledWith('time_log.deletedAt');
		expect(hours).toBe(1);
	});
});
