import { Injectable, CanActivate, ExecutionContext, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { environment as env } from '@gauzy/config';
import { isNotEmpty, PERMISSIONS_METADATA, removeDuplicates } from '@gauzy/common';
import { RequestContext } from './../../core/context';
import { TenantBaseGuard } from './tenant-base.guard';
import { RolePermissionService } from '../../role-permission/role-permission.service';

@Injectable()
export class TenantPermissionGuard extends TenantBaseGuard
	implements CanActivate {

	constructor(
		private readonly _reflector: Reflector,
		private readonly _rolePermissionService: RolePermissionService
	) {
		super();
	}

	/**
	 *
	 * @param context
	 * @returns
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const currentTenantId = RequestContext.currentTenantId();
		let isAuthorized = false;

		if (!currentTenantId) {
			return isAuthorized;
		}

		// Check if the guard allows access based on the parent class's canActivate method
		isAuthorized = await super.canActivate(context);

		// If the guard disallows access, return early
		if (!isAuthorized) {
			return isAuthorized;
		}

		// Check for super admin role
		if (env.allowSuperAdminRole && RequestContext.hasRoles([RolesEnum.SUPER_ADMIN])) {
			return true;
		}

		// Retrieve permissions from metadata
		const targets: Array<Function | Type<any>> = [context.getHandler(), context.getClass()];
		const permissions = removeDuplicates(this._reflector.getAllAndOverride<PermissionsEnum[]>(PERMISSIONS_METADATA, targets)) || [];

		// Check if permissions are not empty
		if (isNotEmpty(permissions)) {
			// Check if the tenant has the required permissions
			isAuthorized = await this._rolePermissionService.checkRolePermission(permissions);
		}

		// Log unauthorized access attempts
		if (!isAuthorized) {
			console.log(`Unauthorized access blocked. Tenant ID:', ${currentTenantId}, Permissions Checked: ${permissions.join(', ')}`);
		}

		return isAuthorized;
	}
}
