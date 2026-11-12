// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { RequestContext } from '../../core/context';
import { SPAN_ORGANIZATION_ID, SPAN_TENANT_ID, TimeSpanStore } from '../testing/time-span-store';
import { TimerService } from './timer.service';

/**
 * Stopping a timer takes the stopped log's time out of the member's other logs that overlap it (another device's
 * timer, manual time saved meanwhile), through the real overlap handling over a scripted store. The overlap was
 * resolved once per time slot of the other log, each pass deleting the slot it was given: the other log lost every
 * slot and, with the last one, was deleted, and the slots it shared with the stopped log went with it.
 */
describe('TimerService — the logs a stopped timer overlaps', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(SPAN_TENANT_ID);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('an earlier log keeps its time before the stopped one, and the stopped one keeps its time slots', async () => {
		const store = new TimeSpanStore();
		store.addTimeLog('earlier', '10:00', '11:30');
		store.addTimeLog('stopped', '11:00', '12:00');
		const commandBus = { execute: store.execute };
		const service = new TimerService(
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			{} as never,
			commandBus as never,
			{} as never
		);

		await service['handleConflictingTimeLogs'](store.read('stopped'), SPAN_TENANT_ID, SPAN_ORGANIZATION_ID);

		expect(store.shapes()).toEqual([
			['10:00', '11:00', ['10:00', '10:10', '10:20', '10:30', '10:40', '10:50']],
			['11:00', '12:00', ['11:00', '11:10', '11:20', '11:30', '11:40', '11:50']]
		]);
	});
});
