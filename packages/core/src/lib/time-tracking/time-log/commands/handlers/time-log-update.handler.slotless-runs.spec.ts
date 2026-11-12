// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { TimeLogSourceEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../../core/context';
import { MultiORMEnum } from '../../../../core/utils';
import { TimeLogUpdateCommand } from '../time-log-update.command';
import { TimeLogUpdateHandler } from './time-log-update.handler';

/**
 * ever-co/ever-gauzy#11843: Ever Teams and its mobile app post a time slot on each heartbeat, so a run of theirs that
 * never sent one had no slot when it stopped, and the day's worked time, which counts logs through their slots, left
 * it out. A stop gives such a run the slots of its range, as it gives a web timer run; a run that has slots keeps them.
 */

const TENANT = 'tenant-a';
const STARTED = new Date('2026-01-05T09:00:00.000Z');
const STOPPED = new Date('2026-01-05T09:30:00.000Z');
const minutesAfterStart = (minutes: number) => new Date(STARTED.getTime() + minutes * 60_000);
/** The ten-minute slots of the run's 30 minutes. */
const RANGE_SLOTS = [0, 10, 20].map((minutes) => ({ startedAt: minutesAfterStart(minutes), duration: 600 }));

/** Stops a run of `source` at 09:30, started at 09:00, that has slots or not. */
async function stopRun(
	source: TimeLogSourceEnum,
	{
		hasSlots = false,
		manualTimeSlot = false,
		slotReadFails = false,
		edit = {} as { source?: TimeLogSourceEnum }
	} = {}
) {
	const run = {
		id: 'run',
		tenantId: TENANT,
		organizationId: 'org-a',
		employeeId: 'employee-a',
		source,
		startedAt: STARTED,
		stoppedAt: STARTED,
		isRunning: true
	};
	// The stored run: an update writes into it, and a read answers it as it now stands
	const timeLogRepository = {
		findOneBy: jest.fn(async () => ({ ...run })),
		update: jest.fn(async (_where: object, changes: object) => {
			Object.assign(run, changes);
			return { affected: 1 };
		})
	};
	// The count of the slots linked to the run
	const slotQuery = {
		alias: 'time_slot',
		innerJoin: jest.fn(() => slotQuery),
		where: jest.fn(() => slotQuery),
		getCount: jest.fn(async () => {
			if (slotReadFails) throw new Error('the database is unreachable');
			return hasSlots ? 2 : 0;
		})
	};
	const timeSlotRepository = { createQueryBuilder: jest.fn(() => slotQuery) };
	const timeSlotService = {
		generateTimeSlots: jest.fn(() => RANGE_SLOTS),
		bulkCreate: jest.fn(async (slots: object[]) => slots.map((slot, index) => ({ ...slot, id: `slot-${index}` })))
	};
	const handler = new TimeLogUpdateHandler(
		{ execute: jest.fn(async () => ({ id: 'timesheet-1' })) } as any,
		timeLogRepository as any,
		timeSlotRepository as any,
		{} as any,
		timeSlotService as any
	);
	(handler as any).ormType = MultiORMEnum.TypeORM;
	jest.spyOn(handler as any, 'planRelease').mockResolvedValue({ remove: [], unlink: [] });
	jest.spyOn(handler as any, 'applyRelease').mockResolvedValue(undefined);
	jest.spyOn(handler as any, 'recalculateTimesheetAndEmployeeHours').mockResolvedValue(undefined);
	const save = jest.spyOn(handler as any, 'saveUpdatedTimeLog').mockImplementation(async (log) => log);

	const stop = handler.execute(
		new TimeLogUpdateCommand({ isRunning: false, stoppedAt: STOPPED, ...edit }, 'run', manualTimeSlot)
	);
	const outcome = await stop.then(
		() => undefined,
		(error: Error) => error
	);

	const savedRun = save.mock.calls[0]?.[0] as {
		isRunning: boolean;
		stoppedAt: Date;
		timeSlots?: { startedAt: Date; duration: number; timeLogId: string }[];
	};
	return { bulkCreate: timeSlotService.bulkCreate, savedRun, slotCount: slotQuery.getCount, run, outcome };
}

describe('TimeLogUpdateHandler, the stop of a run that sent no heartbeat (#11843)', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	});
	afterEach(() => jest.restoreAllMocks());

	it.each([TimeLogSourceEnum.TEAMS, TimeLogSourceEnum.MOBILE])(
		'gives a %s run without slots the slots of its 30 minutes, so the day counts them',
		async (source) => {
			const { bulkCreate, savedRun } = await stopRun(source);

			expect(savedRun).toMatchObject({ isRunning: false, stoppedAt: STOPPED });
			expect(bulkCreate).toHaveBeenCalledTimes(1);
			const seconds = savedRun.timeSlots?.reduce((sum, slot) => sum + slot.duration, 0);
			expect(seconds).toBe(30 * 60);
			expect(savedRun.timeSlots?.map((slot) => slot.startedAt)).toEqual(
				RANGE_SLOTS.map((slot) => slot.startedAt)
			);
			expect(savedRun.timeSlots?.every((slot) => slot.timeLogId === 'run')).toBe(true);
		}
	);

	it('leaves an Ever Teams run that posted slots with those it posted', async () => {
		const { bulkCreate, savedRun } = await stopRun(TimeLogSourceEnum.TEAMS, { hasSlots: true });

		expect(bulkCreate).not.toHaveBeenCalled();
		expect(savedRun.timeSlots).toBeUndefined();
	});

	it('still gives a web timer run the slots of its range, without reading its slots', async () => {
		const { bulkCreate, slotCount } = await stopRun(TimeLogSourceEnum.WEB_TIMER);

		expect(bulkCreate).toHaveBeenCalledTimes(1);
		expect(slotCount).not.toHaveBeenCalled();
	});

	it('still leaves a desktop run to the slots its tracker posts', async () => {
		const { bulkCreate, slotCount } = await stopRun(TimeLogSourceEnum.DESKTOP);

		expect(bulkCreate).not.toHaveBeenCalled();
		expect(slotCount).not.toHaveBeenCalled();
	});

	it('reads the slots before writing the stop, so a failed read leaves the run going rather than stopped without slots', async () => {
		const { run, outcome, bulkCreate } = await stopRun(TimeLogSourceEnum.TEAMS, { slotReadFails: true });

		expect(outcome).toEqual(new Error('the database is unreachable'));
		expect(run).toMatchObject({ isRunning: true, stoppedAt: STARTED });
		expect(bulkCreate).not.toHaveBeenCalled();
	});

	it('still gives a desktop log edited into a web timer run the slots of its range', async () => {
		const { bulkCreate } = await stopRun(TimeLogSourceEnum.DESKTOP, {
			edit: { source: TimeLogSourceEnum.WEB_TIMER }
		});

		expect(bulkCreate).toHaveBeenCalledTimes(1);
	});

	it('gives no slots to an Ever Teams log without slots edited into a desktop one', async () => {
		const { bulkCreate, slotCount } = await stopRun(TimeLogSourceEnum.TEAMS, {
			edit: { source: TimeLogSourceEnum.DESKTOP }
		});

		expect(bulkCreate).not.toHaveBeenCalled();
		expect(slotCount).not.toHaveBeenCalled();
	});

	it('creates no slots for an update that brings its own manual slot', async () => {
		const { bulkCreate } = await stopRun(TimeLogSourceEnum.TEAMS, { manualTimeSlot: true });

		expect(bulkCreate).not.toHaveBeenCalled();
	});
});
