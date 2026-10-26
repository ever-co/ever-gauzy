import { FindOptionsWhere, In } from 'typeorm';
import { RolesEnum } from '@gauzy/contracts';
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
