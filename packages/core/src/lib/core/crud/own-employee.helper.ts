import { ForbiddenException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../context';

/**
 * Refuses a write that files a row only an employee owns, when the signed-in caller has no employee record and may
 * not act for other employees (a viewer, a candidate).
 *
 * `TenantAwareCrudService.create` stamps the caller's employee over the body's only when the caller has one, so such
 * a caller wrote the row under whichever employee the body named. A request with no user (a seeder, a job) is let
 * through: it states the employee itself.
 *
 * @param message The refusal.
 * @throws ForbiddenException for such a caller.
 */
export function assertHasOwnEmployee(message: string): void {
	if (!RequestContext.currentUser()) {
		return;
	}
	// `currentEmployeeId()` is null both without an employee record and with CHANGE_SELECTED_EMPLOYEE
	if (RequestContext.currentEmployeeId() || RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
		return;
	}
	throw new ForbiddenException(message);
}
