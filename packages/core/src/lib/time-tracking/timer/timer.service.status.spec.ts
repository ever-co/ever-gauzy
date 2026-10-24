// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { DatabaseTypeEnum, defineConfig } from '@gauzy/config';
import { ITimerStatus, ITimerStatusInput, TimeLogSourceEnum } from '@gauzy/contracts';
import { FindOperator } from 'typeorm';
import { MultiORMEnum } from '../../core/utils';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TimerService } from './timer.service';

/**
 * `getTimerStatus` looked up the last log (running or completed) with the same `startedAt` window as today's
 * completed logs, so a timer started before `todayStart` (one still running past midnight) was never found: the
 * status read stopped, and its duration was missing, until the timer was stopped (ever-co/ever-teams#4649).
 *
 * The repositories here answer from an in-memory table and apply the `where` each ORM path builds (TypeORM find
 * operators, or the MikroORM condition they translate to), so the specs check which logs the queries select.
 */

const EMPLOYEE_ID = 'employee-1';
const TODAY_START = '2026-10-24T00:00:00.000Z';
const TODAY_END = '2026-10-24T23:59:59.999Z';
const NOW = new Date('2026-10-24T02:00:00.000Z');

const HOUR = 3600;

interface TimeLogRow {
	id: string;
	employeeId: string;
	tenantId: string;
	organizationId: string;
	source: TimeLogSourceEnum;
	isActive: boolean;
	isArchived: boolean;
	isRunning: boolean;
	startedAt: Date;
	stoppedAt: Date;
	createdAt: Date;
	duration: number;
}

const time = (value: unknown): number => new Date(value as Date).getTime();

/** Applies a TypeORM `where` (plain values, `Between`, `Not(IsNull())`) to a row. */
function matchesTypeOrmWhere(row: TimeLogRow, where: Record<string, unknown>): boolean {
	return Object.entries(where).every(([key, condition]) => {
		const value = row[key as keyof TimeLogRow];
		if (condition instanceof FindOperator) {
			switch (condition.type) {
				case 'between': {
					const [from, to] = condition.value as unknown as Date[];
					return time(value) >= time(from) && time(value) <= time(to);
				}
				case 'not':
					if (condition.child?.type === 'isNull') {
						return value !== null && value !== undefined;
					}
					return value !== condition.value;
				default:
					throw new Error(`Unexpected TypeORM operator "${condition.type}" on ${key}`);
			}
		}
		return value === condition;
	});
}

/** Applies a MikroORM `where` (plain values, `$gte` / `$lte`, `$ne`) to a row. */
function matchesMikroOrmWhere(row: TimeLogRow, where: Record<string, unknown>): boolean {
	return Object.entries(where).every(([key, condition]) => {
		const value = row[key as keyof TimeLogRow];
		if (condition !== null && typeof condition === 'object' && !(condition instanceof Date)) {
			return Object.entries(condition).every(([operator, operand]) => {
				switch (operator) {
					case '$gte':
						return time(value) >= time(operand);
					case '$lte':
						return time(value) <= time(operand);
					case '$ne':
						return operand === null ? value !== null && value !== undefined : value !== operand;
					default:
						throw new Error(`Unexpected MikroORM operator "${operator}" on ${key}`);
				}
			});
		}
		return value === condition;
	});
}

/** The first row by `startedAt DESC, createdAt DESC`, the order both last-log queries ask for. */
function latest(rows: TimeLogRow[]): TimeLogRow | null {
	const sorted = [...rows].sort(
		(a, b) => time(b.startedAt) - time(a.startedAt) || time(b.createdAt) - time(a.createdAt)
	);
	return sorted[0] ?? null;
}

/** A `TimerService` whose repositories read `rows`, on the given ORM. */
function createService(ormType: MultiORMEnum, rows: TimeLogRow[]): TimerService {
	const typeOrmTimeLogRepository = {
		metadata: undefined,
		createQueryBuilder: () => {
			let where: Record<string, unknown> = {};
			const builder = {
				setFindOptions: (options: { where: Record<string, unknown> }) => {
					where = options.where;
					return builder;
				},
				// The inner join on `timeSlots`: every completed row here has its slots.
				innerJoin: () => builder,
				getMany: async () => rows.filter((row) => matchesTypeOrmWhere(row, where))
			};
			return builder;
		},
		findOne: async ({ where }: { where: Record<string, unknown> }) =>
			latest(rows.filter((row) => matchesTypeOrmWhere(row, where)))
	};

	const mikroOrmTimeLogRepository = {
		// `wrapSerialize` serializes the entities `findAll` returns.
		findAll: async ({ where }: { where: Record<string, unknown> }) =>
			rows
				.filter((row) => matchesMikroOrmWhere(row, where))
				.map((row) => ({ ...row, toJSON: () => ({ ...row }) })),
		findOne: async (where: Record<string, unknown>) =>
			latest(rows.filter((row) => matchesMikroOrmWhere(row, where)))
	};

	return Object.assign(Object.create(TimerService.prototype), {
		ormType,
		typeOrmTimeLogRepository,
		mikroOrmTimeLogRepository,
		fetchEmployee: jest.fn().mockResolvedValue({ id: EMPLOYEE_ID })
	});
}

