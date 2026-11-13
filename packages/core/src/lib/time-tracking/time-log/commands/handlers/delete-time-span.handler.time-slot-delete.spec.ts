// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { ITimeSlot } from '@gauzy/contracts';
import { RequestContext } from '../../../../core/context';
import { at, SPAN_TENANT_ID, StoredTimeSlot, TimeSpanStore } from '../../../testing/time-span-store';
import { DeleteTimeSpanCommand } from '../delete-time-span.command';

/**
 * Deletes the employee's slot of the ten minutes from `from` to `to` as `DELETE /timesheet/time-slot` does: the slot is
 * read with the logs holding it, then each of them that is not running gets the slot's ten minutes taken out.
 *
 * @param store - The store holding the slot.
 * @param from - The slot's start, `HH:mm`.
 * @param to - The slot's end, `HH:mm`.
 */
async function deleteTimeSlot(store: TimeSpanStore, from: string, to: string): Promise<void> {
	const startsAtFrom = (slot: StoredTimeSlot) => slot.startedAt.getTime() === at(from).getTime();
	const stored = store.timeSlots.find(startsAtFrom);
	const timeLogs = stored.timeLogs.map((link) => store.read(link.id));
	const timeSlot = { ...stored, timeLogs } as unknown as ITimeSlot;
	const notRunning = timeLogs.filter((timeLog) => !timeLog.isRunning);
	for (const timeLog of notRunning) {
		await store.execute(new DeleteTimeSpanCommand({ start: at(from), end: at(to) }, timeLog, timeSlot));
	}
}

/**
 * A slot deleted inside a log splits it. The log was shortened to the slot's start, then copied to make the part
 * after the slot, so the copy ran from the slot's end back to that start and was never saved: the time after the
 * slot was gone, its time slots left on the shortened log, outside its time.
 */
describe('DeleteTimeSpanHandler: deleting a time slot inside a log (real handlers over a scripted store)', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(SPAN_TENANT_ID);
	});

	afterEach(() => jest.restoreAllMocks());

	it('keeps the time before the slot on the log and the time after it on a copy, each with its slots', async () => {
		const store = new TimeSpanStore();
		store.addTimeLog('tracked', '10:00', '11:00');
		const log = store.read('tracked');
		const slot = log.timeSlots.find((timeSlot) => timeSlot.startedAt.getTime() === at('10:20').getTime());

		await store.execute(new DeleteTimeSpanCommand({ start: at('10:20'), end: at('10:30') }, log, slot));

		expect(store.shapes()).toEqual([
			['10:00', '10:20', ['10:00', '10:10']],
			['10:30', '11:00', ['10:30', '10:40', '10:50']]
		]);
	});
});

/**
 * A log can still hold a slot its time no longer reaches, when a cut's release missed it. Deleting that slot deleted it
 * whole, even when a running timer holds it too, which the time-slot delete otherwise never touches: the timer lost
 * the slot, with its screenshots and activity.
 */
describe('DeleteTimeSpanHandler: deleting a time slot its log no longer reaches (real handlers over a scripted store)', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(SPAN_TENANT_ID);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([
		{
			shape: 'a running timer holding it too keeps it',
			isRunning: true,
			shapes: [
				['10:00', '10:20', ['10:00', '10:10']],
				['10:25', '10:30', ['10:20']]
			]
		},
		{
			shape: 'CONTROL: it goes when the other log holding it is not running',
			isRunning: false,
			shapes: [['10:00', '10:20', ['10:00', '10:10']]]
		}
	])('$shape', async ({ isRunning, shapes }) => {
		const store = new TimeSpanStore();
		store.addTimeLog('cut', '10:00', '10:30');
		store.addTimeLog('other', '10:25', '10:30', { isRunning });
		const cut = store.timeLogs.find((timeLog) => timeLog.id === 'cut');
		cut.stoppedAt = at('10:20');

		await deleteTimeSlot(store, '10:20', '10:30');

		expect(store.shapes()).toEqual(shapes);
	});
});
