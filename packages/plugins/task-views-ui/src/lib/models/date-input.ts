import { ITaskViewFilterCondition } from '@gauzy/contracts';

/**
 * Dates of the filter editor: a day picked in a date field (`2026-11-20`, local) and the instant a condition holds
 * (ISO), as the platform compares them: "after" (`>= from`) and the lower bound of "between" are the start of the
 * day; "before" (`< to`) is the start of its day (before that day); the upper bound of "between" (`<= to`) is the
 * last instant of its day, so the last day picked is included and the next one is not.
 *
 * A bound also carries the day itself (`fromDay` / `toDay`): a due date stored as a date only (midnight UTC of its
 * day) is compared with the day, not the instant, so west of UTC it is not taken for the day before.
 */

export type BoundKind = 'from' | 'before' | 'until';

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The instant a picked day stands for as a bound, or null for an empty or malformed field. */
export function instantOfDay(value: string | null | undefined, kind: BoundKind): string | null {
	const match = DAY.exec(String(value ?? '').trim());
	if (!match) return null;
	const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
	const date =
		kind === 'until' ? new Date(year, month, day, 23, 59, 59, 999) : new Date(year, month, day, 0, 0, 0, 0);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString();
}

/** The day a bound shows in a date field (`2026-11-20`), or an empty string. */
export function dayOfInstant(instant: string | null | undefined, _kind: BoundKind): string {
	if (!instant) return '';
	const time = Date.parse(instant);
	if (!Number.isFinite(time)) return '';
	const date = new Date(time);
	const pad = (value: number) => String(value).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** What a picked day sends as a bound: its instant in the reader's zone and the calendar day itself. */
export interface DayBound {
	instant: string;
	day: string;
}

/** The bound a picked day makes, or null for an empty or malformed field. */
export function boundOfDay(value: string | null | undefined, kind: BoundKind): DayBound | null {
	const instant = instantOfDay(value, kind);
	// The day of the instant built, not the text typed: `2026-02-30` would name a day the instant is not on.
	return instant ? { instant, day: dayOfInstant(instant, kind) } : null;
}

/** The day a condition's bound shows: the day it was picked as, else the reader's day of its instant (older views). */
export function dayOfBound(condition: ITaskViewFilterCondition, bound: 'from' | 'to', kind: BoundKind): string {
	const day = bound === 'from' ? condition.fromDay : condition.toDay;
	return day && DAY.test(day) ? day : dayOfInstant(bound === 'from' ? condition.from : condition.to, kind);
}
