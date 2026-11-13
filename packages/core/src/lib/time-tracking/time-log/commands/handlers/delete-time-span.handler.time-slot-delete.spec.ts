// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { RequestContext } from '../../../../core/context';
import { at, SPAN_TENANT_ID, TimeSpanStore } from '../../../testing/time-span-store';
import { DeleteTimeSpanCommand } from '../delete-time-span.command';

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
