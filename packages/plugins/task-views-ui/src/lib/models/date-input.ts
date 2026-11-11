/**
 * Dates of the filter editor: a day picked in a date field (`2026-11-20`, local) and the instant a condition holds
 * (ISO). A lower bound is the start of its day; an upper bound of "before" is the start of its day (before that day);
 * the upper bound of "between" is the start of the day after (the last day included).
 */

export type BoundKind = 'from' | 'before' | 'until';

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The instant a picked day stands for as a bound, or null for an empty or malformed field. */
export function instantOfDay(value: string | null | undefined, kind: BoundKind): string | null {
	const match = DAY.exec(String(value ?? '').trim());
	if (!match) return null;
	const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
	const date = new Date(year, month, day + (kind === 'until' ? 1 : 0), 0, 0, 0, 0);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString();
}

/** The day a bound shows in a date field (`2026-11-20`), or an empty string. */
export function dayOfInstant(instant: string | null | undefined, kind: BoundKind): string {
	if (!instant) return '';
	const time = Date.parse(instant);
	if (!Number.isFinite(time)) return '';
	const date = new Date(time);
	if (kind === 'until') date.setDate(date.getDate() - 1);
	const pad = (value: number) => String(value).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
