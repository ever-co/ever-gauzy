import { IEmployee, IReportDayTaskRow, ITimeLog, ITimeLogStoredRates, OwedRateSource } from '@gauzy/contracts';
import { addDecimalStrings } from '../../money/decimal';
import { isPayRateSet, StoredPayRate } from '../../employee/pay-rate';
import { owedRateOf } from './owed-rate';
import { calculateBillableAmount } from './time-log.utils';

type Rate = number | string | null | undefined;

/** A log as the pricing reads it: the rates it stores, and its employee for a log that stores none. */
export type PricedLog = Pick<ITimeLog, 'billRateValue' | 'billRateCurrency' | 'ratesStored'> & {
	employee?: Pick<IEmployee, 'billRateValue' | 'billRateCurrency'> | null;
};

/** A rate and the currency it is in (already the organization's when the rate states none). */
export interface PricedRate {
	rate: Rate;
	currency: string | null;
}

/** An amount, and the currency it is in. */
export interface CurrencyAmount {
	currency: string | null;
	amount: number;
}

/** What a log's time is owed at, and which of the member's rates that is. */
export interface OwedLogRate extends PricedRate {
	rateSource: OwedRateSource;
}

/** What a member is owed for some time, in one currency. */
export interface OwedLine {
	amount: number;
	duration: number;
	rateSource: OwedRateSource;
	currency: string | null;
}

/** Whether a time log stores the rates that price it (a boolean column some drivers return as 0 or 1). */
export function storesRates(log: Pick<ITimeLog, 'ratesStored'> | null | undefined): boolean {
	const marker: unknown = log?.ratesStored;
	return marker === true || marker === 1 || marker === '1' || marker === 'true';
}

/**
 * The billing rate that prices a log's time: the one it stores, else, for a log recorded around the API, the
 * member's current rate, as all time was priced before rates were stored. The currency is the rate's own; empty,
 * it is the organization's.
 *
 * @param log The log, with its employee when it may store no rate.
 */
export function billingRateOfLog(log: PricedLog): PricedRate {
	if (storesRates(log)) {
		return { rate: log.billRateValue, currency: log.billRateCurrency ?? null };
	}
	return { rate: log.employee?.billRateValue, currency: log.employee?.billRateCurrency ?? null };
}

/**
 * The billing rate that prices a log's time (see {@link billingRateOfLog}), its currency the organization's when
 * the rate states none.
 */
export function billedRateOf(log: PricedLog, organizationCurrency: string | null): PricedRate {
	const { rate, currency } = billingRateOfLog(log);
	return { rate, currency: currency || organizationCurrency };
}

/**
 * What a log's time costs against a project or client budget: its hours at the billing rate that prices it, in
 * floating point as the budgets always added it; nothing without a rate.
 */
export function budgetCostOf(log: PricedLog & { duration?: number }): number {
	const { rate } = billingRateOfLog(log);
	const hourlyRate = Number(rate) || 0;
	return ((Number(log.duration) || 0) / 3600) * hourlyRate;
}

/** A rate as a report states it: a number, or null for none. */
function rateOrNull(rate: Rate): number | null {
	const isMissing = rate === null || rate === undefined || rate === '';
	if (isMissing) {
		return null;
	}
	return Number(rate);
}

/** The billing rate a report row of the log states, so a client prices the row as the API does. */
export function rateOfReportRow(log: PricedLog): Pick<IReportDayTaskRow, 'billRateValue' | 'billRateCurrency'> {
	const { rate, currency } = billingRateOfLog(log);
	return { billRateValue: rateOrNull(rate), billRateCurrency: currency };
}

/** The key two shares of time are priced together under: the same rate in the same currency. */
function shareKeyOf({ rate, currency }: PricedRate): string {
	const value = rateOrNull(rate);
	return `${value ?? 'none'}|${currency ?? ''}`;
}

/**
 * What some time costs when each log is priced at its own rate. The logs are summed per rate and currency and each
 * sum is priced once, as one rate priced a whole week before rates were stored, so a period at one rate reads the
 * same amount to the cent; the amounts of a currency are then added exactly. Currencies are never added together,
 * and time without a rate adds nothing.
 *
 * @param logs The logs, each with its duration in seconds.
 * @param rateOf The rate of a log, its currency already the organization's when the rate states none.
 * @returns One amount per currency, in the order the currencies first appear; none when nothing has a rate.
 */
