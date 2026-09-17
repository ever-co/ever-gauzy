import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RequestContext } from '../../core/context';
import { PermissionsEnum } from '@gauzy/contracts';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';

/**
 * Guard to enforce the `allowEmployeeToSeeTrackedData` organization setting.
 *
 * Allows the request when:
 * 1. The caller has `CHANGE_SELECTED_EMPLOYEE` permission (Admin / Super Admin), OR
 * 2. The caller is a team/project manager in the organization, OR
 * 3. The organization setting `allowEmployeeToSeeTrackedData` is `true` (or not explicitly `false`).
 *
 * Blocks (403) when:
 * - The setting is `false` and the caller is a regular employee without manager status.
 * - The organization ID cannot be resolved.
 * - The organization does not exist (within the caller's tenant).
 */
@Injectable()
export class EmployeeTrackedDataGuard implements CanActivate {
	constructor(
		private readonly dataSource: DataSource,
		private readonly managedEmployeeService: ManagedEmployeeService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		// Bypass 1: Admin / Super Admin with CHANGE_SELECTED_EMPLOYEE
		if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			return true;
		}

		const request = context.switchToHttp().getRequest();
		const organizationId =
			request.query?.organizationId ||
			request.body?.organizationId ||
			request.params?.organizationId ||
			RequestContext.currentOrganizationId();

		// Fail closed: no organization ID could be resolved
		if (!organizationId) {
			throw new ForbiddenException('Organization context is required to access tracked data');
		}

		const tenantId = RequestContext.currentTenantId();
		const organizationRepo = this.dataSource.getRepository('Organization');
		const organization = await organizationRepo.findOne({
			where: { id: organizationId, tenantId },
			select: { id: true, allowEmployeeToSeeTrackedData: true }
		});

		// Fail closed: organization not found (or not in caller's tenant)
		if (!organization) {
			throw new ForbiddenException('Organization not found or not accessible');
		}

		// Setting is enabled (or not explicitly false) — allow all employees
		if (organization['allowEmployeeToSeeTrackedData'] !== false) {
			return true;
		}

		// Setting is disabled — check if the caller is a team/project manager
		const currentEmployeeId = RequestContext.currentUser()?.employeeId;
		if (currentEmployeeId) {
			const isManager = await this.managedEmployeeService.isManagerOfTeamsOrProjects(
				currentEmployeeId,
				[], // no specific teamIds — check all teams in the org
				[]  // no specific projectIds — check all projects in the org
			);
			if (isManager) {
				return true;
			}
		}

		throw new ForbiddenException('Employees are not allowed to view tracked data in this organization');
	}
}
