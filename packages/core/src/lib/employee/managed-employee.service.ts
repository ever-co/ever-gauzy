import { Injectable } from '@nestjs/common';
import { Equal, In, IsNull, Or } from 'typeorm';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/utils';
import { RequestContext } from '../core/context';
import { TypeOrmOrganizationTeamEmployeeRepository } from '../organization-team-employee/repository/type-orm-organization-team-employee.repository';
import { TypeOrmOrganizationProjectEmployeeRepository } from '../organization-project/repository/type-orm-organization-project-employee.repository';

/**
 * Service to handle manager access control and filter accessible employeeIds
 * based on team/project membership and manager status.
 *
 * This service centralizes the logic for determining which employees a user can access,
 * taking into account:
 * - Global permissions (CHANGE_SELECTED_EMPLOYEE)
 * - Team manager status (isManager in OrganizationTeamEmployee)
 * - Project manager status (isManager in OrganizationProjectEmployee)
 */
/**
 * Stands in for "this caller may see no employee at all".
 *
 * The employee predicates in this codebase are applied only when the id list is non-empty
 * (`if (isNotEmpty(employeeIds))`), so an empty list reads as "do not filter" rather than "deny", and a
 * caller whose token carries no employee identity would get the whole organization. Returning this id
 * instead keeps the predicate in place and matches no row, so such a caller gets an empty result. It is
 * the nil UUID, which is a valid value to compare against a uuid column.
 */
export const NO_ACCESSIBLE_EMPLOYEE_ID: ID = '00000000-0000-0000-0000-000000000000';

/**
 * Where clause for a team or project membership that is still in effect.
 *
 * Both flags are nullable and their defaults only apply on insert, so a legacy or imported row can hold
 * NULL. Strict equality would skip it and refuse a real manager or member. A fresh object is built per
 * query because TypeORM may transform a FindOperator's value in place.
 */
const activeMembershipWhere = () => ({
	isActive: Or(IsNull(), Equal(true)),
	isArchived: Or(IsNull(), Equal(false))
});

@Injectable()
export class ManagedEmployeeService {
	constructor(
		private readonly typeOrmTeamEmployeeRepository: TypeOrmOrganizationTeamEmployeeRepository,
		private readonly typeOrmProjectEmployeeRepository: TypeOrmOrganizationProjectEmployeeRepository
	) {}

	/**
	 * Filters the requested employeeIds based on the current user's permissions and manager status.
	 *
	 * Logic:
	 * 1. If user has CHANGE_SELECTED_EMPLOYEE permission → Return requested employeeIds as-is
	 * 2. If user explicitly requests "onlyMe" → Return only current user's employeeId
	 * 3. If teamIds or projectIds are provided → Keep the members of the ones the user manages
	 * 4. Otherwise → Return only current user's employeeId
	 *
	 * @param requestedEmployeeIds - The employeeIds requested by the client
	 * @param teamIds - The teamIds provided in the request (optional)
	 * @param projectIds - The projectIds provided in the request (optional)
	 * @param onlyMe - If the user explicitly requests their own data only
	 * @returns The filtered list of accessible employeeIds
	 */
	async filterAccessibleEmployeeIds(
		requestedEmployeeIds: ID[] = [],
		teamIds: ID[] = [],
		projectIds: ID[] = [],
		onlyMe: boolean = false
	): Promise<ID[]> {
		const user = RequestContext.currentUser();
		const currentEmployeeId = user?.employeeId;

		// Case 1: User has global permission to change selected employee
		if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			return requestedEmployeeIds;
		}

		// Case 2: User explicitly requests "onlyMe"
		if (onlyMe && currentEmployeeId) {
			return [currentEmployeeId];
		}

		// Case 3: An authenticated caller whose token carries no employee identity — after switching to an
		// organization they belong to without being an employee there, or when their employee record is gone.
		// An organization-wide viewer keeps the access their role gives them; anyone else gets an id that
		// matches nothing, so they see an empty result instead of every employee in the organization.
		// A request with no user at all (a public share link, an internal call) is left to the scoping its own
		// caller applies, exactly as before.
		if (!currentEmployeeId) {
			if (user && !RequestContext.hasPermission(PermissionsEnum.ALL_ORG_VIEW)) {
				return [NO_ACCESSIBLE_EMPLOYEE_ID];
			}
			return requestedEmployeeIds;
		}

