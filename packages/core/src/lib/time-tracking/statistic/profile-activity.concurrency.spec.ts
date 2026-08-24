jest.mock('dotenv', () => ({
	config: jest.fn(() => ({ parsed: {} }))
}));

import * as dotenv from 'dotenv';
import '../../core/entities/internal';

import { monitorEventLoopDelay } from 'node:perf_hooks';
import { DatabaseTypeEnum } from '@gauzy/config';
import { ID, IGetProfileActivity, IProfileActivity } from '@gauzy/contracts';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { MultiORMEnum } from '../../core/utils';
import { StatisticService } from './statistic.service';

const TENANT_ID = '7e948ea7-bb8d-45b6-8750-2ebf35479471';
const ORGANIZATION_ID = '7d038bc1-653e-4a81-84cc-99252d6cc925';
const EMPLOYEE_ID = '3f324de5-fcc0-4f30-bcb2-10023768e2b7';
const OTHER_EMPLOYEE_ID = '84e7e42e-e4dc-4d34-9a4e-2bcd94bbe56f';

const request: IGetProfileActivity = {
	organizationId: ORGANIZATION_ID,
	employeeId: EMPLOYEE_ID,
	startDate: '2026-08-01',
	endDate: '2026-08-04',
	timeZone: 'UTC',
	includeDaily: true
};

const expectedResponse: IProfileActivity = {
	employeeId: EMPLOYEE_ID,
	activeDays: 2,
	totalDuration: 210,
	firstActiveOn: '2026-08-01',
	lastActiveOn: '2026-08-02',
	period: {
		startDate: '2026-08-01',
		endDate: '2026-08-04',
		timeZone: 'UTC'
	},
	daily: [
		{ date: '2026-08-01', duration: 180 },
		{ date: '2026-08-02', duration: 30 }
	]
};

type FixtureTimeLog = {
	id: string;
	tenantId: string;
	organizationId: string;
	employeeId: string;
	startedAt: Date;
	stoppedAt: Date | null;
	deletedAt: Date | null;
};

type ConcurrencyMetrics = {
	requests: number;
	fulfilled: number;
	rejected: number;
	selects: number;
	eventLoopP95Milliseconds: number;
	eventLoopMaxMilliseconds: number;
	cpuMicroseconds: { user: number; system: number; total: number };
	memoryDeltaBytes: { rss: number; heapUsed: number; external: number };
	pool: 'none';
};

const TimeLogSchema = new EntitySchema<FixtureTimeLog>({
	name: 'ProfileActivityConcurrencyTimeLog',
	tableName: 'time_log',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar' },
		organizationId: { type: 'varchar' },
		employeeId: { type: 'varchar' },
		startedAt: { type: Date },
		stoppedAt: { type: Date, nullable: true },
		deletedAt: { type: Date, nullable: true, deleteDate: true }
	}
});

class ConcurrencyStatisticService extends StatisticService {
	constructor(repository: Repository<FixtureTimeLog>) {
		super(
			{ createQueryBuilder: jest.fn() } as any,
			{ existsBy: jest.fn() } as any,
			{ createQueryBuilder: jest.fn() } as any,
			repository as any,
			{} as any,
			{} as any,
			{ dbConnectionOptions: { type: DatabaseTypeEnum.betterSqlite3 } } as any,
			{} as any
		);
		this.ormType = MultiORMEnum.TypeORM;
	}

	protected assertProfileActivityAccess(): Promise<ID> {
		return Promise.resolve(TENANT_ID);
	}
}

function at(value: string): Date {
	return new Date(value);
}

