import { IOrganization } from '@gauzy/contracts';

/** The organization does not let its members discard a running timer. */
export const TIMER_DISCARD_DISABLED = 'TIMER_DISCARD_DISABLED';

/** The run started longer ago than the organization lets a run be discarded. */
export const TIMER_DISCARD_TOO_LATE = 'TIMER_DISCARD_TOO_LATE';

/** Why a discard is refused: a code a client can translate, and the message the API answers with it. */
export interface ITimerDiscardRefusal {
	code: typeof TIMER_DISCARD_DISABLED | typeof TIMER_DISCARD_TOO_LATE;
	message: string;
}

/** The organization settings a discard depends on. */
export type TimerDiscardSettings = Pick<IOrganization, 'allowDiscardTimer' | 'discardTimerWithinMinutes'>;

const MILLISECONDS_PER_MINUTE = 60 * 1000;

/**
 * The refusal of an organization that turned discarding off, or null when its members may discard. Only an explicit
 * `false` turns it off: the switch is on by default, and a null value counts as on.
 *
 * @param settings The organization's settings, if known.
 */
export function discardDisabledRefusal(settings: TimerDiscardSettings | null | undefined): ITimerDiscardRefusal | null {
	const isTurnedOff = settings?.allowDiscardTimer === false;
	if (!isTurnedOff) {
		return null;
	}
	return {
		code: TIMER_DISCARD_DISABLED,
		message: 'Discarding a running timer is turned off in this organization. Stop the timer to end the run.'
	};
}

/**
 * The refusal of a run that started too long ago to be discarded, or null when it may still be: the organization sets
 * no limit (null, or a value that is not a positive number of minutes), or the run started less than that many
 * minutes before `now`.
 *
 * @param settings The organization's settings, if known.
 * @param startedAt When the running timer started.
 * @param now The server's current time.
 */
export function discardTooLateRefusal(
	settings: TimerDiscardSettings | null | undefined,
	startedAt: Date,
	now: Date
): ITimerDiscardRefusal | null {
	const limitMinutes = Number(settings?.discardTimerWithinMinutes);
	const hasLimit = Number.isFinite(limitMinutes) && limitMinutes > 0;
	if (!hasLimit) {
		return null;
	}

	const runningFor = now.getTime() - new Date(startedAt).getTime();
	const isWithinLimit = runningFor < limitMinutes * MILLISECONDS_PER_MINUTE;
	if (isWithinLimit) {
		return null;
	}
	return {
		code: TIMER_DISCARD_TOO_LATE,
		message: `This timer can only be discarded within ${limitMinutes} ${minuteUnit(limitMinutes)} of its start.`
	};
}

/** The unit after a number of minutes. */
function minuteUnit(minutes: number): string {
	if (minutes === 1) {
		return 'minute';
	}
	return 'minutes';
}
