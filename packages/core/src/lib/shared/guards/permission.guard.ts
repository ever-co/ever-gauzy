import { CanActivate, ExecutionContext, Inject, Injectable, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { verify } from 'jsonwebtoken';
import { PERMISSIONS_METADATA } from '@gauzy/common';
import { environment as env } from '@gauzy/config';
import { PermissionsEnum } from '@gauzy/contracts';
import { deduplicate, isEmpty } from '@gauzy/utils';
import { RequestContext } from './../../core/context';
import { RolePermissionService } from '../../role-permission/role-permission.service';

@Injectable()
export class PermissionGuard implements CanActivate {
	constructor(
		@Inject(CACHE_MANAGER) private cacheManager: Cache,
		private readonly _reflector: Reflector,
		private readonly _rolePermissionService: RolePermissionService
	) {}

	/**
	 * Checks if the user is authorized based on specified permissions.
	 * @param context The execution context.
	 * @returns A promise that resolves to a boolean indicating authorization status.
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		console.log('PermissionGuard canActivate called');

		// Retrieve permissions from metadata
		const targets: Array<Function | Type<any>> = [context.getHandler(), context.getClass()];
		const permissions =
			deduplicate(this._reflector.getAllAndOverride<PermissionsEnum[]>(PERMISSIONS_METADATA, targets)) || [];

		// If no specific permissions are required, consider it authorized
		if (isEmpty(permissions)) {
			return true;
		}

		// Check user authorization
		const token = RequestContext.currentToken();

		const { id, role } = verify(token, env.JWT_SECRET) as { id: string; role: string };

		// Retrieve current role ID and tenant ID from RequestContext
		const tenantId = RequestContext.currentTenantId();
		const roleId = RequestContext.currentRoleId();

		const cacheKey = `userPermissions_${tenantId}_${roleId}_${permissions.join('_')}`;

		console.log('Checking User Permissions from Cache with key:', cacheKey);

		let isAuthorized = false;

		const fromCache = await this.cacheManager.get<boolean | null>(cacheKey);

		if (fromCache == null) {
			console.log('User Permissions NOT loaded from Cache with key:', cacheKey);

			// Check if user has the required permissions
			isAuthorized = await this._rolePermissionService.checkRolePermission(tenantId, roleId, permissions, true);

			await this.cacheManager.set(
				cacheKey,
				isAuthorized,
				5 * 60 * 1000 // 5 minutes cache expiration time for User Permissions
			);
		} else {
			isAuthorized = fromCache;
			console.log(`User Permissions loaded from Cache with key: ${cacheKey}. Value: ${isAuthorized}`);
		}

		// Log unauthorized access attempts
		if (!isAuthorized) {
			// Log unauthorized access attempts
			console.log(
				`Unauthorized access blocked: User ID: ${id}, Role: ${role}, Tenant ID:', ${tenantId}, Permissions Checked: ${permissions.join(
					', '
				)}`
			);
		} else {
			console.log(
				`Access granted.  User ID: ${id}, Role: ${role}, Tenant ID:', ${tenantId}, Permissions Checked: ${permissions.join(
					', '
				)}`
			);
		}

		return isAuthorized;
	}
}
