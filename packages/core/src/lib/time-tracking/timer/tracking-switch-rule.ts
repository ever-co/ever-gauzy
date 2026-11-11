import { ForbiddenException } from '@nestjs/common';
import { RolesEnum } from '@gauzy/contracts';
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
 * Refuses a tracking switch the rule does not allow.
 *
 * @param actor The rank of the person changing the switch.
 * @param target The rank of the person whose switch changes.
 * @throws ForbiddenException When `actor` may not turn the tracking of `target` on or off.
 */
export function assertMayTurnTrackingOf(actor: TrackingSwitchRank, target: TrackingSwitchRank): void {
	if (!mayTurnTrackingOf(actor, target)) {
		throw new ForbiddenException(TRACKING_SWITCH_REFUSED);
	}
}
