jest.mock('dotenv', () => ({
	config: jest.fn(() => ({ parsed: {} }))
}));

import '../../core/entities/internal';

import { DatabaseTypeEnum, defineConfig } from '@gauzy/config';
import { IActivitiesStatistics, IGetActivitiesStatistics } from '@gauzy/contracts';
import { knex as createKnex, Knex } from 'knex';
import { DataSource, EntitySchema, EntitySchemaColumnOptions } from 'typeorm';
import { MultiORMEnum } from '../../core/utils';
import { StatisticService } from './statistic.service';

/**
 * Locks the activity statistics ("Apps & URLs") while the query stops joining `activity` to the time slots and
 * time logs and reads the slots first, then the activities by `timeSlotId` (see
 * `getActivityTimeSlotFilterQueryString`):
 *  - the range, the organization, the tenant and the employee / project / team filters still apply,
 *  - soft-deleted activities, time slots and time logs still stay out, on both ORM paths,
 *  - an activity of a slot linked to TWO time logs counts once (the joins counted it twice),
 *  - the top five by duration and the percentage over the WHOLE total (every title, not only the five).
 */

const TENANT_ID = '3f9b0d11-9d24-4a6e-9a1a-6c5a2d7a5f01';
const OTHER_TENANT_ID = 'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a05';
const ORGANIZATION_ID = 'c2b7e6c0-3f7d-4a3e-9c2b-1f0e6d5a4b02';
const OTHER_ORGANIZATION_ID = '8a1d5e4b-6c2f-4f1a-8e3d-2b7c9a0f1e03';
const EMPLOYEE_ID = '5d2c1b0a-7e8f-4c3d-9a1b-0f2e3d4c5b04';
const OTHER_EMPLOYEE_ID = '6e3d2c1b-8f9a-4d4e-9b2c-1a3f4e5d6c05';
const PROJECT_ID = '0b9e8d7c-6a5b-4c3d-8e2f-1a0b9c8d7e05';
const OTHER_PROJECT_ID = '9c8b7a6d-5e4f-4a3b-9c2d-1e0f9a8b7c06';
const TEAM_ID = '7e6d5c4b-3a2f-4e1d-8c0b-9a8f7e6d5c07';
const OTHER_TEAM_ID = '8f7e6d5c-4b3a-4f2e-9d1c-0b9a8f7e6d08';

// ISO week of 2026-01-05 (Monday) to 2026-01-11 (Sunday).
const request = {
	organizationId: ORGANIZATION_ID,
	tenantId: TENANT_ID,
	startDate: '2026-01-05T00:00:00.000Z',
	endDate: '2026-01-11T23:59:59.000Z'
} as IGetActivitiesStatistics;

const filteredRequest = {
	...request,
	employeeIds: [EMPLOYEE_ID],
	projectIds: [PROJECT_ID],
	teamIds: [TEAM_ID]
} as IGetActivitiesStatistics;

// Every title in the week: VS Code 600 + Chrome 300 + 100 (shared slot, once) + Slack 200 + Zoom 70 + Figma 50
// + Mail 10 = 1330. The top five leave Mail out; the percentage is still over 1330.
const TOTAL = 1330;
const expectedActivities = [
	{ title: 'VS Code', sessions: 1, duration: 600 },
	{ title: 'Chrome', sessions: 2, duration: 400 },
	{ title: 'Slack', sessions: 1, duration: 200 },
	{ title: 'Zoom', sessions: 1, duration: 70 },
	{ title: 'Figma', sessions: 1, duration: 50 }
].map((activity) => ({ ...activity, durationPercentage: (activity.duration * 100) / TOTAL }));

// Employee, project and team filters drop Slack (other employee), Figma (other project) and Zoom (other team).
const FILTERED_TOTAL = 1010;
const expectedFilteredActivities = [
	{ title: 'VS Code', sessions: 1, duration: 600 },
	{ title: 'Chrome', sessions: 2, duration: 400 },
	{ title: 'Mail', sessions: 1, duration: 10 }
].map((activity) => ({ ...activity, durationPercentage: (activity.duration * 100) / FILTERED_TOTAL }));

