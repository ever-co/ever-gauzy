import { canInviteWithRole, ID, IInvite, IRole, RolesEnum } from '@gauzy/contracts';

/**
 * Whether a caller holding `callerRole` may issue an invitation that grants `invitedRole`, and so may hold its
 * accept-invite token (whoever holds the token can accept the invitation and register with its role).
 *
 * The rule `createBulk` applies when it mints an invitation (owner decision, ever-co/ever-gauzy#11318): an inviter
 * grants only their own level or lower (`canInviteWithRole`), so only an ADMIN or SUPER_ADMIN issues an ADMIN
 * invitation, only a SUPER_ADMIN a SUPER_ADMIN one, and a role the tenant created takes a tenant admin.
 *
 * Inviting an organization contact, a route open to employees, issues a VIEWER invitation; an employee keeps that
 * invitation's token. The ceiling already lets an employee grant VIEWER, the case is stated here so it does not hang on
 * the scale. An unknown role on either side is refused.
 *
 * @param callerRole The role the caller holds as stored (the one `createBulk` ranks an inviter by).
 * @param invitedRole The role the invitation grants.
 */
export function mayIssueInviteRole(
	callerRole: string | null | undefined,
	invitedRole: string | null | undefined
): boolean {
	if (!callerRole || !invitedRole) {
		return false;
	}
	if (callerRole === RolesEnum.EMPLOYEE && invitedRole === RolesEnum.VIEWER) {
		return true;
	}
	return canInviteWithRole(callerRole, invitedRole);
}

/** What deciding on an invitation's token needs to know about the caller. */
export interface IInviteTokenReader {
	/**
	 * Reads the role stored for the caller, the one `createBulk` ranks an inviter by (not the request context's, which
	 * may come from a reused authenticated-user context). Called at most once, and only when the caller may issue
	 * invitations and there is an invitation to decide on.
	 */
	findCallerRole: () => Promise<string | null | undefined>;
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
	{ findCallerRole, mayIssueInvites, findRoles }: IInviteTokenReader
): Promise<void> {
	if (!mayIssueInvites) {
		for (const invite of invites) {
			delete invite.token;
		}
		return;
	}
	if (invites.length === 0) {
		return;
	}

	const callerRole = await findCallerRole();

	// The role is joined only when the listing asks for it; otherwise it is read here.
	const roleNames = new Map<ID, string>();
	const unresolved = [
		...new Set(invites.filter((invite) => !invite.role?.name && invite.roleId).map((invite) => invite.roleId))
	];
	if (callerRole && unresolved.length > 0) {
		(await findRoles(unresolved)).forEach((role) => roleNames.set(role.id, role.name));
	}

	for (const invite of invites) {
		const invitedRole = invite.role?.name ?? roleNames.get(invite.roleId);
		if (!mayIssueInviteRole(callerRole, invitedRole)) {
			delete invite.token;
		}
	}
}
