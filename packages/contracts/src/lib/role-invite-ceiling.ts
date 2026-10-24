import { RolesEnum } from './role.model';

/**
 * The level of each built-in role for invitations, highest first:
 * `SUPER_ADMIN` > `ADMIN` > `MANAGER` > `DATA_ENTRY` / `EMPLOYEE` > `VIEWER` / `CANDIDATE` / `INTERVIEWER`.
 */
export const ROLE_INVITE_LEVELS: Readonly<Record<RolesEnum, number>> = Object.freeze({
	[RolesEnum.SUPER_ADMIN]: 4,
	[RolesEnum.ADMIN]: 3,
	[RolesEnum.MANAGER]: 2,
	[RolesEnum.DATA_ENTRY]: 1,
	[RolesEnum.EMPLOYEE]: 1,
	[RolesEnum.VIEWER]: 0,
	[RolesEnum.CANDIDATE]: 0,
	[RolesEnum.INTERVIEWER]: 0
});

/** The level of a role name, or undefined for a role that is not built in (a tenant's own role). */
function roleInviteLevel(roleName: string): number | undefined {
	return Object.prototype.hasOwnProperty.call(ROLE_INVITE_LEVELS, roleName)
		? ROLE_INVITE_LEVELS[roleName as RolesEnum]
		: undefined;
}

/**
 * Whether an inviter holding `inviterRole` may issue an invitation that grants `invitedRole`.
 *
 * An inviter grants only their own level or lower, so only an `ADMIN` or `SUPER_ADMIN` invites an `ADMIN`,
 * and only a `SUPER_ADMIN` invites a `SUPER_ADMIN`.
 *
 * A role the tenant created itself is not on the scale, so its permissions are unknown here:
 * - granting one takes a tenant admin (`ADMIN` or `SUPER_ADMIN`);
 * - an inviter holding one counts as the lowest level.
 *
 * An inviter with no role, or an invitation for no role, is refused.
 *
 * @param inviterRole - The role name of the user sending the invitation.
 * @param invitedRole - The role name the invitation grants.
 */
export function canInviteWithRole(
	inviterRole: string | null | undefined,
	invitedRole: string | null | undefined
): boolean {
	if (!inviterRole || !invitedRole) {
		return false;
	}
	const inviterLevel = roleInviteLevel(inviterRole) ?? ROLE_INVITE_LEVELS[RolesEnum.VIEWER];
	const invitedLevel = roleInviteLevel(invitedRole) ?? ROLE_INVITE_LEVELS[RolesEnum.ADMIN];
	return invitedLevel <= inviterLevel;
}
