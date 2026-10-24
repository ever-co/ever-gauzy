import { canInviteWithRole, RolesEnum } from '@gauzy/contracts';
import { mayIssueInviteRole, withholdTokensNotIssuable } from './invite-role-issuer';

/**
 * `GET /invite` (ORG_INVITE_VIEW, held by every employee) answered each invitation with its accept-invite token. An
 * employee could read an admin invitation's token, accept it with the invited address and register as an admin. The
 * token now stays with a caller who may issue invitations (ORG_INVITE_EDIT) for the invitation's role.
 *
 * Which roles a caller may issue is the role ceiling `createBulk` applies (owner decision, ever-co/ever-gauzy#11318):
 * own level or below, only ADMIN/SUPER_ADMIN invite ADMIN, only SUPER_ADMIN invites SUPER_ADMIN.
 */
describe('mayIssueInviteRole', () => {
	const BUILT_IN = Object.values(RolesEnum);

	it.each([
		[RolesEnum.SUPER_ADMIN, RolesEnum.SUPER_ADMIN, true],
		[RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN, true],
		[RolesEnum.ADMIN, RolesEnum.ADMIN, true],
		[RolesEnum.ADMIN, RolesEnum.EMPLOYEE, true],
		[RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN, false],
		[RolesEnum.MANAGER, RolesEnum.SUPER_ADMIN, false],
		// Before the ceiling every role but an employee issued any role except SUPER_ADMIN.
		[RolesEnum.MANAGER, RolesEnum.ADMIN, false],
		[RolesEnum.MANAGER, RolesEnum.MANAGER, true],
		[RolesEnum.MANAGER, RolesEnum.EMPLOYEE, true],
		[RolesEnum.DATA_ENTRY, RolesEnum.MANAGER, false],
		[RolesEnum.VIEWER, RolesEnum.EMPLOYEE, false],
		[RolesEnum.EMPLOYEE, RolesEnum.EMPLOYEE, true],
		// Inviting an organization contact (open to employees) issues a VIEWER invitation.
		[RolesEnum.EMPLOYEE, RolesEnum.VIEWER, true],
		[RolesEnum.EMPLOYEE, RolesEnum.ADMIN, false],
		[RolesEnum.EMPLOYEE, RolesEnum.MANAGER, false],
		// The ceiling lets an employee invite a candidate (createBulk issues one), so the token follows.
		[RolesEnum.EMPLOYEE, RolesEnum.CANDIDATE, true],
		[RolesEnum.EMPLOYEE, RolesEnum.SUPER_ADMIN, false]
	])('a %s may issue a %s invitation: %s', (callerRole, invitedRole, expected) => {
		expect(mayIssueInviteRole(callerRole, invitedRole)).toBe(expected);
	});

	it('answers exactly as the createBulk ceiling for every pair of built-in roles', () => {
		for (const callerRole of BUILT_IN) {
			for (const invitedRole of BUILT_IN) {
				expect({ callerRole, invitedRole, allowed: mayIssueInviteRole(callerRole, invitedRole) }).toEqual({
					callerRole,
					invitedRole,
					allowed: canInviteWithRole(callerRole, invitedRole)
				});
			}
		}
	});

	it('a role the tenant created is issued only by a tenant admin, and its holder ranks lowest', () => {
		expect(mayIssueInviteRole(RolesEnum.SUPER_ADMIN, 'RECRUITER')).toBe(true);
		expect(mayIssueInviteRole(RolesEnum.ADMIN, 'RECRUITER')).toBe(true);
		expect(mayIssueInviteRole(RolesEnum.MANAGER, 'RECRUITER')).toBe(false);
		expect(mayIssueInviteRole('RECRUITER', RolesEnum.VIEWER)).toBe(true);
		expect(mayIssueInviteRole('RECRUITER', RolesEnum.EMPLOYEE)).toBe(false);
	});

	it('refuses when either role is unknown', () => {
		expect(mayIssueInviteRole(null, RolesEnum.EMPLOYEE)).toBe(false);
		expect(mayIssueInviteRole(undefined, RolesEnum.VIEWER)).toBe(false);
		expect(mayIssueInviteRole(RolesEnum.SUPER_ADMIN, undefined)).toBe(false);
		expect(mayIssueInviteRole(RolesEnum.EMPLOYEE, null)).toBe(false);
	});
});

