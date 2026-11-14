import { HttpStatus } from '@nestjs/common';
import * as moment from 'moment';
import { IOrganization, ITimeLog } from '@gauzy/contracts';
import { isTrackerSource } from '../time-log/tracker-source';

/** No timer runs, so there is no start to move. */
export const TIMER_NOT_RUNNING = 'TIMER_NOT_RUNNING';

/** The running log is the desktop app's or the agent's: they upload its slots themselves. */
export const TIMER_START_TRACKER_RUN = 'TIMER_START_TRACKER_RUN';

/** The new start is later than now. */
export const TIMER_START_IN_FUTURE = 'TIMER_START_IN_FUTURE';

/** The organization does not let its members change tracked time (`allowModifyTime`). */
export const TIMER_START_EDIT_NOT_ALLOWED = 'TIMER_START_EDIT_NOT_ALLOWED';

/** An earlier start adds time by hand, which the organization does not allow (`allowManualTime`). */
export const TIMER_START_MANUAL_NOT_ALLOWED = 'TIMER_START_MANUAL_NOT_ALLOWED';

/** The organization asks for a reason when tracked time changes (`requireReason`), and none was given. */
export const TIMER_START_REASON_REQUIRED = 'TIMER_START_REASON_REQUIRED';

/** The reason is longer than a time log keeps. */
export const TIMER_START_REASON_TOO_LONG = 'TIMER_START_REASON_TOO_LONG';

/** An earlier start overlaps another time entry of the same member. */
export const TIMER_START_OVERLAP = 'TIMER_START_OVERLAP';

/** Another call moved the run's start after this move was checked: the move is checked again from the new start. */
export const TIMER_START_CHANGED = 'TIMER_START_CHANGED';

/** The longest reason a time log keeps: its `reason` column is a 255-character string on MySQL. */
export const TIMER_START_REASON_MAX_LENGTH = 255;

/** Why a move of the running timer's start is refused, with the HTTP status that says so. */
export interface StartMoveRefusal {
	status: HttpStatus.BAD_REQUEST | HttpStatus.FORBIDDEN | HttpStatus.CONFLICT;
	code: string;
	message: string;
}

/** A move of the running timer's start, with what the rules read. */
export interface StartMoveRequest {
	/** The caller's running log, or nothing when no timer runs. */
	runningLog: Pick<ITimeLog, 'startedAt' | 'source'> | null | undefined;
	/** The start asked for. */
	requestedStart: Date;
	/** The moment of the request. */
	now: Date;
	/** The reason given, if any. */
	reason?: string | null;
	/** The time policy of the caller's organization. */
	organization:
		Partial<Pick<IOrganization, 'allowManualTime' | 'allowModifyTime' | 'requireReason'>> | null | undefined;
	/** A super admin, where the installation lets that role bypass the organization's time policy. */
	bypassesTimePolicy: boolean;
	/** Whether the caller's role may change tracked time (`ALLOW_MODIFY_TIME`). */
	roleMayModifyTime: boolean;
	/** Whether the caller's role may add time by hand (`ALLOW_MANUAL_TIME`). */
	roleMayAddTime: boolean;
}

/**
 * Whether the requested start is before the running log's start: the minutes in between are then added by hand.
 *
 * @param runningSince - The running log's start, as stored.
 * @param requestedStart - The start asked for.
 */
export function movesStartEarlier(runningSince: Date, requestedStart: Date): boolean {
	return moment.utc(requestedStart).isBefore(moment.utc(runningSince));
}

/**
 * The refusal of a move of the running timer's start, or null when the move may go ahead. The overlap with another
 * entry is checked apart, since it needs the member's other entries.
 *
 * The caller's role needs the permissions the manual time routes require, besides the organization's switches:
 * `ALLOW_MODIFY_TIME` for any move, and `ALLOW_MANUAL_TIME` for an earlier start. The time policy is the
 * organization's, read as the organization policy guard of the manual time routes reads it: a switch that is not on
 * refuses, and a super admin passes where the installation lets that role bypass it. The reason rule is a rule on the
 * data and holds for everyone.
 *
 * @param request - The move, with the running log, the caller's role and the organization's policy.
 */
export function startMoveRefusal(request: StartMoveRequest): StartMoveRefusal | null {
	const { runningLog, requestedStart, now, organization, bypassesTimePolicy } = request;

	if (!runningLog) {
		return {
			status: HttpStatus.BAD_REQUEST,
			code: TIMER_NOT_RUNNING,
			message: 'No timer is running, so there is no start to move.'
		};
	}

	if (isTrackerSource(runningLog.source)) {
		return {
			status: HttpStatus.CONFLICT,
			code: TIMER_START_TRACKER_RUN,
			message:
				'This timer runs in the desktop app or the agent, which record its time themselves. Change its start there.'
		};
	}

	const startsInTheFuture = moment.utc(requestedStart).isAfter(moment.utc(now));
	if (startsInTheFuture) {
		return {
			status: HttpStatus.BAD_REQUEST,
			code: TIMER_START_IN_FUTURE,
			message: 'The start cannot be later than now.'
		};
	}

	if (!request.roleMayModifyTime) {
		return {
			status: HttpStatus.FORBIDDEN,
			code: TIMER_START_EDIT_NOT_ALLOWED,
			message: 'Your role does not allow changing tracked time.'
		};
	}

	const policyApplies = !bypassesTimePolicy;
	const mayChangeTrackedTime = organization?.allowModifyTime === true;
	if (policyApplies && !mayChangeTrackedTime) {
		return {
			status: HttpStatus.FORBIDDEN,
			code: TIMER_START_EDIT_NOT_ALLOWED,
			message: 'Your organization does not allow changing tracked time.'
		};
	}

	const addsTimeByHand = movesStartEarlier(runningLog.startedAt, requestedStart);
	const roleRefusesAddedTime = addsTimeByHand && !request.roleMayAddTime;
	if (roleRefusesAddedTime) {
		return {
			status: HttpStatus.FORBIDDEN,
			code: TIMER_START_MANUAL_NOT_ALLOWED,
			message: 'Your role does not allow adding time by hand, so the start can only move later.'
		};
	}

	const mayAddTimeByHand = organization?.allowManualTime === true;
	const refusesAddedTime = policyApplies && addsTimeByHand && !mayAddTimeByHand;
	if (refusesAddedTime) {
		return {
			status: HttpStatus.FORBIDDEN,
			code: TIMER_START_MANUAL_NOT_ALLOWED,
			message: 'Your organization does not allow adding time by hand, so the start can only move later.'
		};
	}

	const reason = (request.reason ?? '').trim();
	const missesRequiredReason = organization?.requireReason === true && reason.length === 0;
	if (missesRequiredReason) {
		return {
			status: HttpStatus.BAD_REQUEST,
			code: TIMER_START_REASON_REQUIRED,
			message: 'Your organization asks for a reason when tracked time changes.'
		};
	}

	if (reason.length > TIMER_START_REASON_MAX_LENGTH) {
		return {
			status: HttpStatus.BAD_REQUEST,
			code: TIMER_START_REASON_TOO_LONG,
			message: `The reason can hold at most ${TIMER_START_REASON_MAX_LENGTH} characters.`
		};
	}

	return null;
}
