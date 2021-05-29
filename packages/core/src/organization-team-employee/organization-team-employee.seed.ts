import { Connection } from 'typeorm';
import * as faker from 'faker';
import { OrganizationTeamEmployee } from './organization-team-employee.entity';
import { IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import { OrganizationTeam, Role } from './../core/entities/internal';

export const createRandomOrganizationTeamEmployee = async (
	connection: Connection,
	tenants: ITenant[],
	tenantEmployeeMap: Map<ITenant, IEmployee[]>,
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
) => {
	if (!tenantEmployeeMap) {
		console.warn(
			'Warning: tenantEmployeeMap not found, Random Organization Team Employee will not be created'
		);
		return;
	}
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Random Organization Team Employee will not be created'
		);
		return;
	}

	const orgTeamEmployees: OrganizationTeamEmployee[] = [];
	for (const tenant of tenants) {
		const orgs = tenantOrganizationsMap.get(tenant);
		const tenantEmployees = tenantEmployeeMap.get(tenant);
		for (const org of orgs) {
			const organizationTeams = await connection.manager.find(
				OrganizationTeam,
				{
					where: [{ organizationId: org.id }]
				}
			);
			const roles = await connection.manager.find(Role, {});
			const team = faker.random.arrayElement(organizationTeams);
			const employee = faker.random.arrayElement(tenantEmployees);

			const orgTeamEmployee = new OrganizationTeamEmployee();

			orgTeamEmployee.organizationTeamId = team.id;
			orgTeamEmployee.employeeId = employee.id;
			orgTeamEmployee.organizationTeam = team;
			orgTeamEmployee.employee = employee;
			orgTeamEmployee.organization = org;
			orgTeamEmployee.tenant = tenant;
			orgTeamEmployee.role = faker.random.arrayElement(roles);

			orgTeamEmployees.push(orgTeamEmployee);
		}
	}
	await connection.manager.save(orgTeamEmployees);
};
