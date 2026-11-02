import { FindOptionsWhere, In } from 'typeorm';
import { ID, IRole, RolesEnum } from '@gauzy/contracts';
import type { OrganizationTeamEmployee } from './organization-team-employee.entity';

/**
 * The team roles that make a member one of the team's managers, beside the `isManager` flag. Creating a team gives
 * its managers the MANAGER role, and sets the flag only when the creator may act for every employee.
 */
export const TEAM_MANAGER_ROLES: ReadonlyArray<RolesEnum> = Object.freeze([
	RolesEnum.MANAGER,
	RolesEnum.ADMIN,
	RolesEnum.SUPER_ADMIN
]);

/**
 * The memberships that make an employee a manager of a team: flagged `isManager`, or holding one of the
 * {@link TEAM_MANAGER_ROLES}. With the team's creator, these are the managers Ever Teams shows a team's invitations
 * and join requests to, and the ones who decide on them.
 *
 * @param member - The membership columns to match, such as the employee, the team and the tenant.
 * @returns The alternatives of a `where` that matches either kind of manager membership.
 */
export function teamManagerMembershipWhere(
	member: FindOptionsWhere<OrganizationTeamEmployee>
): FindOptionsWhere<OrganizationTeamEmployee>[] {
	const managerRole = { name: In([...TEAM_MANAGER_ROLES]) };

	return [
		{ ...member, isManager: true },
		{ ...member, role: managerRole }
	];
}

/**
 * The team role a member already on a team holds after an edit of the team that states its managers.
 *
 * A member the edit names as a manager gets the manager role. Any other member keeps the role they hold — a custom
 * role given to them on purpose survives an edit that does not mention it (#6569) — unless that role is the manager
 * role the edit hands out or one of the {@link TEAM_MANAGER_ROLES}: a manager the edit leaves out loses it, as
 * before, so no member keeps manager authority the edit took away.
 *
 * @param member - The membership as stored, with its role loaded.
 * @param isManager - Whether the edit names the member as a manager.
 * @param managerRole - The role the edit gives the team's managers (MANAGER).
 * @returns The role to store on the membership, or `null` for a plain member.
 */
export function teamRoleAfterEdit(
	member: { roleId?: ID | null; role?: IRole | null },
	isManager: boolean,
	managerRole: IRole
): IRole | null {
	if (isManager) {
		return managerRole;
	}

	const current = member.role;
	if (!current) {
		return null;
	}

	const roleId = current.id ?? member.roleId;
	const grantsManagement =
		(!!managerRole?.id && roleId === managerRole.id) || TEAM_MANAGER_ROLES.includes(current.name as RolesEnum);

	return grantsManagement ? null : current;
}
