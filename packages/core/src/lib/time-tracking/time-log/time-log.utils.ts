import { pluck, reduce } from 'underscore';
import { CurrencyCode, ITimeLog, ITimeSlot, RoundingMode, TimeLogType } from '@gauzy/contracts';
import { ArraySum } from '@gauzy/utils';
import { currencyPrecision } from '../../money/currency-precision';
import {
	divideDecimalUnits,
	formatDecimalUnits,
	multiplyDecimalUnits,
	parseDecimalString,
	STORAGE_SCALE
} from '../../money/decimal';
import { roundingStrategies } from '../../money/rounding';

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

/** An hour, in the seconds a duration is stored in. */
const SECONDS_PER_HOUR = parseDecimalString(3600);

/** Digits an amount is carried at beyond its currency's, so the one rounding sees the true value. */
const GUARD_DIGITS = 4;

/**
 * What a duration costs at an hourly rate, rounded once to the currency's minor unit.
 *
 * The amount is exact decimal arithmetic, as every money amount on the platform is: the whole seconds times
 * the rate, divided by an hour, then rounded half up through the platform's rounding strategy. Nothing is
 * rounded on the way, so the total is the one a person gets by hand: 1,800 seconds at 20.15 is 10.075,
 * which is 10.08, where pricing binary floating point hours answers 10.07.
 *
 * The rate is read as a number whichever way it was loaded: the bill rate is a `numeric` column, which some
 * drivers hand back as a string. A missing, non-numeric or non-positive rate is no rate at all, so there is
 * nothing to price the time at and the answer is `null` rather than a made-up zero.
 *
 * @param durationInSeconds The duration to price, in seconds; durations are stored as whole seconds.
 * @param hourlyRate The rate per hour, as the employee's `billRateValue` holds it.
 * @param currency The rate's currency, which sets the decimals the amount is rounded to; two when unknown.
 * @returns The amount, or `null` when there is no rate.
 */
export const calculateBillableAmount = (
	durationInSeconds: number,
	hourlyRate: number | string | null | undefined,
	currency?: CurrencyCode | null
): number | null => {
	if (hourlyRate === null || hourlyRate === undefined || hourlyRate === '') {
		return null;
	}
	const rate = Number(hourlyRate);
	if (!Number.isFinite(rate) || rate <= 0) {
		return null;
	}
	const seconds = parseDecimalString(Math.round(Number(durationInSeconds) || 0));
	// Fixed notation at the money storage scale: a rate column holds cents, and the text is exact
	const cost = multiplyDecimalUnits(seconds, parseDecimalString(rate.toFixed(STORAGE_SCALE)));
	const decimals = currencyPrecision.decimalsFor(currency ?? '');
	const scale = decimals + GUARD_DIGITS;
	const amount = formatDecimalUnits(divideDecimalUnits(cost, SECONDS_PER_HOUR, scale), scale);
	return Number(roundingStrategies.active.round(amount, decimals, RoundingMode.HALF_UP));
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