		// Case 4: Members of the specified teams/projects the user manages
		if (isNotEmpty(teamIds) || isNotEmpty(projectIds)) {
			// Only the teams and projects the user manages: managing one of the selected groups gives no access
			// to the members of the others.
			const managed = await this.getManagedTeamsAndProjects(currentEmployeeId, teamIds, projectIds);

			if (isNotEmpty(managed.teamIds) || isNotEmpty(managed.projectIds)) {
				const managedEmployeeIds = await this.getMembersOfTeamsAndProjects(managed.teamIds, managed.projectIds);

				return this.keepManagedEmployeeIds(requestedEmployeeIds, managedEmployeeIds);
			}
		}

		// Case 5: User is not a manager → Access only to themselves
		return [currentEmployeeId];
	}

	/**
	 * Keeps the requested employeeIds that are managed employees, or all managed employees when none were requested.
	 *
	 * An empty list would drop the employee predicate and read every employee of the selected teams or projects,
	 * so a selection with no managed employee in it returns an id that matches nothing instead.
	 *
	 * @param requestedEmployeeIds - The employeeIds requested by the client
	 * @param managedEmployeeIds - The members of the teams and projects the user manages
	 * @returns The accessible employeeIds, or [NO_ACCESSIBLE_EMPLOYEE_ID] when none is left
	 */
	private keepManagedEmployeeIds(requestedEmployeeIds: ID[], managedEmployeeIds: ID[]): ID[] {
		const accessibleEmployeeIds = isNotEmpty(requestedEmployeeIds)
			? requestedEmployeeIds.filter((id) => managedEmployeeIds.includes(id))
			: managedEmployeeIds;

		return isNotEmpty(accessibleEmployeeIds) ? accessibleEmployeeIds : [NO_ACCESSIBLE_EMPLOYEE_ID];
	}

	/**
	 * Checks if the current employee is a manager of at least one of the specified teams or projects.
	 *
	 * @param currentEmployeeId - The employeeId to check
	 * @param teamIds - The teamIds to check against
	 * @param projectIds - The projectIds to check against
	 * @returns True if the employee is a manager of at least one team or project
	 */
	async isManagerOfTeamsOrProjects(
		currentEmployeeId: ID,
		teamIds: ID[] = [],
		projectIds: ID[] = []
	): Promise<boolean> {
		const tenantId = RequestContext.currentTenantId();

		if (!tenantId) {
			return false;
		}

		// Check if manager of any specified team
		if (isNotEmpty(teamIds)) {
			const isTeamManager = await this.typeOrmTeamEmployeeRepository.existsBy({
				employeeId: currentEmployeeId,
				organizationTeamId: In(teamIds),
				isManager: true,
				...activeMembershipWhere(),
				tenantId
			});

			if (isTeamManager) {
				return true;
			}
		}

		// Check if manager of any specified project
		if (isNotEmpty(projectIds)) {
			const isProjectManager = await this.typeOrmProjectEmployeeRepository.existsBy({
				employeeId: currentEmployeeId,
				organizationProjectId: In(projectIds),
				isManager: true,
				...activeMembershipWhere(),
				tenantId
			});

			if (isProjectManager) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Checks if an employee is an active member of a team, whether or not they manage it.
	 *
	 * @param employeeId - The employee to look for
	 * @param organizationTeamId - The team to check
	 * @returns true if the employee belongs to the team in the current tenant
	 */
	async isMemberOfTeam(employeeId: ID, organizationTeamId: ID): Promise<boolean> {
		const tenantId = RequestContext.currentTenantId();

		// Fail closed: an undefined key is dropped from the query, which would then match any membership.
		if (!tenantId || !employeeId || !organizationTeamId) {
			return false;
		}

		return await this.typeOrmTeamEmployeeRepository.existsBy({
			employeeId,
			organizationTeamId,
			tenantId,
			...activeMembershipWhere()
		});
	}

	/**
	 * Checks if the current employee can manage a specific target employee.
	 *
	 * This method verifies access based on:
	 * 1. Global permissions (CHANGE_SELECTED_EMPLOYEE)
	 * 2. Self-access (currentEmployeeId === targetEmployeeId)
	 * 3. Manager status in the specified team (if organizationTeamId provided)
	 * 4. Otherwise, manager status in any team of the record's organization that the target
	 *    employee belongs to. This fallback needs `organizationId` and denies without it.
	 *
	 * @param targetEmployeeId - The employee ID to check access for
	 * @param organizationTeamId - Optional team ID to check manager status
	 * @param organizationId - The organization the record belongs to; anchors the no-team fallback
	 * @returns true if the current employee can manage the target employee
	 */
	async canManageEmployee(targetEmployeeId: ID, organizationTeamId?: ID, organizationId?: ID): Promise<boolean> {
		const user = RequestContext.currentUser();
		const currentEmployeeId = user?.employeeId;

		// Case 1: User has global permission to change selected employee
		if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			return true;
		}

		// Case 2: No employee identity on either side (user not logged in as employee, or no target).
		// Fail closed: an undefined target would be dropped from the membership queries below and
		// match any member of the team.
		if (!currentEmployeeId || !targetEmployeeId) {
			return false;
		}

		// Case 3: User is accessing their own data
		if (currentEmployeeId === targetEmployeeId) {
			return true;
		}

		// Case 4: Check if user is manager of the target employee in the specified team
		if (organizationTeamId) {
			const tenantId = RequestContext.currentTenantId();

			if (!tenantId) {
				return false;
			}

			// Check if current user is manager of this team
			const isManagerOfTeam = await this.typeOrmTeamEmployeeRepository.existsBy({
				employeeId: currentEmployeeId,
				organizationTeamId: organizationTeamId,
				isManager: true,
				...activeMembershipWhere(),
				tenantId
			});

			if (!isManagerOfTeam) {
				return false;
			}

			// Check if target employee is member of this team
			const isTargetMemberOfTeam = await this.typeOrmTeamEmployeeRepository.existsBy({
				employeeId: targetEmployeeId,
				organizationTeamId: organizationTeamId,
				...activeMembershipWhere(),
				tenantId
			});

			return isTargetMemberOfTeam;
		}

		// Case 5: Records such as daily plans carry a nullable organizationTeamId, so callers cannot
		// always supply one. Fall back to "is there a team I manage that this employee belongs to",
		// restricted to the record's organization. That organization is the only anchor this branch
		// has: without it the check fails closed instead of spanning every organization of the tenant
		// (an undefined where key is dropped from the query in this codebase).
		if (!organizationId) {
			return false;
		}

		return await this.canManageEmployeeInAnyTeam(targetEmployeeId, organizationId);
	}

	/**
	 * Checks whether the current employee may view another employee's profile activity.
	 *
	 * Team-based access requires both employees to be active members of the same active team.
	 * Managers may view active teammates; other teammates may view profiles only when the
	 * team's profile-sharing setting is explicitly enabled.
	 *
	 * @param targetEmployeeId - Employee whose profile will be viewed
	 * @param organizationId - Organization that owns the profile and team
	 * @param organizationTeamId - Optional team used for teammate access
	 * @returns true when the current request context is allowed to view the profile
	 */
	async canViewEmployeeProfile(targetEmployeeId: ID, organizationId: ID, organizationTeamId?: ID): Promise<boolean> {
		const tenantId = RequestContext.currentTenantId();

		if (!tenantId) {
			return false;
		}

		if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			return true;
		}

		const currentEmployeeId = RequestContext.currentUser()?.employeeId;

		if (currentEmployeeId === targetEmployeeId) {
			return true;
		}

		if (!currentEmployeeId || !organizationTeamId) {
			return false;
		}

		const memberships = await this.typeOrmTeamEmployeeRepository
			.createQueryBuilder('member')
			.innerJoinAndSelect('member.organizationTeam', 'team')
			.where('member.employeeId IN (:...employeeIds)', {
				employeeIds: [currentEmployeeId, targetEmployeeId]
			})
			.andWhere('member.organizationTeamId = :organizationTeamId', { organizationTeamId })
			.andWhere('member.tenantId = :tenantId', { tenantId })
			.andWhere('member.organizationId = :organizationId', { organizationId })
			.andWhere('member.isActive = :memberIsActive', { memberIsActive: true })
			.andWhere('member.isArchived = :memberIsArchived', { memberIsArchived: false })
			.andWhere('member.deletedAt IS NULL')
			.andWhere('team.id = :organizationTeamId', { organizationTeamId })
			.andWhere('team.tenantId = :tenantId', { tenantId })
			.andWhere('team.organizationId = :organizationId', { organizationId })
			.andWhere('team.isActive = :teamIsActive', { teamIsActive: true })
			.andWhere('team.isArchived = :teamIsArchived', { teamIsArchived: false })
			.andWhere('team.deletedAt IS NULL')
			.getMany();

		const isExactActiveMembership = (membership: (typeof memberships)[number]): boolean => {
			const team = membership.organizationTeam;

			return (
				membership.organizationTeamId === organizationTeamId &&
				membership.tenantId === tenantId &&
				membership.organizationId === organizationId &&
				membership.isActive === true &&
				membership.isArchived === false &&
				membership.deletedAt == null &&
				team?.id === organizationTeamId &&
				team.tenantId === tenantId &&
				team.organizationId === organizationId &&
				team.isActive === true &&
				team.isArchived === false &&
				team.deletedAt == null
			);
		};

		const actorMemberships = memberships.filter(
			(membership) => membership.employeeId === currentEmployeeId && isExactActiveMembership(membership)
		);
		const targetMemberships = memberships.filter(
			(membership) => membership.employeeId === targetEmployeeId && isExactActiveMembership(membership)
		);

		if (!isNotEmpty(actorMemberships) || !isNotEmpty(targetMemberships)) {
			return false;
		}

		if (actorMemberships.some((membership) => membership.isManager === true)) {
			return true;
		}

		return (
			actorMemberships.some((membership) => membership.organizationTeam.shareProfileView === true) &&
			targetMemberships.some((membership) => membership.organizationTeam.shareProfileView === true)
		);
	}

	/**
	 * Checks if the current employee can manage ALL specified employees.
	 *
	 * This method verifies that the current user can manage every employee in the provided list.
	 * It checks against the specified teams (if provided).
	 *
	 * @param targetEmployeeIds - Array of employee IDs to check access for
	 * @param organizationTeamIds - Optional array of team IDs to check manager status
	 * @returns true if the current employee can manage ALL target employees
	 */
	async canManageEmployees(targetEmployeeIds: ID[], organizationTeamIds?: ID[]): Promise<boolean> {
		// No employees to check → return true
		if (!isNotEmpty(targetEmployeeIds)) {
			return true;
		}

		// Check each employee
		for (const targetEmployeeId of targetEmployeeIds) {
			// Check if user can manage this employee in at least one of the specified teams
			let canManageThisEmployee = false;

			if (isNotEmpty(organizationTeamIds)) {
				// Check against specified teams
				for (const teamId of organizationTeamIds) {
					if (await this.canManageEmployee(targetEmployeeId, teamId)) {
						canManageThisEmployee = true;
						break;
					}
				}
			} else {
				// No teams specified → Check if user manages this employee in ANY team
				canManageThisEmployee = await this.canManageEmployeeInAnyTeam(targetEmployeeId);
			}

			if (!canManageThisEmployee) {
				return false; // At least one employee cannot be managed
			}
		}

		return true; // All employees can be managed
	}

	/**
	 * Checks if the current employee can manage a target employee in ANY team.
	 *
	 * @param targetEmployeeId - The employee ID to check access for
	 * @param organizationId - Optional organization to restrict the managed teams to
	 * @returns true if the current employee manages the target employee in at least one team
	 */
	private async canManageEmployeeInAnyTeam(targetEmployeeId: ID, organizationId?: ID): Promise<boolean> {
		const currentEmployeeId = RequestContext.currentEmployeeId();
		const tenantId = RequestContext.currentTenantId();

		// Fail closed on a missing target as well: an undefined key is dropped from the membership
		// query, which would otherwise match any member of a managed team.
		if (!currentEmployeeId || !targetEmployeeId || !tenantId) {
			return false;
		}

		// Get all teams where current user is manager
		const managedTeams = await this.typeOrmTeamEmployeeRepository.find({
			where: {
				employeeId: currentEmployeeId,
				isManager: true,
				...activeMembershipWhere(),
				tenantId,
				// Scoped through the team, whose organizationId is authoritative,
				// rather than through the membership row where it may be null.
				...(organizationId ? { organizationTeam: { organizationId } } : {})
			},
			select: {
				organizationTeamId: true
			}
		});

		if (!isNotEmpty(managedTeams)) {
			return false;
		}

		const managedTeamIds = managedTeams.map((t) => t.organizationTeamId);

		// Check if target employee is member of any of these teams
		const isTargetMember = await this.typeOrmTeamEmployeeRepository.existsBy({
			employeeId: targetEmployeeId,
			organizationTeamId: In(managedTeamIds),
			...activeMembershipWhere(),
			tenantId
		});

		return isTargetMember;
	}

	/**
	 * Keeps, among the specified teams and projects, the ones the current employee manages.
	 *
	 * @param currentEmployeeId - The employeeId to check
	 * @param teamIds - The teamIds to narrow
	 * @param projectIds - The projectIds to narrow
	 * @returns The teamIds and projectIds the employee is an active manager of
	 */
	private async getManagedTeamsAndProjects(
		currentEmployeeId: ID,
		teamIds: ID[] = [],
		projectIds: ID[] = []
	): Promise<{ teamIds: ID[]; projectIds: ID[] }> {
		const tenantId = RequestContext.currentTenantId();
		const managed = { teamIds: [] as ID[], projectIds: [] as ID[] };

		if (!tenantId) {
			return managed;
		}

		if (isNotEmpty(teamIds)) {
			const teams = await this.typeOrmTeamEmployeeRepository.find({
				where: {
					employeeId: currentEmployeeId,
					organizationTeamId: In(teamIds),
					isManager: true,
					...activeMembershipWhere(),
					tenantId
				},
				select: { organizationTeamId: true }
			});
			managed.teamIds = teams.map((team) => team.organizationTeamId);
		}

		if (isNotEmpty(projectIds)) {
			const projects = await this.typeOrmProjectEmployeeRepository.find({
				where: {
					employeeId: currentEmployeeId,
					organizationProjectId: In(projectIds),
					isManager: true,
					...activeMembershipWhere(),
					tenantId
				},
				select: { organizationProjectId: true }
			});
			managed.projectIds = projects.map((project) => project.organizationProjectId);
		}

		return managed;
	}

	/**
	 * Gets all employeeIds who are members of the specified teams and/or projects.
	 *
	 * @param teamIds - The teamIds to get members from
	 * @param projectIds - The projectIds to get members from
	 * @returns Array of employeeIds who are members of the specified teams/projects
	 */
	private async getMembersOfTeamsAndProjects(teamIds: ID[] = [], projectIds: ID[] = []): Promise<ID[]> {
		const tenantId = RequestContext.currentTenantId();
		const employeeIds = new Set<ID>();

		if (!tenantId) {
			return [];
		}

		// Get members of specified teams
		if (isNotEmpty(teamIds)) {
			const teamMembers = await this.typeOrmTeamEmployeeRepository.find({
				where: {
					organizationTeamId: In(teamIds),
					...activeMembershipWhere(),
					tenantId
				},
				select: {
					employeeId: true
				}
			});

			teamMembers.forEach((member) => employeeIds.add(member.employeeId));
		}

		// Get members of specified projects
		if (isNotEmpty(projectIds)) {
			const projectMembers = await this.typeOrmProjectEmployeeRepository.find({
				where: {
					organizationProjectId: In(projectIds),
					...activeMembershipWhere(),
					tenantId
				},
				select: {
					employeeId: true
				}
			});

			projectMembers.forEach((member) => employeeIds.add(member.employeeId));
		}

		return Array.from(employeeIds);
	}
}
