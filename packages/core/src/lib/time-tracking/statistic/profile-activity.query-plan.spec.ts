jest.mock('dotenv', () => ({
	config: jest.fn(() => ({ parsed: {} }))
}));

import * as dotenv from 'dotenv';
import '../../core/entities/internal';

import { DatabaseTypeEnum } from '@gauzy/config';
import { ID, IGetProfileActivity, IProfileActivity } from '@gauzy/contracts';
import { DataSource, EntitySchema, Repository, SelectQueryBuilder } from 'typeorm';
import { MultiORMEnum } from '../../core/utils';
import {
	buildProfileActivityResponse,
	ProfileActivityPeriod,
	ProfileActivityRawRow,
	resolveProfileActivityPeriod
} from './profile-activity.helper';
import { StatisticService } from './statistic.service';

const TENANT_ID = 'dcd7306d-589f-4a84-b6bd-f16692d4d3f0';
const OTHER_TENANT_ID = '27a8db94-f8cf-46d0-916b-ce3d8ac4ec5a';
const ORGANIZATION_ID = '1aa9f15d-cf84-42bb-99d8-310fdd7fc991';
const OTHER_ORGANIZATION_ID = 'd23e7f8b-d84e-45ea-a57f-ebef708815b9';
const EMPLOYEE_ID = '86f4db94-408a-427a-bef9-1bf9dbcebe4e';
const TEAM_ID = '1e3af410-332f-44ab-b3cb-bd83bf37bf73';
const OTHER_TEAM_ID = '105761cf-df20-4c5e-9684-fdf0b1608ce8';

const DAY_MILLISECONDS = 86_400_000;
const MINUTE_MILLISECONDS = 60_000;
const RANGE_START_MILLISECONDS = Date.parse('2026-01-01T00:00:00.000Z');
const RANGE_END_MILLISECONDS = Date.parse('2026-01-31T00:00:00.000Z');
const SAMPLE_COUNT = 50;
const WARMUP_COUNT = 10;

const CURRENT_INDEXES = {
	tenant: { name: 'IDX_profile_activity_tenant', column: 'tenantId' },
	organization: { name: 'IDX_profile_activity_organization', column: 'organizationId' },
	employee: { name: 'IDX_profile_activity_employee', column: 'employeeId' },
	startedAt: { name: 'IDX_profile_activity_started_at', column: 'startedAt' }
} as const;
const COMPACT_INDEX_NAME = 'IDX_profile_activity_employee_started_at';
const WIDE_INDEX_NAME = 'IDX_profile_activity_scope_employee_started_at';

const request: IGetProfileActivity = {
	organizationId: ORGANIZATION_ID,
	employeeId: EMPLOYEE_ID,
	organizationTeamId: TEAM_ID,
	startDate: '2026-01-01',
	endDate: '2026-01-31',
	timeZone: 'UTC',
	includeDaily: true
};

