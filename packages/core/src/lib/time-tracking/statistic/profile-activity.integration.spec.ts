jest.mock('dotenv', () => ({
	config: jest.fn(() => ({ parsed: {} }))
}));

import * as dotenv from 'dotenv';
import '../../core/entities/internal';

import { DatabaseTypeEnum } from '@gauzy/config';
import { ID, IGetProfileActivity, IProfileActivity } from '@gauzy/contracts';
import { knex as createKnex, Knex } from 'knex';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { MultiORMEnum } from '../../core/utils';
import { StatisticService } from './statistic.service';

const TENANT_ID = '836f20c4-6014-444a-858f-f6803651afda';
const OTHER_TENANT_ID = 'fe44989b-9381-4573-b904-c5ca0680638e';
const ORGANIZATION_ID = 'cc2e40f0-bd4a-44c9-b3ce-bf250e2d4993';
const OTHER_ORGANIZATION_ID = '82f6028e-eb27-4f7f-a855-937909de8bef';
const EMPLOYEE_ID = '8f65f1cc-b2ff-4146-8889-46efc7a8371b';
const OTHER_EMPLOYEE_ID = 'cbf27f7b-d16e-41e4-8547-e9ace2d69aed';
const TEAM_ID = '8fe6823a-c610-45b1-9c0c-e8eb40399d4c';
const OTHER_TEAM_ID = 'b510ca99-f67f-44a5-a136-27c1c4b0158c';

const request: IGetProfileActivity = {
	organizationId: ORGANIZATION_ID,
	employeeId: EMPLOYEE_ID,
	organizationTeamId: TEAM_ID,
	startDate: '2025-12-31',
	endDate: '2026-01-03',
	timeZone: 'Europe/Madrid',
	includeDaily: true
};

const expectedResponse: IProfileActivity = {
	employeeId: EMPLOYEE_ID,
	activeDays: 2,
	totalDuration: 0.6,
	firstActiveOn: '2025-12-31',
	lastActiveOn: '2026-01-01',
	period: {
		startDate: '2025-12-31',
		endDate: '2026-01-03',
		timeZone: 'Europe/Madrid'
	},
	daily: [
		{ date: '2025-12-31', duration: 0.1 },
		{ date: '2026-01-01', duration: 0.5 }
	]
};

type FixtureTimeLog = {
	id: string;
	tenantId: string;
	organizationId: string;
	employeeId: string;
	organizationTeamId: string | null;
	startedAt: Date;
	stoppedAt: Date | null;
	deletedAt: Date | null;
};

const TimeLogSchema = new EntitySchema<FixtureTimeLog>({
	name: 'ProfileActivityTimeLog',
	tableName: 'time_log',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar' },
		organizationId: { type: 'varchar' },
		employeeId: { type: 'varchar' },
		organizationTeamId: { type: 'varchar', nullable: true },
		startedAt: { type: Date },
		stoppedAt: { type: Date, nullable: true },
		deletedAt: { type: Date, nullable: true, deleteDate: true }
	}
});

function at(value: string): Date {
	return new Date(value);
}

function createFixtureRows(): FixtureTimeLog[] {
	return [
		{
			id: 'matching-local-december',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			organizationTeamId: TEAM_ID,
			startedAt: at('2025-12-31T22:30:00.000Z'),
			stoppedAt: at('2025-12-31T22:30:00.100Z'),
			deletedAt: null
		},
		{
			id: 'matching-local-january',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			organizationTeamId: TEAM_ID,
			startedAt: at('2025-12-31T23:30:00.000Z'),
			stoppedAt: at('2025-12-31T23:30:00.200Z'),
			deletedAt: null
		},
		{
			id: 'matching-other-team',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			organizationTeamId: OTHER_TEAM_ID,
			startedAt: at('2026-01-01T01:00:00.000Z'),
			stoppedAt: at('2026-01-01T01:00:00.300Z'),
			deletedAt: null
		},
		{
			id: 'deleted',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			organizationTeamId: TEAM_ID,
			startedAt: at('2026-01-01T02:00:00.000Z'),
			stoppedAt: at('2026-01-01T02:00:10.000Z'),
			deletedAt: at('2026-01-01T03:00:00.000Z')
		},
		{
			id: 'null-stop',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			organizationTeamId: TEAM_ID,
			startedAt: at('2026-01-01T03:00:00.000Z'),
			stoppedAt: null,
			deletedAt: null
		},
		{
			id: 'zero-duration',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			organizationTeamId: TEAM_ID,
			startedAt: at('2026-01-01T04:00:00.000Z'),
			stoppedAt: at('2026-01-01T04:00:00.000Z'),
			deletedAt: null
		},
		{
			id: 'negative-duration',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			organizationTeamId: TEAM_ID,
			startedAt: at('2026-01-01T05:00:00.000Z'),
			stoppedAt: at('2026-01-01T04:59:59.000Z'),
			deletedAt: null
		},
		{
			id: 'wrong-tenant',
			tenantId: OTHER_TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			organizationTeamId: TEAM_ID,
			startedAt: at('2026-01-01T06:00:00.000Z'),
			stoppedAt: at('2026-01-01T06:00:05.000Z'),
			deletedAt: null
		},
		{
			id: 'wrong-organization',
			tenantId: TENANT_ID,
			organizationId: OTHER_ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			organizationTeamId: TEAM_ID,
			startedAt: at('2026-01-01T07:00:00.000Z'),
			stoppedAt: at('2026-01-01T07:00:05.000Z'),
			deletedAt: null
		},
		{
			id: 'wrong-employee',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: OTHER_EMPLOYEE_ID,
			organizationTeamId: TEAM_ID,
			startedAt: at('2026-01-01T08:00:00.000Z'),
			stoppedAt: at('2026-01-01T08:00:05.000Z'),
			deletedAt: null
		},
		{
			id: 'before-start',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			organizationTeamId: TEAM_ID,
			startedAt: at('2025-12-30T22:59:59.999Z'),
			stoppedAt: at('2025-12-30T23:00:00.999Z'),
			deletedAt: null
		},
		{
			id: 'at-exclusive-end',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			organizationTeamId: TEAM_ID,
			startedAt: at('2026-01-02T23:00:00.000Z'),
			stoppedAt: at('2026-01-02T23:00:01.000Z'),
			deletedAt: null
		}
	];
}

