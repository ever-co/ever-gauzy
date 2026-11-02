import { PayPeriodEnum } from './employee.model';
import { PayrollFrequencyEnum } from './payroll.model';
import { payPeriodToPayrollFrequency, payrollFrequencyToPayPeriod } from './payroll-frequency.util';

/**
 * #10184 item 4: an employee's `payPeriod` and a payroll run's `frequency` are two vocabularies for the same
 * cadences, with "twice a month" spelled `TWICE_PER_MONTH` on one side and `SEMI_MONTHLY` on the other.
 */
describe('pay period <-> payroll frequency', () => {
	const SHARED: [PayPeriodEnum, PayrollFrequencyEnum][] = [
		[PayPeriodEnum.WEEKLY, PayrollFrequencyEnum.WEEKLY],
		[PayPeriodEnum.BI_WEEKLY, PayrollFrequencyEnum.BI_WEEKLY],
		[PayPeriodEnum.TWICE_PER_MONTH, PayrollFrequencyEnum.SEMI_MONTHLY],
		[PayPeriodEnum.MONTHLY, PayrollFrequencyEnum.MONTHLY]
	];

	it.each(SHARED)('pays an employee paid %s with a %s run', (payPeriod, frequency) => {
		expect(payPeriodToPayrollFrequency(payPeriod)).toBe(frequency);
	});

	it.each(SHARED)('reads %s back from a %s run', (payPeriod, frequency) => {
		expect(payrollFrequencyToPayPeriod(frequency)).toBe(payPeriod);
	});

	it('maps an employee with no pay period to no run frequency', () => {
		expect(payPeriodToPayrollFrequency(PayPeriodEnum.NONE)).toBeUndefined();
	});

	it.each([PayrollFrequencyEnum.QUARTERLY, PayrollFrequencyEnum.ANNUALLY])(
		'maps a %s run to no employee pay period, since an employee cannot hold that cadence',
		(frequency) => {
			expect(payrollFrequencyToPayPeriod(frequency)).toBeUndefined();
		}
	);

	it.each([undefined, null, ''])('answers undefined for a missing value (%p)', (value) => {
		expect(payPeriodToPayrollFrequency(value as PayPeriodEnum)).toBeUndefined();
		expect(payrollFrequencyToPayPeriod(value as PayrollFrequencyEnum)).toBeUndefined();
	});

	it('never resolves an inherited member for a value read from outside', () => {
		for (const value of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
			expect(payPeriodToPayrollFrequency(value as PayPeriodEnum)).toBeUndefined();
			expect(payrollFrequencyToPayPeriod(value as PayrollFrequencyEnum)).toBeUndefined();
		}
	});

	/**
	 * The guard against drift: a cadence added to either enum must be decided here, either mapped or listed as
	 * having no counterpart, rather than silently falling through as `undefined`.
	 */
	it('decides every member of both enums', () => {
		const unmappedPayPeriods = [PayPeriodEnum.NONE];
		const unmappedFrequencies = [PayrollFrequencyEnum.QUARTERLY, PayrollFrequencyEnum.ANNUALLY];

		for (const payPeriod of Object.values(PayPeriodEnum)) {
			const frequency = payPeriodToPayrollFrequency(payPeriod);
			if (unmappedPayPeriods.includes(payPeriod)) {
				expect(frequency).toBeUndefined();
			} else {
				expect(frequency).toBeDefined();
				// and the mapping is a bijection on the shared cadences
				expect(payrollFrequencyToPayPeriod(frequency)).toBe(payPeriod);
			}
		}

		for (const frequency of Object.values(PayrollFrequencyEnum)) {
			const payPeriod = payrollFrequencyToPayPeriod(frequency);
			if (unmappedFrequencies.includes(frequency)) {
				expect(payPeriod).toBeUndefined();
			} else {
				expect(payPeriod).toBeDefined();
				expect(payPeriodToPayrollFrequency(payPeriod)).toBe(frequency);
			}
		}
	});
});