function createFixtureRows(): FixtureTimeLog[] {
	return [
		{
			id: 'matching-first',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			startedAt: at('2026-08-01T08:00:00.000Z'),
			stoppedAt: at('2026-08-01T08:01:00.000Z'),
			deletedAt: null
		},
		{
			id: 'matching-same-day',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			startedAt: at('2026-08-01T12:00:00.000Z'),
			stoppedAt: at('2026-08-01T12:02:00.000Z'),
			deletedAt: null
		},
		{
			id: 'matching-second-day',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			startedAt: at('2026-08-02T09:00:00.000Z'),
			stoppedAt: at('2026-08-02T09:00:30.000Z'),
			deletedAt: null
		},
		{
			id: 'deleted-distractor',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			startedAt: at('2026-08-02T10:00:00.000Z'),
			stoppedAt: at('2026-08-02T10:10:00.000Z'),
			deletedAt: at('2026-08-02T11:00:00.000Z')
		},
		{
			id: 'employee-distractor',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: OTHER_EMPLOYEE_ID,
			startedAt: at('2026-08-02T11:00:00.000Z'),
			stoppedAt: at('2026-08-02T11:10:00.000Z'),
			deletedAt: null
		},
		{
			id: 'zero-duration-distractor',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			startedAt: at('2026-08-03T12:00:00.000Z'),
			stoppedAt: at('2026-08-03T12:00:00.000Z'),
			deletedAt: null
		}
	];
}

function wait(milliseconds: number): Promise<void> {
	return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

function roundedMilliseconds(nanoseconds: number): number {
	return Number((nanoseconds / 1_000_000).toFixed(3));
}

jest.setTimeout(60_000);

describe('profile activity in-process concurrency evidence', () => {
	it('keeps 32 real one-select service calls structurally stable without blocking the event loop', async () => {
		expect(jest.isMockFunction(dotenv.config)).toBe(true);
		expect(dotenv.config).toHaveBeenCalled();

		const capturedQueries: string[] = [];
		let capture = false;
		const dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [TimeLogSchema],
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
			const repository = dataSource.getRepository(TimeLogSchema);
			await repository.insert(createFixtureRows());
			const service = new ConcurrencyStatisticService(repository);

			await expect(service.getProfileActivity(request)).resolves.toEqual(expectedResponse);

			const eventLoopDelay = monitorEventLoopDelay({ resolution: 10 });
			let settled: PromiseSettledResult<IProfileActivity>[] = [];
			let metrics: ConcurrencyMetrics | undefined;
			eventLoopDelay.enable();

			try {
				await wait(25);
				eventLoopDelay.reset();
				const cpuStart = process.cpuUsage();
				const memoryStart = process.memoryUsage();
				capture = true;
				settled = await Promise.allSettled(
					Array.from({ length: 32 }, () => service.getProfileActivity(request))
				);
				capture = false;
				await wait(25);

				const cpu = process.cpuUsage(cpuStart);
				const memoryEnd = process.memoryUsage();
				const fulfilled = settled.filter(
					(result): result is PromiseFulfilledResult<IProfileActivity> => result.status === 'fulfilled'
				);
				const rejected = settled.filter((result) => result.status === 'rejected');
				const selects = capturedQueries.filter((sql) => /^\s*SELECT\b/i.test(sql));

				metrics = {
					requests: settled.length,
					fulfilled: fulfilled.length,
					rejected: rejected.length,
					selects: selects.length,
					eventLoopP95Milliseconds: roundedMilliseconds(eventLoopDelay.percentile(95)),
					eventLoopMaxMilliseconds: roundedMilliseconds(eventLoopDelay.max),
					cpuMicroseconds: { user: cpu.user, system: cpu.system, total: cpu.user + cpu.system },
					memoryDeltaBytes: {
						rss: memoryEnd.rss - memoryStart.rss,
						heapUsed: memoryEnd.heapUsed - memoryStart.heapUsed,
						external: memoryEnd.external - memoryStart.external
					},
					pool: 'none'
				};

				expect(settled).toHaveLength(32);
				expect(fulfilled).toHaveLength(32);
				expect(rejected).toHaveLength(0);
				expect(fulfilled.map(({ value }) => value)).toEqual(Array(32).fill(expectedResponse));
				expect(selects).toHaveLength(32);
				expect(selects.every((sql) => !/\bJOIN\b/i.test(sql))).toBe(true);
				expect(metrics.pool).toBe('none');
				expect(metrics.eventLoopMaxMilliseconds).toBeLessThan(100);
			} finally {
				capture = false;
				eventLoopDelay.disable();
			}

			expect(metrics).toBeDefined();
			console.info(`PROFILE_ACTIVITY_IN_PROCESS_METRICS ${JSON.stringify(metrics)}`);
		} finally {
			if (dataSource.isInitialized) await dataSource.destroy();
		}
	});
});
