import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { EntityManager } from 'typeorm';
import { ID, IEmployee, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from './../core/context';
import {
	assertCurrentUserBelongsToOrganization,
	assertCurrentUserBelongsToSentOrganization,
	isSent
} from './../user-organization/assert-organization-membership';

/**
 * Refuses a read of one employee's statistics that would reach an organization the caller does not belong to.
 *
 * A stated organization has to be one of the caller's. Without one, the income and expense reads behind the
 * monthly and history answers drop that filter and reach the employee in whichever organization it belongs to,
 * and neither `@IsEmployeeBelongsToOrganization()` nor its GraphQL counterpart checks an employee that is stated
 * with no organization beside it. So that employee's own organization is the one checked; an employee is then
 * required, because without one the split-expense reads look up the tenant's first employee instead.
 *
 * A caller without `CHANGE_SELECTED_EMPLOYEE` reads only their own employee's figures
 * ({@link assertOwnEmployeeUnlessSelecting}).
 *
 * `GET /employee-statistics/history` made this check on its own; `/months` and the `employeeMonthlyStatistics`
 * and `employeeStatisticsHistory` fields did not, so a member of one organization could read the figures of an
 * employee of another organization of the same tenant.
 *
 * @param manager The TypeORM entity manager the membership lookups run with.
 * @param employees What reads the employee, scoped to the caller's tenant.
 * @param input The organization and the employee the read names.
 * @throws ForbiddenException when the caller is not a member of the organization the read would reach, or names
 * another employee than their own without `CHANGE_SELECTED_EMPLOYEE`.
 * @throws BadRequestException when a stated organization is not a UUID, or no organization is stated and the
 * employee is not a UUID.
 */
export async function assertStatisticsReadInScope(
	manager: EntityManager,
	employees: { findOneByIdString(id: ID): Promise<IEmployee> },
	input: { organizationId?: unknown; employeeId?: unknown }
): Promise<void> {
	assertOwnEmployeeUnlessSelecting(input?.employeeId);
	await assertCurrentUserBelongsToSentOrganization(manager, input?.organizationId);

	if (isSent(input?.organizationId)) {
		return;
	}

	if (!isUUID(input?.employeeId)) {
		throw new BadRequestException('employeeId must be a UUID');
	}

	const employee = await employees.findOneByIdString(input.employeeId as ID);

	await assertCurrentUserBelongsToOrganization(manager, employee.organizationId);
}

/**
 * Keeps a caller without `CHANGE_SELECTED_EMPLOYEE` to their own employee's figures.
 *
 * The per-employee statistics routes and fields ask for `ADMIN_DASHBOARD_VIEW` or `HUMAN_RESOURCE_DASHBOARD`, and the
 * default EMPLOYEE role holds `ADMIN_DASHBOARD_VIEW`: the organization check alone let an employee read the income,
 * expense and bonus figures of any coworker. Choosing another employee is what `CHANGE_SELECTED_EMPLOYEE` grants
 * everywhere else.
 *
 * @param employeeId The employee the read names.
 * @throws ForbiddenException when the caller lacks `CHANGE_SELECTED_EMPLOYEE` and names another employee, or none.
 */
export function assertOwnEmployeeUnlessSelecting(employeeId: unknown): void {
	if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
		return;
	}
	const own = RequestContext.currentEmployeeId();
	if (!own || employeeId !== own) {
		throw new ForbiddenException();
	}
}
