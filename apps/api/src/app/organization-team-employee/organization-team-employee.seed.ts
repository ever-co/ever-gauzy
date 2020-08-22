import { Connection } from 'typeorm';
import * as faker from 'faker';
import { OrganizationTeamEmployee } from './organization-team-employee.entity';
import { Employee, Organization } from '@gauzy/models';
import { Tenant } from '../tenant/tenant.entity';
import { OrganizationTeam } from '../organization-team/organization-team.entity';
import { Role } from '../role/role.entity';

export const createRandomOrganizationTeamEmployee = async (
	connection: Connection,
	tenants: Tenant[],
	tenantEmployeeMap: Map<Tenant, Employee[]>,
	tenantOrganizationsMap: Map<Tenant, Organization[]>
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
		let tenantEmployees = tenantEmployeeMap.get(tenant);
		for (const org of orgs) {
			const OrganizationTeams = await connection.manager.find(
				OrganizationTeam,
				{
					where: [{ organizationId: org.id }]
				}
			);
			const roles = await connection.manager.find(Role, {});
			let team = faker.random.arrayElement(OrganizationTeams);
			let employee = faker.random.arrayElement(tenantEmployees);

			const orgTeamEmployee = new OrganizationTeamEmployee();

			orgTeamEmployee.organizationTeamId = team.id;
			orgTeamEmployee.employeeId = employee.id;
			orgTeamEmployee.organizationTeam = team;
			orgTeamEmployee.employee = employee;
			orgTeamEmployee.role = faker.random.arrayElement(roles);

			orgTeamEmployees.push(orgTeamEmployee);
		}
	}
	await connection.manager.save(orgTeamEmployees);
};
