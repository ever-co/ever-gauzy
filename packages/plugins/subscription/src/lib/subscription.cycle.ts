import { CurrencyCode, DecimalString } from '@gauzy/contracts';
import { Money, divideDecimalUnits, formatDecimalUnits } from '@gauzy/core';
import { SubscriptionBillingPeriod, ISubscriptionItem } from './subscription.types';

/**
 * The calendar and the arithmetic of a recurring subscription.
 *
 * Two decisions live here and nowhere else, because both are the kind that quietly drift when they
 * are re-derived at each call site:
 *
 * 1. **Period arithmetic is calendar arithmetic, not day arithmetic.** A monthly subscription that
 *    started on the 31st bills on the last day of a shorter month and returns to the 31st afterwards,
 *    rather than sliding backwards one month at a time. Only `DAILY` and `WEEKLY` add exact days,
 *    because a day is a day.
 * 2. **A period is computed from the period start, never from the moment the job ran.** A billing run
 *    that is six hours late produces the same next period as one that is on time, so lateness never
 *    accumulates into a drifting calendar.
 *
 * Every amount crosses exactly one rounding boundary, at the currency's own scale, through the
 * platform money layer: the intermediate values carry the full working scale so a total is
 * reproducible from its parts.
 */

/** A half-open period `[start, end)`. */
export interface ISubscriptionPeriod {
	start: Date;
	end: Date;
}

/** A period plus the cadence that produced it. */
export interface ISubscriptionCadence {
	period: SubscriptionBillingPeriod;
	interval: number;
}

/**
 * The dunning schedule, in days after the cycle's due instant.
 *
 * It is data rather than a formula because it is a policy: the first retry is the same day, then the
 * gaps widen so a transient provider outage is ridden out without hammering the provider or the
 * customer. The array's length is therefore also the number of attempts a cycle gets.
 */
export const DUNNING_RETRY_OFFSETS_DAYS: ReadonlyArray<number> = [0, 1, 3, 5, 7];

/** How many attempts one cycle is given before the subscription moves to `FAILED`. */
export const MAX_BILLING_ATTEMPTS = DUNNING_RETRY_OFFSETS_DAYS.length;

/** The smallest proration worth charging, in the subscription's currency. */
export const DEFAULT_MINIMUM_PRORATION_CHARGE = '1';

/**
 * @param date The instant to move.
 * @param months How many calendar months to add; may be negative.
 * @returns The instant, clamped to the last day of the target month when the day does not exist there.
 */
export function addCalendarMonths(date: Date, months: number): Date {
	const day = date.getUTCDate();
	// Anchoring on the first of the target month first is what makes the clamp correct: adding months
	// to the 31st of January would otherwise roll into March before the clamp is even considered.
	const target = new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds())
	);
	const lastDayOfTargetMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();

	target.setUTCDate(Math.min(day, lastDayOfTargetMonth));

	return target;
}

/**
 * @param date The instant to move.
 * @param days How many exact days to add; may be negative.
 * @returns The instant.
 */
