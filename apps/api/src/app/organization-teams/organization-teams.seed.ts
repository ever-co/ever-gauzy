import { Connection } from 'typeorm';
import { Employee } from '../employee/employee.entity';
import { environment as env } from '@env-api/environment';
import { OrganizationTeams } from './organization-teams.entity';
import { Organization } from '../organization/organization.entity';

export const createDefaultTeams = async (
	connection: Connection,
	organization: Organization,
	employees: Employee[]
): Promise<OrganizationTeams[]> => {
	const teams = env.defaultTeams || [];

	const organizationTeams = [];
	for (let i = 0; i < teams.length; i++) {
		const team = new OrganizationTeams();
		team.name = teams[i].name;
		team.organizationId = organization.id;
		team.members = employees.filter(
			(e) => (teams[i].defaultMembers || []).indexOf(e.user.email) > -1
		);

		organizationTeams.push(team);
	}

	insertOrganizationTeam(connection, organizationTeams);

	return organizationTeams;
};

const insertOrganizationTeam = async (
	connection: Connection,
	team: OrganizationTeams[]
): Promise<void> => {
	await connection.manager.save(team);
};
