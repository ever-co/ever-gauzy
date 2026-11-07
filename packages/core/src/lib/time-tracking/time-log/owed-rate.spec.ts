import { CurrenciesEnum, IEmployee } from '@gauzy/contracts';
import { owedRateOf, payRateNeedsOrganizationCurrency } from './owed-rate';

/**
 * What an employee is owed is priced at their pay rate once a rate editor sets it, and at their billing rate until
 * then, exactly as before pay rates existed. A client billed 80 an hour for an employee paid 30 owes 80; the employee
 * is owed 30.
 */
describe('owedRateOf', () => {
	const employee = { id: 'employee-1', billRateValue: 80, billRateCurrency: CurrenciesEnum.USD } as IEmployee;

	it('prices at the billing rate, in its currency, while no pay rate is set', () => {
		expect(owedRateOf(employee, undefined, 'EUR')).toEqual({ rate: 80, currency: 'USD', rateSource: 'billing' });

		const withoutCurrency = { ...employee, billRateCurrency: undefined } as IEmployee;
		expect(owedRateOf(withoutCurrency, undefined, 'EUR')).toEqual({
			rate: 80,
			currency: 'EUR',
			rateSource: 'billing'
		});
	});

	it('prices at the pay rate once set, in its own currency, else the organization’s', () => {
		const paid = { id: 'employee-1', payRateValue: '30.00', payRateCurrency: CurrenciesEnum.GBP };
		expect(owedRateOf(employee, paid, 'EUR')).toEqual({ rate: '30.00', currency: 'GBP', rateSource: 'pay' });

		const paidInOrganizationCurrency = { ...paid, payRateCurrency: null };
		expect(owedRateOf(employee, paidInOrganizationCurrency, 'EUR')).toEqual({
			rate: '30.00',
			currency: 'EUR',
			rateSource: 'pay'
		});
	});

	it('keeps a pay rate of 0: the employee is paid nothing for that time, not their billing rate', () => {
		const unpaid = { id: 'employee-1', payRateValue: 0, payRateCurrency: CurrenciesEnum.USD };

		expect(owedRateOf(employee, unpaid, null)).toEqual({ rate: 0, currency: 'USD', rateSource: 'pay' });
	});

	it('needs the organization currency only for a set pay rate that states none', () => {
		expect(payRateNeedsOrganizationCurrency({ id: 'a', payRateValue: 30, payRateCurrency: null })).toBe(true);
		expect(
			payRateNeedsOrganizationCurrency({ id: 'b', payRateValue: 30, payRateCurrency: CurrenciesEnum.USD })
		).toBe(false);
		expect(payRateNeedsOrganizationCurrency({ id: 'c', payRateValue: null, payRateCurrency: null })).toBe(false);
	});
});
