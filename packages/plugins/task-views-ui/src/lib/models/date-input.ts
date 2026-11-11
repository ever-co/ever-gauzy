/**
 * Dates of the filter editor: a day picked in a date field (`2026-11-20`, local) and the instant a condition holds
 * (ISO), as the platform compares them: "after" (`>= from`) and the lower bound of "between" are the start of the
 * day; "before" (`< to`) is the start of its day (before that day); the upper bound of "between" (`<= to`) is the
 * last instant of its day, so the last day picked is included and the next one is not.
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
