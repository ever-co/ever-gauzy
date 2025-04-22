import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';
import { RequestContext } from '../../core/context';
import { PermissionGuard } from '../../shared/guards';
import { RolePermissionService } from '../../role-permission/role-permission.service';
import { OrganizationProjectService } from '../organization-project.service';

@Injectable()
export class ProjectManagerOrPermissionGuard extends PermissionGuard implements CanActivate {
	constructor(
		@Inject(CACHE_MANAGER) _cacheManager: Cache,
		readonly _reflector: Reflector,
		readonly _rolePermissionService: RolePermissionService,
		readonly _projectService: OrganizationProjectService
	) {
		super(_cacheManager, _reflector, _rolePermissionService);
	}

	/**
	 * Determines if the current user has access to the project.
	 * @param context - The execution context of the request.
	 * @returns A boolean indicating whether the user can proceed.
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		// Extract request and projectId from params
		const request = super.getRequest(context);
		const projectId = request.params?.id;

		// Get employeeId from RequestContext
		const employeeId = RequestContext.currentEmployeeId();

		// If either employeeId or projectId is missing, defer to PermissionGuard
		if (!employeeId || !projectId) {
			console.log('⚠️ Missing employeeId or projectId, deferring to PermissionGuard.');
			return super.canActivate(context);
		}

		// Check if the user is a project manager
		const isManager = await this._projectService.isManagerOfProject(projectId, employeeId);
		if (isManager) {
			console.log(`✅ Access granted: User (employeeId: ${employeeId}) is manager of project ${projectId}.`);
			return true;
		}

		// If the user is not a manager, delegate the check to PermissionGuard
		return super.canActivate(context);
	}
}
