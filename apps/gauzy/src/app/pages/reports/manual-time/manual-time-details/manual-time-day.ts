import moment from 'moment-timezone';
import { ITimeLog, TimeFormatEnum, TimeLogType } from '@gauzy/contracts';

/** Minutes in a day without a clock change; a day the clocks change on is 23 or 25 hours long (`minutes`). */
export const MINUTES_PER_DAY = 24 * 60;

/** How a stretch of the day was logged. The entry the dialog is about is drawn on its own. */
export type ManualTimeDaySegmentKind = 'tracked' | 'manual' | 'current';

/** One time log on the day timeline, as a span of the day in the report's time zone. */
export interface IManualTimeDaySegment {
	readonly id: string;
	readonly kind: ManualTimeDaySegmentKind;
	/** Where it starts, as a percentage of the day. */
	readonly left: number;
	/** How much of the day it covers, as a percentage; never below a sliver, so a short log stays visible. */
	readonly width: number;
	/** "09:00 – 10:30", in the report's time zone and time format. */
	readonly range: string;
	/** The logged duration, in seconds. */
	readonly duration: number;
}

/** The employee's day around one manual entry: the timeline, and how the day's time splits. */
export interface IManualTimeDay {
	/** `YYYY-MM-DD`, in the report's time zone. */
	readonly date: string;
	/** How long that day is, in minutes: 1,440, or 1,380 / 1,500 on a day the clocks change. */
	readonly minutes: number;
	/** Where each hour of `TIMELINE_HOURS` falls on the timeline, as a percentage of the day (local clock time). */
	readonly hourPositions: ReadonlyArray<number>;
	readonly segments: IManualTimeDaySegment[];
	/** Seconds the timer tracked within that day: a log that crosses midnight counts only its part inside the day. */
	readonly tracked: number;
	/** Seconds added by hand within that day, this entry included. */
	readonly manual: number;
	/** Seconds of this entry within that day. */
	readonly current: number;
	/** `tracked + manual`. */
	readonly total: number;
}

/** The local clock hours marked under the timeline. */
export const TIMELINE_HOURS: ReadonlyArray<number> = [0, 6, 12, 18, 24];

/** The narrowest a segment is drawn, as a percentage of the day (about 7 minutes): a 2-minute log still shows. */
const MIN_SEGMENT_WIDTH = 0.5;

/**
 * The instant in a time zone (the browser's when none is given or it is unknown).
 *
 * @param value - The instant, as the API returns it (UTC).
 * @param timeZone - The IANA zone.
 */
function inZone(value: Date | string, timeZone?: string): moment.Moment {
	const instant = moment.utc(value);
	return timeZone && moment.tz.zone(timeZone) ? instant.tz(timeZone) : instant.local();
}

/**
 * The range to read the day an entry started on with, in the report's time zone, as the API reads a range (UTC).
 *
 * The API selects logs by when they started, so the range opens a day early: a log that started the evening before
 * and ran past midnight is part of this day too. `buildManualTimeDay` keeps only what overlaps the day itself.
 *
 * @param entry - The manual entry.
 * @param timeZone - The IANA zone the report is read in.
 */
export function dayRangeOf(entry: ITimeLog, timeZone?: string): { date: string; startDate: string; endDate: string } {
	const start = inZone(entry.startedAt, timeZone).startOf('day');
	const end = start.clone().endOf('day');
	return {
		date: start.format('YYYY-MM-DD'),
		startDate: start.clone().subtract(1, 'day').utc().format('YYYY-MM-DD HH:mm:ss'),
		endDate: end.clone().utc().format('YYYY-MM-DD HH:mm:ss')
	};
}

