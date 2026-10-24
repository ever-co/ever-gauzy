import { Injectable, CanActivate, ExecutionContext, Type, Inject, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PERMISSIONS_METADATA, PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { environment as env } from '@gauzy/config';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { isEmpty, isNotEmpty, deduplicate } from '@gauzy/utils';
import { RequestContext } from './../../core/context';
import {
	narrowPermissionsToOAuthAppScopes,
	oauthAppScopesAllowWrites,
	oauthAppScopesOf
} from '../../auth/oauth-app-scope';
import { TenantBaseGuard } from './tenant-base.guard';
import { isMutatingOperation } from './mutating-operation';
import { RolePermissionService } from '../../role-permission/role-permission.service';

// Per-request trace lines: printed at debug level, i.e. only when LOG_LEVEL is debug/verbose (or unset).
const logger = new Logger('TenantPermissionGuard');

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
		logger.debug('TenantPermissionGuard canActivate called');

		// Check if the route or controller has the PUBLIC decorator
		const isPublic =
			this._reflector.get<boolean>(PUBLIC_METHOD_METADATA, context.getHandler()) ||
			this._reflector.get<boolean>(PUBLIC_METHOD_METADATA, context.getClass());

		// Allow access if the method or class has the PUBLIC decorator
		if (isPublic) {
			return true;
		}

		const tenantId = RequestContext.currentTenantId();
		const roleId = RequestContext.currentRoleId();

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

		let permissions =
			deduplicate(this._reflector.getAllAndOverride<PermissionsEnum[]>(PERMISSIONS_METADATA, targets)) || [];

		// A third-party OAuth-app token reaches only the permissions its approved scopes allow (owner decision Q12): the
		// role query below is asked about those alone, so it cannot grant one outside the scopes. A token without a
		// write scope never writes here, even on a route that declares no permission or also accepts a read one.
		const oauthAppScopes = oauthAppScopesOf(RequestContext.currentUser());
		if (oauthAppScopes !== null && !oauthAppScopesAllowWrites(oauthAppScopes) && isMutatingOperation(context)) {
			console.log(
				`Unauthorized access blocked: OAuth app token without a write scope. Tenant ID: ${tenantId}, Role ID: ${roleId}`
			);
			return false;
		}
		if (oauthAppScopes !== null && isNotEmpty(permissions)) {
			const reachable = narrowPermissionsToOAuthAppScopes(permissions, oauthAppScopes);
			if (isEmpty(reachable)) {
				console.log(
					`Unauthorized access blocked: OAuth app token scopes do not allow any of the permissions. Tenant ID: ${tenantId}, Role ID: ${roleId}, Permissions Checked: ${permissions.join(
						', '
					)}`
				);
				return false;
			}
			permissions = reachable;
		}

		// Check if permissions are not empty
		if (isNotEmpty(permissions)) {
			const cacheKey = `tenantPermissions_${tenantId}_${roleId}_${permissions.join('_')}`;

			logger.debug(`Checking Tenant Permissions from Cache with key: ${cacheKey}`);

			const fromCache = await this.cacheManager.get<boolean | null>(cacheKey);

			if (fromCache == null) {
				logger.debug(`Tenant Permissions NOT loaded from Cache with key: ${cacheKey}`);

				// Check if the tenant has the required permissions
				isAuthorized = await this._rolePermissionService.checkRolePermission(tenantId, roleId, permissions);

				await this.cacheManager.set(
					cacheKey,
					isAuthorized,
					5 * 60 * 1000 // 5 minutes caching period for Tenants Permissions
				);
			} else {
				isAuthorized = fromCache;
				logger.debug(`Tenant Permissions loaded from Cache with key: ${cacheKey}. Value: ${isAuthorized}`);
			}
		}

		// Log unauthorized access attempts
		if (!isAuthorized) {
			console.log(
				`Unauthorized access blocked. Tenant ID: ${tenantId}, Role ID: ${roleId}, Permissions Checked: ${permissions.join(
					', '
				)}`
			);
		} else {
			logger.debug(
				`Authorized access granted. Tenant ID: ${tenantId}, Role ID: ${roleId}, Permissions Checked: ${permissions.join(
					', '
				)}`
			);
		}

		return isAuthorized;
	}
}
