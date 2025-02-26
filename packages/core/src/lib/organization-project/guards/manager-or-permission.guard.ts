import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';
import { OrganizationProjectService } from '../organization-project.service';
import { PermissionGuard } from '../../shared';
import { RolePermissionService } from '../../role-permission';

@Injectable()
export class ManagerOrPermissionGuard extends PermissionGuard implements CanActivate {
	constructor(
		@Inject(CACHE_MANAGER) cacheManager: Cache,
		reflector: Reflector,
		rolePermissionService: RolePermissionService,
		private readonly _projectService: OrganizationProjectService
	) {
		super(cacheManager, reflector, rolePermissionService);
	}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		console.log('✅ ManagerOrPermissionGuard canActivate called');

		// Extract request and projectId from params
		const request = context.switchToHttp().getRequest();
		const projectId = request.params.id;

		// Get user details from the request context
		const { employeeId } = request.user;

		// Check if the user is a project manager
		if (employeeId && projectId) {
			const isManager = await this._projectService.isManagerOfProject(projectId, employeeId);
			if (isManager) {
				console.log(`✅ User (employeeId: ${employeeId}) is manager of project ${projectId}, access granted.`);
				return true;
			}
		}

		// If the user is not a manager, delegate the check to PermissionGuard
		console.log(`🔄 User is not a manager, deferring to PermissionGuard.`);
		return super.canActivate(context);
	}
}
