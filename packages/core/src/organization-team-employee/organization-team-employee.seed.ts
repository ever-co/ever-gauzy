import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { OrganizationTeamEmployee } from './organization-team-employee.entity';
import { IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import { OrganizationTeam, Role } from './../core/entities/internal';

export const createRandomOrganizationTeamEmployee = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>
) => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Random Organization Team Employee will not be created'
		);
		return;
	}
	if (!organizationEmployeesMap) {
		console.warn(
			'Warning: organizationEmployeesMap not found, Random Organization Team Employee will not be created'
		);
		return;
	}

	const orgTeamEmployees: OrganizationTeamEmployee[] = [];
	for (const tenant of tenants) {
		const { id: tenantId } = tenant;
		const organizations = tenantOrganizationsMap.get(tenant);

		for (const organization of organizations) {
			const tenantEmployees = organizationEmployeesMap.get(organization);
			const { id: organizationId } = organization;
			const organizationTeams = await dataSource.manager.findBy(OrganizationTeam, {
				organizationId,
				tenantId
			});
			const roles = await dataSource.manager.find(Role, {});
			const team = faker.random.arrayElement(organizationTeams);
			const employee = faker.random.arrayElement(tenantEmployees);

			const orgTeamEmployee = new OrganizationTeamEmployee();

			orgTeamEmployee.organizationTeamId = team.id;
			orgTeamEmployee.employeeId = employee.id;
			orgTeamEmployee.organizationTeam = team;
			orgTeamEmployee.employee = employee;
			orgTeamEmployee.organizationId = organizationId;
			orgTeamEmployee.tenantId = tenantId;
			orgTeamEmployee.role = faker.random.arrayElement(roles);

			orgTeamEmployees.push(orgTeamEmployee);
		}
	}
	await dataSource.manager.save(orgTeamEmployees);
};
