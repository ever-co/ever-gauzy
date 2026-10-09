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
const RUNNING_EMPLOYEE_ID = 'cb7af98c-d96e-40c8-8acb-3e37ee5dce12';
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

type FixtureTimeSlot = {
	id: string;
	tenantId: string;
	organizationId: string;
	overall: number;
	deletedAt: Date | null;
};

type FixtureTimeSlotTimeLog = {
	timeSlotId: string;
	timeLogId: string;
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

const TimeSlotSchema = new EntitySchema<FixtureTimeSlot>({
	name: 'ProfileActivityTimeSlot',
	tableName: 'time_slot',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar' },
		organizationId: { type: 'varchar' },
		overall: { type: Number },
		deletedAt: { type: Date, nullable: true, deleteDate: true }
	}
});

const TimeSlotTimeLogSchema = new EntitySchema<FixtureTimeSlotTimeLog>({
	name: 'ProfileActivityTimeSlotTimeLog',
	tableName: 'time_slot_time_logs',
	columns: {
		timeSlotId: { primary: true, type: 'varchar' },
		timeLogId: { primary: true, type: 'varchar' }
	},
	indices: [{ name: 'IDX_profile_activity_time_log_link', columns: ['timeLogId'] }]
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
			id: 'no-time-slot',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			organizationTeamId: TEAM_ID,
			startedAt: at('2026-01-01T05:30:00.000Z'),
			stoppedAt: at('2026-01-01T05:30:09.000Z'),
			deletedAt: null
		},
		{
			id: 'activity-above-100-percent',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			organizationTeamId: TEAM_ID,
			startedAt: at('2026-01-01T05:45:00.000Z'),
			stoppedAt: at('2026-01-01T05:45:08.000Z'),
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
		},
		{
			id: 'running-only-today',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: RUNNING_EMPLOYEE_ID,
			organizationTeamId: TEAM_ID,
			startedAt: at('2026-01-01T10:00:00.000Z'),
			stoppedAt: null,
			deletedAt: null
		}
	];
}

function createFixtureTimeSlots(): FixtureTimeSlot[] {
	return [
		{ id: 'slot-december-min', tenantId: TENANT_ID, organizationId: ORGANIZATION_ID, overall: 0, deletedAt: null },
		{ id: 'slot-january-max', tenantId: TENANT_ID, organizationId: ORGANIZATION_ID, overall: 600, deletedAt: null },
		{
			id: 'slot-january-second',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			overall: 300,
			deletedAt: null
		},
		{ id: 'slot-other-team', tenantId: TENANT_ID, organizationId: ORGANIZATION_ID, overall: 240, deletedAt: null },
		{
			id: 'slot-activity-too-high',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			overall: 601,
			deletedAt: null
		},
		{ id: 'slot-running', tenantId: TENANT_ID, organizationId: ORGANIZATION_ID, overall: 120, deletedAt: null }
	];
}

function createFixtureTimeSlotLinks(): FixtureTimeSlotTimeLog[] {
	return [
		{ timeSlotId: 'slot-december-min', timeLogId: 'matching-local-december' },
		{ timeSlotId: 'slot-january-max', timeLogId: 'matching-local-january' },
		{ timeSlotId: 'slot-january-second', timeLogId: 'matching-local-january' },
		{ timeSlotId: 'slot-other-team', timeLogId: 'matching-other-team' },
		{ timeSlotId: 'slot-activity-too-high', timeLogId: 'activity-above-100-percent' },
		{ timeSlotId: 'slot-running', timeLogId: 'running-only-today' }
	];
}

async function seedTypeOrmFixture(dataSource: DataSource): Promise<Repository<FixtureTimeLog>> {
	const repository = dataSource.getRepository(TimeLogSchema);
	await repository.insert(createFixtureRows());
	await dataSource.getRepository(TimeSlotSchema).insert(createFixtureTimeSlots());
	await dataSource.getRepository(TimeSlotTimeLogSchema).insert(createFixtureTimeSlotLinks());
	return repository;
}

function asEpochMilliseconds(date: Date | null): number | null {
	return date === null ? null : date.getTime();
}

