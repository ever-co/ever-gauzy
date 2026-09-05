jest.mock('dotenv', () => ({
	config: jest.fn(() => ({ parsed: {} }))
}));

import '../../core/entities/internal';

import { DatabaseTypeEnum } from '@gauzy/config';
import { ICountsStatistics, IGetCountsStatistics } from '@gauzy/contracts';
import { knex as createKnex, Knex } from 'knex';
import { DataSource, EntitySchema } from 'typeorm';
import { MultiORMEnum } from '../../core/utils';
import { StatisticService } from './statistic.service';

/**
 * Locks the counts semantics while the per-row aggregation moves from JavaScript to SQL:
 *  - a time log spanning several time slots must be counted once (ROUND(SUM / COUNT) per log),
 *  - a time slot linked to two time logs must contribute its overall/duration once per log,
 *  - the activity percentage is still computed in JavaScript from the two sums.
 * The expected numbers below are derived by hand from those rules, so the same spec passes
 * against the previous in-memory implementation.
 */

const TENANT_ID = '3f9b0d11-9d24-4a6e-9a1a-6c5a2d7a5f01';
const ORGANIZATION_ID = 'c2b7e6c0-3f7d-4a3e-9c2b-1f0e6d5a4b02';
const OTHER_ORGANIZATION_ID = '8a1d5e4b-6c2f-4f1a-8e3d-2b7c9a0f1e03';
const EMPLOYEE_ID = '5d2c1b0a-7e8f-4c3d-9a1b-0f2e3d4c5b04';

// ISO week of 2026-01-05 (Monday) to 2026-01-11 (Sunday); "today" is 2026-01-06.
const request = {
	organizationId: ORGANIZATION_ID,
	tenantId: TENANT_ID,
	startDate: '2026-01-05T00:00:00.000Z',
	endDate: '2026-01-11T23:59:59.000Z',
	todayStart: '2026-01-06T00:00:00.000Z',
	todayEnd: '2026-01-06T23:59:59.000Z'
} as IGetCountsStatistics;

// Week: log-six-slots (3600 s once, not 6 x 3600) + log-shared-a (600 s) + log-shared-b (600 s) = 4800 s.
// overall = 6 x 300 + 120 + 120 = 2040; duration = 6 x 600 + 600 + 600 = 4800; 2040 * 100 / 4800 = 42.5 %.
// Today: only the two shared-slot logs: 1200 s; overall = 240; duration = 1200; 20 %.
const expectedCounts: ICountsStatistics = {
	employeesCount: 1,
	projectsCount: 2,
	weekActivities: 42.5,
	weekDuration: 4800,
	todayActivities: 20,
	todayDuration: 1200
};

type FixtureTimeLog = {
	id: string;
	tenantId: string;
	organizationId: string;
	employeeId: string;
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
	overall: number;
	duration: number;
	deletedAt: string | null;
	timeLogs?: FixtureTimeLog[];
};

type FixtureTimeSlotTimeLog = { timeSlotId: string; timeLogId: string };

// Entity names mirror the production classes so the generated aliases ("TimeSlot", "time_log") match.
const TimeLogSchema = new EntitySchema<FixtureTimeLog>({
	name: 'TimeLog',
	tableName: 'time_log',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar' },
		organizationId: { type: 'varchar' },
		employeeId: { type: 'varchar' },
		startedAt: { type: 'varchar' },
		stoppedAt: { type: 'varchar', nullable: true },
		deletedAt: { type: 'varchar', nullable: true, deleteDate: true }
	}
});

