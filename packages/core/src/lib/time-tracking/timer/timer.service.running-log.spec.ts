// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { DatabaseTypeEnum, defineConfig } from '@gauzy/config';
import { ITimeLog, ITimerStatus, ITimerStatusInput, ITimerToggleInput, TimeLogSourceEnum } from '@gauzy/contracts';
import { FindOperator } from 'typeorm';
import { MultiORMEnum } from '../../core/utils';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TimerService } from './timer.service';

/**
 * A running time log could be stored with `isRunning: true` and a null `stoppedAt` (`TimeLogCreateHandler` gave a
 * desktop-source log `isRunning: true` by default, and `IntegrationMapSyncTimeLogHandler` passes its entity as-is),
 * while the status read (`getTimerStatus`) and stop / toggle (`getRunningLogs`) both asked for `stoppedAt IS NOT
 * NULL`. Such a row ran with neither read seeing it: the status said "stopped", toggle started a second timer
 * beside it, and nothing stopped it. New rows get `stoppedAt = startedAt` at create (time-log-create.handler.spec.ts);
 * the reads now agree on "running" as `isRunning`, whatever `stoppedAt` holds, so a row stored before still shows.
 *
 * The repositories answer from an in-memory table and apply the `where` each ORM path builds.
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
	stoppedAt: Date | null;
	createdAt: Date;
	duration: number;
}

const time = (value: unknown): number => new Date(value as Date).getTime();

/** Applies a TypeORM `where` (plain values, `Between`, `LessThanOrEqual` / `MoreThanOrEqual`, `Not(IsNull())`). */
function matchesTypeOrmWhere(row: TimeLogRow, where: Record<string, unknown>): boolean {
	return Object.entries(where).every(([key, condition]) => {
		const value = row[key as keyof TimeLogRow];
		if (condition instanceof FindOperator) {
			switch (condition.type) {
				case 'between': {
					const [from, to] = condition.value as unknown as Date[];
					return time(value) >= time(from) && time(value) <= time(to);
				}
				// A null column matches neither, as in SQL (the completed-logs query may use them for its day window).
				case 'lessThanOrEqual':
					return value !== null && value !== undefined && time(value) <= time(condition.value);
				case 'moreThanOrEqual':
					return value !== null && value !== undefined && time(value) >= time(condition.value);
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
					// A null column matches neither, as in SQL.
					case '$gte':
						return value !== null && value !== undefined && time(value) >= time(operand);
					case '$lte':
						return value !== null && value !== undefined && time(value) <= time(operand);
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

/** The rows by `startedAt DESC, createdAt DESC`, the order every running-log query asks for. */
function latestFirst(rows: TimeLogRow[]): TimeLogRow[] {
	return [...rows].sort((a, b) => time(b.startedAt) - time(a.startedAt) || time(b.createdAt) - time(a.createdAt));
}

/** A MikroORM-loaded row: `wrapSerialize` calls its `toJSON`. */
const loaded = (row: TimeLogRow) => ({ ...row, toJSON: () => ({ ...row }) });

/** A `TimerService` whose repositories read `rows`, on the given ORM, with `startTimer` / `stopTimer` stubbed. */
function createService(ormType: MultiORMEnum, rows: TimeLogRow[], organizationId: string) {
	const typeOrmTimeLogRepository = {
		metadata: undefined,
		createQueryBuilder: () => {
			let where: Record<string, unknown> = {};
			const builder = {
				setFindOptions: (options: { where: Record<string, unknown> }) => {
					where = options.where;
					return builder;
				},
				innerJoin: () => builder,
				getMany: async () => rows.filter((row) => matchesTypeOrmWhere(row, where))
			};
			return builder;
		},
		find: async ({ where }: { where: Record<string, unknown> }) =>
			latestFirst(rows.filter((row) => matchesTypeOrmWhere(row, where))),
		findOne: async ({ where }: { where: Record<string, unknown> }) =>
			latestFirst(rows.filter((row) => matchesTypeOrmWhere(row, where)))[0] ?? null
	};

	const mikroOrmTimeLogRepository = {
		findAll: async ({ where }: { where: Record<string, unknown> }) =>
			latestFirst(rows.filter((row) => matchesMikroOrmWhere(row, where))).map(loaded),
		findOne: async (where: Record<string, unknown>) => {
			const row = latestFirst(rows.filter((candidate) => matchesMikroOrmWhere(candidate, where)))[0];
			return row ? loaded(row) : null;
		}
	};

	const startTimer = jest.fn(async () => ({ id: 'started' }) as ITimeLog);
	const stopTimer = jest.fn(async () => ({ id: 'stopped' }) as ITimeLog);

	const service: TimerService = Object.assign(Object.create(TimerService.prototype), {
		ormType,
		typeOrmTimeLogRepository,
		mikroOrmTimeLogRepository,
		fetchEmployee: jest.fn().mockResolvedValue({ id: EMPLOYEE_ID }),
		findEmployee: jest.fn().mockResolvedValue({ id: EMPLOYEE_ID, organizationId }),
		startTimer,
		stopTimer
	});

	return { service, startTimer, stopTimer };
}

describe.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])(
	'TimerService running log with a null stoppedAt (%s)',
	(ormType) => {
		const fixture = createTenantFixture();

		/** A time log of the employee, active and not archived unless `overrides` say otherwise. */
		const timeLog = (overrides: Partial<TimeLogRow> & Pick<TimeLogRow, 'id' | 'startedAt' | 'stoppedAt'>) =>
			({
				employeeId: EMPLOYEE_ID,
				tenantId: fixture.tenantId,
				organizationId: fixture.organizationId,
				source: TimeLogSourceEnum.DESKTOP,
				isActive: true,
				isArchived: false,
				isRunning: false,
				createdAt: overrides.startedAt,
				duration: overrides.stoppedAt ? (time(overrides.stoppedAt) - time(overrides.startedAt)) / 1000 : 0,
				...overrides
			}) as TimeLogRow;

		/** The row the bug left behind: running, no `stoppedAt`. */
		const runningWithoutStoppedAt = () =>
			timeLog({
				id: 'running-without-stopped-at',
				isRunning: true,
				startedAt: new Date('2026-10-24T01:00:00.000Z'),
				stoppedAt: null
			});

		const setup = (rows: TimeLogRow[]) => createService(ormType, rows, fixture.organizationId);

		const getTimerStatus = (service: TimerService): Promise<ITimerStatus> =>
			service.getTimerStatus({
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

		it('CONTROL: the row is the shape the old `stoppedAt IS NOT NULL` filter dropped', () => {
			const row = runningWithoutStoppedAt();
			expect(row.isRunning).toBe(true);
			expect(row.stoppedAt).toBeNull();
		});

		it('status reads it as the running log, counting its time since it started', async () => {
			const { service } = setup([runningWithoutStoppedAt()]);

			const status = await getTimerStatus(service);

			expect(status.running).toBe(true);
			expect(status.lastLog).toMatchObject({ id: 'running-without-stopped-at', isRunning: true });
			// 01:00 to 02:00
			expect(status.duration).toBe(HOUR);
		});

		it('stop finds the same log the status shows as running', async () => {
			const { service } = setup([runningWithoutStoppedAt()]);

			const status = await getTimerStatus(service);
			const lastRunningLog = await (service as any).getLastRunningLog(true);

			expect(lastRunningLog).toMatchObject({ id: status.lastLog.id });
		});

		it('toggle stops it instead of starting a second timer beside it', async () => {
			const { service, startTimer, stopTimer } = setup([runningWithoutStoppedAt()]);

			await service.toggleTimeLog({} as ITimerToggleInput);

			expect(stopTimer).toHaveBeenCalledTimes(1);
			expect(startTimer).not.toHaveBeenCalled();
		});

		it('hands it to the previous-timers cleanup, which runs before a new timer starts', async () => {
			const { service } = setup([runningWithoutStoppedAt()]);

			const logs = await (service as any).getLastRunningLogs();

			expect(logs.map((log: ITimeLog) => log.id)).toEqual(['running-without-stopped-at']);
		});

		it('keeps reading a running log written by the timer, with its stoppedAt', async () => {
			const runningFromTimer = timeLog({
				id: 'running-from-timer',
				isRunning: true,
				startedAt: new Date('2026-10-24T01:30:00.000Z'),
				stoppedAt: new Date('2026-10-24T01:59:00.000Z')
			});
			const { service } = setup([runningFromTimer]);

			const status = await getTimerStatus(service);
			const lastRunningLog = await (service as any).getLastRunningLog();

			expect(status.running).toBe(true);
			expect(status.lastLog).toMatchObject({ id: 'running-from-timer' });
			expect(lastRunningLog).toMatchObject({ id: 'running-from-timer' });
		});

		it('still finds no running log when every log is stopped, and toggle starts a timer', async () => {
			const stopped = timeLog({
				id: 'stopped-today',
				startedAt: new Date('2026-10-24T00:30:00.000Z'),
				stoppedAt: new Date('2026-10-24T01:00:00.000Z')
			});
			const { service, startTimer, stopTimer } = setup([stopped]);

			expect(await (service as any).getLastRunningLog()).toBeNull();
			expect((await getTimerStatus(service)).running).toBe(false);

			await service.toggleTimeLog({} as ITimerToggleInput);

			expect(startTimer).toHaveBeenCalledTimes(1);
			expect(stopTimer).not.toHaveBeenCalled();
		});

		it("does not read another employee's running log", async () => {
			const teammate = timeLog({
				id: 'teammate-running',
				employeeId: 'employee-2',
				isRunning: true,
				startedAt: new Date('2026-10-24T01:00:00.000Z'),
				stoppedAt: null
			});
			const { service } = setup([teammate]);

			expect(await (service as any).getLastRunningLog()).toBeNull();
			expect((await getTimerStatus(service)).running).toBe(false);
		});
	}
);
