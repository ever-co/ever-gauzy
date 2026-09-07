import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RolesEnum } from '@gauzy/contracts';
import { assertRoleAssignmentAllowed } from './role-assignment.helper';

/**
 * Regression suite for the SUPER_ADMIN assignment boundary (GHSA-hjcg-633x-qq74 / GHSA-x4mv-fhwj-g3rp
 * residuals).
 *
 * Two ways the previous gates leaked:
 * - they read the role name from the CLIENT (`input.user.role.name`), so a role object carrying only
 *   an id — or a spoofed name — skipped the check while the id was still persisted;
 * - they resolved only ONE identifier (`roleId ?? role.id`), while the `role` RELATION wins on
 *   persist, so a harmless `roleId` next to a privileged `role: { id }` validated the harmless one;
 * - and an id that did not resolve inside the caller's tenant was treated as "not a super admin",
 *   which let an attacker who also owns a second tenant pass that tenant's SUPER_ADMIN role id.
 */
describe('assertRoleAssignmentAllowed', () => {
	it('allows an ordinary role for any caller', () => {
		expect(() => assertRoleAssignmentAllowed(RolesEnum.EMPLOYEE, false)).not.toThrow();
		expect(() => assertRoleAssignmentAllowed(RolesEnum.ADMIN, false)).not.toThrow();
	});

	it('allows SUPER_ADMIN only for a caller holding SUPER_ADMIN_EDIT', () => {
		expect(() => assertRoleAssignmentAllowed(RolesEnum.SUPER_ADMIN, true)).not.toThrow();
		expect(() => assertRoleAssignmentAllowed(RolesEnum.SUPER_ADMIN, false)).toThrow(ForbiddenException);
	});

	it.each([[undefined], ['']])('refuses an id that did not resolve in the tenant (%p) — fail closed', (roleName) => {
		// A cross-tenant SUPER_ADMIN role id resolves to undefined here; it must NOT read as "harmless".
		expect(() => assertRoleAssignmentAllowed(roleName as any, false)).toThrow(BadRequestException);
		expect(() => assertRoleAssignmentAllowed(roleName as any, true)).toThrow(BadRequestException);
	});

	it('CONTROL: the pre-fix shape (only the first identifier checked) would have admitted the escalation', () => {
		// Body: { roleId: <EMPLOYEE>, role: { id: <SUPER_ADMIN> } } — the relation is what gets persisted.
		const resolved = { roleId: RolesEnum.EMPLOYEE, relation: RolesEnum.SUPER_ADMIN };
		const preFix = () => assertRoleAssignmentAllowed(resolved.roleId, false); // `roleId ?? role.id`
		const fixed = () => [resolved.roleId, resolved.relation].forEach((name) => assertRoleAssignmentAllowed(name, false));
		expect(preFix).not.toThrow();
		expect(fixed).toThrow(ForbiddenException);
	});
});
