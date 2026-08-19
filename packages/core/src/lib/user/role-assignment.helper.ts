import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RolesEnum } from '@gauzy/contracts';

/**
 * Decides whether a caller may assign a role, given the role's name **as resolved from the database**
 * and whether the caller holds `SUPER_ADMIN_EDIT`.
 *
 * Two rules, both fail-closed:
 *
 * 1. An unresolvable role id is refused. `UserService.resolveRoleName()` scopes its lookup to the
 *    caller's tenant, so a role id borrowed from another tenant resolves to `undefined` — treating
 *    that as "not a super admin" would let an attacker who owns a second tenant on the same
 *    deployment pass their own tenant's SUPER_ADMIN role id through the gate.
 * 2. Granting SUPER_ADMIN requires `SUPER_ADMIN_EDIT` — the same boundary the register handler and
 *    invite creation enforce (GHSA-hjcg-633x-qq74 / GHSA-x4mv-fhwj-g3rp).
 *
 * Callers must apply this to EVERY role identifier in the payload (both the flat `roleId` and the
 * `role` relation): the relation wins when the row is persisted, so validating only one of them lets
 * a body pair a harmless `roleId` with a privileged `role: { id }`.
 *
 * @param roleName - The role name resolved from the database, or undefined when it did not resolve.
 * @param canEditSuperAdmin - Whether the caller holds `PermissionsEnum.SUPER_ADMIN_EDIT`.
 */
export function assertRoleAssignmentAllowed(roleName: string | undefined, canEditSuperAdmin: boolean): void {
	if (!roleName) {
		throw new BadRequestException('The specified role does not exist in this tenant.');
	}
	if (roleName === RolesEnum.SUPER_ADMIN && !canEditSuperAdmin) {
		throw new ForbiddenException('Only a super admin may assign the super admin role.');
	}
}
