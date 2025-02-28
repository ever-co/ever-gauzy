import { reduce } from "underscore";
import { ArraySum } from "@gauzy/common";
import { ITimeLog, TimeLogType } from "@gauzy/contracts";

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
    let avgActivity = 0;
	logs.forEach((log) => {
		avgActivity += logActivity[log.id] || 0;
	});
    avgActivity /= logs.length;
    return avgActivity || 0;
};

/**
 * Calculate the total duration of a specific log type within a given array of time logs.
 * @param logs Array of time logs.
 * @param logType Type of the log (e.g., TRACKED, MANUAL, IDLE, RESUMED).
 * @returns Total duration of the specified log type in seconds.
 */
export const calculateDuration = (logs: ITimeLog[], logType: TimeLogType): number => {
    return logs.filter((log) => log.logType === logType).reduce((totalDuration, log) => totalDuration + log.duration, 0);
};