type FixtureTimeLog = {
	id: string;
	tenantId: string;
	organizationId: string;
	employeeId: string;
	organizationTeamId: string;
	startedAt: string;
	stoppedAt: string | null;
	deletedAt: string | null;
};

type FixtureTimeSlot = {
	id: string;
	tenantId: string;
	organizationId: string;
	employeeId: string;
	startedAt: string;
	deletedAt: string | null;
	timeLogs?: FixtureTimeLog[];
};

type FixtureActivity = {
	id: string;
	tenantId: string;
	organizationId: string;
	employeeId: string;
	projectId: string;
	timeSlotId: string;
	title: string;
	duration: number;
	recordedAt: string;
	deletedAt: string | null;
};

type FixtureTimeSlotTimeLog = { timeSlotId: string; timeLogId: string };

const TIME_LOG_TEXT_COLUMNS = ['tenantId', 'organizationId', 'employeeId', 'organizationTeamId', 'startedAt'] as const;
const TIME_SLOT_TEXT_COLUMNS = ['tenantId', 'organizationId', 'employeeId', 'startedAt'] as const;
const ACTIVITY_TEXT_COLUMNS = [
	'tenantId',
	'organizationId',
	'employeeId',
	'projectId',
	'timeSlotId',
	'title',
	'recordedAt'
] as const;

function textColumns(names: readonly string[]): Record<string, EntitySchemaColumnOptions> {
	return Object.fromEntries(names.map((name) => [name, { type: 'varchar' }]));
}

const TimeLogSchema = new EntitySchema<FixtureTimeLog>({
	name: 'TimeLog',
	tableName: 'time_log',
	columns: {
		id: { primary: true, type: 'varchar' },
		...textColumns(TIME_LOG_TEXT_COLUMNS),
		stoppedAt: { type: 'varchar', nullable: true },
		deletedAt: { type: 'varchar', nullable: true, deleteDate: true }
	}
});

const TimeSlotSchema = new EntitySchema<FixtureTimeSlot>({
	name: 'TimeSlot',
	tableName: 'time_slot',
	columns: {
		id: { primary: true, type: 'varchar' },
		...textColumns(TIME_SLOT_TEXT_COLUMNS),
		deletedAt: { type: 'varchar', nullable: true, deleteDate: true }
	},
	relations: {
		timeLogs: {
			type: 'many-to-many',
			target: 'TimeLog',
			joinTable: {
				name: 'time_slot_time_logs',
				joinColumn: { name: 'timeSlotId', referencedColumnName: 'id' },
				inverseJoinColumn: { name: 'timeLogId', referencedColumnName: 'id' }
			}
		}
	}
});

// Named as the entity is, so the query builder's default alias is the production one ("Activity").
const ActivitySchema = new EntitySchema<FixtureActivity>({
	name: 'Activity',
	tableName: 'activity',
	columns: {
		id: { primary: true, type: 'varchar' },
		...textColumns(ACTIVITY_TEXT_COLUMNS),
		duration: { type: Number },
		deletedAt: { type: 'varchar', nullable: true, deleteDate: true }
	}
});

function log(id: string, startedAt: string, overrides: Partial<FixtureTimeLog> = {}): FixtureTimeLog {
	return {
		id,
		tenantId: TENANT_ID,
		organizationId: ORGANIZATION_ID,
		employeeId: EMPLOYEE_ID,
		organizationTeamId: TEAM_ID,
		startedAt,
		stoppedAt: null,
		deletedAt: null,
		...overrides
	};
}

function slot(id: string, startedAt: string, overrides: Partial<FixtureTimeSlot> = {}): FixtureTimeSlot {
	return {
		id,
		tenantId: TENANT_ID,
		organizationId: ORGANIZATION_ID,
		employeeId: EMPLOYEE_ID,
		startedAt,
		deletedAt: null,
		...overrides
	};
}

