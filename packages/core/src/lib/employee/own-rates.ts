import { ForbiddenException } from '@nestjs/common';
import { IEmployee, IEmployeeUpdateInput } from '@gauzy/contracts';

/** The rate fields one changes on one's own employee record only with CHANGE_OWN_RATES. */
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
	'You cannot change your own rates. Send a rate change request to an admin instead.';

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
 * Whether two ids name the same employee. A route id passes the UUID pipe in any letter case, and Postgres matches
 * every case to the stored row, so ids are compared without case.
 */
export function isSameId(first: string | null | undefined, second: string | null | undefined): boolean {
	const bothSet = Boolean(first) && Boolean(second);
	if (!bothSet) {
		return false;
	}
	return first.toLowerCase() === second.toLowerCase();
}

/**
 * The rate fields an update changes. Values are compared, not presence: a profile form sends the unchanged rate with
 * every save.
 */
export function changedOwnRateFields(stored: Partial<IEmployee>, input: Partial<IEmployeeUpdateInput>): OwnRateField[] {
	return OWN_RATE_FIELDS.filter((field) => changes(stored, input, field));
}

/**
 * Refuses a change to one's own rates without CHANGE_OWN_RATES, which SUPER_ADMIN and ADMIN hold by default: an
 * employee sees their rates and sends a rate change request instead. Someone else's rates need ORG_EMPLOYEES_EDIT,
 * which the edit route already requires. Every other field of the profile still saves.
 *
 * @param employee - The stored employee.
 * @param input - The update.
 * @param caller - Whether the caller edits their own record, and whether they may change their own rates.
 * @throws ForbiddenException when a rate field of one's own record would change.
 */
export function assertOwnRatesMayChange(
	employee: Partial<IEmployee>,
	input: Partial<IEmployeeUpdateInput>,
	caller: { editsOwnRecord: boolean; changesOwnRates: boolean }
): void {
	if (!caller.editsOwnRecord) {
		return;
	}
	if (caller.changesOwnRates) {
		return;
	}
	const changed = changedOwnRateFields(employee, input);
	if (changed.length > 0) {
		throw new ForbiddenException(OWN_RATES_LOCKED_MESSAGE);
	}
}

/**
 * Takes the rate fields out of an edit of one's own record made without CHANGE_OWN_RATES, in place. They passed
 * {@link assertOwnRatesMayChange} unchanged, and writing them back could undo a rate an admin changed meanwhile.
 */
export function removeOwnRateFields(changes: Partial<IEmployeeUpdateInput>): void {
	for (const field of OWN_RATE_FIELDS) {
		delete changes[field];
	}
}

/**
 * The saved employee with its rates as stored. A self save without CHANGE_OWN_RATES leaves the rates out of the
 * write, so the save answers without them; the stored ones are read back, never the ones the request sent.
 */
export function withStoredOwnRates(saved: IEmployee, persisted: Partial<IEmployee>): IEmployee {
	const answer: IEmployee = { ...saved };
	for (const field of OWN_RATE_FIELDS) {
		(answer as Record<string, unknown>)[field] = persisted?.[field];
	}
	return answer;
}
