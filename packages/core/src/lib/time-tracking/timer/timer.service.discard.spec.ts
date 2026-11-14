// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ITimerDiscardInput, TimeLogSourceEnum } from '@gauzy/contracts';
import { MultiORMEnum } from '../../core/utils';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TimeLogDeleteCommand } from '../time-log/commands';
import { TIMER_DISCARD_DISABLED, TIMER_DISCARD_TOO_LATE } from './timer-discard-rule';
import { TimerService } from './timer.service';

/**
 * Issue #11923 — a member discards their own running timer: the run is removed, with its slots, through the time log
 * delete, and no permission to delete time is asked. Nothing runs: 400. A discard naming another log than the running
 * one: 409. The organization's switch off, or its time limit passed: 403 with a code. A stopped entry is never removed,
 * and neither is another employee's run.
 *
 * The repositories answer from an in-memory table, the command bus records the delete and applies it to that table,
 * and the trailing `stopPreviousRunningTimers` is stubbed.
 */

const EMPLOYEE_ID = 'employee-paul';
const OTHER_EMPLOYEE_ID = 'employee-marie';
const NOW = new Date('2026-11-13T10:02:00.000Z');
const RUNNING_LOG_ID = '11923000-0000-4000-8000-0000000000aa';
const STOPPED_LOG_ID = '11923000-0000-4000-8000-000000000010';
const OTHER_RUNNING_LOG_ID = '11923000-0000-4000-8000-0000000000bb';

interface TimeLogRow {
	id: string;
	employeeId: string;
	tenantId: string;
	organizationId: string;
	source: TimeLogSourceEnum;
	isRunning: boolean;
	startedAt: Date;
	stoppedAt: Date;
	createdAt: Date;
	timeSlots: Array<{ id: string }>;
}

const time = (value: Date): number => new Date(value).getTime();

/** The rows matching a plain `where`, by `startedAt DESC, createdAt DESC` as the running-log query orders them. */
function findRows(rows: TimeLogRow[], where: Record<string, unknown>): TimeLogRow[] {
	return rows
		.filter((row) => Object.entries(where).every(([key, value]) => row[key as keyof TimeLogRow] === value))
		.sort((a, b) => time(b.startedAt) - time(a.startedAt) || time(b.createdAt) - time(a.createdAt));
}

interface OrganizationSettings {
	allowDiscardTimer?: boolean | null;
	discardTimerWithinMinutes?: number | null;
}

/** Applies `values` to the rows matching `where`, as one UPDATE statement would, and answers how many it changed. */
function updateRows(rows: TimeLogRow[], where: Record<string, unknown>, values: Partial<TimeLogRow>): number {
	const matching = findRows(rows, where);
	for (const row of matching) {
		Object.assign(row, values);
	}
	return matching.length;
}

/**
 * A `TimerService` over `rows`, on the given ORM, whose command bus removes the row a `TimeLogDeleteCommand` names.
 * `hooks.afterDelete` runs right after that removal, to play what another device does meanwhile.
 */
