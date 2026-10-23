import '../../core/entities/internal';

import { knex as createKnex, Knex } from 'knex';
import { IGetManualTimesStatistics, IManualTimesStatistics } from '@gauzy/contracts';
import { MultiORMEnum } from '../../core/utils';
import { asTenantUser, createCrossTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { StatisticService } from './statistic.service';

/**
 * The MikroORM branch of manualTimes answered `employee: { id }` only, so the dashboard could not tell an
 * agent employee from a person. It now selects `employee.kind` too. The SQL is the real knex SQL (Postgres
 * dialect, no connection); awaiting the builder returns canned rows.
 */
describe('StatisticService.manualTimes on MikroORM', () => {
	const { tenantA } = createCrossTenantFixture();
	const sqlBuilder = createKnex({ client: 'pg' });

	let restore: () => void;
	let queries: string[];

	beforeEach(() => {
		({ restore } = asTenantUser(tenantA));
		queries = [];
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	afterAll(() => sqlBuilder.destroy());

	const recordingKnex = (...results: unknown[]) =>
		Object.assign(
			(table: string) => {
				const builder: Knex.QueryBuilder = sqlBuilder(table);
				const result = results.shift();
				(builder as unknown as { then: unknown }).then = (
					resolve: (value: unknown) => unknown,
					reject?: (reason: unknown) => unknown
				) => {
					queries.push(builder.toString());
					return Promise.resolve(result).then(resolve, reject);
				};
				return builder;
			},
			{ raw: sqlBuilder.raw.bind(sqlBuilder) }
		);

	it('returns the employee kind with each manual time log', async () => {
		const knex = recordingKnex([
			{
				id: 'L1',
				startedAt: '2026-09-29T10:00:00.000Z',
				duration: 3600,
				employeeId: 'E1',
				user_firstName: 'Ever',
				user_lastName: 'Agent',
				user_imageUrl: 'agent.png',
				project_name: 'Gauzy',
				project_imageUrl: null,
				employee_id: 'E1',
				employee_kind: 'agent'
			}
		]);

		const [log] = (await StatisticService.prototype.manualTimes.call(
			{
				ormType: MultiORMEnum.MikroORM,
				_managedEmployeeService: { filterAccessibleEmployeeIds: jest.fn().mockResolvedValue([]) },
				mikroOrmTimeLogRepository: { getKnex: () => knex }
			},
			{
				organizationId: tenantA.organizationId,
				startDate: '2026-09-28',
				endDate: '2026-10-04'
			} as IGetManualTimesStatistics
		)) as IManualTimesStatistics[];

		expect(queries).toHaveLength(1);
		expect(queries[0]).toContain('"employee"."kind" as "employee_kind"');
		expect(log.employee).toEqual({ id: 'E1', kind: 'agent' });
		expect(log.user).toEqual({ name: 'Ever Agent', imageUrl: 'agent.png' });
	});
});
