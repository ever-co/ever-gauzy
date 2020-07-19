import { Connection } from 'typeorm';
import { Employee } from '../employee/employee.entity';
import { environment as env } from '@env-api/environment';
import { OrganizationTeam } from './organization-team.entity';
import { OrganizationTeamEmployee } from '../organization-team-employee/organization-team-employee.entity';
import { Organization } from '../organization/organization.entity';
import { Role } from '../role/role.entity';
import { RolesEnum } from '@gauzy/models';

export const createDefaultTeams = async (
	connection: Connection,
	organization: Organization,
	employees: Employee[],
	roles: Role[]
): Promise<OrganizationTeam[]> => {
	const teams = env.defaultTeams || [];

	const organizationTeams: OrganizationTeam[] = [];
	for (let i = 0; i < teams.length; i++) {
		const team = new OrganizationTeam();
		team.name = teams[i].name;
		team.organizationId = organization.id;

		const emps = employees.filter(
			(e) => (teams[i].defaultMembers || []).indexOf(e.user.email) > -1
		);

		const teamEmployees: OrganizationTeamEmployee[] = [];

		emps.forEach((emp) => {
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

const insertOrganizationTeam = async (
	connection: Connection,
	teams: OrganizationTeam[]
): Promise<void> => {
	await connection.manager.save(teams);
};