class IntegrationStatisticService extends StatisticService {
	constructor(
		ormType: MultiORMEnum,
		typeOrmTimeLogRepository: any,
		mikroOrmTimeLogRepository: any,
		private readonly profileNow?: Date
	) {
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

	protected getProfileActivityNow(): Date {
		return this.profileNow ?? super.getProfileActivityNow();
	}
}

describe('profile activity one-select BetterSqlite integration', () => {
	it('hoists a no-op dotenv config mock before config, entity, and service imports', () => {
		expect(jest.isMockFunction(dotenv.config)).toBe(true);
		expect(dotenv.config).toHaveBeenCalled();
		expect(dotenv.config()).toEqual({ parsed: {} });
	});

	it('runs the TypeORM production path with soft-delete, time-slot, and 0..100 activity semantics', async () => {
		const capturedQueries: Array<{ sql: string; parameters?: unknown[] }> = [];
		let capture = false;
		const dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [TimeLogSchema, TimeSlotSchema, TimeSlotTimeLogSchema],
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
			const repository = await seedTypeOrmFixture(dataSource);
			const service = new IntegrationStatisticService(MultiORMEnum.TypeORM, repository, {});
			capture = true;

			await expect(service.getProfileActivity(request)).resolves.toEqual(expectedResponse);

			const selects = capturedQueries.filter(({ sql }) => /^\s*SELECT\b/i.test(sql));
			expect(selects).toHaveLength(1);
			expect(selects[0].sql).toMatch(/\bEXISTS\b/i);
			expect(selects[0].sql).toMatch(/time_slot_time_logs/i);
			expect(selects[0].sql).toMatch(/overall[^\n]*BETWEEN/i);
			expect(selects[0].sql).toMatch(/deletedAt[^\n]*IS NULL/i);
			expect(selects[0].sql).toMatch(/startedAt[^\n]*>=/i);
			expect(selects[0].sql).toMatch(/startedAt[^\n]*</i);
			expect(selects[0].sql).not.toMatch(/organizationTeamId/i);
		} finally {
			if (dataSource.isInitialized) await dataSource.destroy();
		}
	});

	it('counts a running-only log through the current instant when it has a matching time slot', async () => {
		const dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [TimeLogSchema, TimeSlotSchema, TimeSlotTimeLogSchema],
			synchronize: true
		});

		try {
			await dataSource.initialize();
			const repository = await seedTypeOrmFixture(dataSource);
			const service = new IntegrationStatisticService(
				MultiORMEnum.TypeORM,
				repository,
				{},
				at('2026-01-01T10:01:30.000Z')
			);

			await expect(
				service.getProfileActivity({
					...request,
					employeeId: RUNNING_EMPLOYEE_ID,
					startDate: '2026-01-01',
					endDate: '2026-01-02',
					timeZone: 'UTC'
				})
			).resolves.toEqual({
				employeeId: RUNNING_EMPLOYEE_ID,
				activeDays: 1,
				totalDuration: 90,
				firstActiveOn: '2026-01-01',
				lastActiveOn: '2026-01-01',
				period: { startDate: '2026-01-01', endDate: '2026-01-02', timeZone: 'UTC' },
				daily: [{ date: '2026-01-01', duration: 90 }]
			});
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
			await knex.schema.createTable('time_slot', (table) => {
				table.string('id').primary();
				table.string('tenantId').notNullable();
				table.string('organizationId').notNullable();
				table.integer('overall').notNullable();
				table.dateTime('deletedAt').nullable();
			});
			await knex.schema.createTable('time_slot_time_logs', (table) => {
				table.string('timeSlotId').notNullable();
				table.string('timeLogId').notNullable().index();
				table.primary(['timeSlotId', 'timeLogId']);
			});
			await knex('time_log').insert(
				createFixtureRows().map((row) => ({
					...row,
					startedAt: asEpochMilliseconds(row.startedAt),
					stoppedAt: asEpochMilliseconds(row.stoppedAt),
					deletedAt: asEpochMilliseconds(row.deletedAt)
				}))
			);
			await knex('time_slot').insert(
				createFixtureTimeSlots().map((row) => ({ ...row, deletedAt: asEpochMilliseconds(row.deletedAt) }))
			);
			await knex('time_slot_time_logs').insert(createFixtureTimeSlotLinks());
			const service = new IntegrationStatisticService(MultiORMEnum.MikroORM, {}, { getKnex: () => knex });
			capture = true;

			await expect(service.getProfileActivity(request)).resolves.toEqual(expectedResponse);

			const selects = capturedQueries.filter((sql) => /^\s*select\b/i.test(sql));
			expect(selects).toHaveLength(1);
			expect(selects[0]).toMatch(/\bexists\b/i);
			expect(selects[0]).toMatch(/time_slot_time_logs/i);
			expect(selects[0]).toMatch(/overall[^\n]*between/i);
			expect(selects[0]).toMatch(/deletedAt[^\n]*is null/i);
			expect(selects[0]).toMatch(/startedAt[^\n]*>=/i);
			expect(selects[0]).toMatch(/startedAt[^\n]*</i);
			expect(selects[0]).not.toMatch(/organizationTeamId/i);
		} finally {
			await knex.destroy();
		}
	});
});
