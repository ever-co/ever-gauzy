import moment from 'moment-timezone';
import { ITimeLog, TimeFormatEnum, TimeLogType } from '@gauzy/contracts';

/** Minutes in a day: the width of the day timeline. */
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
	readonly segments: IManualTimeDaySegment[];
	/** Seconds the timer tracked that day. */
	readonly tracked: number;
	/** Seconds added by hand that day, this entry included. */
	readonly manual: number;
	/** Seconds of this entry. */
	readonly current: number;
	/** `tracked + manual`. */
	readonly total: number;
}

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
 * The bounds of the day an entry started on, in the report's time zone, as the API reads a range (UTC).
 *
 * @param entry - The manual entry.
 * @param timeZone - The IANA zone the report is read in.
 */
export function dayRangeOf(entry: ITimeLog, timeZone?: string): { date: string; startDate: string; endDate: string } {
	const start = inZone(entry.startedAt, timeZone).startOf('day');
	const end = start.clone().endOf('day');
	return {
		date: start.format('YYYY-MM-DD'),
		startDate: start.clone().utc().format('YYYY-MM-DD HH:mm:ss'),
		endDate: end.clone().utc().format('YYYY-MM-DD HH:mm:ss')
	};
}

/**
 * Builds the day around a manual entry from the employee's time logs of that day.
 *
 * The entry is always on it, even when the day's logs could not be read or did not include it. Each log is
 * clipped to the day, so one that runs past midnight is drawn up to the edge.
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
	const clock = timeFormat === TimeFormatEnum.FORMAT_24_HOURS ? 'HH:mm' : 'h:mm A';

	const others = (logs ?? []).filter((log) => log.id !== entry.id && log.startedAt && log.stoppedAt);
	const all = [...others, entry].sort((a, b) => moment.utc(a.startedAt).diff(moment.utc(b.startedAt)));

	let tracked = 0;
	let manual = 0;
	const segments: IManualTimeDaySegment[] = [];

	for (const log of all) {
		const isCurrent = log.id === entry.id;
		const isManual = isCurrent || log.logType === TimeLogType.MANUAL;
		const duration = Number(log.duration) || 0;
		if (isManual) {
			manual += duration;
		} else {
			tracked += duration;
		}

		const start = inZone(log.startedAt, timeZone);
		const end = log.stoppedAt ? inZone(log.stoppedAt, timeZone) : start.clone();
		const from = Math.max(0, start.diff(dayStart, 'minutes', true));
		const to = Math.min(MINUTES_PER_DAY, end.diff(dayStart, 'minutes', true));
		if (to <= 0 || from >= MINUTES_PER_DAY) {
			continue;
		}
		const left = (from / MINUTES_PER_DAY) * 100;
		segments.push({
			id: log.id,
			kind: isCurrent ? 'current' : isManual ? 'manual' : 'tracked',
			left,
			width: Math.min(100 - left, Math.max(MIN_SEGMENT_WIDTH, ((to - from) / MINUTES_PER_DAY) * 100)),
			range: `${start.format(clock)} – ${end.format(clock)}`,
			duration
		});
	}

	// The entry last, so it is drawn over any log it overlaps
	segments.sort((a, b) => Number(a.kind === 'current') - Number(b.kind === 'current'));

	const current = Number(entry.duration) || 0;
	return { date: dayStart.format('YYYY-MM-DD'), segments, tracked, manual, current, total: tracked + manual };
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
