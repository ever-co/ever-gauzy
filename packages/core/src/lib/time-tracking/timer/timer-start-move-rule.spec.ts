import { HttpStatus } from '@nestjs/common';
import { TimeLogSourceEnum } from '@gauzy/contracts';
import {
	StartMoveRequest,
	TIMER_NOT_RUNNING,
	TIMER_START_EDIT_NOT_ALLOWED,
	TIMER_START_IN_FUTURE,
	TIMER_START_MANUAL_NOT_ALLOWED,
	TIMER_START_REASON_MAX_LENGTH,
	TIMER_START_REASON_REQUIRED,
	TIMER_START_REASON_TOO_LONG,
	TIMER_START_TRACKER_RUN,
	movesStartEarlier,
	startMoveRefusal
} from './timer-start-move-rule';

/** Marie's timer, started at 9:25 from Ever Teams; it is 10:00 now. */
const NOW = new Date('2026-11-16T10:00:00.000Z');
const RUNNING_SINCE = new Date('2026-11-16T09:25:00.000Z');
const EARLIER = new Date('2026-11-16T09:00:00.000Z');
const LATER = new Date('2026-11-16T09:40:00.000Z');

const openOrganization = { allowManualTime: true, allowModifyTime: true, requireReason: false };

/** A role holding both permissions the manual time routes require. */
const fullRole = { roleMayModifyTime: true, roleMayAddTime: true };

function request(overrides: Partial<StartMoveRequest> = {}): StartMoveRequest {
	return {
		...fullRole,
		runningLog: { startedAt: RUNNING_SINCE, source: TimeLogSourceEnum.TEAMS },
		requestedStart: EARLIER,
		now: NOW,
		reason: undefined,
		organization: openOrganization,
		bypassesTimePolicy: false,
		...overrides
	};
}

