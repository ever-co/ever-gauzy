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

	const organizationTeams: OrganizationTeam[] = [];
	for (let i = 0; i < teams.length; i++) {
		const team = new OrganizationTeam();
		team.name = teams[i].name;
		team.organizationId = organization.id;
		team.tenant = organization.tenant;

		const filteredEmployees = employees.filter((e) => (teams[i].defaultMembers || []).indexOf(e.user.email) > -1);

		const teamEmployees: OrganizationTeamEmployee[] = [];

		filteredEmployees.forEach((emp) => {
			const teamEmployee = new OrganizationTeamEmployee();
			teamEmployee.employeeId = emp.id;
			teamEmployees.push(teamEmployee);
		});

		const managers = employees.filter((e) => (teams[i].manager || []).indexOf(e.user.email) > -1);

		managers.forEach((emp) => {
			const teamEmployee = new OrganizationTeamEmployee();
			teamEmployee.employeeId = emp.id;
			teamEmployee.isManager = true;
			teamEmployee.role = roles.filter((x) => x.name === RolesEnum.MANAGER)[0];
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
							role: roles.filter(
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
