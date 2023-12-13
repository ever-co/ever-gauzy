import { pluck, reduce } from "underscore";
import { ArraySum } from "@gauzy/common";
import { ITimeSlot } from "@gauzy/contracts";

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
