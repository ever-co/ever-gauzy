import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PermissionGuard } from './permission.guard';
import { RequestContext } from '../../core/context';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import { RolePermissionService } from '../../role-permission/role-permission.service';
import { isNotEmpty } from '@gauzy/utils';

/**
 * Guard that allows access if the user is either:
 * 1. A manager of the teams/projects specified in the request, OR
 * 2. Has the required permissions
 *
 * This guard checks if the current user is a manager of the teams or projects
 * specified in the request query/body parameters. If they are a manager,
 * access is granted without checking permissions.
 *
 * Usage:
 * @UseGuards(TenantPermissionGuard, ManagerOrPermissionGuard)
 * @Permissions(PermissionsEnum.ALL_ORG_EDIT)
 */
@Injectable()
export class ManagerOrPermissionGuard extends PermissionGuard {
	constructor(
		@Inject(CACHE_MANAGER) protected _cacheManager: Cache,
		protected readonly _reflector: Reflector,
		protected readonly _rolePermissionService: RolePermissionService,
		private readonly _managedEmployeeService: ManagedEmployeeService
	) {
		super(_cacheManager, _reflector, _rolePermissionService);
	}

	/**
	 * Determines if the current user can activate the route.
	 *
	 * @param context - The execution context
	 * @returns True if user is a manager of specified teams/projects OR has required permissions
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const employeeId = RequestContext.currentEmployeeId();

		// If no employeeId, fall back to permission check
		if (!employeeId) {
			return super.canActivate(context);
		}

		try {
			const request = this.getRequest(context);

			// Extract teamIds and projectIds from query or body
			const teamIds = this.extractIds(request, 'teamIds', 'organizationTeamId');
			const projectIds = this.extractIds(request, 'projectIds', 'projectId');

			// If teamIds or projectIds are provided, check if user is a manager
			if (isNotEmpty(teamIds) || isNotEmpty(projectIds)) {
				const isManager = await this._managedEmployeeService.isManagerOfTeamsOrProjects(
					employeeId,
					teamIds,
					projectIds
				);

				if (isManager) {
					return true; // User is a manager → Grant access
				}
			}

			// Not a manager or no teams/projects specified → Check permissions
			return super.canActivate(context);
		} catch (error) {
			// On error, fall back to permission check
			return super.canActivate(context);
		}
	}

	/**
	 * Extracts IDs from request query or body.
	 * Handles both array and single value cases.
	 *
	 * @param request - The HTTP request
	 * @param arrayKey - The key for array values (e.g., 'teamIds')
	 * @param singleKey - The key for single values (e.g., 'organizationTeamId')
	 * @returns Array of IDs
	 */
	private extractIds(request: any, arrayKey: string, singleKey: string): string[] {
		const ids: string[] = [];

		// Check query params
		if (request.query) {
			if (request.query[arrayKey]) {
				const queryIds = Array.isArray(request.query[arrayKey])
					? request.query[arrayKey]
					: [request.query[arrayKey]];
				ids.push(...queryIds);
			}
			if (request.query[singleKey]) {
				ids.push(request.query[singleKey]);
			}
		}

		// Check body params
		if (request.body) {
			if (request.body[arrayKey]) {
				const bodyIds = Array.isArray(request.body[arrayKey])
					? request.body[arrayKey]
					: [request.body[arrayKey]];
				ids.push(...bodyIds);
			}
			if (request.body[singleKey]) {
				ids.push(request.body[singleKey]);
			}
		}

		// Remove duplicates and filter out undefined/null
		return [...new Set(ids)].filter((id) => id != null);
	}
}
