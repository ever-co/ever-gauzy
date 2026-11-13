// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { Logger } from '@nestjs/common';
import { RequestContext } from '../../../../core/context';
import { TimesheetRecalculateCommand } from '../../../timesheet/commands';
import { TimeSlotDurationRecalculateCommand } from '../time-slot-duration-recalculate.command';
import { TimeSlotDurationRecalculateHandler } from './time-slot-duration-recalculate.handler';

/**
 * A time slot counts the time the logs holding it spend in its ten minutes. A timer stopped over a manual entry
 * merged its slots with the entry's by summing their durations, then took the shared time out of the entry without
 * counting the slots again: each shared slot kept that time twice, and the weekly timesheet, which sums the slots,
 * read high.
 */

const TENANT = 'tenant-a';
const ORGANIZATION = 'org-a';
const EMPLOYEE = 'employee-a';

interface IStoredTimeLog {
	id: string;
	timesheetId: string;
	startedAt: Date;
	stoppedAt: Date | null;
}

interface IStoredSlot {
	id: string;
	tenantId: string;
	startedAt: Date;
	duration: number;
	timeLogs: IStoredTimeLog[];
}

/** A moment of the day, from its `HH:mm:ss.SSS`, in UTC. */
function at(time: string): Date {
	return new Date(`2026-11-12T${time}Z`);
}

function timeLog(id: string, timesheetId: string, from: string, to: string): IStoredTimeLog {
	return { id, timesheetId, startedAt: at(from), stoppedAt: at(to) };
}

function slot(id: string, startedAt: string, duration: number, timeLogs: IStoredTimeLog[]): IStoredSlot {
	return { id, tenantId: TENANT, startedAt: at(startedAt), duration, timeLogs };
}

function createHandler(stored: IStoredSlot[]) {
	const parameters: Record<string, unknown> = {};
	const builder = {
		alias: 'time_slot',
		leftJoinAndSelect: () => builder,
		where: (_condition: string, values: Record<string, unknown>) => addParameters(values),
		andWhere: (_condition: string, values: Record<string, unknown>) => addParameters(values),
		getMany: async () => stored.filter((timeSlot) => (parameters.timeSlotsIds as string[]).includes(timeSlot.id))
	};
	const addParameters = (values: Record<string, unknown>) => {
		Object.assign(parameters, values);
		return builder;
	};
	const repository = {
		createQueryBuilder: () => builder,
		update: jest.fn(async ({ id }: { id: string }, changes: Partial<IStoredSlot>) => {
			const timeSlot = stored.find((storedSlot) => storedSlot.id === id);
			Object.assign(timeSlot, changes);
			return { affected: 1 };
		})
	};
	const execute = jest.fn<Promise<void>, [unknown]>(async () => undefined);
	const handler = new TimeSlotDurationRecalculateHandler(repository as never, { execute } as never);
	return { handler, repository, execute, parameters };
}

const recalculate = (timeSlotsIds: string[]) =>
	new TimeSlotDurationRecalculateCommand({ organizationId: ORGANIZATION, employeeId: EMPLOYEE, timeSlotsIds });

describe('TimeSlotDurationRecalculateHandler', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it('counts the time each log holding a slot spends in its ten minutes, once', async () => {
		// The entry stops where the timer starts; the merge left their slot at 180 + 123 seconds.
		const entry = timeLog('entry', 'week', '19:30:00.000', '19:31:39.510');
		const timer = timeLog('timer', 'week', '19:31:39.510', '19:33:42.632');
		const stored = [slot('slot-1930', '19:30:00.000', 303, [entry, timer])];
		const { handler, parameters } = createHandler(stored);

		await handler.execute(recalculate(['slot-1930']));

		expect(stored.map((timeSlot) => timeSlot.duration)).toEqual([222]);
		expect(parameters).toEqual(
			expect.objectContaining({ employeeId: EMPLOYEE, organizationId: ORGANIZATION, tenantId: TENANT })
		);
	});

	it('writes only a slot whose duration changes, and recalculates the timesheets of the logs holding it', async () => {
		const entry = timeLog('entry', 'entry-week', '18:56:00.000', '19:06:14.967');
		const timer = timeLog('timer', 'timer-week', '19:06:14.967', '19:26:20.047');
		const stored = [
			slot('slot-1900', '19:00:00.000', 600, [entry, timer]),
			slot('slot-1920', '19:20:00.000', 600, [timer])
		];
		const { handler, repository, execute } = createHandler(stored);

		await handler.execute(recalculate(['slot-1900', 'slot-1920']));

		expect(repository.update.mock.calls).toEqual([[{ id: 'slot-1920', tenantId: TENANT }, { duration: 380 }]]);
		const recalculations = execute.mock.calls.map(([command]) => command);
		expect(recalculations).toEqual([new TimesheetRecalculateCommand('timer-week')]);
	});

	/**
	 * One failed save rejected the whole recount: the timesheets of the slots saved before it were not recalculated, and
	 * a retry skipped those slots, whose duration already matched.
	 */
	it('recalculates the timesheets of the slots it saved when another one fails to save, and logs the failure', async () => {
		const first = timeLog('first', 'first-week', '10:00:00.000', '10:05:00.000');
		const second = timeLog('second', 'second-week', '11:00:00.000', '11:05:00.000');
		const stored = [
			slot('slot-1000', '10:00:00.000', 600, [first]),
			slot('slot-1100', '11:00:00.000', 600, [second])
		];
		const { handler, repository, execute } = createHandler(stored);
		repository.update.mockImplementationOnce(async () => {
			throw new Error('The database connection was lost');
		});
		const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

		await handler.execute(recalculate(['slot-1000', 'slot-1100']));

		expect(stored.map((timeSlot) => timeSlot.duration)).toEqual([600, 300]);
		const recalculations = execute.mock.calls.map(([command]) => command);
		expect(recalculations).toEqual([new TimesheetRecalculateCommand('second-week')]);
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('The database connection was lost'),
			expect.anything()
		);
	});

	it('counts a slot at most its ten minutes', async () => {
		const first = timeLog('first', 'week', '10:00:00.000', '10:10:00.000');
		const second = timeLog('second', 'week', '10:00:00.000', '10:10:00.000');
		const stored = [slot('slot-1000', '10:00:00.000', 300, [first, second])];
		const { handler } = createHandler(stored);

		await handler.execute(recalculate(['slot-1000']));

		expect(stored.map((timeSlot) => timeSlot.duration)).toEqual([600]);
	});

	it('counts a log with no stop until now, as a time log counts its duration', async () => {
		jest.useFakeTimers({ now: at('10:07:30.000') });
		const running = { id: 'running', timesheetId: 'week', startedAt: at('10:02:00.000'), stoppedAt: null };
		const stored = [slot('slot-1000', '10:00:00.000', 0, [running])];
		const { handler } = createHandler(stored);

		await handler.execute(recalculate(['slot-1000']));

		expect(stored.map((timeSlot) => timeSlot.duration)).toEqual([330]);
	});
});
