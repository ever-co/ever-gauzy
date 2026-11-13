import { IEmployee, OwedRateSource } from '@gauzy/contracts';
import { isPayRateSet, StoredPayRate } from '../../employee/pay-rate';

/** The rate an employee's time is owed at, the currency it is in, and which of their rates it is. */
export interface OwedRate {
	rate: number | string | null | undefined;
	currency: string | null;
	rateSource: OwedRateSource;
}

/**
 * What an employee's time is owed at. A client is billed at the billing rate and the employee is paid at the pay
 * rate, so the pay rate prices what they are owed once a rate editor sets it. Until then the billing rate does, as it
 * did before pay rates existed, and the line says so. A rate that states no currency is in the organization's.
 */
export function owedRateOf(
	employee: IEmployee | null | undefined,
	payRate: StoredPayRate | undefined,
	organizationCurrency: string | null
): OwedRate {
	const paysAtPayRate = isPayRateSet(payRate?.payRateValue);
	if (payRate && paysAtPayRate) {
		const payCurrency = payRate.payRateCurrency || organizationCurrency;
		return { rate: payRate.payRateValue, currency: payCurrency ?? null, rateSource: 'pay' };
	}
	const billingCurrency = employee?.billRateCurrency || organizationCurrency;
	return { rate: employee?.billRateValue, currency: billingCurrency ?? null, rateSource: 'billing' };
}

/** Whether a set pay rate states no currency, which is then the organization's. */
export function payRateNeedsOrganizationCurrency(payRate: StoredPayRate): boolean {
	const paysAtPayRate = isPayRateSet(payRate.payRateValue);
	return paysAtPayRate && !payRate.payRateCurrency;
}
