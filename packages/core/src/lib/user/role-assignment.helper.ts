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

/**
 * The two fields through which a payload can assign a role: the `role` relation and the flat
 * `roleId` column.
 */
export interface IRoleAssignmentPayload {
	role?: unknown;
	roleId?: unknown;
}

/**
 * Reads the role id out of ONE role reference, without throwing.
 *
 * A role reference is either a bare id string or an object carrying a non-empty string `id`. This is
 * an allowlist on purpose: the request validator (`IsRoleShouldExist`) and both ORMs also accept a
 * bare id string for the `role` relation, and TypeORM persists it as the foreign key — so a reader
 * that only looks at `role?.id` misses that form entirely (GHSA-x4mv-fhwj-g3rp).
 *
 * @param value A `role` or `roleId` value from a payload.
 * @returns The role id, or undefined when the value is not a usable reference.
 */
export function resolveRoleReference(value: unknown): string | undefined {
	if (typeof value === 'string') {
		return value.trim() !== '' ? value : undefined;
	}
	if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
		const id = (value as { id?: unknown }).id;
		return typeof id === 'string' && id.trim() !== '' ? id : undefined;
	}
	return undefined;
}

/**
 * Returns EVERY role identifier a payload carries, whichever form it takes: `roleId`, `role` as a
 * bare id string, and `role` as an object with an `id`.
 *
 * Role checks must run on this list, never on `role?.id` / `roleId` picked by hand: each form the
 * check forgets is a form an attacker can use to assign a role nobody checked (GHSA-x4mv-fhwj-g3rp).
 * A key that is PRESENT but does not reference a role (`role: {}`, `role: { id: '' }`, `role: 42`,
 * `roleId: ''`, ...) is refused rather than skipped, so it can never leave the list empty and let
 * the check pass without checking anything. `undefined` and `null` count as "not sent";
 * {@link normalizeRolePayload} strips a `null` so it cannot clear the stored role either.
 *
 * @param payload The request payload (or its `user` part).
 * @returns The distinct role ids, in payload order (`roleId` first).
 * @throws BadRequestException When a role key is present but does not reference a role.
 */
export function extractRoleIds(payload: IRoleAssignmentPayload | null | undefined): string[] {
	if (!payload || typeof payload !== 'object') {
		return [];
	}

	const ids: string[] = [];
	for (const key of ['roleId', 'role'] as const) {
		const value = payload[key];
		if (value === undefined || value === null) {
			continue;
		}
		const roleId = resolveRoleReference(value);
		if (!roleId) {
			throw new BadRequestException('The specified role does not reference a valid role.');
		}
		if (!ids.includes(roleId)) {
			ids.push(roleId);
		}
	}
	return ids;
}

/**
 * Makes the payload persist exactly the role that was checked, and returns that role id.
 *
 * - Two DIFFERENT role ids (`roleId` vs `role`) are refused: which one the ORM writes is an ORM
 *   detail, and the check must never validate one while the other is stored.
 * - A bare id string in `role` becomes `{ id }`, and `roleId` is pinned to the same id, so the
 *   relation and the FK column always agree.
 * - A `null` role or roleId is removed, so it can neither clear the stored role nor bypass the check.
 *
 * Call it once the payload is authorized and before it is saved. A role object is kept as is (only
 * its `id` is persisted — the relation does not cascade), so callers that read `role.name` from the
 * saved entity keep working.
 *
 * @param payload The payload to normalize (mutated in place).
 * @returns The single role id the payload assigns, or undefined when it assigns none.
 * @throws BadRequestException When a role key is malformed or the two keys disagree.
 */
export function normalizeRolePayload(payload: IRoleAssignmentPayload | null | undefined): string | undefined {
	const ids = extractRoleIds(payload);
	if (ids.length > 1) {
		throw new BadRequestException('The role and roleId fields must reference the same role.');
	}
	if (!payload || typeof payload !== 'object') {
		return undefined;
	}

	const [roleId] = ids;
	if (!roleId) {
		// Only `undefined` / `null` can reach here; never let a `null` through to the write.
		delete payload.role;
		delete payload.roleId;
		return undefined;
	}

	payload.roleId = roleId;
	if (payload.role === null) {
		delete payload.role;
	} else if (typeof payload.role === 'string') {
		payload.role = { id: roleId };
	}
	return roleId;
}