export function amountsOf<T extends { duration?: number }>(
	logs: T[],
	rateOf: (log: T) => PricedRate
): CurrencyAmount[] {
	const shares = new Map<string, PricedRate & { duration: number }>();
	for (const log of logs) {
		const priced = rateOf(log);
		const key = shareKeyOf(priced);
		const share = shares.get(key) ?? { ...priced, duration: 0 };
		share.duration += Number(log.duration) || 0;
		shares.set(key, share);
	}
	const byCurrency = new Map<string, CurrencyAmount>();
	for (const share of shares.values()) {
		const amount = calculateBillableAmount(share.duration, share.rate, share.currency);
		if (amount === null) {
			continue;
		}
		const key = share.currency ?? '';
		const total = byCurrency.get(key) ?? { currency: share.currency, amount: 0 };
		total.amount = Number(addDecimalStrings(total.amount, amount));
		byCurrency.set(key, total);
	}
	return [...byCurrency.values()];
}

/**
 * The amounts of some lines added per currency, exactly: the total of one currency is never added to another's.
 *
 * @param lines The lines, each with its amount and the currency it is in.
 * @returns One total per currency, in the order the currencies first appear.
 */
export function totalsByCurrencyOf(
	lines: ReadonlyArray<{ amount: number; currency?: string | null }>
): CurrencyAmount[] {
	const byCurrency = new Map<string, CurrencyAmount>();
	for (const line of lines) {
		const currency = line.currency ?? null;
		const key = currency ?? '';
		const total = byCurrency.get(key) ?? { currency, amount: 0 };
		total.amount = Number(addDecimalStrings(total.amount, line.amount));
		byCurrency.set(key, total);
	}
	return [...byCurrency.values()];
}

/**
 * What a log's time is owed at. A log that stores its rates is owed at the pay rate it stores, else at the billing
 * rate it stores; a log recorded around the API is owed at the member's current rates, as before (`owedRateOf`).
 *
 * @param log The log, with its employee.
 * @param storedPayRate The pay rate the log stores, given only when the caller may read the member's pay rate.
 * @param livePayRate The member's current pay rate, given only when the caller may read it.
 * @param organizationCurrency The currency of a rate that states none.
 */
export function owedRateOfLog(
	log: PricedLog & { employee?: IEmployee | null },
	storedPayRate: Pick<ITimeLogStoredRates, 'payRateValue' | 'payRateCurrency'> | undefined,
	livePayRate: StoredPayRate | undefined,
	organizationCurrency: string | null
): OwedLogRate {
	if (!storesRates(log)) {
		return owedRateOf(log.employee, livePayRate, organizationCurrency);
	}
	const paysAtPayRate = isPayRateSet(storedPayRate?.payRateValue);
	if (paysAtPayRate) {
		const payCurrency = storedPayRate.payRateCurrency || organizationCurrency;
		return { rate: storedPayRate.payRateValue, currency: payCurrency ?? null, rateSource: 'pay' };
	}
	const billingCurrency = log.billRateCurrency || organizationCurrency;
	return { rate: log.billRateValue, currency: billingCurrency ?? null, rateSource: 'billing' };
}

/**
 * What a member is owed for some time, one line per currency the rates are in: one line in every case where a single
 * rate prices the time, as before rates were stored. A line says the billing rate priced it as soon as part of its
 * time is not priced at the pay rate. Time without a rate is owed nothing, which is still a number.
 *
 * @param logs The logs, each with its duration in seconds.
 * @param rateOf What a log's time is owed at.
 */
export function owedLinesOf<T extends { duration?: number }>(logs: T[], rateOf: (log: T) => OwedLogRate): OwedLine[] {
	const groups = new Map<string, { currency: string | null; logs: T[]; allAtPayRate: boolean }>();
	for (const log of logs) {
		const owed = rateOf(log);
		const key = owed.currency ?? '';
		const group = groups.get(key) ?? { currency: owed.currency, logs: [], allAtPayRate: true };
		group.logs.push(log);
		group.allAtPayRate = group.allAtPayRate && owed.rateSource === 'pay';
		groups.set(key, group);
	}
	const lines: OwedLine[] = [];
	for (const group of groups.values()) {
		const [priced] = amountsOf(group.logs, rateOf);
		const duration = group.logs.reduce((total, log) => total + (Number(log.duration) || 0), 0);
		let rateSource: OwedRateSource = 'billing';
		if (group.allAtPayRate) {
			rateSource = 'pay';
		}
		lines.push({ amount: priced?.amount ?? 0, duration, rateSource, currency: group.currency });
	}
	return lines;
}