const TimeSlotSchema = new EntitySchema<FixtureTimeSlot>({
	name: 'TimeSlot',
	tableName: 'time_slot',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar' },
		organizationId: { type: 'varchar' },
		employeeId: { type: 'varchar' },
		startedAt: { type: 'varchar' },
		overall: { type: Number },
		duration: { type: Number },
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

function log(
	id: string,
	startedAt: string,
	stoppedAt: string | null,
	organizationId = ORGANIZATION_ID
): FixtureTimeLog {
	return { id, tenantId: TENANT_ID, organizationId, employeeId: EMPLOYEE_ID, startedAt, stoppedAt, deletedAt: null };
}

function slot(id: string, startedAt: string, overall: number, duration = 600): FixtureTimeSlot {
	return {
		id,
		tenantId: TENANT_ID,
		organizationId: ORGANIZATION_ID,
		employeeId: EMPLOYEE_ID,
		startedAt,
		overall,
		duration,
		deletedAt: null
	};
}

function createFixtureTimeLogs(): FixtureTimeLog[] {
	return [
		log('log-six-slots', '2026-01-07 09:00:00.000', '2026-01-07 10:00:00.000'),
		log('log-shared-a', '2026-01-06 11:00:00.000', '2026-01-06 11:10:00.000'),
		log('log-shared-b', '2026-01-06 11:00:00.000', '2026-01-06 11:10:00.000'),
		// Excluded rows: other organization, outside the week, stopped before started, no time slot.
		log('log-other-organization', '2026-01-06 12:00:00.000', '2026-01-06 12:10:00.000', OTHER_ORGANIZATION_ID),
		log('log-previous-week', '2026-01-02 09:00:00.000', '2026-01-02 09:10:00.000'),
		log('log-negative', '2026-01-06 13:00:00.000', '2026-01-06 12:59:00.000'),
		log('log-without-slot', '2026-01-06 14:00:00.000', '2026-01-06 14:10:00.000')
	];
}

function createFixtureTimeSlots(): FixtureTimeSlot[] {
	return [
		...[0, 10, 20, 30, 40, 50].map((minute) =>
			slot(`slot-six-${minute}`, `2026-01-07 09:${String(minute).padStart(2, '0')}:00.000`, 300)
		),
		slot('slot-shared', '2026-01-06 11:00:00.000', 120),
		slot('slot-other-organization', '2026-01-06 12:00:00.000', 600),
		slot('slot-previous-week', '2026-01-02 09:00:00.000', 600),
		slot('slot-negative', '2026-01-06 13:00:00.000', 600)
	];
}

function createFixtureLinks(): FixtureTimeSlotTimeLog[] {
	return [
		...[0, 10, 20, 30, 40, 50].map((minute) => ({ timeSlotId: `slot-six-${minute}`, timeLogId: 'log-six-slots' })),
		{ timeSlotId: 'slot-shared', timeLogId: 'log-shared-a' },
		{ timeSlotId: 'slot-shared', timeLogId: 'log-shared-b' },
		{ timeSlotId: 'slot-other-organization', timeLogId: 'log-other-organization' },
		{ timeSlotId: 'slot-previous-week', timeLogId: 'log-previous-week' },
		{ timeSlotId: 'slot-negative', timeLogId: 'log-negative' }
	];
}

class CountsStatisticService extends StatisticService {
	constructor(ormType: MultiORMEnum, typeOrmTimeSlotRepository: any, mikroOrmTimeLogRepository: any) {
		super(
			typeOrmTimeSlotRepository,
			{} as any,
			{} as any,
			{} as any,
			mikroOrmTimeLogRepository,
			{} as any,
			{ dbConnectionOptions: { type: DatabaseTypeEnum.betterSqlite3 } } as any,
			{ filterAccessibleEmployeeIds: async (employeeIds: string[]) => employeeIds } as any
		);
		this.ormType = ormType;
	}
}

// The two other counts query unrelated tables; they are out of scope here.
function stubOtherCounts(service: StatisticService): void {
	jest.spyOn(service as any, 'getEmployeeWorkedCounts').mockResolvedValue(expectedCounts.employeesCount);
	jest.spyOn(service as any, 'getProjectWorkedCounts').mockResolvedValue(expectedCounts.projectsCount);
}

const derivedTableOverGroupedLogs = /from \(select[\s\S]*group by [`"]time_log[`"]\.[`"]id[`"]\)\s*(as\s+)?[`"]t[`"]/i;
const perLogFanOutDivision = /ROUND\([\s\S]*\/ COUNT\(/i;

describe('counts statistics activities BetterSqlite integration', () => {
	it('sums the grouped rows in SQL on the TypeORM path and keeps the counts unchanged', async () => {
		const capturedQueries: string[] = [];
		let capture = false;
		const dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [TimeLogSchema, TimeSlotSchema],
			synchronize: true,
			logging: ['query'],
			logger: {
				logQuery: (sql: string) => {
					if (capture) capturedQueries.push(sql);
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
			await dataSource.getRepository(TimeLogSchema).insert(createFixtureTimeLogs());
			const timeSlotRepository = dataSource.getRepository(TimeSlotSchema);
			await timeSlotRepository.insert(createFixtureTimeSlots());
			await dataSource
				.createQueryBuilder()
				.insert()
				.into('time_slot_time_logs')
				.values(createFixtureLinks())
				.execute();
			const service = new CountsStatisticService(MultiORMEnum.TypeORM, timeSlotRepository, {});
			stubOtherCounts(service);
			capture = true;

			await expect(service.getCounts(request)).resolves.toEqual(expectedCounts);

			const selects = capturedQueries.filter((sql) => /^\s*SELECT\b/i.test(sql));
			expect(selects).toHaveLength(2);
			for (const sql of selects) {
				expect(sql).toMatch(derivedTableOverGroupedLogs);
				expect(sql).toMatch(perLogFanOutDivision);
				expect(sql).toMatch(/deletedAt[^\n]*IS NULL/i);
			}
		} finally {
			if (dataSource.isInitialized) await dataSource.destroy();
		}
	});

	it('sums the grouped rows in SQL on the Knex path and keeps the counts unchanged', async () => {
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
				table.string('startedAt').notNullable();
				table.string('stoppedAt').nullable();
				table.string('deletedAt').nullable();
			});
			await knex.schema.createTable('time_slot', (table) => {
				table.string('id').primary();
				table.string('tenantId').notNullable();
				table.string('organizationId').notNullable();
				table.string('employeeId').notNullable();
				table.string('startedAt').notNullable();
				table.integer('overall').notNullable();
				table.integer('duration').notNullable();
				table.string('deletedAt').nullable();
			});
			await knex.schema.createTable('time_slot_time_logs', (table) => {
				table.string('timeSlotId').notNullable();
				table.string('timeLogId').notNullable();
				table.primary(['timeSlotId', 'timeLogId']);
			});
			await knex('time_log').insert(createFixtureTimeLogs());
			await knex('time_slot').insert(createFixtureTimeSlots());
			await knex('time_slot_time_logs').insert(createFixtureLinks());
			const service = new CountsStatisticService(MultiORMEnum.MikroORM, {}, { getKnex: () => knex });
			stubOtherCounts(service);
			capture = true;

			await expect(service.getCounts(request)).resolves.toEqual(expectedCounts);

			const selects = capturedQueries.filter((sql) => /^\s*select\b/i.test(sql));
			expect(selects).toHaveLength(2);
			for (const sql of selects) {
				expect(sql).toMatch(derivedTableOverGroupedLogs);
				expect(sql).toMatch(perLogFanOutDivision);
			}
		} finally {
			await knex.destroy();
		}
	});
});
