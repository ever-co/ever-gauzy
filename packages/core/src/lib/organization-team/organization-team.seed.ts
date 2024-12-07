import { DataSource } from 'typeorm';
import { OrganizationTeam } from './organization-team.entity';
import { OrganizationTeamEmployee } from '../organization-team-employee/organization-team-employee.entity';
import { IEmployee, IOrganization, IRole, ITenant, RolesEnum } from '@gauzy/contracts';
import * as _ from 'underscore';
import { faker } from '@faker-js/faker';
import { DEFAULT_ORGANIZATION_TEAMS } from './default-organization-teams';

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

		const filteredEmployees = employees.filter(
			(e) => (teams[i].defaultMembers || []).indexOf(e.user.email) > -1
		);

		const teamEmployees: OrganizationTeamEmployee[] = [];

		filteredEmployees.forEach((emp) => {
			const teamEmployee = new OrganizationTeamEmployee();
			teamEmployee.employeeId = emp.id;
			teamEmployees.push(teamEmployee);
		});

		const managers = employees.filter(
			(e) => (teams[i].manager || []).indexOf(e.user.email) > -1
		);

		managers.forEach((emp) => {
			const teamEmployee = new OrganizationTeamEmployee();
			teamEmployee.employeeId = emp.id;
			teamEmployee.role = roles.filter(
				(x) => x.name === RolesEnum.MANAGER
			)[0];
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
					team.members.push(new OrganizationTeamEmployee({
						employeeId: employee.id,
						tenantId,
						organizationId,
						role: roles.filter(
							(role: IRole) => role.name === RolesEnum.MANAGER && role.tenantId === tenantId
						)
					}));
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

const insertOrganizationTeam = async (
	dataSource: DataSource,
	teams: OrganizationTeam[]
): Promise<void> => {
	await dataSource.manager.save(teams);
};
