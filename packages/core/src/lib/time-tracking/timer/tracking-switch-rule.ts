import { ForbiddenException } from '@nestjs/common';
import { RolesEnum } from '@gauzy/contracts';
import { narrowRolesToOAuthAppScopes } from '../../auth/oauth-app-scope';
import { RequestContext } from '../../core/context';

/**
 * The rank a person holds for turning someone's time tracking on or off. SUPER_ADMIN and ADMIN are the admin rank and
 * count as equal; MANAGER is below them, and every other role (EMPLOYEE and the rest) is a member.
 */
export enum TrackingSwitchRank {
	MEMBER = 0,
	MANAGER = 1,
	ADMIN = 2
}

const ADMIN_ROLES: RolesEnum[] = [RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN];

/** The refusal of a tracking switch the caller's rank does not allow. */
export const TRACKING_SWITCH_REFUSED =
	"Only someone of a higher role can turn this person's time tracking on or off (an admin can also do it for another admin).";

/**
 * The rank a tenant role gives.
 *
 * @param roleName The name of the role, if known.
 * @returns ADMIN for SUPER_ADMIN and ADMIN, MANAGER for MANAGER, MEMBER for any other role or none.
 */
export function rankOfRole(roleName: string | null | undefined): TrackingSwitchRank {
	if (ADMIN_ROLES.includes(roleName as RolesEnum)) {
		return TrackingSwitchRank.ADMIN;
	}
	if (roleName === RolesEnum.MANAGER) {
		return TrackingSwitchRank.MANAGER;
	}
	return TrackingSwitchRank.MEMBER;
}

/**
 * The rank a person holds in a team: their role's, raised to MANAGER when they manage the team.
 *
 * @param roleRank The rank of the person's tenant role.
 * @param managesTeam Whether the person manages the team (the MANAGER role or the manager flag on their membership).
 */
export function rankInTeam(roleRank: TrackingSwitchRank, managesTeam: boolean): TrackingSwitchRank {
	if (managesTeam && roleRank < TrackingSwitchRank.MANAGER) {
		return TrackingSwitchRank.MANAGER;
	}
	return roleRank;
}

/**
 * Whether someone may turn another person's time tracking on or off: only a higher rank may, and an admin may also act
 * on an admin, themselves included. A manager therefore acts on members only, never on themselves or another manager,
 * and a member acts on no one.
 *
 * @param actor The rank of the person changing the switch.
 * @param target The rank of the person whose switch changes.
 */
export function mayTurnTrackingOf(actor: TrackingSwitchRank, target: TrackingSwitchRank): boolean {
	if (actor === TrackingSwitchRank.ADMIN) {
		return true;
	}
	return actor > target;
}

/**
 * The caller's rank from the role they hold for this request. Read through `RequestContext.hasRoles`, so a token of a
 * third-party OAuth app, which no role exemption reaches, never ranks as an admin or a manager.
 */
export function callerRoleRank(): TrackingSwitchRank {
	if (RequestContext.hasRoles(ADMIN_ROLES)) {
		return TrackingSwitchRank.ADMIN;
	}
	if (RequestContext.hasRole(RolesEnum.MANAGER)) {
		return TrackingSwitchRank.MANAGER;
	}
	return TrackingSwitchRank.MEMBER;
}

/**
 * Whether the caller's token may act with the rank of a team its user manages. A first-party caller may. A token of a
 * third-party OAuth app acts with the manager role only where an approved scope allows that role (none does today),
 * as the role checks hold it, so managing a team does not raise it either.
 */
export function mayActAsTeamManager(): boolean {
	const oauthAppScopes = RequestContext.currentOAuthAppScopes();
	if (oauthAppScopes === null) {
		return true;
	}
	return narrowRolesToOAuthAppScopes([RolesEnum.MANAGER], oauthAppScopes).length > 0;
}

/**
 * Whether a write carries the person's tracking switch. Someone who may turn it writes it, changed or not. Anyone else
 * may only send it back as it is stored, and then it is left out of the write: it was read before the write, and a
 * change made in between by someone who may make it must not be overwritten by that copy.
 *
 * @param actor The rank of the person writing.
 * @param target The rank of the person whose switch it is.
 * @param changesSwitch Whether the written value differs from the stored one.
 * @returns True when the write carries the switch, false when the switch is left out of it.
 * @throws ForbiddenException When `actor` may not turn the tracking of `target` on or off and the value differs.
 */
export function keepsTrackingSwitch(
	actor: TrackingSwitchRank,
	target: TrackingSwitchRank,
	changesSwitch: boolean
): boolean {
	if (mayTurnTrackingOf(actor, target)) {
		return true;
	}
	if (changesSwitch) {
		throw new ForbiddenException(TRACKING_SWITCH_REFUSED);
	}
	return false;
}