describe('startMoveRefusal', () => {
	it('accepts an earlier and a later start in an organization that allows both', () => {
		expect(startMoveRefusal(request({ requestedStart: EARLIER }))).toBeNull();
		expect(startMoveRefusal(request({ requestedStart: LATER }))).toBeNull();
	});

	it('accepts a start at the very moment of the request', () => {
		expect(startMoveRefusal(request({ requestedStart: NOW }))).toBeNull();
	});

	it('refuses with 400 when no timer runs', () => {
		expect(startMoveRefusal(request({ runningLog: null }))).toMatchObject({
			status: HttpStatus.BAD_REQUEST,
			code: TIMER_NOT_RUNNING
		});
	});

	it('refuses with 409 a run of the desktop app or the agent, which upload their own slots', () => {
		const desktopRun = { startedAt: RUNNING_SINCE, source: TimeLogSourceEnum.DESKTOP };

		expect(startMoveRefusal(request({ runningLog: desktopRun }))).toMatchObject({
			status: HttpStatus.CONFLICT,
			code: TIMER_START_TRACKER_RUN
		});
	});

	it('refuses with 400 a start later than now', () => {
		const inOneSecond = new Date(NOW.getTime() + 1000);

		expect(startMoveRefusal(request({ requestedStart: inOneSecond }))).toMatchObject({
			status: HttpStatus.BAD_REQUEST,
			code: TIMER_START_IN_FUTURE
		});
	});

	it('refuses with 403 any move where the organization does not allow changing tracked time', () => {
		const organization = { ...openOrganization, allowModifyTime: false };
		const refusal = { status: HttpStatus.FORBIDDEN, code: TIMER_START_EDIT_NOT_ALLOWED };

		expect(startMoveRefusal(request({ organization, requestedStart: EARLIER }))).toMatchObject(refusal);
		expect(startMoveRefusal(request({ organization, requestedStart: LATER }))).toMatchObject(refusal);
	});

	it('refuses with 403 any move when the role may not change tracked time (ALLOW_MODIFY_TIME)', () => {
		const refusal = { status: HttpStatus.FORBIDDEN, code: TIMER_START_EDIT_NOT_ALLOWED };

		expect(startMoveRefusal(request({ roleMayModifyTime: false, requestedStart: EARLIER }))).toMatchObject(refusal);
		expect(startMoveRefusal(request({ roleMayModifyTime: false, requestedStart: LATER }))).toMatchObject(refusal);
	});

	it('refuses an earlier start when the role may not add time by hand (ALLOW_MANUAL_TIME), and lets a later one through', () => {
		expect(startMoveRefusal(request({ roleMayAddTime: false, requestedStart: EARLIER }))).toMatchObject({
			status: HttpStatus.FORBIDDEN,
			code: TIMER_START_MANUAL_NOT_ALLOWED
		});
		expect(startMoveRefusal(request({ roleMayAddTime: false, requestedStart: LATER }))).toBeNull();
	});

	it('refuses an organization whose time policy is unset, as the organization policy guard does', () => {
		expect(startMoveRefusal(request({ organization: null }))).toMatchObject({ code: TIMER_START_EDIT_NOT_ALLOWED });
		expect(startMoveRefusal(request({ organization: {} }))).toMatchObject({ code: TIMER_START_EDIT_NOT_ALLOWED });
	});

	it('refuses with 403 an earlier start where the organization does not allow manual time, and lets a later one through', () => {
		const organization = { ...openOrganization, allowManualTime: false };

		expect(startMoveRefusal(request({ organization, requestedStart: EARLIER }))).toMatchObject({
			status: HttpStatus.FORBIDDEN,
			code: TIMER_START_MANUAL_NOT_ALLOWED
		});
		expect(startMoveRefusal(request({ organization, requestedStart: LATER }))).toBeNull();
	});

	it('asks for a reason where the organization requires one, a blank reason included', () => {
		const organization = { ...openOrganization, requireReason: true };
		const refusal = { status: HttpStatus.BAD_REQUEST, code: TIMER_START_REASON_REQUIRED };

		expect(startMoveRefusal(request({ organization }))).toMatchObject(refusal);
		expect(startMoveRefusal(request({ organization, reason: '   ' }))).toMatchObject(refusal);
		expect(startMoveRefusal(request({ organization, reason: 'Forgot to start timer' }))).toBeNull();
	});

	it('refuses a reason longer than a time log keeps', () => {
		const reason = 'x'.repeat(TIMER_START_REASON_MAX_LENGTH + 1);

		expect(startMoveRefusal(request({ reason }))).toMatchObject({
			status: HttpStatus.BAD_REQUEST,
			code: TIMER_START_REASON_TOO_LONG
		});
		expect(startMoveRefusal(request({ reason: 'x'.repeat(TIMER_START_REASON_MAX_LENGTH) }))).toBeNull();
	});

	it('lets a super admin who may bypass the organization policy move the start, still asking for the reason', () => {
		const closed = { allowManualTime: false, allowModifyTime: false, requireReason: true };

		expect(startMoveRefusal(request({ organization: closed, bypassesTimePolicy: true }))).toMatchObject({
			code: TIMER_START_REASON_REQUIRED
		});
		expect(
			startMoveRefusal(request({ organization: closed, bypassesTimePolicy: true, reason: 'Late start' }))
		).toBeNull();
	});

	it('names every refusal with a message a person can read', () => {
		const refusal = startMoveRefusal(request({ runningLog: null }));

		expect(refusal?.message).toMatch(/no timer is running/i);
	});
});

describe('movesStartEarlier', () => {
	it('tells an earlier start from a later or an equal one', () => {
		expect(movesStartEarlier(RUNNING_SINCE, EARLIER)).toBe(true);
		expect(movesStartEarlier(RUNNING_SINCE, LATER)).toBe(false);
		expect(movesStartEarlier(RUNNING_SINCE, new Date(RUNNING_SINCE))).toBe(false);
	});

	it('reads a start stored as a string, as SQLite answers it', () => {
		expect(movesStartEarlier('2026-11-16 09:25:00' as unknown as Date, EARLIER)).toBe(true);
	});
});
