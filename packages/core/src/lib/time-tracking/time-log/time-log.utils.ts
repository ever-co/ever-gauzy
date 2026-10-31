import { pluck, reduce } from 'underscore';
import { ITimeLog, ITimeSlot, TimeLogType } from '@gauzy/contracts';
import { ArraySum } from '@gauzy/utils';

/**
 * Calculates the average of an array of numbers.
 * @param values An array of numbers.
 * @returns The calculated average.
 */
export const calculateAverage = (values: number[]): number => {
	return reduce(values, ArraySum, 0);
};

/**
 * Calculates the average activity based on overall and duration values of an array of time slots.
 * @param slots An array of time slots.
 * @returns The calculated average activity.
 */
export const calculateAverageActivity = (slots: ITimeSlot[]): number => {
	const overallSum = calculateAverage(pluck(slots, 'overall'));
	const durationSum = calculateAverage(pluck(slots, 'duration'));
	return (overallSum * 100) / durationSum || 0;
};

/**
 * What a duration costs at an hourly rate, rounded to cents.
 *
 * The rate is read as a number whichever way it was loaded: the bill rate is a `numeric` column, which some
 * drivers hand back as a string. A missing, non-numeric or non-positive rate is no rate at all, so there is
 * nothing to price the time at and the answer is `null` rather than a made-up zero.
 *
 * @param durationInSeconds The duration to price, in seconds.
 * @param hourlyRate The rate per hour, as the employee's `billRateValue` holds it.
 * @returns The amount, rounded to two decimals, or `null` when there is no rate.
 */
export const calculateBillableAmount = (
	durationInSeconds: number,
	hourlyRate: number | string | null | undefined
): number | null => {
	if (hourlyRate === null || hourlyRate === undefined || hourlyRate === '') {
		return null;
	}
	const rate = Number(hourlyRate);
	if (!Number.isFinite(rate) || rate <= 0) {
		return null;
	}
	const hours = (Number(durationInSeconds) || 0) / 3600;
	return Math.round((hours * rate + Number.EPSILON) * 100) / 100;
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