/**
 * Builds the day around a manual entry from the employee's time logs of that day.
 *
 * The entry is always on it, even when the day's logs could not be read or did not include it. Each log is
 * clipped to the day, both on the chart and in the totals: one that runs past midnight is drawn up to the edge
 * and counts only its part inside the day, so the figures match the chart. A log that does not overlap the day
 * (read because the range opens a day early) is left out. The day's length follows the clock: 23 or 25 hours on
 * the days the clocks change.
 *
 * @param entry - The manual entry the dialog is about.
 * @param logs - The employee's time logs of that day; `null` when they could not be read.
 * @param timeZone - The IANA zone the report is read in.
 * @param timeFormat - 12- or 24-hour clock, for the ranges.
 */
export function buildManualTimeDay(
	entry: ITimeLog,
	logs: ReadonlyArray<ITimeLog> | null,
	timeZone?: string,
	timeFormat?: TimeFormatEnum
): IManualTimeDay {
	const dayStart = inZone(entry.startedAt, timeZone).startOf('day');
	// The next local midnight, not 24 hours later: a day the clocks change on is shorter or longer
	const dayEnd = dayStart.clone().add(1, 'day').startOf('day');
	const minutes = dayEnd.diff(dayStart, 'minutes', true) || MINUTES_PER_DAY;
	const hourPositions = TIMELINE_HOURS.map((hour) =>
		hour >= 24 ? 100 : (dayStart.clone().hour(hour).diff(dayStart, 'minutes', true) / minutes) * 100
	);
	const clock = timeFormat === TimeFormatEnum.FORMAT_24_HOURS ? 'HH:mm' : 'h:mm A';

	const others = (logs ?? []).filter((log) => log.id !== entry.id && log.startedAt && log.stoppedAt);
	const all = [...others, entry].sort((a, b) => moment.utc(a.startedAt).diff(moment.utc(b.startedAt)));

	let tracked = 0;
	let manual = 0;
	let current = 0;
	const segments: IManualTimeDaySegment[] = [];

	for (const log of all) {
		const isCurrent = log.id === entry.id;
		const isManual = isCurrent || log.logType === TimeLogType.MANUAL;
		const duration = Number(log.duration) || 0;

		const start = inZone(log.startedAt, timeZone);
		const end = log.stoppedAt ? inZone(log.stoppedAt, timeZone) : start.clone();
		const offset = start.diff(dayStart, 'minutes', true);
		const span = end.diff(start, 'minutes', true);
		const from = Math.max(0, offset);
		const to = Math.min(minutes, end.diff(dayStart, 'minutes', true));
		// A log without length (or without an end) belongs to the day it starts in; any other one must overlap it
		const inDay = span > 0 ? to > from : offset >= 0 && offset < minutes;
		if (!inDay) {
			continue;
		}
		// The part of the logged duration inside the day, in proportion to the part of its span inside the day
		const counted = span > 0 ? Math.round(duration * Math.min(1, (to - from) / span)) : duration;
		if (isCurrent) {
			current = counted;
		}
		if (isManual) {
			manual += counted;
		} else {
			tracked += counted;
		}

		const left = (from / minutes) * 100;
		segments.push({
			id: log.id,
			kind: isCurrent ? 'current' : isManual ? 'manual' : 'tracked',
			left,
			width: Math.min(100 - left, Math.max(MIN_SEGMENT_WIDTH, ((Math.max(to, from) - from) / minutes) * 100)),
			range: `${start.format(clock)} – ${end.format(clock)}`,
			duration
		});
	}

	// The entry last, so it is drawn over any log it overlaps
	segments.sort((a, b) => Number(a.kind === 'current') - Number(b.kind === 'current'));

	return {
		date: dayStart.format('YYYY-MM-DD'),
		minutes,
		hourPositions,
		segments,
		tracked,
		manual,
		current,
		total: tracked + manual
	};
}

/**
 * A part of the day as a whole percentage of its total.
 *
 * @param part - Seconds.
 * @param total - Seconds.
 */
export function percentOf(part: number, total: number): number {
	return total > 0 ? Math.round((part / total) * 100) : 0;
}
