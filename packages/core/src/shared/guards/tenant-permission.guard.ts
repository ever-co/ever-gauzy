import { Injectable, CanActivate, ExecutionContext, Type, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { environment as env } from '@gauzy/config';
import { isNotEmpty, PERMISSIONS_METADATA, removeDuplicates } from '@gauzy/common';
import { RequestContext } from './../../core/context';
import { TenantBaseGuard } from './tenant-base.guard';
import { RolePermissionService } from '../../role-permission/role-permission.service';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class TenantPermissionGuard extends TenantBaseGuard implements CanActivate {
	constructor(
		@Inject(CACHE_MANAGER) private cacheManager: Cache,
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
		const tenantId = RequestContext.currentTenantId();

		let isAuthorized = false;

		if (!tenantId) {
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

		const permissions =
			removeDuplicates(this._reflector.getAllAndOverride<PermissionsEnum[]>(PERMISSIONS_METADATA, targets)) || [];

		// Check if permissions are not empty
		if (isNotEmpty(permissions)) {
			// Retrieve current role ID and tenant ID from RequestContext
			const roleId = RequestContext.currentRoleId();

			const cacheKey = `tenantPermissions_${tenantId}_${roleId}_${permissions.join('_')}`;

			console.log('Checking Tenant Permissions from Cache with key:', cacheKey);

			const fromCache = await this.cacheManager.get<boolean | null>(cacheKey);

			if (fromCache == null) {
				console.log('Tenant Permissions NOT loaded from Cache with key:', cacheKey);

				// Check if the tenant has the required permissions
				isAuthorized = await this._rolePermissionService.checkRolePermission(tenantId, roleId, permissions);

				await this.cacheManager.set(
					cacheKey,
					isAuthorized,
					5 * 60 * 1000 // 5 minutes caching period for Tenants Permissions
				);
			} else {
				isAuthorized = fromCache;
				console.log(`Tenant Permissions loaded from Cache with key: ${cacheKey}. Value: ${isAuthorized}`);
			}
		}

		// Log unauthorized access attempts
		if (!isAuthorized) {
			console.log(
				`Unauthorized access blocked. Tenant ID:', ${tenantId}, Permissions Checked: ${permissions.join(', ')}`
			);
		} else {
			console.log(
				`Authorized access granted. Tenant ID:', ${tenantId}, Permissions Checked: ${permissions.join(', ')}`
			);
		}

		return isAuthorized;
	}
}
