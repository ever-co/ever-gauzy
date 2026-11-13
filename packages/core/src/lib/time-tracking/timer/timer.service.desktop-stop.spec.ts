// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { ITimeLog, ITimeSlot, ITimerToggleInput, IUser, TimeLogSourceEnum } from '@gauzy/contracts';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TimeLogUpdateCommand } from '../time-log/commands';
import { TimerService } from './timer.service';

/**
 * The desktop stops with its own source every run it shows, the ones it mirrors from other clients too, and a desktop
 * stop applied the desktop's rules to all of them: a run with no time slot started over ten minutes ago ended ten
 * seconds after its start, one whose last time slot was long past where that slot ended. A two-hour web timer run
 * stopped from the desktop was recorded as ten seconds. The rules now hold for a tracker's run only (the desktop
 * timer and the agent send time slots while they run); a run from another client ends at the time the stop asks for.
 */
describe('TimerService.stopTimer from the desktop', () => {
	const fixture = createTenantFixture({ user: { employeeId: 'employee-1' } as IUser });
	const NOW = new Date('2026-10-24T02:00:00.000Z');
	const TWO_HOURS_AGO = new Date('2026-10-24T00:00:00.000Z');
	/** The end the stop asks for, half a minute before now. */
	const REQUESTED_STOP = new Date('2026-10-24T01:59:30.000Z');

	let restore: () => void;
	let service: TimerService;
	let execute: jest.Mock;
	let runningLog: ITimeLog;

	/** The employee's running log from `source`, started two hours ago, with `timeSlots`. */
	const runFrom = (source: TimeLogSourceEnum, timeSlots: Partial<ITimeSlot>[] = []): ITimeLog =>
		({
			id: 'running',
			employeeId: 'employee-1',
			source,
			isRunning: true,
			startedAt: TWO_HOURS_AGO,
			stoppedAt: TWO_HOURS_AGO,
			timeSlots: timeSlots as ITimeSlot[]
		}) as ITimeLog;

	/** A ten-minute time slot of the run, started at `startedAt`. */
	const slotAt = (startedAt: string): Partial<ITimeSlot> => ({ startedAt: new Date(startedAt), duration: 600 });

	/** Stops the running log from `source`, asking for REQUESTED_STOP, as the desktop's stop does. */
	const stopFrom = (source: TimeLogSourceEnum) =>
		service.stopTimer({ source, startedAt: TWO_HOURS_AGO, stoppedAt: REQUESTED_STOP } as ITimerToggleInput);

	/** The end the stop wrote on the running log. */
	const writtenStoppedAt = (): Date => {
		const commands = execute.mock.calls.map(([command]) => command);
		const update = commands.find((command) => command instanceof TimeLogUpdateCommand) as TimeLogUpdateCommand;
		return update.input.stoppedAt;
	};

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
		execute = jest.fn(async (command: unknown) =>
			command instanceof TimeLogUpdateCommand ? { ...runningLog, ...command.input } : undefined
		);
		const employee = { id: 'employee-1', organizationId: fixture.organizationId, tenantId: fixture.tenantId };
		const employeeService = { findOneByUserId: jest.fn(async () => employee), update: jest.fn() };
		service = new TimerService(
			{ find: jest.fn(async () => []) } as never,
			undefined as never,
			undefined as never,
			undefined as never,
			employeeService as never,
			{ execute } as never,
			undefined as never
		);
		Object.assign(service, {
			getLastRunningLogs: jest.fn(async () => [runningLog]),
			stopPreviousRunningTimers: jest.fn(async () => undefined),
			handleConflictingTimeLogs: jest.fn(async () => undefined)
		});
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it.each([TimeLogSourceEnum.WEB_TIMER, TimeLogSourceEnum.TEAMS])(
		'keeps the time it asks for on a %s run started two hours ago with no time slot',
		async (source) => {
			runningLog = runFrom(source);

			await stopFrom(TimeLogSourceEnum.DESKTOP);

			// 01:59:30, not 00:00:10
			expect(writtenStoppedAt()).toEqual(REQUESTED_STOP);
		}
	);

	it('keeps the time it asks for on an Ever Teams run whose last time slot is long past', async () => {
		runningLog = runFrom(TimeLogSourceEnum.TEAMS, [slotAt('2026-10-24T00:00:00.000Z')]);

		await stopFrom(TimeLogSourceEnum.DESKTOP);

		// 01:59:30, not 00:10:00 where its time slot ends
		expect(writtenStoppedAt()).toEqual(REQUESTED_STOP);
	});

	describe('on a desktop run, as before', () => {
		it('ends one started two hours ago with no time slot ten seconds after its start', async () => {
			runningLog = runFrom(TimeLogSourceEnum.DESKTOP);

			await stopFrom(TimeLogSourceEnum.DESKTOP);

			expect(writtenStoppedAt()).toEqual(new Date('2026-10-24T00:00:10.000Z'));
		});

		it('ends one whose last time slot started over ten minutes before the stop where that slot ends', async () => {
			runningLog = runFrom(TimeLogSourceEnum.DESKTOP, [
				slotAt('2026-10-24T00:50:00.000Z'),
				slotAt('2026-10-24T01:00:00.000Z')
			]);

			await stopFrom(TimeLogSourceEnum.DESKTOP);

			expect(writtenStoppedAt()).toEqual(new Date('2026-10-24T01:10:00.000Z'));
		});

		it('keeps the time it asks for on one whose last time slot is recent', async () => {
			runningLog = runFrom(TimeLogSourceEnum.DESKTOP, [slotAt('2026-10-24T01:50:00.000Z')]);

			await stopFrom(TimeLogSourceEnum.DESKTOP);

			expect(writtenStoppedAt()).toEqual(REQUESTED_STOP);
		});

		it('keeps the time a stop from another client asks for', async () => {
			runningLog = runFrom(TimeLogSourceEnum.DESKTOP);

			await stopFrom(TimeLogSourceEnum.TEAMS);

			expect(writtenStoppedAt()).toEqual(REQUESTED_STOP);
		});
	});
});