function activity(
	id: string,
	timeSlotId: string,
	title: string,
	duration: number,
	overrides: Partial<FixtureActivity> = {}
): FixtureActivity {
	return {
		id,
		tenantId: TENANT_ID,
		organizationId: ORGANIZATION_ID,
		employeeId: EMPLOYEE_ID,
		projectId: PROJECT_ID,
		timeSlotId,
		title,
		duration,
		recordedAt: '2026-01-06 09:05:00.000',
		deletedAt: null,
		...overrides
	};
}

function createFixtureTimeLogs(): FixtureTimeLog[] {
	return [
		log('log-a', '2026-01-06 09:00:00.000'),
		// Two logs of one slot: the slot's activities must count once, not once per log.
		log('log-shared-a', '2026-01-06 11:00:00.000'),
		log('log-shared-b', '2026-01-06 11:10:00.000'),
		log('log-other-employee', '2026-01-07 09:00:00.000', { employeeId: OTHER_EMPLOYEE_ID }),
		log('log-other-project', '2026-01-07 10:00:00.000'),
		log('log-other-team', '2026-01-07 11:00:00.000', { organizationTeamId: OTHER_TEAM_ID }),
		// Excluded: soft-deleted log, log before the week, log of another organization, log whose slot is deleted.
		log('log-soft-deleted', '2026-01-06 15:00:00.000', { deletedAt: '2026-01-06 16:00:00.000' }),
		log('log-previous-week', '2026-01-02 09:00:00.000'),
		log('log-other-organization', '2026-01-06 12:00:00.000', { organizationId: OTHER_ORGANIZATION_ID }),
		log('log-with-soft-deleted-slot', '2026-01-06 16:00:00.000')
	];
}

function createFixtureTimeSlots(): FixtureTimeSlot[] {
	return [
		slot('slot-a', '2026-01-06 09:00:00.000'),
		slot('slot-shared', '2026-01-06 11:00:00.000'),
		slot('slot-other-employee', '2026-01-07 09:00:00.000', { employeeId: OTHER_EMPLOYEE_ID }),
		slot('slot-other-project', '2026-01-07 10:00:00.000'),
		slot('slot-other-team', '2026-01-07 11:00:00.000'),
		slot('slot-of-soft-deleted-log', '2026-01-06 15:00:00.000'),
		slot('slot-previous-week', '2026-01-02 09:00:00.000'),
		slot('slot-other-organization', '2026-01-06 12:00:00.000', { organizationId: OTHER_ORGANIZATION_ID }),
		slot('slot-soft-deleted', '2026-01-06 16:00:00.000', { deletedAt: '2026-01-06 17:00:00.000' })
	];
}

function createFixtureLinks(): FixtureTimeSlotTimeLog[] {
	return [
		{ timeSlotId: 'slot-a', timeLogId: 'log-a' },
		{ timeSlotId: 'slot-shared', timeLogId: 'log-shared-a' },
		{ timeSlotId: 'slot-shared', timeLogId: 'log-shared-b' },
		{ timeSlotId: 'slot-other-employee', timeLogId: 'log-other-employee' },
		{ timeSlotId: 'slot-other-project', timeLogId: 'log-other-project' },
		{ timeSlotId: 'slot-other-team', timeLogId: 'log-other-team' },
		{ timeSlotId: 'slot-of-soft-deleted-log', timeLogId: 'log-soft-deleted' },
		{ timeSlotId: 'slot-previous-week', timeLogId: 'log-previous-week' },
		{ timeSlotId: 'slot-other-organization', timeLogId: 'log-other-organization' },
		{ timeSlotId: 'slot-soft-deleted', timeLogId: 'log-with-soft-deleted-slot' }
	];
}

