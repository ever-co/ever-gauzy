import { HttpStatus } from '@nestjs/common';
import { TimeLogType, TimesheetStatus } from '@gauzy/contracts';
import {
	isSlotBoundary,
	nearestSplitBoundaries,
	splitRefusal,
	splitsOnSlotBoundary,
	SplitRequest,
	TIME_LOG_SPLIT_APPROVED,
	TIME_LOG_SPLIT_BREAK_FIELDS,
	TIME_LOG_SPLIT_INVOICED,
	TIME_LOG_SPLIT_OFF_BOUNDARY,
	TIME_LOG_SPLIT_OUTSIDE,
	TIME_LOG_SPLIT_REASON_REQUIRED,
	TIME_LOG_SPLIT_REASON_TOO_LONG,
	TIME_LOG_SPLIT_RUNNING,
	TIME_LOG_SPLIT_TOO_SHORT
} from './time-log-split-rule';

/** 2026-11-16 at `time` (`HH:mm` or `HH:mm:ss.SSS`), UTC. */
const at = (time: string) => new Date(`2026-11-16T${time.length === 5 ? `${time}:00.000` : time}Z`);

/** Marie's tracked log from 9:00 to 13:00, stopped, on a draft timesheet, billed by nothing. */
function request(changes: Partial<SplitRequest> = {}): SplitRequest {
	return {
		log: { startedAt: at('09:00'), stoppedAt: at('13:00'), isRunning: false, logType: TimeLogType.TRACKED },
		splitAt: at('11:00'),
		holdsTimeSlots: true,
		timesheetStatus: TimesheetStatus.DRAFT,
		isInvoiced: false,
		organization: { requireReason: false },
		reason: null,
		secondPart: {},
		...changes
	};
}

describe('time log split rule (CORE-26)', () => {
	it('lets a tracked log split on a slot boundary', () => {
		expect(splitRefusal(request())).toBeNull();
	});

	it('refuses a split off a slot boundary, naming the two nearest ones', () => {
		expect(splitRefusal(request({ splitAt: at('11:05') }))).toEqual({
			status: HttpStatus.BAD_REQUEST,
			code: TIME_LOG_SPLIT_OFF_BOUNDARY,
			message: expect.any(String),
			before: at('11:00').toISOString(),
			after: at('11:10').toISOString()
		});
	});

	it('refuses a split a few seconds off a slot boundary', () => {
		expect(splitRefusal(request({ splitAt: at('11:00:30.000') }))?.code).toBe(TIME_LOG_SPLIT_OFF_BOUNDARY);
	});

	it('names only the nearest boundaries that leave both parts a minute long', () => {
		const log = { startedAt: at('09:00'), stoppedAt: at('09:15') };

		expect(nearestSplitBoundaries(log, at('09:05'))).toEqual({ before: null, after: at('09:10').toISOString() });
	});

	it('lets a manual log split at any minute, its blank slots going as the internal split shares them', () => {
		const manual = { ...request().log, logType: TimeLogType.MANUAL };

		expect(splitRefusal(request({ log: manual, splitAt: at('11:05') }))).toBeNull();
	});

	it('lets a log holding no slot split at any minute', () => {
		expect(splitRefusal(request({ holdsTimeSlots: false, splitAt: at('11:05') }))).toBeNull();
	});

	it.each([
		['the start', '09:00'],
		['the end', '13:00'],
		['before the start', '08:00'],
		['after the end', '14:00']
	])('refuses a split at %s of the log', (_where, time) => {
		expect(splitRefusal(request({ splitAt: at(time) }))?.code).toBe(TIME_LOG_SPLIT_OUTSIDE);
	});

	it('refuses a split that leaves a part shorter than a minute', () => {
		const manual = { ...request().log, logType: TimeLogType.MANUAL };

		expect(splitRefusal(request({ log: manual, splitAt: at('12:59:30.000') }))?.code).toBe(
			TIME_LOG_SPLIT_TOO_SHORT
		);
	});

	it('refuses to split a running log', () => {
		const running = { ...request().log, isRunning: true };

		expect(splitRefusal(request({ log: running }))).toMatchObject({
			status: HttpStatus.FORBIDDEN,
			code: TIME_LOG_SPLIT_RUNNING
		});
	});

	it('refuses to split a log on an approved timesheet', () => {
		expect(splitRefusal(request({ timesheetStatus: TimesheetStatus.APPROVED }))).toMatchObject({
			status: HttpStatus.FORBIDDEN,
			code: TIME_LOG_SPLIT_APPROVED
		});
	});

	it('refuses to split a log a live invoice bills', () => {
		expect(splitRefusal(request({ isInvoiced: true }))).toMatchObject({
			status: HttpStatus.FORBIDDEN,
			code: TIME_LOG_SPLIT_INVOICED
		});
	});

	it('asks for a reason where the organization requires one', () => {
		const organization = { requireReason: true };

		expect(splitRefusal(request({ organization, reason: '  ' }))?.code).toBe(TIME_LOG_SPLIT_REASON_REQUIRED);
		expect(splitRefusal(request({ organization, reason: 'Switched to the checkout bug' }))).toBeNull();
	});

	it('refuses a reason longer than a time log keeps', () => {
		expect(splitRefusal(request({ reason: 'x'.repeat(256) }))?.code).toBe(TIME_LOG_SPLIT_REASON_TOO_LONG);
	});

	it('refuses a task, a project or billable time on the second part of a break', () => {
		const breakLog = { ...request().log, logType: TimeLogType.BREAK };

		expect(splitRefusal(request({ log: breakLog, secondPart: { taskId: 'task' } }))?.code).toBe(
			TIME_LOG_SPLIT_BREAK_FIELDS
		);
		expect(splitRefusal(request({ log: breakLog, secondPart: { description: 'Lunch' } as never }))).toBeNull();
	});

	it('checks the running state before the time asked for', () => {
		const running = { ...request().log, isRunning: true };

		expect(splitRefusal(request({ log: running, splitAt: at('11:05') }))?.code).toBe(TIME_LOG_SPLIT_RUNNING);
	});

	it.each([
		['11:00', true],
		['11:10', true],
		['11:05', false],
		['11:00:00.001', false]
	])('reads %s as a slot boundary: %s', (time, expected) => {
		expect(isSlotBoundary(at(time))).toBe(expected);
	});

	it('asks a boundary of tracked time only', () => {
		expect(splitsOnSlotBoundary({ logType: TimeLogType.TRACKED }, true)).toBe(true);
		expect(splitsOnSlotBoundary({ logType: TimeLogType.MANUAL }, true)).toBe(false);
		expect(splitsOnSlotBoundary({ logType: TimeLogType.TRACKED }, false)).toBe(false);
	});
});
