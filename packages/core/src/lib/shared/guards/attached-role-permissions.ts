import { ID, IRole, PermissionsEnum } from '@gauzy/contracts';
import { IAuthenticatedUser } from '../../core/context/types';

/**
 * Decides a role-permission check from the authorization state `JwtStrategy` pinned onto `request.user`,
 * when that state can answer it.
 *
 * `RoleAuthorizationService.attachAuthorizationState` sets `user.permissions` to the enabled permissions
 * of the user's CURRENT role, read from the database at most 60 s ago with the predicate
 * `RolePermissionService.checkRolePermission(tenantId, roleId, permissions, true)` applies in SQL
 * (`enabled`, `isActive`, not `isArchived`, the role's own rows). `PermissionGuard` used to run that
 * query again, behind a 5-minute cache, on every guarded request; the answer was already on the request.
 *
 * `null` means "not decidable here": no attached state (another authentication path, a test double), or
 * a role that belongs to another tenant than the one the request acts in — the SQL path, which scopes by
 * tenant, keeps deciding those.
 *
 * @param user - `request.user`.
 * @param tenantId - The tenant the request acts in (`RequestContext.currentTenantId()`).
 * @param permissions - The permissions the route requires any one of.
 * @returns Whether the role holds one of them, or `null` when the attached state cannot say.
 */
export function attachedRolePermissionVerdict(
	user: IAuthenticatedUser | null | undefined,
	tenantId: ID | null | undefined,
	permissions: readonly PermissionsEnum[]
): boolean | null {
	if (!user || !tenantId || !Array.isArray(user.permissions)) {
		return null;
	}

	const granted = user.permissions as PermissionsEnum[];

	// The lean role of the attached state (or the managed entity under MikroORM) carries its tenant. A role
	// attached as a bare name (`RegisterAuthorizationGuard`) carries none, so it is not decided here.
	const role = user.role as IRole | string | undefined | null;
	if (role === undefined || role === null) {
		// `attachAuthorizationState` leaves no role and NO permissions behind when the role does not resolve:
		// denied here, fail closed. A permission set with no role to tie it to the request's tenant is never
		// granted from the request: the tenant-scoped query decides it.
		return granted.length === 0 ? false : null;
	}
	if (typeof role !== 'object' || role.tenantId !== tenantId) {
		return null;
	}

	return permissions.some((permission) => granted.includes(permission));
}
