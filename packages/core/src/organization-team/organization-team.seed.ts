import { Connection } from 'typeorm';
import { Employee } from '../employee/employee.entity';
import { OrganizationTeam } from './organization-team.entity';
import { OrganizationTeamEmployee } from '../organization-team-employee/organization-team-employee.entity';
import { Organization } from '../organization/organization.entity';
import { Role } from '../role/role.entity';
import { IOrganization, IRole, ITenant, RolesEnum } from '@gauzy/contracts';
import * as _ from 'underscore';
import * as faker from 'faker';
import { DEFAULT_ORGANIZATION_TEAMS } from './default-organization-teams';

export const createDefaultTeams = async (
	connection: Connection,
	organization: Organization,
	employees: Employee[],
	roles: Role[]
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

	await insertOrganizationTeam(connection, organizationTeams);

	return organizationTeams;
};

export const createRandomTeam = async (
	connection: Connection,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	roles: IRole[]
): Promise<OrganizationTeam[]> => {
	const teamNames = ['QA', 'Designers', 'Developers', 'Employees'];
	const organizationTeams: OrganizationTeam[] = [];

	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		const employees = tenantOrganizationsMap.get(tenant);

		for (const organization of organizations) {
			for (const name of teamNames) {
				const team = new OrganizationTeam();
				team.name = name;
				team.organizationId = organization.id;
				team.tenant = organization.tenant;

				const emps = _.chain(employees)
					.shuffle()
					.take(faker.datatype.number({ min: 1, max: 5 }))
					.values()
					.value();

				const teamEmployees: OrganizationTeamEmployee[] = [];

				emps.forEach((emp) => {
					const teamEmployee = new OrganizationTeamEmployee();
					teamEmployee.employeeId = emp.id;
					teamEmployees.push(teamEmployee);
				});

				const managers = _.chain(employees)
					.shuffle()
					.take(faker.datatype.number({ min: 1, max: 2 }))
					.values()
					.value();

				managers.forEach((emp) => {
					const teamEmployee = new OrganizationTeamEmployee();
					teamEmployee.employeeId = emp.id;
					teamEmployee.role = roles.filter(
						(x) => x.name === RolesEnum.MANAGER
					)[0];
					teamEmployees.push(teamEmployee);
				});

				organizationTeams.push(team);
			}
		}
	}

	const uniqueTeams = organizationTeams.filter(function (elem, index, self) {
		return index === self.indexOf(elem);
	});

	await insertOrganizationTeam(connection, uniqueTeams);

	return uniqueTeams;
};

const insertOrganizationTeam = async (
	connection: Connection,
	teams: OrganizationTeam[]
): Promise<void> => {
	await connection.manager.save(teams);
};
