/** Where the rate a log is counted at comes from: the member's own rate on the project, the project's, or theirs. */
export type BillRateSource = 'member' | 'project' | 'employee';

type Rate = number | string | null | undefined;

export interface BillRates {
	memberRate?: Rate;
	projectRate?: Rate;
	employeeRate?: Rate;
}

function isSet(rate: Rate): boolean {
	const isMissing = rate === null || rate === undefined;
	if (isMissing) {
		return false;
	}
	return rate !== '';
}

/** The most specific rate that is set: the member's own on the project, else the project's, else the employee's. */
export function effectiveBillRateSource(rates: BillRates): BillRateSource | null {
	if (isSet(rates.memberRate)) {
		return 'member';
	}
	if (isSet(rates.projectRate)) {
		return 'project';
	}
	if (isSet(rates.employeeRate)) {
		return 'employee';
	}
	return null;
}

function rateFrom(rates: BillRates, source: BillRateSource): Rate {
	switch (source) {
		case 'member':
			return rates.memberRate;
		case 'project':
			return rates.projectRate;
		case 'employee':
			return rates.employeeRate;
	}
}

/** The rate a member's time on a project is counted at, or `null` when none of the three is set. */
export function effectiveBillRate(rates: BillRates): number | null {
	const source = effectiveBillRateSource(rates);
	if (source === null) {
		return null;
	}
	const rate = rateFrom(rates, source);
	return Number(rate);
}

/**
 * The currency of the effective rate: a member's or a project's rate is in the project's currency, the employee's
 * rate in their own. A rate that states none is in the organization's.
 */
export function effectiveBillRateCurrency(
	source: BillRateSource | null,
	currencies: {
		projectCurrency?: string | null;
		employeeCurrency?: string | null;
		organizationCurrency?: string | null;
	}
): string | null {
	let ownCurrency = currencies.projectCurrency;
	if (source === 'employee') {
		ownCurrency = currencies.employeeCurrency;
	}
	if (ownCurrency) {
		return ownCurrency;
	}
	if (currencies.organizationCurrency) {
		return currencies.organizationCurrency;
	}
	return null;
}
