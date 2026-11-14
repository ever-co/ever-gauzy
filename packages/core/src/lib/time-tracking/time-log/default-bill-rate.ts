import { IEmployee, IOrganization } from '@gauzy/contracts';

/** The organization's default billing rate, as the last link of the price chain reads it. */
export interface DefaultBillRate {
	value: number;
	/** The default's own currency, else the organization's; null when neither is stated. */
	currency: string | null;
}

/** The rate an amount is priced at, as stored (a MikroORM read may hand a numeric column back as text). */
export interface PricedRate {
	rate: IEmployee['billRateValue'];
	currency: string | null;
}

type DefaultBillRateSource = Pick<IOrganization, 'currency' | 'defaultBillRateValue' | 'defaultBillRateCurrency'>;
type RatedEmployee = Pick<IEmployee, 'billRateValue' | 'billRateCurrency'>;

/**
 * Whether a member has a billing rate of their own. A member nobody set a rate for is stored with 0 (see the employee
 * subscriber), and a rate that is not positive prices nothing, so only a positive rate counts as one.
 *
 * @param employee - The member, with their billing rate.
 */
export function hasOwnBillRate(employee: Pick<IEmployee, 'billRateValue'> | null | undefined): boolean {
	const rate = Number(employee?.billRateValue);
	return rate > 0;
}

/**
 * The organization's default billing rate, or null when it sets none: no value, or one that is not positive.
 *
 * @param organization - The organization, with its currency and its default rate.
 */
export function defaultBillRateOf(organization: DefaultBillRateSource | null | undefined): DefaultBillRate | null {
	const value = Number(organization?.defaultBillRateValue);
	const isSet = value > 0;
	if (!isSet) {
		return null;
	}
	const currency = organization.defaultBillRateCurrency || organization.currency || null;
	return { value, currency };
}

/**
 * Whether the default prices a member's time: only for a member without a rate of their own, and only when the
 * organization sets a default. A rate that exists is never replaced.
 *
 * @param employee - The member, with their billing rate.
 * @param defaultRate - The organization's default, or null.
 */
export function pricesAtDefault(
	employee: Pick<IEmployee, 'billRateValue'> | null | undefined,
	defaultRate: DefaultBillRate | null
): boolean {
	const hasDefault = defaultRate !== null;
	return hasDefault && !hasOwnBillRate(employee);
}

/**
 * The rate a member's time is billed at, and its currency: the member's billing rate in its currency (else in
 * `organizationCurrency`), or the organization's default for a member without a rate. Without a default, the member's
 * stored rate is answered as it is, so an amount is what it was before the default existed.
 *
 * @param employee - The member, with their billing rate and its currency.
 * @param organizationCurrency - The currency of a member's rate that states none.
 * @param defaultRate - The organization's default, or null.
 */
export function billRateOf(
	employee: RatedEmployee | null | undefined,
	organizationCurrency: string | null,
	defaultRate: DefaultBillRate | null
): PricedRate {
	if (pricesAtDefault(employee, defaultRate)) {
		return { rate: defaultRate.value, currency: defaultRate.currency };
	}
	const currency = employee?.billRateCurrency || organizationCurrency;
	return { rate: employee?.billRateValue, currency };
}

/**
 * Whether a budget report needs the organization's default: a cost budget whose time includes time of a member
 * without a rate of their own. Hour budgets count hours and price nothing.
 *
 * @param targets - The budget targets (projects or clients), each with its budget type and its time logs.
 * @param hoursType - The budget type that counts hours.
 */
export function budgetNeedsDefaultRate(
	targets: ReadonlyArray<{
		budgetType?: string;
		timeLogs?: ReadonlyArray<{ employee?: Pick<IEmployee, 'billRateValue'> }>;
	}>,
	hoursType: string
): boolean {
	return targets.some((target) => {
		const isCostBudget = target.budgetType !== hoursType;
		const logs = target.timeLogs ?? [];
		return isCostBudget && logs.some((log) => !!log.employee && !hasOwnBillRate(log.employee));
	});
}
