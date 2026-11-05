import { ForbiddenException } from '@nestjs/common';
import { IEmployee, IEmployeeUpdateInput } from '@gauzy/contracts';

/** The fields an organization may stop its employees from changing on their own record. */
export const OWN_RATE_FIELDS = [
	'billRateValue',
	'billRateCurrency',
	'minimumBillingRate',
	'payPeriod',
	'reWeeklyLimit'
] as const;

type OwnRateField = (typeof OWN_RATE_FIELDS)[number];

const NUMERIC_RATE_FIELDS: ReadonlySet<OwnRateField> = new Set<OwnRateField>([
	'billRateValue',
	'minimumBillingRate',
	'reWeeklyLimit'
]);

export const OWN_RATES_LOCKED_MESSAGE =
	'Your organization does not let employees change their own rates. Send a rate change request to an admin instead.';

/**
 * Empty, null and zero are the same amount: the profile form sends an empty rate as it is, and the billing rate
 * transform reads an empty value as 0.
 */
function asAmount(value: unknown): number {
	const present = value ?? 0;
	return Number(present);
}

function asText(value: unknown): string {
	const present = value ?? '';
	return String(present);
}

function isSent(input: Partial<IEmployeeUpdateInput>, field: OwnRateField): boolean {
	return input[field] !== undefined;
}

function changes(stored: Partial<IEmployee>, input: Partial<IEmployeeUpdateInput>, field: OwnRateField): boolean {
	if (!isSent(input, field)) {
		return false;
	}
	if (NUMERIC_RATE_FIELDS.has(field)) {
		return asAmount(stored[field]) !== asAmount(input[field]);
	}
	return asText(stored[field]) !== asText(input[field]);
}

/**
 * The rate fields an update changes. Values are compared, not presence: a profile form sends the unchanged rate with
 * every save.
 */
export function changedOwnRateFields(stored: Partial<IEmployee>, input: Partial<IEmployeeUpdateInput>): OwnRateField[] {
	return OWN_RATE_FIELDS.filter((field) => changes(stored, input, field));
}

/**
 * Refuses an employee's change to their own rates when their organization turned `allowEmployeesToEditOwnRates` off.
 * Someone who may edit every employee is never held to it, and every other field of the profile still saves.
 *
 * @param employee - The stored employee, with its organization.
 * @param input - The update.
 * @param caller - Whether the caller edits their own record, and whether they may edit every employee.
 * @throws ForbiddenException when a locked rate field would change.
 */
export function assertOwnRatesMayChange(
	employee: Partial<IEmployee>,
	input: Partial<IEmployeeUpdateInput>,
	caller: { editsOwnRecord: boolean; editsEveryEmployee: boolean }
): void {
	const isSelfEdit = caller.editsOwnRecord && !caller.editsEveryEmployee;
	if (!isSelfEdit) {
		return;
	}
	const ratesLocked = employee.organization?.allowEmployeesToEditOwnRates === false;
	if (!ratesLocked) {
		return;
	}
	const changed = changedOwnRateFields(employee, input);
	if (changed.length > 0) {
		throw new ForbiddenException(OWN_RATES_LOCKED_MESSAGE);
	}
}