const expectedResponse: IProfileActivity = {
	employeeId: EMPLOYEE_ID,
	activeDays: 30,
	totalDuration: 6000,
	firstActiveOn: '2026-01-01',
	lastActiveOn: '2026-01-30',
	period: {
		startDate: '2026-01-01',
		endDate: '2026-01-31',
		timeZone: 'UTC'
	},
	daily: [
		{ date: '2026-01-01', duration: 240 },
		{ date: '2026-01-02', duration: 240 },
		{ date: '2026-01-03', duration: 240 },
		{ date: '2026-01-04', duration: 240 },
		{ date: '2026-01-05', duration: 240 },
		{ date: '2026-01-06', duration: 240 },
		{ date: '2026-01-07', duration: 240 },
		{ date: '2026-01-08', duration: 240 },
		{ date: '2026-01-09', duration: 240 },
		{ date: '2026-01-10', duration: 240 },
		{ date: '2026-01-11', duration: 180 },
		{ date: '2026-01-12', duration: 180 },
		{ date: '2026-01-13', duration: 180 },
		{ date: '2026-01-14', duration: 180 },
		{ date: '2026-01-15', duration: 180 },
		{ date: '2026-01-16', duration: 180 },
		{ date: '2026-01-17', duration: 180 },
		{ date: '2026-01-18', duration: 180 },
		{ date: '2026-01-19', duration: 180 },
		{ date: '2026-01-20', duration: 180 },
		{ date: '2026-01-21', duration: 180 },
		{ date: '2026-01-22', duration: 180 },
		{ date: '2026-01-23', duration: 180 },
		{ date: '2026-01-24', duration: 180 },
		{ date: '2026-01-25', duration: 180 },
		{ date: '2026-01-26', duration: 180 },
		{ date: '2026-01-27', duration: 180 },
		{ date: '2026-01-28', duration: 180 },
		{ date: '2026-01-29', duration: 180 },
		{ date: '2026-01-30', duration: 180 }
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

type ExplainRow = {
	id: number;
	parent: number;
	notused: number;
	detail: string;
};

type LatencyEvidence = {
	minMilliseconds: number;
	maxMilliseconds: number;
	p95Milliseconds: number;
};

const TimeLogSchema = new EntitySchema<FixtureTimeLog>({
	name: 'ProfileActivityQueryPlanTimeLog',
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
	},
	indices: Object.values(CURRENT_INDEXES).map(({ name, column }) => ({
		name,
		columns: [column]
	}))
});

const TimeSlotSchema = new EntitySchema<FixtureTimeSlot>({
	name: 'ProfileActivityQueryPlanTimeSlot',
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
	name: 'ProfileActivityQueryPlanTimeSlotTimeLog',
	tableName: 'time_slot_time_logs',
	columns: {
		timeSlotId: { primary: true, type: 'varchar' },
		timeLogId: { primary: true, type: 'varchar' }
	},
	indices: [{ name: 'IDX_profile_activity_time_log_link', columns: ['timeLogId'] }]
});

class QueryPlanStatisticService extends StatisticService {
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

	compileProfileActivityQuery(
		input: IGetProfileActivity,
		tenantId: ID,
		period: ProfileActivityPeriod
	): SelectQueryBuilder<FixtureTimeLog> {
		const query = this.buildProfileActivityRowsQuery(input, tenantId, period);
		if (query.ormType !== MultiORMEnum.TypeORM) {
			throw new Error('Query-plan fixture requires the TypeORM profile activity builder');
		}

		return query.builder as unknown as SelectQueryBuilder<FixtureTimeLog>;
	}
}

function dateAt(milliseconds: number): Date {
	return new Date(milliseconds);
}

function stoppedAfter(startedAt: Date, milliseconds = MINUTE_MILLISECONDS): Date {
	return dateAt(startedAt.getTime() + milliseconds);
}

function fixtureEmployeeId(scope: number, index: number): string {
	const suffix = (scope * 100_000 + index).toString().padStart(12, '0');
	return `00000000-0000-4000-8000-${suffix}`;
}

function createFixtureRows(): FixtureTimeLog[] {
	const rows: FixtureTimeLog[] = [];
	const add = (input: Omit<FixtureTimeLog, 'id'>): void => {
		rows.push({ id: `profile-row-${rows.length.toString().padStart(5, '0')}`, ...input });
	};

	for (let index = 0; index < 100; index++) {
		const startedAt = dateAt(
			RANGE_START_MILLISECONDS + (index % 30) * DAY_MILLISECONDS + 12 * 60 * MINUTE_MILLISECONDS
		);
		add({
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			organizationTeamId: index % 2 === 0 ? TEAM_ID : OTHER_TEAM_ID,
			startedAt,
			stoppedAt: stoppedAfter(startedAt),
			deletedAt: null
		});
	}

	for (let index = 0; index < 100; index++) {
		const startedAt = dateAt(
			RANGE_START_MILLISECONDS + (index % 30) * DAY_MILLISECONDS + 16 * 60 * MINUTE_MILLISECONDS
		);
		const invalidKind = Math.floor(index / 25);
		add({
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			organizationTeamId: TEAM_ID,
			startedAt,
			stoppedAt:
				invalidKind === 1
					? null
					: invalidKind === 2
						? startedAt
						: invalidKind === 3
							? dateAt(startedAt.getTime() - MINUTE_MILLISECONDS)
							: stoppedAfter(startedAt),
			deletedAt: invalidKind === 0 ? stoppedAfter(startedAt, 2 * MINUTE_MILLISECONDS) : null
		});
	}

	for (let index = 0; index < 1900; index++) {
		const startedAt = dateAt(RANGE_START_MILLISECONDS - (index + 1) * MINUTE_MILLISECONDS);
		add({
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			organizationTeamId: TEAM_ID,
			startedAt,
			stoppedAt: stoppedAfter(startedAt),
			deletedAt: null
		});
	}

	for (let index = 0; index < 1900; index++) {
		const startedAt = dateAt(RANGE_END_MILLISECONDS + index * MINUTE_MILLISECONDS);
		add({
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			organizationTeamId: OTHER_TEAM_ID,
			startedAt,
			stoppedAt: stoppedAfter(startedAt),
			deletedAt: null
		});
	}

	for (let index = 0; index < 3000; index++) {
		const startedAt = dateAt(
			RANGE_START_MILLISECONDS + (index % 30) * DAY_MILLISECONDS + (index % 1000) * MINUTE_MILLISECONDS
		);
		add({
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: fixtureEmployeeId(1, index),
			organizationTeamId: TEAM_ID,
			startedAt,
			stoppedAt: stoppedAfter(startedAt),
			deletedAt: null
		});
	}

	for (let index = 0; index < 1000; index++) {
		const startedAt = dateAt(
			RANGE_START_MILLISECONDS + (index % 30) * DAY_MILLISECONDS + (index % 1000) * MINUTE_MILLISECONDS
		);
		add({
			tenantId: TENANT_ID,
			organizationId: OTHER_ORGANIZATION_ID,
			employeeId: fixtureEmployeeId(2, index),
			organizationTeamId: TEAM_ID,
			startedAt,
			stoppedAt: stoppedAfter(startedAt),
			deletedAt: null
		});
	}

	for (let index = 0; index < 1000; index++) {
		const startedAt = dateAt(
			RANGE_START_MILLISECONDS + (index % 30) * DAY_MILLISECONDS + (index % 1000) * MINUTE_MILLISECONDS
		);
		add({
			tenantId: OTHER_TENANT_ID,
			organizationId: OTHER_ORGANIZATION_ID,
			employeeId: fixtureEmployeeId(3, index),
			organizationTeamId: TEAM_ID,
			startedAt,
			stoppedAt: stoppedAfter(startedAt),
			deletedAt: null
		});
	}

	for (let index = 0; index < 1000; index++) {
		const startedAt =
			index < 500
				? dateAt(RANGE_START_MILLISECONDS - (index + 1) * MINUTE_MILLISECONDS)
				: dateAt(RANGE_END_MILLISECONDS + (index - 500) * MINUTE_MILLISECONDS);
		add({
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: fixtureEmployeeId(4, index),
			organizationTeamId: TEAM_ID,
			startedAt,
			stoppedAt: stoppedAfter(startedAt),
			deletedAt: null
		});
	}

	return rows;
}

async function seedFixture(repository: Repository<FixtureTimeLog>): Promise<void> {
	const rows = createFixtureRows();
	expect(rows).toHaveLength(10_000);

	for (let offset = 0; offset < rows.length; offset += 250) {
		await repository.insert(rows.slice(offset, offset + 250));
	}

	const dataSource = repository.manager.connection;
	const matchingRows = rows.slice(0, 100);
	await dataSource.getRepository(TimeSlotSchema).insert(
		matchingRows.map((row, index) => ({
			id: `profile-slot-${index.toString().padStart(5, '0')}`,
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			overall: (index % 101) * 6,
			deletedAt: null
		}))
	);
	await dataSource.getRepository(TimeSlotTimeLogSchema).insert(
		matchingRows.map((row, index) => ({
			timeSlotId: `profile-slot-${index.toString().padStart(5, '0')}`,
			timeLogId: row.id
		}))
	);
}

async function explainQuery(dataSource: DataSource, sql: string, parameters: unknown[]): Promise<ExplainRow[]> {
	return (await dataSource.query(`EXPLAIN QUERY PLAN ${sql}`, parameters)) as ExplainRow[];
}

function planText(rows: ExplainRow[]): string {
	return rows.map(({ detail }) => detail).join('\n');
}

function scansWholeTimeLogTable(plan: string): boolean {
	const unquotedPlan = plan.replace(/["`\[\]]/g, '');
	return /\bSCAN\s+(?:TABLE\s+)?time_log\b/i.test(unquotedPlan);
}

function requiresProfileActivityIndexReview(plan: string): boolean {
	return scansWholeTimeLogTable(plan);
}

async function scalarCount(dataSource: DataSource, sql: string, parameters: unknown[] = []): Promise<number> {
	const [row] = (await dataSource.query(sql, parameters)) as Array<{ count: number | string }>;
	return Number(row.count);
}

function canonicalRows(rows: ProfileActivityRawRow[]): string[] {
	return rows.map((row) => JSON.stringify(row)).sort((left, right) => left.localeCompare(right));
}

function nearestRankP95(samples: number[]): number {
	const sorted = [...samples].sort((left, right) => left - right);
	return sorted[Math.ceil(0.95 * sorted.length) - 1];
}

async function measureLatency(builder: SelectQueryBuilder<FixtureTimeLog>): Promise<LatencyEvidence> {
	for (let index = 0; index < WARMUP_COUNT; index++) {
		await builder.getRawMany();
	}

	const samples: number[] = [];
	for (let index = 0; index < SAMPLE_COUNT; index++) {
		const startedAt = process.hrtime.bigint();
		await builder.getRawMany();
		const elapsedNanoseconds = process.hrtime.bigint() - startedAt;
		samples.push(Number(elapsedNanoseconds) / 1_000_000);
	}

	return {
		minMilliseconds: Math.min(...samples),
		maxMilliseconds: Math.max(...samples),
		p95Milliseconds: nearestRankP95(samples)
	};
}

async function dropCurrentIndexes(dataSource: DataSource): Promise<void> {
	for (const { name } of Object.values(CURRENT_INDEXES)) {
		await dataSource.query(`DROP INDEX IF EXISTS "${name}"`);
	}
}

async function createCurrentIndexes(dataSource: DataSource): Promise<void> {
	for (const { name, column } of Object.values(CURRENT_INDEXES)) {
		await dataSource.query(`CREATE INDEX "${name}" ON "time_log" ("${column}")`);
	}
}

jest.setTimeout(180_000);

describe('profile activity production query plan evidence', () => {
	it('keeps the 10,000-row scoped aggregate index-backed and emits comparative latency evidence', async () => {
		expect(jest.isMockFunction(dotenv.config)).toBe(true);
		expect(dotenv.config).toHaveBeenCalled();
		expect(dotenv.config()).toEqual({ parsed: {} });
		expect(nearestRankP95(Array.from({ length: 21 }, (_, index) => index + 1))).toBe(20);

		const syntheticFastFullScanPlan = 'SCAN time_log';
		const syntheticIndexedPlan = 'SEARCH time_log USING INDEX IDX_profile_activity_employee (employeeId=?)';
		expect(requiresProfileActivityIndexReview(syntheticFastFullScanPlan)).toBe(true);
		expect(requiresProfileActivityIndexReview(syntheticIndexedPlan)).toBe(false);

		const dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [TimeLogSchema, TimeSlotSchema, TimeSlotTimeLogSchema],
			synchronize: true
		});

		try {
			await dataSource.initialize();
			const repository = dataSource.getRepository(TimeLogSchema);
			await seedFixture(repository);
			await dataSource.query('ANALYZE');

			const period = resolveProfileActivityPeriod(request);
			const service = new QueryPlanStatisticService(repository);
			const builder = service.compileProfileActivityQuery(request, TENANT_ID, period);
			const [sql, parameters] = builder.getQueryAndParameters();

			expect(sql).not.toMatch(/organizationTeamId/i);
			expect(sql).not.toContain(TEAM_ID);
			expect(parameters).toHaveLength(69);
			expect(parameters.slice(0, 4)).toEqual([
				'2026-01-02 00:00:00.000',
				'2026-01-01',
				'2026-01-03 00:00:00.000',
				'2026-01-02'
			]);
			expect(parameters).toEqual(
				expect.arrayContaining([
					TENANT_ID,
					ORGANIZATION_ID,
					EMPLOYEE_ID,
					'2026-01-01 00:00:00.000',
					'2026-01-31 00:00:00.000'
				])
			);
			expect(sql).toMatch(/\bEXISTS\b/i);
			expect(sql).toMatch(/time_slot_time_logs/i);
			expect(sql).toMatch(/overall[^\n]*BETWEEN 0 AND 600/i);

			const initialIndexes = (await dataSource.query('PRAGMA index_list("time_log")')) as Array<{
				name: string;
			}>;
			expect(initialIndexes.map(({ name }) => name)).toEqual(
				expect.arrayContaining(Object.values(CURRENT_INDEXES).map(({ name }) => name))
			);

			await dropCurrentIndexes(dataSource);
			await dataSource.query('ANALYZE');
			const noIndexControlPlan = planText(await explainQuery(dataSource, sql, parameters));
			expect(scansWholeTimeLogTable(noIndexControlPlan)).toBe(true);

			await createCurrentIndexes(dataSource);
			await dataSource.query('ANALYZE');

			const candidateCounts = {
				full: await scalarCount(dataSource, 'SELECT COUNT(*) AS count FROM "time_log"'),
				tenant: await scalarCount(dataSource, 'SELECT COUNT(*) AS count FROM "time_log" WHERE "tenantId" = ?', [
					TENANT_ID
				]),
				organization: await scalarCount(
					dataSource,
					'SELECT COUNT(*) AS count FROM "time_log" WHERE "organizationId" = ?',
					[ORGANIZATION_ID]
				),
				employee: await scalarCount(
					dataSource,
					'SELECT COUNT(*) AS count FROM "time_log" WHERE "employeeId" = ?',
					[EMPLOYEE_ID]
				),
				startedAt: await scalarCount(
					dataSource,
					'SELECT COUNT(*) AS count FROM "time_log" WHERE "startedAt" >= ? AND "startedAt" < ?',
					['2026-01-01 00:00:00.000', '2026-01-31 00:00:00.000']
				),
				compact: await scalarCount(
					dataSource,
					'SELECT COUNT(*) AS count FROM "time_log" WHERE "employeeId" = ? AND "startedAt" >= ? AND "startedAt" < ?',
					[EMPLOYEE_ID, '2026-01-01 00:00:00.000', '2026-01-31 00:00:00.000']
				),
				wide: await scalarCount(
					dataSource,
					'SELECT COUNT(*) AS count FROM "time_log" WHERE "tenantId" = ? AND "organizationId" = ? AND "employeeId" = ? AND "startedAt" >= ? AND "startedAt" < ?',
					[TENANT_ID, ORGANIZATION_ID, EMPLOYEE_ID, '2026-01-01 00:00:00.000', '2026-01-31 00:00:00.000']
				)
			};
			expect(candidateCounts).toEqual({
				full: 10_000,
				tenant: 9000,
				organization: 8000,
				employee: 4000,
				startedAt: 5200,
				compact: 200,
				wide: 200
			});

			const currentPlan = planText(await explainQuery(dataSource, sql, parameters));
			expect(currentPlan).toMatch(/\btime_log\b/i);
			expect(currentPlan).toContain(CURRENT_INDEXES.employee.name);
			expect(scansWholeTimeLogTable(currentPlan)).toBe(false);
			expect(currentPlan).not.toMatch(/AUTOMATIC/i);

			const currentRows = (await builder.getRawMany()) as ProfileActivityRawRow[];
			const canonicalCurrentRows = canonicalRows(currentRows);
			expect(currentRows).toHaveLength(30);
			expect(buildProfileActivityResponse(request, period, currentRows)).toEqual(expectedResponse);
			const currentLatency = await measureLatency(builder);

			await dataSource.query(`CREATE INDEX "${COMPACT_INDEX_NAME}" ON "time_log" ("employeeId", "startedAt")`);
			await dataSource.query('ANALYZE');
			const compactPlan = planText(await explainQuery(dataSource, sql, parameters));
			expect(compactPlan).toContain(COMPACT_INDEX_NAME);
			expect(compactPlan).toMatch(/employeeId=\?[^\n]*startedAt>\?[^\n]*startedAt<\?/i);
			const compactRows = (await builder.getRawMany()) as ProfileActivityRawRow[];
			expect(canonicalRows(compactRows)).toEqual(canonicalCurrentRows);
			expect(buildProfileActivityResponse(request, period, compactRows)).toEqual(expectedResponse);
			const compactLatency = await measureLatency(builder);

			await dataSource.query(`DROP INDEX "${COMPACT_INDEX_NAME}"`);
			await dataSource.query(
				`CREATE INDEX "${WIDE_INDEX_NAME}" ON "time_log" ("tenantId", "organizationId", "employeeId", "startedAt")`
			);
			await dataSource.query('ANALYZE');
			const widePlan = planText(await explainQuery(dataSource, sql, parameters));
			expect(widePlan).toContain(WIDE_INDEX_NAME);
			expect(widePlan).toMatch(
				/tenantId=\?[^\n]*organizationId=\?[^\n]*employeeId=\?[^\n]*startedAt>\?[^\n]*startedAt<\?/i
			);
			const wideRows = (await builder.getRawMany()) as ProfileActivityRawRow[];
			expect(canonicalRows(wideRows)).toEqual(canonicalCurrentRows);
			expect(buildProfileActivityResponse(request, period, wideRows)).toEqual(expectedResponse);
			const wideLatency = await measureLatency(builder);

			const migrationReviewGate = requiresProfileActivityIndexReview(currentPlan);
			const latencyEvidence = { current: currentLatency, compact: compactLatency, wide: wideLatency };
			for (const evidence of Object.values(latencyEvidence)) {
				expect(evidence.minMilliseconds).toBeGreaterThanOrEqual(0);
				expect(evidence.p95Milliseconds).toBeGreaterThanOrEqual(evidence.minMilliseconds);
				expect(evidence.maxMilliseconds).toBeGreaterThanOrEqual(evidence.p95Milliseconds);
			}
			console.info(
				'PROFILE_ACTIVITY_QUERY_PLAN_EVIDENCE',
				JSON.stringify({ candidateCounts, outputRows: currentRows.length, latencyEvidence })
			);
			expect(migrationReviewGate).toBe(false);
		} finally {
			if (dataSource.isInitialized) {
				await dataSource.destroy();
			}
		}
	});
});
