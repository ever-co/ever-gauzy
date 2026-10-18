import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { attachedRolePermissionVerdict } from './attached-role-permissions';

describe('attachedRolePermissionVerdict', () => {
	const TENANT = 'tenant-1';
	const role = { id: 'role-1', name: RolesEnum.EMPLOYEE, tenantId: TENANT };
	const required = [PermissionsEnum.ORG_TEAM_VIEW, PermissionsEnum.ORG_TEAM_EDIT];

	it('grants when the attached role holds one of the required permissions', () => {
		const user: any = { id: 'u', tenantId: TENANT, role, permissions: [PermissionsEnum.ORG_TEAM_EDIT] };
		expect(attachedRolePermissionVerdict(user, TENANT, required)).toBe(true);
	});

	it('denies when it holds none of them', () => {
		const user: any = { id: 'u', tenantId: TENANT, role, permissions: [PermissionsEnum.PROFILE_EDIT] };
		expect(attachedRolePermissionVerdict(user, TENANT, required)).toBe(false);
	});

	it('denies, fail closed, a user whose role could not be resolved (no role, no permissions attached)', () => {
		// `RoleAuthorizationService.attachAuthorizationState` leaves exactly this shape behind.
		const user: any = { id: 'u', tenantId: TENANT, permissions: [] };
		expect(attachedRolePermissionVerdict(user, TENANT, required)).toBe(false);
	});

	it('does not decide without an attached state', () => {
		expect(attachedRolePermissionVerdict(null, TENANT, required)).toBeNull();
		expect(attachedRolePermissionVerdict(undefined, TENANT, required)).toBeNull();
		// A user object another authentication path left on the request: the token's claims are never read.
		expect(attachedRolePermissionVerdict({ id: 'u', tenantId: TENANT, role } as any, TENANT, required)).toBeNull();
	});

	it('does not decide without a tenant', () => {
		const user: any = { id: 'u', role, permissions: [PermissionsEnum.ORG_TEAM_EDIT] };
		expect(attachedRolePermissionVerdict(user, null, required)).toBeNull();
		expect(attachedRolePermissionVerdict(user, undefined, required)).toBeNull();
	});

	it('leaves a role of another tenant to the tenant-scoped query', () => {
		const user: any = {
			id: 'u',
			tenantId: TENANT,
			role: { ...role, tenantId: 'tenant-2' },
			permissions: [PermissionsEnum.ORG_TEAM_EDIT]
		};
		expect(attachedRolePermissionVerdict(user, TENANT, required)).toBeNull();
	});

	it('leaves a role attached as a bare name to the query', () => {
		const user: any = {
			id: 'u',
			tenantId: TENANT,
			role: RolesEnum.ADMIN,
			permissions: [PermissionsEnum.ORG_TEAM_EDIT]
		};
		expect(attachedRolePermissionVerdict(user, TENANT, required)).toBeNull();
	});
});
