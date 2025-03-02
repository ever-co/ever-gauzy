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
