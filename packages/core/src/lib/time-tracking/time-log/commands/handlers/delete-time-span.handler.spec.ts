// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { ITimeSlot } from '@gauzy/contracts';
import { TimeSlotBulkDeleteCommand } from '../../../time-slot/commands';
import { TimeLog } from '../../time-log.entity';
import { DeleteTimeSpanCommand } from '../delete-time-span.command';
import { TimeLogDeleteCommand } from '../time-log-delete.command';
import { DeleteTimeSpanHandler } from './delete-time-span.handler';

/**
 * #10734 — manual time over a range that fully covers a tracked log with several time slots.
 *
 * `TimeLogService.addManualTime` / `updateManualTime` and the timer's stop send one `DeleteTimeSpanCommand`
 * per slot of each conflicting log. When the new range covers the log, the command for its first slot deletes
 * the whole log; the command for the next slot then read the log back, found nothing, and destructured `null`,
 * so the request failed with 400 after the old entry was already gone and the manual entry was never saved.
 */

const LOG_ID = '10734000-0000-4000-8000-000000000001';

/** A log tracked from 10:00 to 10:30: three ten-minute slots. */
const TRACKED_LOG = {
	id: LOG_ID,
	tenantId: '10734000-0000-4000-8000-0000000000aa',
	organizationId: '10734000-0000-4000-8000-0000000000bb',
	employeeId: '10734000-0000-4000-8000-0000000000cc',
	timesheetId: '10734000-0000-4000-8000-0000000000dd',
	startedAt: new Date('2026-10-12T10:00:00.000Z'),
	stoppedAt: new Date('2026-10-12T10:30:00.000Z'),
	timeSlots: [
		{ id: '10734000-0000-4000-8000-000000000011' },
		{ id: '10734000-0000-4000-8000-000000000012' },
		{ id: '10734000-0000-4000-8000-000000000013' }
	] as ITimeSlot[]
} as unknown as TimeLog;

/** The manual entry picked over it: 09:30 to 11:00. */
const COVERING_RANGE = {
	start: new Date('2026-10-12T09:30:00.000Z'),
	end: new Date('2026-10-12T11:00:00.000Z')
};

/**
 * The handler over a store holding the tracked log until a `TimeLogDeleteCommand` removes it, which is what
 * the default (soft-deleting) delete leaves a later `findOne` to see.
 */
function createHandler(storedLog: TimeLog = TRACKED_LOG) {
	let stored: TimeLog | null = storedLog;

	const timeLogRepository = {
		findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
			stored && stored.id === where.id ? { ...stored, timeSlots: [...stored.timeSlots] } : null
		),
		save: jest.fn(async (log: TimeLog) => log)
	};
	const execute = jest.fn(async (command: unknown) => {
		if (command instanceof TimeLogDeleteCommand) {
			stored = null;
		}
		return undefined;
	});

	const handler = new DeleteTimeSpanHandler(timeLogRepository as any, {} as any, { execute } as any);

	return { handler, execute, timeLogRepository };
}

describe('DeleteTimeSpanHandler', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('deletes a log the new range covers entirely, on the command for its first slot', async () => {
		const { handler, execute } = createHandler();

		await expect(
			handler.execute(new DeleteTimeSpanCommand(COVERING_RANGE, TRACKED_LOG, TRACKED_LOG.timeSlots[0]))
		).resolves.toBe(true);

		expect(execute).toHaveBeenCalledTimes(1);
		expect(execute.mock.calls[0][0]).toBeInstanceOf(TimeLogDeleteCommand);
	});

	it('clears every slot of a covered multi-slot log, as the manual time loop sends them, without failing', async () => {
		const { handler, execute, timeLogRepository } = createHandler();

		// `addManualTime`: one command per slot of each conflicting log, sequentially.
		const results: boolean[] = [];
		for (const timeSlot of TRACKED_LOG.timeSlots) {
			results.push(await handler.execute(new DeleteTimeSpanCommand(COVERING_RANGE, TRACKED_LOG, timeSlot)));
		}

		// The first command removed the log; the next two found nothing left to trim.
		expect(results).toEqual([true, false, false]);
		expect(timeLogRepository.findOne).toHaveBeenCalledTimes(3);
		expect(execute.mock.calls.filter(([command]) => command instanceof TimeLogDeleteCommand)).toHaveLength(1);
	});

	it('does nothing for a log that is no longer there', async () => {
		const { handler, execute } = createHandler();
		await handler.execute(new DeleteTimeSpanCommand(COVERING_RANGE, TRACKED_LOG, TRACKED_LOG.timeSlots[0]));
		execute.mockClear();

		await expect(
			handler.execute(new DeleteTimeSpanCommand(COVERING_RANGE, TRACKED_LOG, TRACKED_LOG.timeSlots[1], true))
		).resolves.toBe(false);
		expect(execute).not.toHaveBeenCalled();
	});

	/**
	 * Deleting a time slot sends the slot's ten minutes as the span, once per log holding the slot. A log whose time
	 * does not reach the slot fell through to the overlap shapes after the slot was deleted: the split one moved the
	 * stop of a log that ends before the slot up to the slot, and deleted a log that starts after it to save a copy
	 * starting at the slot's end.
	 */
	describe('deleting a time slot its log does not reach', () => {
		const SLOT_OUTSIDE = { id: '10734000-0000-4000-8000-000000000021' } as ITimeSlot;
		const SLOT_RANGE = {
			start: new Date('2026-10-12T11:00:00.000Z'),
			end: new Date('2026-10-12T11:10:00.000Z')
		};
		const LOG_AFTER_SLOT = {
			...TRACKED_LOG,
			startedAt: new Date('2026-10-12T12:00:00.000Z'),
			stoppedAt: new Date('2026-10-12T12:30:00.000Z')
		} as TimeLog;

		it.each([
			['that stops before it', TRACKED_LOG],
			['that starts after it', LOG_AFTER_SLOT]
		])('deletes the slot alone and leaves a log %s as it is', async (_shape, log) => {
			const { handler, execute, timeLogRepository } = createHandler(log);

			await handler.execute(new DeleteTimeSpanCommand(SLOT_RANGE, log, SLOT_OUTSIDE));

			const commands = execute.mock.calls.map(([command]) => command);
			expect(timeLogRepository.save).not.toHaveBeenCalled();
			expect(commands.some((command) => command instanceof TimeLogDeleteCommand)).toBe(false);
			const slotDeletions = commands.filter((command) => command instanceof TimeSlotBulkDeleteCommand);
			expect(slotDeletions.map((command) => command.input.timeSlotsIds)).toEqual([[SLOT_OUTSIDE.id]]);
		});
	});
});
