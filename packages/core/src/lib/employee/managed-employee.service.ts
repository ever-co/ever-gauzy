import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
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
	 * 3. If teamIds or projectIds are provided → Check if user is manager and filter accordingly
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

		// Case 3: No employeeId (user not logged in as employee)
		if (!currentEmployeeId) {
			return [];
		}

		// Case 4: Check if user is manager of the specified teams/projects
		if (isNotEmpty(teamIds) || isNotEmpty(projectIds)) {
			const isManager = await this.isManagerOfTeamsOrProjects(currentEmployeeId, teamIds, projectIds);

			if (isManager) {
				// User is manager → Get all members of the specified teams/projects
				const managedEmployeeIds = await this.getMembersOfTeamsAndProjects(teamIds, projectIds);

				// Filter requested employeeIds to only include managed employees
				if (isNotEmpty(requestedEmployeeIds)) {
					return requestedEmployeeIds.filter((id) => managedEmployeeIds.includes(id));
				}

				// No specific employeeIds requested → Return all managed employees
				return managedEmployeeIds;
			}
		}

		// Case 5: User is not a manager → Access only to themselves
		return [currentEmployeeId];
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
				isActive: true,
				isArchived: false,
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
				isActive: true,
				isArchived: false,
				tenantId
			});

			if (isProjectManager) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Checks if the current employee can manage a specific target employee.
	 *
	 * This method verifies access based on:
	 * 1. Global permissions (CHANGE_SELECTED_EMPLOYEE)
	 * 2. Self-access (currentEmployeeId === targetEmployeeId)
	 * 3. Manager status in the specified team (if organizationTeamId provided)
	 *
	 * @param targetEmployeeId - The employee ID to check access for
	 * @param organizationTeamId - Optional team ID to check manager status
	 * @returns true if the current employee can manage the target employee
	 */
	async canManageEmployee(targetEmployeeId: ID, organizationTeamId?: ID): Promise<boolean> {
		const user = RequestContext.currentUser();
		const currentEmployeeId = user?.employeeId;

		// Case 1: User has global permission to change selected employee
		if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
			return true;
		}

		// Case 2: No employeeId (user not logged in as employee)
		if (!currentEmployeeId) {
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
				isActive: true,
				isArchived: false,
				tenantId
			});

			if (!isManagerOfTeam) {
				return false;
			}

			// Check if target employee is member of this team
			const isTargetMemberOfTeam = await this.typeOrmTeamEmployeeRepository.existsBy({
				employeeId: targetEmployeeId,
				organizationTeamId: organizationTeamId,
				isActive: true,
				isArchived: false,
				tenantId
			});

			return isTargetMemberOfTeam;
		}

		// Case 5: No team context provided → No access
		return false;
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
	 * @returns true if the current employee manages the target employee in at least one team
	 */
	private async canManageEmployeeInAnyTeam(targetEmployeeId: ID): Promise<boolean> {
		const currentEmployeeId = RequestContext.currentEmployeeId();
		const tenantId = RequestContext.currentTenantId();

		if (!currentEmployeeId || !tenantId) {
			return false;
		}

		// Get all teams where current user is manager
		const managedTeams = await this.typeOrmTeamEmployeeRepository.find({
			where: {
				employeeId: currentEmployeeId,
				isManager: true,
				isActive: true,
				isArchived: false,
				tenantId
			},
			select: ['organizationTeamId']
		});

		if (!isNotEmpty(managedTeams)) {
			return false;
		}

		const managedTeamIds = managedTeams.map((t) => t.organizationTeamId);

		// Check if target employee is member of any of these teams
		const isTargetMember = await this.typeOrmTeamEmployeeRepository.existsBy({
			employeeId: targetEmployeeId,
			organizationTeamId: In(managedTeamIds),
			isActive: true,
			isArchived: false,
			tenantId
		});

		return isTargetMember;
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
					isActive: true,
					isArchived: false,
					tenantId
				},
				select: ['employeeId']
			});

			teamMembers.forEach((member) => employeeIds.add(member.employeeId));
		}

		// Get members of specified projects
		if (isNotEmpty(projectIds)) {
			const projectMembers = await this.typeOrmProjectEmployeeRepository.find({
				where: {
					organizationProjectId: In(projectIds),
					isActive: true,
					isArchived: false,
					tenantId
				},
				select: ['employeeId']
			});

			projectMembers.forEach((member) => employeeIds.add(member.employeeId));
		}

		return Array.from(employeeIds);
	}
}
