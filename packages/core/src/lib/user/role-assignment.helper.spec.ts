import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RolesEnum } from '@gauzy/contracts';
import {
	assertRoleAssignmentAllowed,
	extractRoleIds,
	normalizeRolePayload,
	resolveRoleReference
} from './role-assignment.helper';

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

/**
 * GHSA-x4mv-fhwj-g3rp: the role checks read `role?.id` and `roleId`, while the request validator and
 * both ORMs also accept `role` as a bare id STRING. That form was invisible to every check.
 */
describe('role payload extraction (GHSA-x4mv-fhwj-g3rp)', () => {
	const SA = '55555555-5555-4555-8555-555555555555';
	const EMP = '44444444-4444-4444-8444-444444444444';

	/** The exact pre-fix extraction used by updateProfile / UserCreateHandler / assertCanAssignRoles. */
	const preFixExtract = (payload: any) => [payload.role?.id, payload.roleId].filter((id) => !!id);

	describe('resolveRoleReference', () => {
		it.each([
			[SA, SA],
			[{ id: SA }, SA],
			[{ id: SA, name: RolesEnum.SUPER_ADMIN }, SA]
		])('reads %p as %p', (value, expected) => {
			expect(resolveRoleReference(value)).toBe(expected);
		});

		it.each([[undefined], [null], [''], ['   '], [42], [[SA]], [{}], [{ id: '' }], [{ id: 42 }], [{ id: null }]])(
			'reads %p as no role',
			(value) => {
				expect(resolveRoleReference(value)).toBeUndefined();
			}
		);
	});

	describe('extractRoleIds', () => {
		it('CONTROL: the pre-fix extraction sees nothing in a bare-string role', () => {
			expect(preFixExtract({ role: SA })).toEqual([]);
			expect(preFixExtract({ roleId: EMP, role: SA })).toEqual([EMP]);
		});

		it('reads a bare-string role', () => {
			expect(extractRoleIds({ role: SA })).toEqual([SA]);
		});

		it('reads every form at once, roleId first and de-duplicated', () => {
			expect(extractRoleIds({ roleId: EMP, role: SA })).toEqual([EMP, SA]);
			expect(extractRoleIds({ roleId: EMP, role: { id: SA } })).toEqual([EMP, SA]);
			expect(extractRoleIds({ roleId: SA, role: { id: SA, name: 'x' } })).toEqual([SA]);
		});

		it('treats absent, undefined and null as "not sent"', () => {
			expect(extractRoleIds(undefined)).toEqual([]);
			expect(extractRoleIds({})).toEqual([]);
			expect(extractRoleIds({ role: undefined, roleId: undefined })).toEqual([]);
			expect(extractRoleIds({ role: null, roleId: null })).toEqual([]);
		});

		it.each([
			[{ role: {} }],
			[{ role: { id: '' } }],
			[{ role: { name: RolesEnum.SUPER_ADMIN } }],
			[{ role: 42 }],
			[{ role: [SA] }],
			[{ roleId: '' }],
			[{ roleId: 42 }],
			// An empty `role` must not mask a privileged `roleId`, and vice versa: refused outright.
			[{ role: { id: '' }, roleId: SA }]
		])('refuses a present role key that references nothing: %p', (payload) => {
			expect(() => extractRoleIds(payload)).toThrow(BadRequestException);
		});
	});

	describe('normalizeRolePayload', () => {
		it('turns a bare-string role into { id } and pins roleId to it', () => {
			const payload: any = { role: SA };
			expect(normalizeRolePayload(payload)).toBe(SA);
			expect(payload).toEqual({ role: { id: SA }, roleId: SA });
		});

		it('keeps a role object as is (callers read role.name afterwards) and pins roleId', () => {
			const role = { id: EMP, name: RolesEnum.EMPLOYEE };
			const payload: any = { role };
			expect(normalizeRolePayload(payload)).toBe(EMP);
			expect(payload.role).toBe(role);
			expect(payload.roleId).toBe(EMP);
		});

		it('keeps a lone roleId untouched', () => {
			const payload: any = { roleId: EMP };
			expect(normalizeRolePayload(payload)).toBe(EMP);
			expect(payload).toEqual({ roleId: EMP });
		});

		it('refuses a role / roleId pair that disagrees', () => {
			expect(() => normalizeRolePayload({ roleId: EMP, role: SA })).toThrow(BadRequestException);
			expect(() => normalizeRolePayload({ roleId: EMP, role: { id: SA } })).toThrow(BadRequestException);
		});

		it('strips a null role / roleId so it cannot clear the stored role', () => {
			const payload: any = { role: null, roleId: null, firstName: 'Ada' };
			expect(normalizeRolePayload(payload)).toBeUndefined();
			expect(payload).toEqual({ firstName: 'Ada' });

			const withId: any = { role: null, roleId: EMP };
			expect(normalizeRolePayload(withId)).toBe(EMP);
			expect(withId).toEqual({ roleId: EMP });
		});

		it('leaves a payload without role keys alone', () => {
			const payload: any = { firstName: 'Ada' };
			expect(normalizeRolePayload(payload)).toBeUndefined();
			expect(payload).toEqual({ firstName: 'Ada' });
			expect(normalizeRolePayload(undefined)).toBeUndefined();
		});
	});
});
