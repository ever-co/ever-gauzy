import { IEmployee } from '@gauzy/contracts';

/**
 * Sets an employee's `fullName` to their user's name, when the user is loaded and has a name.
 *
 * @param employee - The loaded employee.
 */
export function setEmployeeFullName(employee: IEmployee): void {
	if (employee?.user?.name) {
		employee.fullName = employee.user.name;
	}
}
