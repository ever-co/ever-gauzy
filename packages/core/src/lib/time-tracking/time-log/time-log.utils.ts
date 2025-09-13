import * as moment from 'moment-timezone';
import { reduce } from 'underscore';
import { ArraySum } from '@gauzy/utils';
import { ITimeLog, TimeLogPartialStatus, TimeLogType } from '@gauzy/contracts';
import { getDateRangeFormat } from '../../core/utils';

/**
 * Calculates the average of an array of numbers.
 * @param values An array of numbers.
 * @returns The calculated average.
 */
export const calculateAverage = (values: number[]): number => {
	return reduce(values, ArraySum, 0);
};

/**
 * Calculates the average activity based on the average of activity for the involver time logs
 * @param logs An array of time logs.
 * @param logActivity A map of time log id to its activity.
 * @returns The calculated average activity.
 */
export const calculateAverageActivity = (logs: ITimeLog[], logActivity: Record<string, number>): number => {
	const avgActivity = logs.reduce((total, log) => total + (logActivity[log.id] || 0), 0);
	return logs.length ? avgActivity / logs.length : 0;
};

/**
 * Calculate the total duration of a specific log type within a given array of time logs.
 * @param logs Array of time logs.
 * @param logType Type of the log (e.g., TRACKED, MANUAL, IDLE, RESUMED).
 * @returns Total duration of the specified log type in seconds.
 */
export const calculateDuration = (logs: ITimeLog[], logType: TimeLogType): number => {
	return logs
		.filter((log) => log.logType === logType)
		.reduce((totalDuration, log) => totalDuration + log.duration, 0);
};

/**
 * Calculate the duration of a time log.
 * @param log - The time log to calculate the duration of.
 * @returns The duration of the time log in seconds.
 */
export const calculateTimeLogDuration = (log: ITimeLog): number => {
	if (!log.startedAt || !log.stoppedAt) {
		return 0;
	}

	const duration = moment(log.stoppedAt).diff(moment(log.startedAt), 'seconds');
	return Math.max(0, Math.trunc(duration));
};

/**
 * Fix the time logs boundary to adjust the startedAt and stoppedAt to the date range and recalculate the duration.
 *
 * @param timeLogs - The time logs array to fix. Entries should be sorted by startedAt in ascending order.
 * @param startDate - The start date of the date range.
 * @param endDate - The end date of the date range.
 */
export function fixTimeLogsBoundary(
	timeLogs: ITimeLog[],
	startDate?: string | Date,
	endDate?: string | Date,
	tz = 'UTC',
	startOf: moment.unitOfTime.StartOf = 'day'
) {
	if (timeLogs.length === 0) return [];

	const result: ITimeLog[] = [];

	const { start, end } = getDateRangeFormat(
		moment.utc(startDate || moment().startOf(startOf)),
		moment.utc(endDate || moment().endOf(startOf))
	);

	// Iterate over the time logs to ensure they fits in the date range and also by days within the date range
	for (const log of timeLogs) {
		// Correct when the log started before the date range
		if (moment(log.startedAt).isBefore(moment(start))) {
			log.startedAt = moment(start).toDate();
			log.partialStatus = TimeLogPartialStatus.TO_RIGHT;
		}

		// Correct when the log stopped after the date range
		if (moment(log.stoppedAt).isAfter(moment(end))) {
			log.stoppedAt = moment(end).toDate();
			log.partialStatus =
				log.partialStatus === TimeLogPartialStatus.COMPLETE
					? TimeLogPartialStatus.TO_LEFT
					: TimeLogPartialStatus.BOTH_SIDES;
		}

		// Calculate the next day start and current day end in the required timezone
		const nextDayStart = moment(log.startedAt).tz(tz).add(1, 'day').startOf('day');
		const currentDayEnd = moment(log.startedAt).tz(tz).endOf('day');

		// If the timelog fits in the current day, add it to the result
		if (moment(log.stoppedAt).isSameOrBefore(currentDayEnd)) {
			log.duration = calculateTimeLogDuration(log);
			result.push(log);
		} else {
			/*
			 * If the timelog dont fit in the current day, split it into two logs
			 * As timelog maximum size will be 24 hours, we can safely split it only into two logs
			 * The first log will cover the time that fits in the current day and the second log will
			 * be the remaining time that fits in the next day
			 */

			// Create a new log for the remaining time
			const newLog = {
				...log,
				startedAt: nextDayStart.toDate(),
				partialStatus: TimeLogPartialStatus.TO_RIGHT
			};
			newLog.duration = calculateTimeLogDuration(newLog);

			// Update the original log to the current day boundary
			log.stoppedAt = currentDayEnd.toDate();
			log.partialStatus =
				log.partialStatus === TimeLogPartialStatus.COMPLETE
					? TimeLogPartialStatus.TO_LEFT
					: TimeLogPartialStatus.BOTH_SIDES;
			log.duration = calculateTimeLogDuration(log);

			// Add the original and new logs to the result
			result.push(log);
			result.push(newLog);
		}
	}

	return result;
}

/**
 * Calculate the duration of a time log within a specific date range, taking into account the timezone.
 *
 * @param log - The time log object, must have startedAt and stoppedAt dates.
 * @param startDate - Optional start of the range. If not provided, the log's startedAt is used.
 * @param endDate - Optional end of the range. If not provided, the log's stoppedAt is used.
 * @param tz - Timezone string (default is 'UTC') for consistent calculation.
 * @returns Duration in seconds, clipped to the provided date range. Returns 0 if log is invalid or out of range.
 */
export function calculateTimeLogDurationInRange(
	log: ITimeLog,
	startDate?: string | Date,
	endDate?: string | Date,
	tz = 'UTC'
): number {
	// Return 0 if either start or stop time is missing
	if (!log.startedAt || !log.stoppedAt) return 0;

	// Convert startDate and endDate to moment objects in the specified timezone
	const start = moment.tz(startDate ?? log.startedAt, tz);
	const end = moment.tz(endDate ?? log.stoppedAt, tz);

	// Clip the log start and end times to the provided range
	const clippedStart = moment.max(moment.tz(log.startedAt, tz), start);
	const clippedEnd = moment.min(moment.tz(log.stoppedAt, tz), end);

	// If clipped end is before clipped start, duration is 0
	if (clippedEnd.isBefore(clippedStart)) return 0;

	// Calculate duration in seconds
	let duration = clippedEnd.diff(clippedStart, 'seconds');

	// Adjust duration for partial logs (not COMPLETE), subtract 1 second to ensure correct rounding
	if (log.partialStatus !== TimeLogPartialStatus.COMPLETE) {
		duration += 5;
	}

	// Ensure duration is never negative
	return Math.max(0, duration);
}

/**
 * Calculate the total duration of multiple time logs within a specified date range.
 *
 * @param logs - Array of time log objects.
 * @param startDate - Optional start of the range for calculation.
 * @param endDate - Optional end of the range for calculation.
 * @param tz - Timezone string (default 'UTC') to use for all logs.
 * @returns Total duration in seconds of all logs within the range.
 */
export function calculateTotalDuration(
	logs: ITimeLog[],
	startDate?: string | Date,
	endDate?: string | Date,
	tz = 'UTC'
): number {
	// Sum the clipped durations of all logs in the array
	return logs.reduce((sum, log) => sum + calculateTimeLogDurationInRange(log, startDate, endDate, tz), 0);
}
