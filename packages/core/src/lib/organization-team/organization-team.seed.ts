import { DataSource } from 'typeorm';
import { OrganizationTeam } from './organization-team.entity';
import { OrganizationTeamEmployee } from '../organization-team-employee/organization-team-employee.entity';
import { IEmployee, IOrganization, IRole, ITenant, RolesEnum } from '@gauzy/contracts';
import * as _ from 'underscore';
import { faker } from '@faker-js/faker';
import { environment } from '@gauzy/config';
import { DEFAULT_ORGANIZATION_TEAMS } from './default-organization-teams';
import { Employee, User } from '../core/entities/internal';

export const createDefaultTeams = async (
	dataSource: DataSource,
	organization: IOrganization,
	employees: IEmployee[],
	roles: IRole[]
): Promise<OrganizationTeam[]> => {
	const teams = DEFAULT_ORGANIZATION_TEAMS;
	const { id: organizationId, tenantId } = organization;

	// Load employees with user.role relation to check for admin users
	const employeesWithRoles = await dataSource.manager.find(Employee, {
		where: { organizationId, tenantId },
		relations: ['user', 'user.role']
	});

	const organizationTeams: OrganizationTeam[] = [];
	for (let i = 0; i < teams.length; i++) {
		const team = new OrganizationTeam();
		team.name = teams[i].name;
		team.organizationId = organizationId;
		team.tenant = organization.tenant;

		const managerEmails = teams[i].manager || [];
		const memberEmails = teams[i].defaultMembers || [];
		const managerRole = roles.find((x) => x.name === RolesEnum.MANAGER);

		// Create a map to track employees and their manager status
		const employeeMap = new Map<string, { employee: IEmployee; isManager: boolean }>();

		// First, add all members
		employeesWithRoles
			.filter((e) => memberEmails.indexOf(e.user.email) > -1)
			.forEach((emp) => {
				// Check if employee has ADMIN or SUPER_ADMIN role
				const isAdminUser =
					emp.user?.role?.name === RolesEnum.ADMIN || emp.user?.role?.name === RolesEnum.SUPER_ADMIN;

				// Admins should always be managers in their teams
				employeeMap.set(emp.id, { employee: emp, isManager: isAdminUser });
			});

		// Then, mark managers (this will update existing entries or add new ones)
		employeesWithRoles
			.filter((e) => managerEmails.indexOf(e.user.email) > -1)
			.forEach((emp) => {
				const existing = employeeMap.get(emp.id);
				if (existing) {
					// Employee is already a member, just mark as manager
					existing.isManager = true;
				} else {
					// Employee is only a manager, add them
					employeeMap.set(emp.id, { employee: emp, isManager: true });
				}
			});

		// Create team employee records from the map
		const teamEmployees: OrganizationTeamEmployee[] = [];
		employeeMap.forEach(({ employee: emp, isManager }) => {
			const teamEmployee = new OrganizationTeamEmployee();
			// Set IDs
			teamEmployee.employeeId = emp.id;
			teamEmployee.organizationId = organizationId;
			teamEmployee.tenantId = tenantId;
			// Set relations
			teamEmployee.employee = emp;
			teamEmployee.organizationTeam = team;
			// Set manager fields
			teamEmployee.isManager = isManager;
			teamEmployee.role = isManager ? managerRole : null;
			teamEmployees.push(teamEmployee);
		});

		team.members = teamEmployees;

		organizationTeams.push(team);
	}

	await insertOrganizationTeam(dataSource, organizationTeams);

	return organizationTeams;
};

export const createRandomTeam = async (
	dataSource: DataSource,
	tenants: ITenant[],
	roles: IRole[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>
): Promise<OrganizationTeam[]> => {
	const teamNames = ['QA', 'Designers', 'Developers', 'Employees'];
	const organizationTeams: OrganizationTeam[] = [];

	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		for (const organization of organizations) {
			const { id: tenantId } = tenant;
			const { id: organizationId } = organization;
			const employees = organizationEmployeesMap.get(organization);
			for (const name of teamNames) {
				const team = new OrganizationTeam();
				team.name = name;
				team.organizationId = organization.id;
				team.tenant = organization.tenant;
				team.members = [];
				/**
				 * Team Members
				 */
				const managers = _.chain(employees)
					.shuffle()
					.take(faker.number.int({ min: 1, max: 5 }))
					.values()
					.value();
				managers.forEach((employee: IEmployee) => {
					team.members.push(
						new OrganizationTeamEmployee({
							employeeId: employee.id,
							tenantId,
							organizationId,
							isManager: true,
							role: roles.find(
								(role: IRole) => role.name === RolesEnum.MANAGER && role.tenantId === tenantId
							)
						})
					);
				});
				organizationTeams.push(team);
			}
		}
	}

	const uniqueTeams = organizationTeams.filter(function (elem, index, self) {
		return index === self.indexOf(elem);
	});

	await insertOrganizationTeam(dataSource, uniqueTeams);

	return uniqueTeams;
};

const insertOrganizationTeam = async (dataSource: DataSource, teams: OrganizationTeam[]): Promise<void> => {
	await dataSource.manager.save(teams);
};

/**
 * Update lastTeamId for demo users after teams are created
 * This ensures demo users have a default team when they log in
 */
export const updateDemoUsersLastTeam = async (dataSource: DataSource, organization: IOrganization): Promise<void> => {
	const { id: organizationId, tenantId } = organization;

	// Get the demo user emails
	const demoEmails = [
		environment.demoCredentialConfig.superAdminEmail,
		environment.demoCredentialConfig.adminEmail,
		environment.demoCredentialConfig.employeeEmail
	];

	// Find the users
	const users = await dataSource.manager.find(User, {
		where: demoEmails.map((email) => ({ email, tenantId }))
	});

	if (users.length === 0) {
		console.warn('No demo users found to update lastTeamId');
		return;
	}

	// For each user, find their employee and first team
	for (const user of users) {
		// Find the employee for this user
		const employee = await dataSource.manager.findOne(Employee, {
			where: {
				userId: user.id,
				tenantId,
				organizationId
			}
		});

		if (!employee) {
			console.warn(`No employee found for user ${user.email}`);
			continue;
		}

		// Find the first team this employee is a member of
		const teamMembership = await dataSource.manager.findOne(OrganizationTeamEmployee, {
			where: {
				employeeId: employee.id,
				tenantId,
				organizationId
			},
			relations: ['organizationTeam']
		});

		if (teamMembership && teamMembership.organizationTeam) {
			// Update the user's lastTeamId
			await dataSource.manager.update(
				User,
				{ id: user.id },
				{
					lastTeamId: teamMembership.organizationTeam.id,
					defaultTeamId: teamMembership.organizationTeam.id
				}
			);
			console.log(`Updated lastTeamId for ${user.email} to team: ${teamMembership.organizationTeam.name}`);
		}
	}
};