export function addDays(date: Date, days: number): Date {
	return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * @param start The instant a period begins.
 * @param cadence The plan's period and interval.
 * @returns The instant the period ends, one cadence later.
 */
export function endOfPeriod(start: Date, cadence: ISubscriptionCadence): Date {
	const interval = Math.max(1, Math.trunc(cadence.interval || 1));

	switch (cadence.period) {
		case SubscriptionBillingPeriod.DAILY:
			return addDays(start, interval);
		case SubscriptionBillingPeriod.WEEKLY:
			return addDays(start, interval * 7);
		case SubscriptionBillingPeriod.MONTHLY:
			return addCalendarMonths(start, interval);
		case SubscriptionBillingPeriod.QUARTERLY:
			return addCalendarMonths(start, interval * 3);
		case SubscriptionBillingPeriod.YEARLY:
			return addCalendarMonths(start, interval * 12);
		default:
			throw new Error(`SUBSCRIPTION_PERIOD_UNSUPPORTED: "${cadence.period}" is not a recurring billing period.`);
	}
}

/**
 * @param start The instant a period begins.
 * @param cadence The plan's period and interval.
 * @returns The period, `[start, one cadence later)`.
 */
export function periodFrom(start: Date, cadence: ISubscriptionCadence): ISubscriptionPeriod {
	return { start, end: endOfPeriod(start, cadence) };
}

/**
 * @param period The period to measure.
 * @returns Its length in milliseconds; never zero, because a zero-length period cannot be prorated.
 */
export function periodLengthMs(period: ISubscriptionPeriod): number {
	return Math.max(1, period.end.getTime() - period.start.getTime());
}

/**
 * @param period The period being billed.
 * @param at The instant the question is asked.
 * @returns How much of the period is still ahead of `at`, clamped into `[0, length]`.
 */
export function remainingMs(period: ISubscriptionPeriod, at: Date): number {
	return Math.min(Math.max(0, period.end.getTime() - at.getTime()), periodLengthMs(period));
}

/**
 * Sums the recurring value of a line set.
 *
 * @param items The subscription's items.
 * @param currency The currency the items are expressed in.
 * @returns The exact recurring amount, not yet rounded to a payment boundary.
 */
export function recurringAmount(items: ReadonlyArray<Pick<ISubscriptionItem, 'quantity' | 'unitPrice'>>, currency: CurrencyCode): Money {
	let total = Money.zero(currency);

	for (const item of items ?? []) {
		total = total.add(Money.of(normalizeDecimal(item.quantity, '0'), currency).multiply(normalizeDecimal(item.unitPrice, '0')));
	}

	return total;
}

/**
 * Applies a recurring plan discount to an amount.
 *
 * The discount is a fraction (`0.1` is ten per cent) and stays an exact decimal throughout, so a
 * ten-per-cent discount of 99.99 is 9.999 and only the boundary rounds it.
 *
 * @param amount The amount before the discount.
 * @param discountPercentage The fraction, when the plan grants one.
 * @returns The discount granted and the amount that remains.
 */
export function applyRecurringDiscount(
	amount: Money,
	discountPercentage?: DecimalString | number | null
): { discount: Money; net: Money } {
	if (discountPercentage === undefined || discountPercentage === null || String(discountPercentage) === '') {
		return { discount: Money.zero(amount.currency, amount.decimals), net: amount };
	}

	const discount = amount.multiply(normalizeDecimal(discountPercentage, '0')).round();
	const net = amount.subtract(discount).round();

	return { discount, net };
}

/**
 * The period the next cycle of a subscription covers.
 *
 * A cycle is identified by the period it covers, and the period is derived from the subscription's own
 * calendar — the next billing instant while it bills, the end of the last settled period when it is in
 * dunning, and the instant asked about when it has neither — never from when a job happens to run.
 * `billCycle` keys its claim and its row by this period and the upcoming-billing preview reports it, so
 * the two cannot name different periods for one subscription.
 *
 * @param subscription The subscription's calendar.
 * @param cadence The plan's period and interval.
 * @param now The instant the question is asked.
 * @returns The period, `[start, one cadence later)`.
 */
export function nextCyclePeriod(
	subscription: { nextBillingAt?: Date | string | null; currentPeriodEnd?: Date | string | null },
	cadence: ISubscriptionCadence,
	now: Date
): ISubscriptionPeriod {
	return periodFrom(new Date(subscription.nextBillingAt ?? subscription.currentPeriodEnd ?? now), cadence);
}

/**
 * The instant a paused subscription bills next once it resumes.
 *
 * A resume never charges twice for time already paid for and never refunds it: the next billing is the
 * end of the period the customer already paid for, or the resume itself when that period is over.
 *
 * @param currentPeriodEnd The end of the period already paid for, when there is one.
 * @param at The instant the subscription resumes.
 * @returns The next billing instant.
 */
export function resumedNextBillingAt(currentPeriodEnd: Date | string | null | undefined, at: Date): Date {
	const periodEnd = currentPeriodEnd ? new Date(currentPeriodEnd) : at;

	return periodEnd.getTime() > at.getTime() ? periodEnd : at;
}

/**
 * The discount a subscription's cycles are billed with: the one it was sold with, else its plan's.
 *
 * @param plan The plan the subscription is on.
 * @param override A discount stated for this subscription alone.
 * @returns The discount fraction to apply, or undefined when neither grants one.
 */
export function cycleDiscountOf(
	plan: { discountPercentage?: DecimalString | number | null },
	override?: DecimalString | number | null
): string | undefined {
	if (override !== undefined && override !== null && String(override) !== '') {
		return String(override);
	}

	return plan?.discountPercentage !== undefined && plan?.discountPercentage !== null
		? String(plan.discountPercentage)
		: undefined;
}

/**
 * The discount a subscription was sold with, when it is not simply its plan's.
 *
 * @param metadata The subscription's metadata, where the sale recorded it.
 * @returns The fraction, or undefined when the subscription carries none of its own.
 */
export function subscriptionDiscountOverrideOf(metadata?: Record<string, unknown> | null): string | undefined {
	const override = metadata?.['discountPercentage'];

	return override === undefined || override === null ? undefined : String(override);
}

/** What one cycle bills, and the two figures it is computed from. */
export interface ISubscriptionCyclePrice {
	/** The recurring lines, summed at the full working scale. */
	gross: Money;
	/** The recurring discount granted, as a positive magnitude, rounded at the currency's scale. */
	discount: Money;
	/** What the cycle bills: the amount its billing row records and its order is raised for. */
	net: Money;
}

/**
 * Prices one billing cycle.
 *
 * This is the one place a cycle's amount is computed. `billCycle` bills what it answers and the
 * upcoming-billing preview reports what it answers, so a preview cannot drift from the bill it
 * previews: the same lines, the same currency and the same discount rule — the subscription's own
 * discount where it was sold with one, the plan's otherwise — give the same three figures. It reads
 * nothing and writes nothing; the caller hands it the state.
 *
 * @param input The recurring lines, the currency, the plan and the subscription's metadata.
 * @returns The gross, the discount and the net the cycle bills.
 */
export function priceCycle(input: {
	items: ReadonlyArray<Pick<ISubscriptionItem, 'quantity' | 'unitPrice'>>;
	currency: CurrencyCode;
	plan: { discountPercentage?: DecimalString | number | null };
	metadata?: Record<string, unknown> | null;
}): ISubscriptionCyclePrice {
	const gross = recurringAmount(input.items, input.currency);
	const { discount, net } = applyRecurringDiscount(
		gross,
		cycleDiscountOf(input.plan, subscriptionDiscountOverrideOf(input.metadata))
	);

	return { gross, discount, net };
}

/**
 * Splits the remaining time of a period between the plan being left and the plan being taken up.
 *
 * Both halves are computed against the **old** period's length so the two numbers describe the same
 * window and their difference is meaningful. Each crosses exactly one rounding boundary, at the end.
 *
 * @param input The two recurring amounts, the period, and the instant the change takes effect.
 * @returns What the old plan's unused time is worth, what the new plan costs for it, and the net.
 */
export function prorate(input: {
	oldRecurring: Money;
	newRecurring: Money;
	period: ISubscriptionPeriod;
	at: Date;
}): { credit: Money; charge: Money; net: Money } {
	const { oldRecurring, newRecurring, period, at } = input;
	const length = periodLengthMs(period);
	const remaining = remainingMs(period, at);

	// The share of the period that is left, carried at the money layer's own working scale. Every
	// amount below is that share of a recurring amount, so both halves describe the same window and
	// their difference is the money that actually moves.
	const ratio = ratioOf(remaining, length);

	const credit = oldRecurring.multiply(ratio).round();
	const charge = newRecurring.multiply(ratio).round();

	// The net is the difference of the two values that were actually rounded, and is NOT rounded again:
	// both already sit on the currency's scale, so their difference does too, and a second boundary
	// could only move the net away from `charge - credit`. A caller that posts all three to a ledger
	// posts a balanced triple.
	return { credit, charge, net: charge.subtract(credit) };
}

/**
 * The share of a period that is left, as an exact decimal.
 *
 * **The division is on the digits, never on a double.** `part / whole` is binary floating point and
 * `toFixed` then rounds the *binary* value rather than the decimal one: ten days of thirty came out
 * as `0.333333333333`, which is 3.33e-13 below the exact third, and the credit and the charge of a
 * plan change are each that fraction of a recurring amount. The money layer has an exact integer
 * division for precisely this — `divideDecimalUnits` — and the tax package one repository over uses
 * it for the same job. Both arguments are whole milliseconds, so widening them to `bigint` loses
 * nothing.
 *
 * @param part A span of time.
 * @param whole The span it is a share of.
 * @returns The share as an exact decimal fraction, at the money layer's working scale.
 */
export function ratioOf(part: number, whole: number): string {
	if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) {
		return '0';
	}

	// Truncated before widening: `BigInt` refuses a fractional number, and a span of time that arrives
	// with a fraction of a millisecond in it carries no information this share can use.
	const denominator = Math.trunc(whole);
	const numerator = Math.min(Math.max(Math.trunc(part), 0), denominator);
	const quotient = divideDecimalUnits(
		{ units: BigInt(numerator), scale: 0 },
		{ units: BigInt(denominator), scale: 0 },
		Money.WORKING_SCALE
	);

	return formatDecimalUnits(quotient, Money.WORKING_SCALE);
}

