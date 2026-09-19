import { CanActivate, ExecutionContext, Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { isUUID } from 'class-validator';
import { isNotEmpty } from '@gauzy/utils';
import { RequestContext } from '../../core/context';
import { PermissionsEnum } from '@gauzy/contracts';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';

/**
 * Guard to enforce the `allowEmployeeToSeeTrackedData` organization setting.
 *
 * Allows the request when:
 * 1. The caller has `CHANGE_SELECTED_EMPLOYEE` permission (Admin / Super Admin), OR
 * 2. The caller has no employee record (retains role-based access), OR
 * 3. The organization setting `allowEmployeeToSeeTrackedData` is `true` (or not explicitly `false`), OR
 * 4. The caller is a team/project manager for the requested target scope or manages any active team/project in the organization.
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

		// Validate organizationId UUID format before DB lookup
		if (typeof organizationId !== 'string' || !isUUID(organizationId)) {
			throw new BadRequestException('Invalid organizationId');
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

		// Setting is disabled — callers with no employee record keep role-based access
		const currentEmployeeId = RequestContext.currentUser()?.employeeId;
		if (!currentEmployeeId) {
			return true;
		}

		// Check manager status for teamIds, projectIds, or employeeIds
		const teamIds = this.extractIds(request, 'teamIds', 'organizationTeamId');
		const projectIds = this.extractIds(request, 'projectIds', 'projectId');
		const employeeIds = this.extractIds(request, 'employeeIds', 'employeeId');

		if (isNotEmpty(teamIds) || isNotEmpty(projectIds)) {
			const isManager = await this.managedEmployeeService.isManagerOfTeamsOrProjects(
				currentEmployeeId,
				teamIds,
				projectIds
			);
			if (isManager) {
				return true;
			}
		}

		const targetOtherEmployees = employeeIds.filter((id) => id !== currentEmployeeId);
		if (isNotEmpty(targetOtherEmployees)) {
			const canManage = await this.managedEmployeeService.canManageEmployees(targetOtherEmployees, teamIds);
			if (canManage) {
				return true;
			}
		}

		// When no specific team/project/target employee IDs are provided, or if none matched:
		// Check whether the caller manages any active team or project in this organization
		const teamEmployeeRepo = this.dataSource.getRepository('OrganizationTeamEmployee');
		const isTeamManager = await teamEmployeeRepo.existsBy({
			employeeId: currentEmployeeId,
			isManager: true,
			isActive: true,
			isArchived: false,
			tenantId,
			organizationId
		});
		if (isTeamManager) {
			return true;
		}

		const projectEmployeeRepo = this.dataSource.getRepository('OrganizationProjectEmployee');
		const isProjectManager = await projectEmployeeRepo.existsBy({
			employeeId: currentEmployeeId,
			isManager: true,
			isActive: true,
			isArchived: false,
			tenantId,
			organizationId
		});
		if (isProjectManager) {
			return true;
		}

		throw new ForbiddenException('Employees are not allowed to view tracked data in this organization');
	}

	private extractIds(request: any, arrayKey: string, singleKey: string): string[] {
		const ids: string[] = [];

		if (request.query) {
			if (request.query[arrayKey]) {
				const queryIds = Array.isArray(request.query[arrayKey])
					? request.query[arrayKey]
					: typeof request.query[arrayKey] === 'string'
					? request.query[arrayKey].split(',')
					: [request.query[arrayKey]];
				ids.push(...queryIds);
			}
			if (request.query[singleKey]) {
				ids.push(request.query[singleKey]);
			}
		}

		if (request.body) {
			if (request.body[arrayKey]) {
				const bodyIds = Array.isArray(request.body[arrayKey])
					? request.body[arrayKey]
					: typeof request.body[arrayKey] === 'string'
					? request.body[arrayKey].split(',')
					: [request.body[arrayKey]];
				ids.push(...bodyIds);
			}
			if (request.body[singleKey]) {
				ids.push(request.body[singleKey]);
			}
		}

		return [...new Set(ids)].filter((id) => id != null && typeof id === 'string' && id.trim() !== '');
	}
}
