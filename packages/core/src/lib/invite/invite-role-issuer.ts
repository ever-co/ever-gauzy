import { ID, IInvite, IRole, RolesEnum } from '@gauzy/contracts';

/**
 * The roles an EMPLOYEE issues invitations for: `createBulk` forces the EMPLOYEE role on every invitation an employee
 * sends, and inviting an organization contact (also open to employees) issues a VIEWER invitation.
 */
const ROLES_AN_EMPLOYEE_ISSUES: ReadonlySet<string> = new Set([RolesEnum.EMPLOYEE, RolesEnum.VIEWER]);

/**
 * Whether a caller holding `callerRole` may issue an invitation that grants `invitedRole`, and so may hold its
 * accept-invite token (whoever holds the token can accept the invitation and register with its role).
 *
 * The rule the invitation routes apply when they mint one: an EMPLOYEE invites employees (and organization contacts,
 * as viewers), only a super admin invites a super admin, and every other role invites any other role. An unknown role
 * on either side is refused.
 */
export function mayIssueInviteRole(
	callerRole: string | null | undefined,
	invitedRole: string | null | undefined
): boolean {
	if (!callerRole || !invitedRole) {
		return false;
	}
	if (callerRole === RolesEnum.SUPER_ADMIN) {
		return true;
	}
	if (callerRole === RolesEnum.EMPLOYEE) {
		return ROLES_AN_EMPLOYEE_ISSUES.has(invitedRole);
	}
	return invitedRole !== RolesEnum.SUPER_ADMIN;
}

/** What deciding on an invitation's token needs to know about the caller. */
export interface IInviteTokenReader {
	/** The role the caller holds. */
	callerRole: string | null | undefined;
	/** Whether the caller may issue invitations at all (ORG_INVITE_EDIT). */
	mayIssueInvites: boolean;
	/** Reads roles by id in the caller's tenant, for invitations listed without their role joined. */
	findRoles: (ids: ID[]) => Promise<Pick<IRole, 'id' | 'name'>[]>;
}

/**
 * Removes the accept-invite token from every listed invitation the caller could not have issued.
 *
 * The token is the credential `POST /invite/accept` takes, and the invitation register is readable with the
 * permissions every employee holds: an employee listing it read an admin invitation's token, accepted it with the
 * invited address and registered as an admin. The token stays with a caller who may issue invitations for the
 * invitation's role, which is all "copy invite link" needs.
 */
export async function withholdTokensNotIssuable(
	invites: Pick<IInvite, 'token' | 'roleId' | 'role'>[] = [],
	{ callerRole, mayIssueInvites, findRoles }: IInviteTokenReader
): Promise<void> {
	// The role is joined only when the listing asks for it; otherwise it is read here.
	const roleNames = new Map<ID, string>();
	const unresolved = [
		...new Set(invites.filter((invite) => !invite.role?.name && invite.roleId).map((invite) => invite.roleId))
	];
	if (mayIssueInvites && unresolved.length > 0) {
		(await findRoles(unresolved)).forEach((role) => roleNames.set(role.id, role.name));
	}

	for (const invite of invites) {
		const invitedRole = invite.role?.name ?? roleNames.get(invite.roleId);
		if (!mayIssueInvites || !mayIssueInviteRole(callerRole, invitedRole)) {
			delete invite.token;
		}
	}
}