/**
 * @param attemptCount How many attempts the cycle has already used.
 * @param from The instant the last attempt failed.
 * @returns When the next attempt is due, or null when the schedule is exhausted.
 */
export function nextRetryAt(attemptCount: number, from: Date): Date | null {
	const offset = DUNNING_RETRY_OFFSETS_DAYS[Math.max(0, Math.trunc(attemptCount))];

	return offset === undefined ? null : addDays(from, offset);
}

/**
 * @param attemptCount How many attempts the cycle has used.
 * @returns True when no further automatic attempt is owed to it.
 */
export function isDunningExhausted(attemptCount: number): boolean {
	return attemptCount >= MAX_BILLING_ATTEMPTS;
}

/**
 * @param value A quantity or amount as it was supplied or stored.
 * @param fallback What to use when nothing was supplied.
 * @returns It as an exact decimal string, which is the only form money is carried in.
 */
export function normalizeDecimal(value: DecimalString | number | null | undefined, fallback: string): string {
	if (value === undefined || value === null || String(value) === '') {
		return fallback;
	}

	const text = String(value).trim();

	if (!/^-?\d+(\.\d+)?$/.test(text)) {
		throw new Error(`SUBSCRIPTION_DECIMAL_INVALID: "${text}" is not an exact decimal value.`);
	}

	return text;
}

/**
 * @param value A fraction a caller supplied as a discount.
 * @returns The fraction as an exact decimal string.
 * @throws Error when it is not a fraction inside `[0, 1]`.
 */
export function normalizeDiscountFraction(value: DecimalString | number | null | undefined): string | undefined {
	if (value === undefined || value === null || String(value) === '') {
		return undefined;
	}

	const text = normalizeDecimal(value, '0');
	const fraction = Number(text);

	if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
		throw new Error(
			`SUBSCRIPTION_DISCOUNT_OUT_OF_RANGE: ${text} is not a fraction between 0 and 1; state a discount as a fraction, not as a percentage.`
		);
	}

	return text;
}
