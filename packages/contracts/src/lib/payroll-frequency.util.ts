import { PayPeriodEnum } from './employee.model';
import { PayrollFrequencyEnum } from './payroll.model';

/**
 * The pay cadences an employee's `payPeriod` and a payroll run's `frequency` share (issue #10184).
 *
 * The two vocabularies were written separately and both are persisted, so neither is renamed: the same
 * "paid twice a month" is `PayPeriodEnum.TWICE_PER_MONTH` on an employee and `PayrollFrequencyEnum.SEMI_MONTHLY`
 * on a run. Cadences only one side knows (`PayPeriodEnum.NONE`, `PayrollFrequencyEnum.QUARTERLY` and `ANNUALLY`)
 * have no counterpart and are deliberately absent.
 *
 * A `Map` rather than an object literal, so a value read from outside (a query string, a CSV cell) can never
 * resolve to an inherited member such as `constructor`.
 */
const PAYROLL_FREQUENCY_BY_PAY_PERIOD: ReadonlyMap<PayPeriodEnum, PayrollFrequencyEnum> = new Map([
	[PayPeriodEnum.WEEKLY, PayrollFrequencyEnum.WEEKLY],
	[PayPeriodEnum.BI_WEEKLY, PayrollFrequencyEnum.BI_WEEKLY],
	[PayPeriodEnum.TWICE_PER_MONTH, PayrollFrequencyEnum.SEMI_MONTHLY],
	[PayPeriodEnum.MONTHLY, PayrollFrequencyEnum.MONTHLY]
]);

/** The same pairs read the other way, derived so the two directions cannot drift apart. */
const PAY_PERIOD_BY_PAYROLL_FREQUENCY: ReadonlyMap<PayrollFrequencyEnum, PayPeriodEnum> = new Map(
	Array.from(PAYROLL_FREQUENCY_BY_PAY_PERIOD, ([payPeriod, frequency]) => [frequency, payPeriod])
);

/**
 * The payroll run frequency that pays an employee on the given pay period.
 *
 * @param payPeriod - The employee's `payPeriod`.
 * @returns The matching `PayrollFrequencyEnum`, or `undefined` when the pay period has none (`NONE`, or no value).
 */
export function payPeriodToPayrollFrequency(
	payPeriod: PayPeriodEnum | null | undefined
): PayrollFrequencyEnum | undefined {
	return payPeriod ? PAYROLL_FREQUENCY_BY_PAY_PERIOD.get(payPeriod) : undefined;
}

/**
 * The employee pay period a payroll run frequency corresponds to.
 *
 * @param frequency - The run's `frequency`.
 * @returns The matching `PayPeriodEnum`, or `undefined` when an employee cannot hold that cadence (`QUARTERLY`,
 * `ANNUALLY`, or no value).
 */
export function payrollFrequencyToPayPeriod(
	frequency: PayrollFrequencyEnum | null | undefined
): PayPeriodEnum | undefined {
	return frequency ? PAY_PERIOD_BY_PAYROLL_FREQUENCY.get(frequency) : undefined;
}
