import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import { OrganizationTeamEmployee } from './organization-team-employee.entity';
import { OrganizationTeam, Role } from './../core/entities/internal';

/**
 * Create random OrganizationTeamEmployee entries for each tenant, organization, and employee.
 *
 * @param dataSource - The data source instance for managing database operations
 * @param tenants - List of tenants to create OrganizationTeamEmployees for
 * @param tenantOrganizationsMap - A map linking each tenant to its organizations
 * @param organizationEmployeesMap - A map linking each organization to its employees
 * @returns void
 */
export const createRandomOrganizationTeamEmployee = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>
): Promise<void> => {
	if (!tenantOrganizationsMap || !organizationEmployeesMap) {
		console.warn('Warning: Required maps not found, Random Organization Team Employee creation skipped.');
		return;
	}

	const orgTeamEmployees: OrganizationTeamEmployee[] = [];

	// Iterate over each tenant
	for await (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant) || [];
		const { id: tenantId } = tenant;

		// Fetch employees in parallel
		const roles = await dataSource.manager.find(Role, { where: { tenantId } }); // Fetch roles once for reuse

		// Iterate over each organization
		for await (const organization of organizations) {
			const tenantEmployees = organizationEmployeesMap.get(organization) || [];
			const { id: organizationId } = organization;

			// Fetch organization teams in parallel
			const organizationTeams = await dataSource.manager.findBy(OrganizationTeam, {
				organizationId,
				tenantId
			});

			// Randomly select a team and employee if available
			if (organizationTeams.length && tenantEmployees.length) {
				const team = faker.helpers.arrayElement(organizationTeams);
				const employee = faker.helpers.arrayElement(tenantEmployees);

				// Create a new OrganizationTeamEmployee instance
				orgTeamEmployees.push(
					new OrganizationTeamEmployee({
						organizationTeamId: team.id,
						employeeId: employee.id,
						organizationTeam: team,
						employee: employee,
						organizationId,
						tenantId,
						role: faker.helpers.arrayElement(roles)
					})
				);
			}
		}
	}

	// Save the organization team employees to the database
	await dataSource.manager.save(orgTeamEmployees);
};
