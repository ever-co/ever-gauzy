import { HttpStatus } from '@nestjs/common';
import * as moment from 'moment';
import { IOrganization, ITimeLog, TimeLogType, TimesheetStatus } from '@gauzy/contracts';
import { generateTimeSlots } from '../time-slot/utils';

/** The log's timer still runs: it still records into the log. */
export const TIME_LOG_SPLIT_RUNNING = 'TIME_LOG_SPLIT_RUNNING';

/** The day of the log is on an approved timesheet. */
export const TIME_LOG_SPLIT_APPROVED = 'TIME_LOG_SPLIT_APPROVED';

/** An invoice that is neither void nor a rejected estimate bills the log. */
export const TIME_LOG_SPLIT_INVOICED = 'TIME_LOG_SPLIT_INVOICED';

/** The split time is not inside the log. */
export const TIME_LOG_SPLIT_OUTSIDE = 'TIME_LOG_SPLIT_OUTSIDE';

/** One of the two parts would be shorter than a minute. */
export const TIME_LOG_SPLIT_TOO_SHORT = 'TIME_LOG_SPLIT_TOO_SHORT';

/** The log holds tracked time slots, and the split time is not one of their boundaries. */
export const TIME_LOG_SPLIT_OFF_BOUNDARY = 'TIME_LOG_SPLIT_OFF_BOUNDARY';

/** The organization asks for a reason when time changes (`requireReason`), and none was given. */
export const TIME_LOG_SPLIT_REASON_REQUIRED = 'TIME_LOG_SPLIT_REASON_REQUIRED';

/** The reason is longer than a time log keeps. */
export const TIME_LOG_SPLIT_REASON_TOO_LONG = 'TIME_LOG_SPLIT_REASON_TOO_LONG';

/** A break names a task, a project or billable time for its second part, which a break never has. */
export const TIME_LOG_SPLIT_BREAK_FIELDS = 'TIME_LOG_SPLIT_BREAK_FIELDS';

/** The log changed between the checks and the split (another split, an edit, a delete): nothing was written. */
export const TIME_LOG_SPLIT_CHANGED = 'TIME_LOG_SPLIT_CHANGED';

/** The shortest part a split leaves. */
export const TIME_LOG_SPLIT_MIN_PART_SECONDS = 60;

/** The longest reason a time log keeps: its `reason` column is a 255-character string on MySQL. */
export const TIME_LOG_SPLIT_REASON_MAX_LENGTH = 255;

/** Why a split is refused, with the HTTP status that says so and, off a boundary, the two nearest ones. */
export interface SplitRefusal {
	status: HttpStatus.BAD_REQUEST | HttpStatus.FORBIDDEN;
	code: string;
	message: string;
	/** Off a boundary: the nearest slot boundaries before and after the time asked for that split the log. */
	before?: string | null;
	after?: string | null;
}

/** The fields of the second part that a break never has. */
export interface SplitSecondPartFields {
	taskId?: unknown;
	projectId?: unknown;
	isBillable?: boolean;
}

/** A split, with what the rules read. */
export interface SplitRequest {
	log: Pick<ITimeLog, 'startedAt' | 'stoppedAt' | 'isRunning' | 'logType'>;
	splitAt: Date;
	/** Whether the log holds time slots: its split then falls on a slot boundary, unless it is manual time. */
	holdsTimeSlots: boolean;
	/** The status of the timesheet the log is on, if it is on one. */
	timesheetStatus?: TimesheetStatus | string | null;
	/** Whether a live invoice bills the log. */
	isInvoiced: boolean;
	/** The organization's time policy. */
	organization: Partial<Pick<IOrganization, 'requireReason'>> | null | undefined;
	reason?: string | null;
	secondPart: SplitSecondPartFields;
}

/** The ten minutes of a time slot. */
const SLOT_MINUTES = 10;

/**
 * The slot boundary at or before `at`: the start of the ten-minute slot holding it, as the time-slot helper computes
 * a log's slots, at its whole minute.
 *
 * @param at - A moment.
 */
export function slotBoundaryAtOrBefore(at: Date): Date {
	const until = moment(at).add(1, 'minute').toDate();
	const [slot] = generateTimeSlots(at, until);
	return moment(slot.startedAt).startOf('minute').toDate();
}

/**
 * Whether a moment is a slot boundary: the start of a ten-minute slot, at a whole minute with no seconds.
 *
 * @param at - A moment.
 */
export function isSlotBoundary(at: Date): boolean {
	return slotBoundaryAtOrBefore(at).getTime() === new Date(at).getTime();
}

/**
 * Whether a split at `at` leaves both parts of the log at least a minute long.
 *
 * @param log - The log's range.
 * @param at - The split time.
 */
function leavesBothParts(log: Pick<ITimeLog, 'startedAt' | 'stoppedAt'>, at: Date): boolean {
	const firstSeconds = moment(at).diff(moment(log.startedAt), 'seconds');
	const secondSeconds = moment(log.stoppedAt).diff(moment(at), 'seconds');
	const firstIsLongEnough = firstSeconds >= TIME_LOG_SPLIT_MIN_PART_SECONDS;
	const secondIsLongEnough = secondSeconds >= TIME_LOG_SPLIT_MIN_PART_SECONDS;
	return firstIsLongEnough && secondIsLongEnough;
}

