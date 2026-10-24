import { CanActivate, ExecutionContext, Inject, Injectable, Logger, Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import { deduplicate, isEmpty } from '@gauzy/utils';
import { RequestContext } from './../../core/context';
import { narrowPermissionsToOAuthAppScopes } from '../../auth/oauth-app-scope';
import { debugInDevelopment } from '../../logger';
import { BaseGuard } from './base.guard';
import { attachedRolePermissionVerdict } from './attached-role-permissions';
import { RolePermissionService } from '../../role-permission/role-permission.service';

const logger = new Logger('PermissionGuard');

@Injectable()
export class PermissionGuard extends BaseGuard implements CanActivate {
	constructor(
		@Inject(CACHE_MANAGER) protected _cacheManager: Cache,
		protected readonly _reflector: Reflector,
		protected readonly _rolePermissionService: RolePermissionService
	) {
		super();
	}

	/**
	 * Checks if the user is authorized based on specified permissions.
	 * @param context The execution context.
	 * @returns A promise that resolves to a boolean indicating authorization status.
	 */
	async canActivate(context: ExecutionContext): Promise<boolean> {
		// Retrieve permissions from metadata
		let permissions = this.routePermissions(context);

		// If no specific permissions are required, consider it authorized
		if (isEmpty(permissions)) {
			return true;
		}

		// Identify the caller for the audit lines below from the request's DB-fresh user, never by
		// decoding the bearer token again: its `role` claim is whatever the user was when it was issued.
		const id = RequestContext.currentUserId();
		const role = RequestContext.currentRoleName();

		// A third-party OAuth-app token reaches only the permissions its approved scopes allow (owner decision Q12).
		// The role's permissions on the request are already narrowed by JwtStrategy; narrowing what the route asks
		// for as well keeps the role query below (a request without that state) from granting outside the scopes.
		const reachable = this.reachableByOAuthAppScopes(permissions);
		if (isEmpty(reachable)) {
			logger.warn(
				`Unauthorized access blocked: OAuth app token scopes do not allow any of the permissions. User ID: ${id}, Role: ${role}, Permissions Checked: ${permissions.join(', ')}`
			);
			return false;
		}
		permissions = reachable;

		// Retrieve current role ID and tenant ID from RequestContext
		const tenantId = RequestContext.currentTenantId();
		const roleId = RequestContext.currentRoleId();

		let isAuthorized = false;

		// The role's DB-fresh permissions are already on the request (JwtStrategy); the same predicate the
		// query below applies, without the cache round trip and the query. See ./attached-role-permissions.ts.
		const attached = attachedRolePermissionVerdict(RequestContext.currentUser(), tenantId, permissions);

		if (attached !== null) {
			isAuthorized = attached;
			debugInDevelopment(logger, () => `User Permissions decided from the request's role state: ${isAuthorized}`);
		} else {
			const cacheKey = `userPermissions_${tenantId}_${roleId}_${permissions.join('_')}`;

			const fromCache = await this._cacheManager.get<boolean | null>(cacheKey);

			if (fromCache == null) {
				debugInDevelopment(logger, () => `User Permissions NOT loaded from Cache with key: ${cacheKey}`);

				// Check if user has the required permissions
				isAuthorized = await this._rolePermissionService.checkRolePermission(
					tenantId,
					roleId,
					permissions,
					true
				);

				await this._cacheManager.set(
					cacheKey,
					isAuthorized,
					5 * 60 * 1000 // 5 minutes cache expiration time for User Permissions
				);
			} else {
				isAuthorized = fromCache;
				debugInDevelopment(
					logger,
					() => `User Permissions loaded from Cache with key: ${cacheKey}. Value: ${isAuthorized}`
				);
			}
		}

		// Blocked access stays logged in every environment: it is the only trace of a denied request.
		if (!isAuthorized) {
			logger.warn(
				`Unauthorized access blocked: User ID: ${id}, Role: ${role}, Tenant ID: ${tenantId}, Permissions Checked: ${permissions.join(', ')}`
			);
		} else {
			debugInDevelopment(
				logger,
				() =>
					`Access granted. User ID: ${id}, Role: ${role}, Tenant ID: ${tenantId}, Permissions Checked: ${permissions.join(', ')}`
			);
		}

		return isAuthorized;
	}

	/**
	 * The permissions a route declares (`@Permissions(...)` on the handler, else on the class), deduplicated.
	 *
	 * @param context The execution context.
	 * @returns The declared permissions; empty when the route declares none.
	 */
	protected routePermissions(context: ExecutionContext): PermissionsEnum[] {
		const targets: Array<Function | Type<any>> = [context.getHandler(), context.getClass()];
		return deduplicate(this._reflector.getAllAndOverride<PermissionsEnum[]>(PERMISSIONS_METADATA, targets)) || [];
	}

	/**
	 * The permissions among `permissions` the request may be granted at all: every one of them for a first-party
	 * caller, only the ones its approved scopes allow for a third-party OAuth-app token (see `auth/oauth-app-scope.ts`).
	 *
	 * @param permissions The permissions a route declares.
	 * @returns The reachable ones.
	 */
	protected reachableByOAuthAppScopes(permissions: PermissionsEnum[]): PermissionsEnum[] {
		const scopes = RequestContext.currentOAuthAppScopes();
		return scopes === null ? permissions : narrowPermissionsToOAuthAppScopes(permissions, scopes);
	}

	/**
	 * Whether a grant that does not come from the role (a project manager's, for instance) may apply to this request:
	 * always for a first-party caller; for an OAuth-app token, only when its scopes reach one of the permissions the
	 * route declares, so a read-only app is never handed a write route through a relationship.
	 *
	 * @param context The execution context.
	 * @returns Whether such a grant may apply.
	 */
	protected oauthAppScopesReachRoute(context: ExecutionContext): boolean {
		const permissions = this.routePermissions(context);
		return isEmpty(permissions) || !isEmpty(this.reachableByOAuthAppScopes(permissions));
	}
}