function createService(
	ormType: MultiORMEnum,
	rows: TimeLogRow[],
	employee: Record<string, unknown>,
	hooks: { beforeDelete?: () => void; afterDelete?: () => void; failDelete?: boolean } = {}
) {
	const typeOrmTimeLogRepository = {
		findOne: async ({ where }: { where: Record<string, unknown> }) => findRows(rows, where)[0] ?? null,
		find: async ({ where }: { where: Record<string, unknown> }) => findRows(rows, where),
		update: jest.fn(async (where: Record<string, unknown>, values: Partial<TimeLogRow>) => ({
			affected: updateRows(rows, where, values)
		}))
	};
	const mikroOrmTimeLogRepository = {
		findOne: async (where: Record<string, unknown>) => {
			const row = findRows(rows, where)[0];
			// A MikroORM-loaded row: `wrapSerialize` calls its `toJSON`
			return row ? { ...row, toJSON: () => ({ ...row }) } : null;
		},
		findAll: async ({ where }: { where: Record<string, unknown> }) =>
			findRows(rows, where).map((row) => ({ ...row, toJSON: () => ({ ...row }) })),
		nativeUpdate: jest.fn(async (where: Record<string, unknown>, values: Partial<TimeLogRow>) =>
			updateRows(rows, where, values)
		)
	};
	const execute = jest.fn(async (command: object) => {
		if (command instanceof TimeLogDeleteCommand) {
			hooks.beforeDelete?.();
			if (hooks.failDelete) {
				throw new Error('The database went away while the run was removed.');
			}
			const deleted = command.ids as { id: string };
			const index = rows.findIndex((row) => row.id === deleted.id);
			rows.splice(index, 1);
			hooks.afterDelete?.();
		}
		return [];
	});
	const employeeService = {
		findOneByUserId: jest.fn(async () => employee),
		update: jest.fn(async () => undefined)
	};
	const typeOrmEmployeeRepository = { update: jest.fn(async () => ({ affected: 1 })) };
	const mikroOrmEmployeeRepository = { nativeUpdate: jest.fn(async () => 1) };

	const service = new TimerService(
		typeOrmTimeLogRepository as never,
		mikroOrmTimeLogRepository as never,
		typeOrmEmployeeRepository as never,
		mikroOrmEmployeeRepository as never,
		employeeService as never,
		{ execute } as never,
		undefined as never
	);
	const stopPreviousRunningTimers = jest.fn(async () => undefined);
	Object.assign(service, { ormType, stopPreviousRunningTimers });
	jest.spyOn((service as unknown as { logger: { warn: () => void } }).logger, 'warn').mockImplementation(
		() => undefined
	);

	/** The "not tracking" write, through the repository of the ORM in use. */
	const notTrackingWrites = () => {
		if (ormType === MultiORMEnum.MikroORM) {
			return mikroOrmEmployeeRepository.nativeUpdate.mock.calls;
		}
		return typeOrmEmployeeRepository.update.mock.calls;
	};

	return {
		service,
		execute,
		employeeService,
		stopPreviousRunningTimers,
		notTrackingWrites,
		typeOrmTimeLogRepository,
		mikroOrmTimeLogRepository
	};
}