function createFixtureActivities(): FixtureActivity[] {
	return [
		activity('act-vscode', 'slot-a', 'VS Code', 600),
		activity('act-chrome', 'slot-a', 'Chrome', 300),
		activity('act-chrome-shared', 'slot-shared', 'Chrome', 100, { recordedAt: '2026-01-06 11:05:00.000' }),
		activity('act-mail', 'slot-a', 'Mail', 10),
		activity('act-slack', 'slot-other-employee', 'Slack', 200, {
			employeeId: OTHER_EMPLOYEE_ID,
			recordedAt: '2026-01-07 09:05:00.000'
		}),
		activity('act-figma', 'slot-other-project', 'Figma', 50, {
			projectId: OTHER_PROJECT_ID,
			recordedAt: '2026-01-07 10:05:00.000'
		}),
		activity('act-zoom', 'slot-other-team', 'Zoom', 70, { recordedAt: '2026-01-07 11:05:00.000' }),
		// Excluded rows, each by one rule.
		activity('act-deleted-slot', 'slot-soft-deleted', 'Deleted slot', 1000, {
			recordedAt: '2026-01-06 16:05:00.000'
		}),
		activity('act-deleted-log', 'slot-of-soft-deleted-log', 'Deleted log', 999, {
			recordedAt: '2026-01-06 15:05:00.000'
		}),
		activity('act-previous-week', 'slot-previous-week', 'Previous week', 500, {
			recordedAt: '2026-01-02 09:05:00.000'
		}),
		activity('act-recorded-later', 'slot-a', 'Recorded later', 400, { recordedAt: '2026-01-13 09:05:00.000' }),
		activity('act-soft-deleted', 'slot-a', 'Removed', 123, { deletedAt: '2026-01-06 10:00:00.000' }),
		activity('act-other-organization', 'slot-other-organization', 'Foreign', 777, {
			organizationId: OTHER_ORGANIZATION_ID,
			recordedAt: '2026-01-06 12:05:00.000'
		}),
		activity('act-other-tenant', 'slot-a', 'Alien', 55, { tenantId: OTHER_TENANT_ID })
	];
}

class ActivitiesStatisticService extends StatisticService {
	constructor(
		ormType: MultiORMEnum,
		typeOrmTimeSlotRepository: any,
		typeOrmActivityRepository: any,
		mikroOrmTimeLogRepository: any
	) {
		super(
			typeOrmTimeSlotRepository,
			{} as any,
			typeOrmActivityRepository,
			{} as any,
			mikroOrmTimeLogRepository,
			{} as any,
			{ dbConnectionOptions: { type: DatabaseTypeEnum.betterSqlite3 } } as any,
			{ filterAccessibleEmployeeIds: async (employeeIds: string[]) => employeeIds } as any
		);
		this.ormType = ormType;
	}
}

/** The rows as numbers, whatever the driver returned them as. */
function normalise(activities: IActivitiesStatistics[]) {
	return activities.map((activity) => ({
		title: activity.title,
		sessions: Number(activity.sessions),
		duration: Number(activity.duration),
		durationPercentage: Number(activity.durationPercentage)
	}));
}

async function expectActivities(service: StatisticService): Promise<void> {
	expect(normalise(await service.getActivities(request))).toEqual(expectedActivities);
	expect(normalise(await service.getActivities(filteredRequest))).toEqual(expectedFilteredActivities);
}

// The outer query reads `activity` alone; the time slots and time logs are joined inside the sub-query only.
const slotsSubQuery = /[`"]timeSlotId[`"] in \(select [`"]time_slot[`"]\.[`"]id[`"]/i;
const softDeleteFilter = (alias: string) => new RegExp(`[\`"]${alias}[\`"]\\.[\`"]deletedAt[\`"] is null`, 'i');