function asNaiveUtc(date: Date | null): string | null {
	return date === null ? null : date.toISOString().replace('T', ' ').replace('Z', '');
}

class IntegrationStatisticService extends StatisticService {
	constructor(ormType: MultiORMEnum, typeOrmTimeLogRepository: any, mikroOrmTimeLogRepository: any) {
		super(
			{ createQueryBuilder: jest.fn() } as any,
			{ existsBy: jest.fn() } as any,
			{ createQueryBuilder: jest.fn() } as any,
			typeOrmTimeLogRepository,
			mikroOrmTimeLogRepository,
			{} as any,
			{ dbConnectionOptions: { type: DatabaseTypeEnum.betterSqlite3 } } as any,
			{} as any
		);
		this.ormType = ormType;
	}

	protected assertProfileActivityAccess(): Promise<ID> {
		return Promise.resolve(TENANT_ID);
	}
}

describe('profile activity one-select BetterSqlite integration', () => {
	it('hoists a no-op dotenv config mock before config, entity, and service imports', () => {
		expect(jest.isMockFunction(dotenv.config)).toBe(true);
		expect(dotenv.config).toHaveBeenCalled();
		expect(dotenv.config()).toEqual({ parsed: {} });
	});

	it('runs the TypeORM production path with automatic soft-delete exclusion and no joins', async () => {
		const capturedQueries: Array<{ sql: string; parameters?: unknown[] }> = [];
		let capture = false;
		const dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [TimeLogSchema],
			synchronize: true,
			logging: ['query'],
			logger: {
				logQuery: (sql: string, parameters?: unknown[]) => {
					if (capture) capturedQueries.push({ sql, parameters });
				},
				logQueryError: () => undefined,
				logQuerySlow: () => undefined,
				logSchemaBuild: () => undefined,
				logMigration: () => undefined,
				log: () => undefined
			} as any
		});

		try {
			await dataSource.initialize();
			const repository: Repository<FixtureTimeLog> = dataSource.getRepository(TimeLogSchema);
			await repository.insert(createFixtureRows());
			const service = new IntegrationStatisticService(MultiORMEnum.TypeORM, repository, {});
			capture = true;

			await expect(service.getProfileActivity(request)).resolves.toEqual(expectedResponse);

			const selects = capturedQueries.filter(({ sql }) => /^\s*SELECT\b/i.test(sql));
			expect(selects).toHaveLength(1);
			expect(selects[0].sql).not.toMatch(/\bJOIN\b/i);
			expect(selects[0].sql).toMatch(/deletedAt[^\n]*IS NULL/i);
			expect(selects[0].sql).toMatch(/startedAt[^\n]*>=/i);
			expect(selects[0].sql).toMatch(/startedAt[^\n]*</i);
			expect(selects[0].sql).not.toContain(TEAM_ID);
		} finally {
			if (dataSource.isInitialized) await dataSource.destroy();
		}
	});

	it('runs the direct Knex production path with explicit soft-delete exclusion and no joins', async () => {
		const knex: Knex = createKnex({
			client: 'better-sqlite3',
			connection: { filename: ':memory:' },
			useNullAsDefault: true
		});
		const capturedQueries: string[] = [];
		let capture = false;
		knex.on('query', ({ sql }) => {
			if (capture) capturedQueries.push(sql);
		});

		try {
			await knex.schema.createTable('time_log', (table) => {
				table.string('id').primary();
				table.string('tenantId').notNullable();
				table.string('organizationId').notNullable();
				table.string('employeeId').notNullable();
				table.string('organizationTeamId').nullable();
				table.dateTime('startedAt').notNullable();
				table.dateTime('stoppedAt').nullable();
				table.dateTime('deletedAt').nullable();
			});
			await knex('time_log').insert(
				createFixtureRows().map((row) => ({
					...row,
					startedAt: asNaiveUtc(row.startedAt),
					stoppedAt: asNaiveUtc(row.stoppedAt),
					deletedAt: asNaiveUtc(row.deletedAt)
				}))
			);
			const service = new IntegrationStatisticService(MultiORMEnum.MikroORM, {}, { getKnex: () => knex });
			capture = true;

			await expect(service.getProfileActivity(request)).resolves.toEqual(expectedResponse);

			const selects = capturedQueries.filter((sql) => /^\s*select\b/i.test(sql));
			expect(selects).toHaveLength(1);
			expect(selects[0]).not.toMatch(/\bjoin\b/i);
			expect(selects[0]).toMatch(/deletedAt[^\n]*is null/i);
			expect(selects[0]).toMatch(/startedAt[^\n]*>=/i);
			expect(selects[0]).toMatch(/startedAt[^\n]*</i);
			expect(selects[0]).not.toContain(TEAM_ID);
		} finally {
			await knex.destroy();
		}
	});
});
