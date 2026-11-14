// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { TimeLogUpdateCommand } from '../time-log/commands';
import { SPAN_ORGANIZATION_ID, SPAN_TENANT_ID, TimeSpanStore } from '../testing/time-span-store';
import { TimerService } from './timer.service';

/**
 * Stopping a timer takes the stopped log's time out of the member's other logs that overlap it (another device's
 * timer, manual time saved meanwhile), through the real overlap handling over a scripted store. The overlap was
 * resolved once per time slot of the other log, each pass deleting the slot it was given: the other log lost every
 * slot and, with the last one, was deleted, and the slots it shared with the stopped log went with it.
 */

/** A timer stopped from the web, whose slots are written when it stops. */
const WEB_TIMER = { logType: TimeLogType.TRACKED, source: TimeLogSourceEnum.WEB_TIMER };

/** A manual entry, as the web and the Angular UI save one. */
const MANUAL_ENTRY = { logType: TimeLogType.MANUAL, source: TimeLogSourceEnum.WEB_TIMER };

function timerServiceOver(store: TimeSpanStore): TimerService {
	const commandBus = { execute: store.execute };
	return new TimerService(
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		commandBus as never,
		{} as never
	);
}

describe('TimerService: the logs a stopped timer overlaps', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(SPAN_TENANT_ID);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('an earlier log keeps its time before the stopped one, and the stopped one keeps its time slots', async () => {
		const store = new TimeSpanStore();
		store.addTimeLog('earlier', '10:00', '11:30');
		store.addTimeLog('stopped', '11:00', '12:00');
		const service = timerServiceOver(store);

		await service['handleConflictingTimeLogs'](store.read('stopped'), SPAN_TENANT_ID, SPAN_ORGANIZATION_ID);

		expect(store.shapes()).toEqual([
			['10:00', '11:00', ['10:00', '10:10', '10:20', '10:30', '10:40', '10:50']],
			['11:00', '12:00', ['11:00', '11:10', '11:20', '11:30', '11:40', '11:50']]
		]);
	});

	/**
	 * Saving the stopped log merged its slots with the entry's by summing both logs' time, and the entry then lost the
	 * shared time without its slots being counted again: they counted the overlap twice (2,040 seconds of slots for
	 * 1,819 seconds of logs, on a running API).
	 */
	it.each([
		{
			shape: 'over the end of the entry',
			entry: ['18:56', '19:26'],
			timer: ['19:06', '19:26'],
			timerToTheMillisecond: ['2026-11-02T19:06:14.967Z', '2026-11-02T19:26:20.047Z'],
			durations: [
				['18:50', 240],
				['19:00', 600],
				['19:10', 600],
				['19:20', 380]
			]
		},
		{
			shape: 'inside one ten-minute slot of the entry',
			entry: ['19:30', '19:33'],
			timer: ['19:31', '19:33'],
			timerToTheMillisecond: ['2026-11-02T19:31:39.510Z', '2026-11-02T19:33:42.632Z'],
			durations: [['19:30', 222]]
		}
	])('each slot a timer stopped $shape shares with it counts the time of both once', async (example) => {
		const store = new TimeSpanStore();
		const [entryStart, entryStop] = example.entry;
		const [timerStart, timerStop] = example.timer;
		const startedAt = new Date(example.timerToTheMillisecond[0]);
		const stoppedAt = new Date(example.timerToTheMillisecond[1]);
		store.addTimeLog('entry', entryStart, entryStop, MANUAL_ENTRY);
		store.addTimeLog('stopped', timerStart, timerStop, { ...WEB_TIMER, startedAt, stoppedAt });
		const service = timerServiceOver(store);

		await service['handleConflictingTimeLogs'](store.read('stopped'), SPAN_TENANT_ID, SPAN_ORGANIZATION_ID);

		expect(store.timeSlotDurations()).toEqual(example.durations);
	});

	/**
	 * A cut that fails ends the stop's overlap handling, which logs it and still answers the stopped log. The slots it
	 * shares with the logs cut before that one kept counting the time those logs no longer have.
	 */
	it('the slots a log cut before a failing cut shares with the stopped one count the time their logs keep', async () => {
		const store = new TimeSpanStore();
		store.addTimeLog('covered', '19:33', '19:34', MANUAL_ENTRY);
		store.addTimeLog('after', '19:35', '19:38', MANUAL_ENTRY);
		store.addTimeLog('stopped', '19:32', '19:36', WEB_TIMER);
		store.failOn(TimeLogUpdateCommand);
		const service = timerServiceOver(store);

		await service['handleConflictingTimeLogs'](store.read('stopped'), SPAN_TENANT_ID, SPAN_ORGANIZATION_ID);

		expect(store.shapes()).toEqual([
			['19:32', '19:36', ['19:30']],
			['19:35', '19:38', ['19:30']]
		]);
		expect(store.timeSlotDurations()).toEqual([['19:30', 420]]);
	});
});