function expectSlotsResolvedFirst(capturedQueries: string[]): void {
	const selects = capturedQueries.filter((sql) => /^\s*select\b/i.test(sql));
	// Two per request (the top five, the total), two requests.
	expect(selects).toHaveLength(4);
	for (const sql of selects) {
		expect(sql).toMatch(slotsSubQuery);
		expect(sql.search(/\bjoin\b/i)).toBeGreaterThan(sql.search(slotsSubQuery));
		for (const alias of ['activity', 'time_slot', 'time_log']) {
			expect(sql).toMatch(softDeleteFilter(alias));
		}
	}
	// The filtered requests carry the team filter inside the sub-query and the employee / project ones outside.
	for (const sql of selects.slice(2)) {
		expect(sql).toMatch(/organizationTeamId[`"]? in \(/i);
		expect(sql).toMatch(/employeeId[`"]? in \(/i);
		expect(sql).toMatch(/projectId[`"]? in \(/i);
	}
}

class QueryCapture {
	readonly queries: string[] = [];
	private armed = false;

	arm(): void {
		this.armed = true;
	}

	record(sql: string): void {
		if (this.armed) this.queries.push(sql);
	}
}

async function createKnexTables(knex: Knex): Promise<void> {
	await knex.schema.createTable('time_log', (table) => {
		table.string('id').primary();
		TIME_LOG_TEXT_COLUMNS.forEach((column) => table.string(column).notNullable());
		table.string('stoppedAt').nullable();
		table.string('deletedAt').nullable();
	});
	await knex.schema.createTable('time_slot', (table) => {
		table.string('id').primary();
		TIME_SLOT_TEXT_COLUMNS.forEach((column) => table.string(column).notNullable());
		table.string('deletedAt').nullable();
	});
	await knex.schema.createTable('time_slot_time_logs', (table) => {
		table.string('timeSlotId').notNullable();
		table.string('timeLogId').notNullable();
		table.primary(['timeSlotId', 'timeLogId']);
	});
	await knex.schema.createTable('activity', (table) => {
		table.string('id').primary();
		ACTIVITY_TEXT_COLUMNS.forEach((column) => table.string(column).notNullable());
		table.integer('duration').notNullable();
		table.string('deletedAt').nullable();
	});
}

describe('activities statistics BetterSqlite integration', () => {
	// getDateRangeFormat reads the global config, not the ConfigService injected into the service:
	// pin it so the date bounds use the SQLite text format whatever DB_TYPE the shell exports.
	beforeAll(() => defineConfig({ dbConnectionOptions: { type: DatabaseTypeEnum.betterSqlite3 } }));

	it('reads the slots first, then the activities, on the TypeORM path', async () => {
		const capture = new QueryCapture();
		const dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [TimeLogSchema, TimeSlotSchema, ActivitySchema],
			synchronize: true,
			logging: ['query'],
			logger: {
				logQuery: (sql: string) => capture.record(sql),
				logQueryError: () => undefined,
				logQuerySlow: () => undefined,
				logSchemaBuild: () => undefined,
				logMigration: () => undefined,
				log: () => undefined
			} as any
		});

		try {
			await dataSource.initialize();
			await dataSource.getRepository(TimeLogSchema).insert(createFixtureTimeLogs());
			const timeSlotRepository = dataSource.getRepository(TimeSlotSchema);
			await timeSlotRepository.insert(createFixtureTimeSlots());
			await dataSource
				.createQueryBuilder()
				.insert()
				.into('time_slot_time_logs')
				.values(createFixtureLinks())
				.execute();
			const activityRepository = dataSource.getRepository(ActivitySchema);
			await activityRepository.insert(createFixtureActivities());
			const service = new ActivitiesStatisticService(
				MultiORMEnum.TypeORM,
				timeSlotRepository,
				activityRepository,
				{}
			);
			capture.arm();

			await expectActivities(service);
			expectSlotsResolvedFirst(capture.queries);
		} finally {
			if (dataSource.isInitialized) await dataSource.destroy();
		}
	});

	it('reads the slots first, then the activities, on the Knex path', async () => {
		const knex: Knex = createKnex({
			client: 'better-sqlite3',
			connection: { filename: ':memory:' },
			useNullAsDefault: true
		});
		const capture = new QueryCapture();
		knex.on('query', ({ sql }) => capture.record(sql));

		try {
			await createKnexTables(knex);
			await knex('time_log').insert(createFixtureTimeLogs());
			await knex('time_slot').insert(createFixtureTimeSlots());
			await knex('time_slot_time_logs').insert(createFixtureLinks());
			await knex('activity').insert(createFixtureActivities());
			const service = new ActivitiesStatisticService(MultiORMEnum.MikroORM, {}, {}, { getKnex: () => knex });
			capture.arm();

			await expectActivities(service);
			expectSlotsResolvedFirst(capture.queries);
		} finally {
			await knex.destroy();
		}
	});
});