describe.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])('TimerService.getTimerStatus (%s)', (ormType) => {
	const fixture = createTenantFixture();

	/** A time log of the employee, active and not archived unless `overrides` say otherwise. */
	const timeLog = (overrides: Partial<TimeLogRow> & Pick<TimeLogRow, 'id' | 'startedAt' | 'stoppedAt'>) =>
		({
			employeeId: EMPLOYEE_ID,
			tenantId: fixture.tenantId,
			organizationId: fixture.organizationId,
			source: TimeLogSourceEnum.TEAMS,
			isActive: true,
			isArchived: false,
			isRunning: false,
			createdAt: overrides.startedAt,
			duration: (time(overrides.stoppedAt) - time(overrides.startedAt)) / 1000,
			...overrides
		}) as TimeLogRow;

	const getTimerStatus = (rows: TimeLogRow[]): Promise<ITimerStatus> =>
		createService(ormType, rows).getTimerStatus({
			tenantId: fixture.tenantId,
			organizationId: fixture.organizationId,
			todayStart: TODAY_START,
			todayEnd: TODAY_END
		} as unknown as ITimerStatusInput);

	let restore: () => void;

	beforeAll(() => defineConfig({ dbConnectionOptions: { type: DatabaseTypeEnum.postgres } }));

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('keeps a timer started before todayStart running, and counts only its part since todayStart', async () => {
		const runningSinceYesterday = timeLog({
			id: 'running-since-yesterday',
			isRunning: true,
			startedAt: new Date('2026-10-23T22:00:00.000Z'),
			// The heartbeat moves `stoppedAt` while the timer runs
			stoppedAt: new Date('2026-10-24T01:59:00.000Z')
		});
		// Another employee's timer, started later: the query without the day window still filters the employee
		const teammateRunning = timeLog({
			id: 'teammate-running',
			employeeId: 'employee-2',
			isRunning: true,
			startedAt: new Date('2026-10-24T01:00:00.000Z'),
			stoppedAt: new Date('2026-10-24T01:59:00.000Z')
		});

		const status = await getTimerStatus([runningSinceYesterday, teammateRunning]);

		expect(status.running).toBe(true);
		expect(status.lastLog).toMatchObject({ id: 'running-since-yesterday', isRunning: true });
		// 00:00 to 02:00 today; the two hours before midnight belong to yesterday
		expect(status.duration).toBe(2 * HOUR);
	});

	it('does not count a completed log started before todayStart', async () => {
		const endedYesterday = timeLog({
			id: 'ended-yesterday',
			startedAt: new Date('2026-10-23T18:00:00.000Z'),
			stoppedAt: new Date('2026-10-23T20:00:00.000Z')
		});
		const endedAfterMidnight = timeLog({
			id: 'ended-after-midnight',
			startedAt: new Date('2026-10-23T23:00:00.000Z'),
			stoppedAt: new Date('2026-10-24T00:30:00.000Z')
		});

		const status = await getTimerStatus([endedYesterday, endedAfterMidnight]);

		expect(status).toEqual({ duration: 0, running: false, lastLog: null });
	});

	it('reads a timer started today as before: running, with today completed logs plus its time so far', async () => {
		const completedToday = timeLog({
			id: 'completed-today',
			startedAt: new Date('2026-10-24T00:30:00.000Z'),
			stoppedAt: new Date('2026-10-24T01:00:00.000Z')
		});
		const runningToday = timeLog({
			id: 'running-today',
			isRunning: true,
			startedAt: new Date('2026-10-24T01:30:00.000Z'),
			stoppedAt: new Date('2026-10-24T01:59:00.000Z')
		});

		const status = await getTimerStatus([completedToday, runningToday]);

		expect(status.running).toBe(true);
		expect(status.lastLog).toMatchObject({ id: 'running-today' });
		// 30 minutes completed, plus 01:30 to 02:00 running
		expect(status.duration).toBe(HOUR);
	});

	it("falls back to today's last completed log when no timer runs", async () => {
		const firstToday = timeLog({
			id: 'first-today',
			startedAt: new Date('2026-10-24T00:15:00.000Z'),
			stoppedAt: new Date('2026-10-24T00:45:00.000Z')
		});
		const lastToday = timeLog({
			id: 'last-today',
			startedAt: new Date('2026-10-24T01:00:00.000Z'),
			stoppedAt: new Date('2026-10-24T01:30:00.000Z')
		});

		const status = await getTimerStatus([firstToday, lastToday]);

		expect(status.running).toBe(false);
		expect(status.lastLog).toMatchObject({ id: 'last-today', isRunning: false });
		expect(status.duration).toBe(HOUR);
	});
});
