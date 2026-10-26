import { IEmployee } from '@gauzy/contracts';

/**
 * Whether a user's employee records make them a deactivated employee, who cannot sign in: they have
 * employee records and none of them is active and unarchived.
 *
 * A user with no employee record (an admin, a viewer) is not one, and neither is an employee still
 * active in another organization of the tenant. This is the rule the MCP OAuth server applies
 * (`OAuthUserService.isDeactivatedEmployee` in `apps/mcp-auth`), so both sign-ins refuse the same people.
 *
 * @param employees - ALL of the user's employee records: inactive and archived ones, in every organization.
 * @returns True when the user has employee records and every one of them is inactive or archived.
 */
export function isDeactivatedEmployee(employees: Pick<IEmployee, 'isActive' | 'isArchived'>[]): boolean {
	return employees.length > 0 && !employees.some((employee) => employee.isActive && !employee.isArchived);
}
