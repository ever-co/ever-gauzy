import { IEmployee } from '@gauzy/contracts';

/**
 * Whether a user's employee records make them the account of a member without an account (a placeholder), who never
 * signs in: one of the records is a placeholder. A placeholder's user is created for it alone (no email, no password),
 * so a single placeholder record says the whole account is one, whatever the state of its other records.
 *
 * @param employees - ALL of the user's employee records: inactive and archived ones, in every organization.
 * @returns True when one of the records is a placeholder.
 */
export function isPlaceholderAccount(employees: Pick<IEmployee, 'isPlaceholder'>[]): boolean {
	return employees.some((employee) => employee.isPlaceholder === true);
}