describe('withholdTokensNotIssuable', () => {
	const ROLES = [
		{ id: 'role-admin', name: RolesEnum.ADMIN },
		{ id: 'role-employee', name: RolesEnum.EMPLOYEE },
		{ id: 'role-super-admin', name: RolesEnum.SUPER_ADMIN },
		{ id: 'role-manager', name: RolesEnum.MANAGER },
		{ id: 'role-viewer', name: RolesEnum.VIEWER }
	];

	/** The register as the list route reads it: the role joined, or only its id. */
	const register = (joined: boolean) =>
		ROLES.map((role) => ({ token: `token-of-${role.name}`, roleId: role.id, ...(joined ? { role } : {}) }));
	const tokens = (invites: { token?: string }[]) => invites.map((invite) => invite.token);

	const reader = (callerRole: string | null, mayIssueInvites = true) => {
		const findRoles = jest.fn(async (ids: string[]) => ROLES.filter((role) => ids.includes(role.id)));
		const findCallerRole = jest.fn(async () => callerRole);
		return { findRoles, findCallerRole, reader: { findCallerRole, mayIssueInvites, findRoles } };
	};

	it.each([true, false])(
		"an employee keeps the employee and contact (viewer) invitations' tokens (role joined: %s)",
		async (joined) => {
			const invites = register(joined);
			const { reader: employee } = reader(RolesEnum.EMPLOYEE);

			await withholdTokensNotIssuable(invites, employee);

			expect(tokens(invites)).toEqual([undefined, 'token-of-EMPLOYEE', undefined, undefined, 'token-of-VIEWER']);
			expect(invites[0]).not.toHaveProperty('token');
		}
	);

	it('a manager keeps the tokens of its own level and below, no longer the admin invitation', async () => {
		const invites = register(true);

		await withholdTokensNotIssuable(invites, reader(RolesEnum.MANAGER).reader);

		expect(tokens(invites)).toEqual([
			undefined,
			'token-of-EMPLOYEE',
			undefined,
			'token-of-MANAGER',
			'token-of-VIEWER'
		]);
	});

	it('an admin keeps every token but the super admin invitation', async () => {
		const invites = register(false);

		await withholdTokensNotIssuable(invites, reader(RolesEnum.ADMIN).reader);

		expect(tokens(invites)).toEqual([
			'token-of-ADMIN',
			'token-of-EMPLOYEE',
			undefined,
			'token-of-MANAGER',
			'token-of-VIEWER'
		]);
	});

	it('a super admin keeps every token', async () => {
		const invites = register(true);

		await withholdTokensNotIssuable(invites, reader(RolesEnum.SUPER_ADMIN).reader);

		expect(tokens(invites)).toEqual([
			'token-of-ADMIN',
			'token-of-EMPLOYEE',
			'token-of-SUPER_ADMIN',
			'token-of-MANAGER',
			'token-of-VIEWER'
		]);
	});

	it('reads the caller role once, and the roles not joined once by distinct id', async () => {
		const invites = [...register(false), { token: 'another', roleId: 'role-admin' }];
		const { findRoles, findCallerRole, reader: admin } = reader(RolesEnum.ADMIN);

		await withholdTokensNotIssuable(invites, admin);

		expect(findCallerRole).toHaveBeenCalledTimes(1);
		expect(findRoles).toHaveBeenCalledTimes(1);
		expect(findRoles).toHaveBeenCalledWith([
			'role-admin',
			'role-employee',
			'role-super-admin',
			'role-manager',
			'role-viewer'
		]);
	});

	it('withholds the token of an invitation whose role is not found', async () => {
		const invites = [{ token: 'orphan', roleId: 'role-of-another-tenant' }];

		await withholdTokensNotIssuable(invites, reader(RolesEnum.ADMIN).reader);

		expect(tokens(invites)).toEqual([undefined]);
	});

	it('withholds every token from a caller with no stored role, without reading roles', async () => {
		const invites = register(false);
		const { findRoles, reader: roleless } = reader(null);

		await withholdTokensNotIssuable(invites, roleless);

		expect(tokens(invites)).toEqual([undefined, undefined, undefined, undefined, undefined]);
		expect(findRoles).not.toHaveBeenCalled();
	});

	it('withholds every token from a caller who may not issue invitations, without reading anything', async () => {
		const invites = register(false);
		const { findRoles, findCallerRole, reader: viewer } = reader(RolesEnum.SUPER_ADMIN, false);

		await withholdTokensNotIssuable(invites, viewer);

		expect(tokens(invites)).toEqual([undefined, undefined, undefined, undefined, undefined]);
		expect(findCallerRole).not.toHaveBeenCalled();
		expect(findRoles).not.toHaveBeenCalled();
	});

	it('reads nothing for an empty page', async () => {
		const { findRoles, findCallerRole, reader: admin } = reader(RolesEnum.ADMIN);

		await withholdTokensNotIssuable([], admin);

		expect(findCallerRole).not.toHaveBeenCalled();
		expect(findRoles).not.toHaveBeenCalled();
	});
});
