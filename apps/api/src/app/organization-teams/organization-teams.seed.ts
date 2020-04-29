import { Connection } from 'typeorm';
import { Employee } from '../employee/employee.entity';
import { environment as env } from '@env-api/environment';
import { OrganizationTeams } from './organization-teams.entity';
import { OrganizationTeamEmployee } from '../organization-team-employee/organization-team-employee.entity';
import { Organization } from '../organization/organization.entity';

export const createDefaultTeams = async (
	connection: Connection,
	organization: Organization,
	employees: Employee[]
): Promise<OrganizationTeams[]> => {
	const teams = env.defaultTeams || [];

	const organizationTeams: OrganizationTeams[] = [];
	for (let i = 0; i < teams.length; i++) {
		const team = new OrganizationTeams();
		team.name = teams[i].name;
		team.organizationId = organization.id;

		team.members = employees.filter(
			(e) => (teams[i].defaultMembers || []).indexOf(e.user.email) > -1
		);

		const teamEmployee: OrganizationTeamEmployee[] = [];
		team.members.forEach((member) => {
			const employee = new OrganizationTeamEmployee();
			employee.employeeId = member.id;
			teamEmployee.push(employee);
		});

		team.teamEmployee = teamEmployee;

		organizationTeams.push(team);
	}

	await insertOrganizationTeam(connection, organizationTeams);

	return organizationTeams;
};

const insertOrganizationTeam = async (
	connection: Connection,
	teams: OrganizationTeams[]
): Promise<void> => {
	await connection.manager.save(teams);
};