describe.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])('TimerService discard (%s)', (ormType) => {
	const fixture = createTenantFixture();

	const timeLog = (
		overrides: Partial<TimeLogRow> & Pick<TimeLogRow, 'id' | 'startedAt' | 'stoppedAt'>
	): TimeLogRow => ({
		employeeId: EMPLOYEE_ID,
		tenantId: fixture.tenantId,
		organizationId: fixture.organizationId,
		source: TimeLogSourceEnum.TEAMS,
		isRunning: false,
		createdAt: overrides.startedAt,
		timeSlots: [],
		...overrides
	});

	/** Paul's entry stopped a second before the run below started. */
	const stoppedLog = (): TimeLogRow =>
		timeLog({
			id: STOPPED_LOG_ID,
			startedAt: new Date('2026-11-13T09:00:00.000Z'),
			stoppedAt: new Date('2026-11-13T09:59:59.000Z')
		});

	/** Paul's run started by mistake at 10:00, with one slot. */
	const runningLog = (): TimeLogRow =>
		timeLog({
			id: RUNNING_LOG_ID,
			isRunning: true,
			startedAt: new Date('2026-11-13T10:00:00.000Z'),
			stoppedAt: new Date('2026-11-13T10:00:00.000Z'),
			timeSlots: [{ id: 'slot-of-the-run' }]
		});

	/** Marie's run, which Paul's discard must never reach. */
	const otherEmployeesRunningLog = (): TimeLogRow =>
		timeLog({
			id: OTHER_RUNNING_LOG_ID,
			employeeId: OTHER_EMPLOYEE_ID,
			isRunning: true,
			startedAt: new Date('2026-11-13T10:01:00.000Z'),
			stoppedAt: new Date('2026-11-13T10:01:00.000Z')
		});

	const setup = (
		rows: TimeLogRow[],
		organization: OrganizationSettings = {},
		hooks: { beforeDelete?: () => void; afterDelete?: () => void; failDelete?: boolean } = {}
	) =>
		createService(
			ormType,
			rows,
			{
				id: EMPLOYEE_ID,
				organizationId: fixture.organizationId,
				tenantId: fixture.tenantId,
				organization
			},
			hooks
		);

	/** The employee, as the "not tracking" write names them. */
	const trackedEmployee = () => ({
		id: EMPLOYEE_ID,
		organizationId: fixture.organizationId,
		tenantId: fixture.tenantId
	});

	const discard = (service: TimerService, input: ITimerDiscardInput = {}) => service.discardTimer(input);

	const refusalCode = async (promise: Promise<unknown>): Promise<unknown> => {
		try {
			await promise;
		} catch (error) {
			return (error as ForbiddenException).getResponse();
		}
		return undefined;
	};

	let restore: () => void;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('removes the running log with its slots through the time log delete, and the employee no longer tracks time', async () => {
		const rows = [stoppedLog(), runningLog(), otherEmployeesRunningLog()];
		const { service, execute, notTrackingWrites } = setup(rows);

		await expect(discard(service)).resolves.toBeUndefined();

		const [deleteCommand] = execute.mock.calls[0] as [TimeLogDeleteCommand];
		expect(deleteCommand).toBeInstanceOf(TimeLogDeleteCommand);
		expect(deleteCommand.forceDelete).toBe(true);
		expect(deleteCommand.ids).toMatchObject({ id: RUNNING_LOG_ID, timeSlots: [{ id: 'slot-of-the-run' }] });
		expect(rows.map((row) => row.id)).toEqual([STOPPED_LOG_ID, OTHER_RUNNING_LOG_ID]);
		expect(notTrackingWrites()).toEqual([[trackedEmployee(), { isOnline: false, isTrackingTime: false }]]);
	});

	it('answers 400 and removes nothing when a stop from another tab lands between the read and the removal', async () => {
		const rows = [runningLog()];
		const { service, execute, typeOrmTimeLogRepository, mikroOrmTimeLogRepository } = setup(rows);
		// The other tab's stop commits right after the discard read the run: the run is a saved entry now
		const stopFromOtherTab = async () => {
			rows[0].isRunning = false;
			return 0;
		};
		typeOrmTimeLogRepository.update.mockImplementationOnce(async () => ({ affected: await stopFromOtherTab() }));
		mikroOrmTimeLogRepository.nativeUpdate.mockImplementationOnce(stopFromOtherTab);

		await expect(discard(service)).rejects.toBeInstanceOf(BadRequestException);
		expect(execute).not.toHaveBeenCalled();
		expect(rows).toEqual([expect.objectContaining({ id: RUNNING_LOG_ID, isRunning: false })]);
	});

	it('never stops a run another device starts meanwhile, and the employee still tracks time', async () => {
		const rows = [runningLog()];
		const newRun = timeLog({
			id: OTHER_RUNNING_LOG_ID,
			source: TimeLogSourceEnum.DESKTOP,
			isRunning: true,
			startedAt: NOW,
			stoppedAt: NOW
		});
		const { service, stopPreviousRunningTimers, notTrackingWrites } = setup(
			rows,
			{},
			{
				afterDelete: () => rows.push(newRun)
			}
		);

		await discard(service);

		expect(rows).toEqual([expect.objectContaining({ id: OTHER_RUNNING_LOG_ID, isRunning: true })]);
		expect(stopPreviousRunningTimers).not.toHaveBeenCalled();
		expect(notTrackingWrites()).toEqual([]);
	});

	it('gives the run back when its removal fails, and the error travels', async () => {
		const rows = [runningLog()];
		const { service } = setup(rows, {}, { failDelete: true });

		await expect(discard(service)).rejects.toThrow('The database went away');
		expect(rows).toEqual([expect.objectContaining({ id: RUNNING_LOG_ID, isRunning: true })]);
	});

	it('leaves the run stopped when its removal fails after another device started a run, so two never run', async () => {
		const rows = [runningLog()];
		const newRun = timeLog({
			id: OTHER_RUNNING_LOG_ID,
			source: TimeLogSourceEnum.DESKTOP,
			isRunning: true,
			startedAt: NOW,
			stoppedAt: NOW
		});
		const { service } = setup(rows, {}, { beforeDelete: () => rows.push(newRun), failDelete: true });

		await expect(discard(service)).rejects.toThrow('The database went away');
		expect(rows).toEqual([
			expect.objectContaining({ id: RUNNING_LOG_ID, isRunning: false }),
			expect.objectContaining({ id: OTHER_RUNNING_LOG_ID, isRunning: true })
		]);
	});

	it('answers 400 when nothing runs, and never removes a stopped entry, even one stopped a second earlier', async () => {
		const rows = [stoppedLog(), otherEmployeesRunningLog()];
		const { service, execute, employeeService } = setup(rows);

		await expect(discard(service)).rejects.toBeInstanceOf(BadRequestException);
		expect(execute).not.toHaveBeenCalled();
		expect(employeeService.update).not.toHaveBeenCalled();
		expect(rows).toHaveLength(2);
	});

	it('answers 409 to a discard naming another log than the running one, and the run goes on', async () => {
		const rows = [stoppedLog(), runningLog()];
		const { service, execute } = setup(rows);

		await expect(discard(service, { timeLogId: STOPPED_LOG_ID })).rejects.toBeInstanceOf(ConflictException);
		expect(execute).not.toHaveBeenCalled();
		expect(rows.map((row) => row.id)).toEqual([STOPPED_LOG_ID, RUNNING_LOG_ID]);
	});

	it('discards the running log it names, its id in either case', async () => {
		const rows = [runningLog()];
		const { service, execute } = setup(rows);

		await discard(service, { timeLogId: RUNNING_LOG_ID.toUpperCase() });

		expect(execute).toHaveBeenCalledTimes(1);
		expect(rows).toEqual([]);
	});

	it.each([
		['the switch is on', { allowDiscardTimer: true }],
		['the switch is null', { allowDiscardTimer: null }]
	])('discards when %s', async (_label, organization) => {
		const rows = [runningLog()];
		const { service } = setup(rows, organization);

		await discard(service);

		expect(rows).toEqual([]);
	});

	it('answers 403 with its code when the organization turned discarding off, whether or not a timer runs', async () => {
		const running = [runningLog()];
		const withRun = setup(running, { allowDiscardTimer: false });
		const withoutRun = setup([], { allowDiscardTimer: false });

		await expect(refusalCode(discard(withRun.service))).resolves.toMatchObject({ code: TIMER_DISCARD_DISABLED });
		await expect(refusalCode(discard(withoutRun.service))).resolves.toMatchObject({ code: TIMER_DISCARD_DISABLED });
		expect(withRun.execute).not.toHaveBeenCalled();
		expect(running).toHaveLength(1);
	});

	it('answers 403 with its code to a run older than the organization limit, and discards a younger one', async () => {
		const olderRun = [runningLog()];
		const tooLate = setup(olderRun, { discardTimerWithinMinutes: 1 });

		await expect(refusalCode(discard(tooLate.service))).resolves.toMatchObject({ code: TIMER_DISCARD_TOO_LATE });
		expect(tooLate.execute).not.toHaveBeenCalled();
		expect(olderRun).toHaveLength(1);

		const youngerRun = [runningLog()];
		const inTime = setup(youngerRun, { discardTimerWithinMinutes: 10 });

		await discard(inTime.service);

		expect(youngerRun).toEqual([]);
	});
});