/**
 * The slot boundaries nearest to `at` that split the log, one before and one after (`null` where there is none), as
 * ISO strings a client can offer.
 *
 * @param log - The log's range.
 * @param at - The split time asked for, off a boundary.
 */
export function nearestSplitBoundaries(
	log: Pick<ITimeLog, 'startedAt' | 'stoppedAt'>,
	at: Date
): { before: string | null; after: string | null } {
	const before = slotBoundaryAtOrBefore(at);
	const after = moment(before).add(SLOT_MINUTES, 'minutes').toDate();
	const beforeSplitsLog = leavesBothParts(log, before);
	const afterSplitsLog = leavesBothParts(log, after);
	let beforeValue: string | null = null;
	if (beforeSplitsLog) {
		beforeValue = before.toISOString();
	}
	let afterValue: string | null = null;
	if (afterSplitsLog) {
		afterValue = after.toISOString();
	}
	return { before: beforeValue, after: afterValue };
}

/**
 * Whether the log's split must fall on a slot boundary: it holds time slots carrying its tracked time. Manual time and
 * breaks split at any minute; a manual log's blank slots follow its time as the internal split already shares them.
 *
 * @param log - The log.
 * @param holdsTimeSlots - Whether the log holds time slots.
 */
export function splitsOnSlotBoundary(log: Pick<ITimeLog, 'logType'>, holdsTimeSlots: boolean): boolean {
	const isManual = log.logType === TimeLogType.MANUAL;
	const isBreak = log.logType === TimeLogType.BREAK;
	return holdsTimeSlots && !isManual && !isBreak;
}

/**
 * The refusal of a split, or null when it may go ahead. The caller's right to change the log (`ALLOW_MODIFY_TIME`,
 * the organization's policy, their own log or a member's they manage) is checked before, by the route's guards and
 * the service; these are the rules on the log and on the request.
 *
 * @param request - The split, with the log and what the rules read.
 */
export function splitRefusal(request: SplitRequest): SplitRefusal | null {
	const { log, splitAt, organization, secondPart } = request;

	if (log.isRunning) {
		return {
			status: HttpStatus.FORBIDDEN,
			code: TIME_LOG_SPLIT_RUNNING,
			message: 'This entry is still running. Stop the timer before splitting it.'
		};
	}

	if (request.timesheetStatus === TimesheetStatus.APPROVED) {
		return {
			status: HttpStatus.FORBIDDEN,
			code: TIME_LOG_SPLIT_APPROVED,
			message: 'This entry is on an approved timesheet, so it can no longer be split.'
		};
	}

	if (request.isInvoiced) {
		return {
			status: HttpStatus.FORBIDDEN,
			code: TIME_LOG_SPLIT_INVOICED,
			message: 'An invoice bills this entry, so it can no longer be split.'
		};
	}

	const isAfterStart = moment(splitAt).isAfter(moment(log.startedAt));
	const isBeforeEnd = moment(splitAt).isBefore(moment(log.stoppedAt));
	const isInsideLog = isAfterStart && isBeforeEnd;
	if (!isInsideLog) {
		return {
			status: HttpStatus.BAD_REQUEST,
			code: TIME_LOG_SPLIT_OUTSIDE,
			message: 'The split time must fall between the start and the end of the entry.'
		};
	}

	if (!leavesBothParts(log, splitAt)) {
		return {
			status: HttpStatus.BAD_REQUEST,
			code: TIME_LOG_SPLIT_TOO_SHORT,
			message: 'Each part of a split must last at least a minute.'
		};
	}

	const needsBoundary = splitsOnSlotBoundary(log, request.holdsTimeSlots);
	const isOffBoundary = needsBoundary && !isSlotBoundary(splitAt);
	if (isOffBoundary) {
		const { before, after } = nearestSplitBoundaries(log, splitAt);
		return {
			status: HttpStatus.BAD_REQUEST,
			code: TIME_LOG_SPLIT_OFF_BOUNDARY,
			message:
				'Tracked time is split on its ten-minute slots, so that each slot goes whole, with its screenshots and activity, to one part.',
			before,
			after
		};
	}

	const isBreak = log.logType === TimeLogType.BREAK;
	const namesWorkFields = secondPart.taskId != null || secondPart.projectId != null || secondPart.isBillable === true;
	if (isBreak && namesWorkFields) {
		return {
			status: HttpStatus.BAD_REQUEST,
			code: TIME_LOG_SPLIT_BREAK_FIELDS,
			message: 'A break has no task, project or billable time.'
		};
	}

	const reason = (request.reason ?? '').trim();
	const missesRequiredReason = organization?.requireReason === true && reason.length === 0;
	if (missesRequiredReason) {
		return {
			status: HttpStatus.BAD_REQUEST,
			code: TIME_LOG_SPLIT_REASON_REQUIRED,
			message: 'Your organization asks for a reason when time changes.'
		};
	}

	if (reason.length > TIME_LOG_SPLIT_REASON_MAX_LENGTH) {
		return {
			status: HttpStatus.BAD_REQUEST,
			code: TIME_LOG_SPLIT_REASON_TOO_LONG,
			message: `The reason can hold at most ${TIME_LOG_SPLIT_REASON_MAX_LENGTH} characters.`
		};
	}

	return null;
}
