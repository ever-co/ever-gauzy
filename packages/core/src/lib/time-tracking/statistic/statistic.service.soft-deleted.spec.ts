import '../../core/entities/internal';

import { knex as createKnex, Knex } from 'knex';
import { DatabaseTypeEnum } from '@gauzy/config';
import { IGetManualTimesStatistics, IGetProjectsStatistics } from '@gauzy/contracts';
import { MultiORMEnum } from '../../core/utils';
import { asTenantUser, createCrossTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { StatisticService } from './statistic.service';

/**
 * The MikroORM branch of the dashboard statistics builds its queries with raw knex, which skips MikroORM's
 * soft-delete filter. The TypeORM query builder adds `"deletedAt" IS NULL` for the main entity and every
 * joined one on its own, so deleted time logs (and their slots, projects, employees...) still counted on
 * MikroORM only. These specs build the real knex SQL (Postgres dialect, no connection) and check it.
 */
describe('StatisticService MikroORM statistics leave soft-deleted rows out', () => {
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

	/**
	 * A knex stand-in that builds real queries but never runs them: awaiting a builder records its SQL and
	 * resolves the next canned result.
	 */
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

	const self = (knex: unknown) => ({
		ormType: MultiORMEnum.MikroORM,
		configService: { dbConnectionOptions: { type: DatabaseTypeEnum.postgres } },
		_managedEmployeeService: { filterAccessibleEmployeeIds: jest.fn().mockResolvedValue([]) },
		mikroOrmTimeLogRepository: { getKnex: () => knex }
	});

	it('getProjects: filters deleted time logs, projects and time slots in both queries', async () => {
		const knex = recordingKnex([{ projectId: 'P', name: 'P', duration: 3600 }], { duration: 3600 });

		await StatisticService.prototype.getProjects.call(self(knex), {
			organizationId: tenantA.organizationId,
			startDate: '2026-09-28',
			endDate: '2026-10-04'
		} as IGetProjectsStatistics);

		expect(queries).toHaveLength(2);
		const [perTimeLog, total] = queries;
		expect(perTimeLog).toContain('"time_log"."deletedAt" is null');
		expect(perTimeLog).toContain('"project"."deletedAt" is null');
		expect(perTimeLog).toContain('"time_slot"."deletedAt" is null');
		expect(total).toContain('"time_log"."deletedAt" is null');
		expect(total).toContain('"project"."deletedAt" is null');
	});

	it('manualTimes: drops deleted logs, but a deleted project, employee or user only empties its fields', async () => {
		const knex = recordingKnex([]);

		await StatisticService.prototype.manualTimes.call(self(knex), {
			organizationId: tenantA.organizationId,
			startDate: '2026-09-28',
			endDate: '2026-10-04'
		} as IGetManualTimesStatistics);

		expect(queries).toHaveLength(1);
		const [sql] = queries;
		const where = sql.slice(sql.indexOf(' where '));
		// The main rows: in the WHERE clause, as TypeORM does for the main entity and its inner joins
		expect(where).toContain('"time_log"."deletedAt" is null');
		expect(where).toContain('"time_slot"."deletedAt" is null');
		// The left joins: in their ON clause, so the time log stays when the joined row is deleted
		expect(sql).toContain(
			'left join "organization_project" on "time_log"."projectId" = "organization_project"."id" and "organization_project"."deletedAt" is null'
		);
		expect(sql).toContain(
			'left join "employee" on "time_log"."employeeId" = "employee"."id" and "employee"."deletedAt" is null'
		);
		expect(sql).toContain('left join "user" on "employee"."userId" = "user"."id" and "user"."deletedAt" is null');
		expect(where).not.toContain('"employee"."deletedAt"');
		expect(where).not.toContain('"organization_project"."deletedAt"');
		expect(where).not.toContain('"user"."deletedAt"');
	});
});
