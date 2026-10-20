import { RolesEnum } from '@gauzy/contracts';
import { mayIssueInviteRole, withholdTokensNotIssuable } from './invite-role-issuer';

/**
 * `GET /invite` (ORG_INVITE_VIEW, held by every employee) answered each invitation with its accept-invite token. An
 * employee could read an admin invitation's token, accept it with the invited address and register as an admin. The
 * token now stays with a caller who may issue invitations (ORG_INVITE_EDIT) for the invitation's role.
 */
describe('mayIssueInviteRole', () => {
	it.each([
		[RolesEnum.SUPER_ADMIN, RolesEnum.SUPER_ADMIN, true],
		[RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN, true],
		[RolesEnum.ADMIN, RolesEnum.ADMIN, true],
		[RolesEnum.ADMIN, RolesEnum.EMPLOYEE, true],
		[RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN, false],
		[RolesEnum.MANAGER, RolesEnum.SUPER_ADMIN, false],
		[RolesEnum.EMPLOYEE, RolesEnum.EMPLOYEE, true],
		[RolesEnum.EMPLOYEE, RolesEnum.VIEWER, true],
		[RolesEnum.EMPLOYEE, RolesEnum.ADMIN, false],
		[RolesEnum.EMPLOYEE, RolesEnum.MANAGER, false],
		[RolesEnum.EMPLOYEE, RolesEnum.CANDIDATE, false],
		[RolesEnum.EMPLOYEE, RolesEnum.SUPER_ADMIN, false]
	])('a %s may issue a %s invitation: %s', (callerRole, invitedRole, expected) => {
		expect(mayIssueInviteRole(callerRole, invitedRole)).toBe(expected);
	});

	it('refuses when either role is unknown', () => {
		expect(mayIssueInviteRole(null, RolesEnum.EMPLOYEE)).toBe(false);
		expect(mayIssueInviteRole(RolesEnum.SUPER_ADMIN, undefined)).toBe(false);
	});
});

describe('withholdTokensNotIssuable', () => {
	const ROLES = [
		{ id: 'role-admin', name: RolesEnum.ADMIN },
		{ id: 'role-employee', name: RolesEnum.EMPLOYEE },
		{ id: 'role-super-admin', name: RolesEnum.SUPER_ADMIN }
	];

	/** The register as the list route reads it: the role joined, or only its id. */
	const register = (joined: boolean) =>
		ROLES.map((role) => ({ token: `token-of-${role.name}`, roleId: role.id, ...(joined ? { role } : {}) }));
	const tokens = (invites: { token?: string }[]) => invites.map((invite) => invite.token);

	const reader = (callerRole: RolesEnum, mayIssueInvites = true) => {
		const findRoles = jest.fn(async (ids: string[]) => ROLES.filter((role) => ids.includes(role.id)));
		return { findRoles, reader: { callerRole, mayIssueInvites, findRoles } };
	};

	it.each([true, false])(
		"an employee keeps only the employee invitation's token (role joined: %s)",
		async (joined) => {
			const invites = register(joined);
			const { reader: employee } = reader(RolesEnum.EMPLOYEE);

			await withholdTokensNotIssuable(invites, employee);

			expect(tokens(invites)).toEqual([undefined, 'token-of-EMPLOYEE', undefined]);
			expect(invites[0]).not.toHaveProperty('token');
		}
	);

	it('an admin keeps every token but the super admin invitation', async () => {
		const invites = register(false);

		await withholdTokensNotIssuable(invites, reader(RolesEnum.ADMIN).reader);

		expect(tokens(invites)).toEqual(['token-of-ADMIN', 'token-of-EMPLOYEE', undefined]);
	});

	it('a super admin keeps every token', async () => {
		const invites = register(true);

		await withholdTokensNotIssuable(invites, reader(RolesEnum.SUPER_ADMIN).reader);

		expect(tokens(invites)).toEqual(['token-of-ADMIN', 'token-of-EMPLOYEE', 'token-of-SUPER_ADMIN']);
	});

	it('reads the roles not joined once, by distinct id', async () => {
		const invites = [...register(false), { token: 'another', roleId: 'role-admin' }];
		const { findRoles, reader: admin } = reader(RolesEnum.ADMIN);

		await withholdTokensNotIssuable(invites, admin);

		expect(findRoles).toHaveBeenCalledTimes(1);
		expect(findRoles).toHaveBeenCalledWith(['role-admin', 'role-employee', 'role-super-admin']);
	});

	it('withholds the token of an invitation whose role is not found', async () => {
		const invites = [{ token: 'orphan', roleId: 'role-of-another-tenant' }];

		await withholdTokensNotIssuable(invites, reader(RolesEnum.ADMIN).reader);

		expect(tokens(invites)).toEqual([undefined]);
	});

	it('withholds every token from a caller who may not issue invitations, without reading roles', async () => {
		const invites = register(false);
		const { findRoles, reader: viewer } = reader(RolesEnum.SUPER_ADMIN, false);

		await withholdTokensNotIssuable(invites, viewer);

		expect(tokens(invites)).toEqual([undefined, undefined, undefined]);
		expect(findRoles).not.toHaveBeenCalled();
	});
});
