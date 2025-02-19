import { DataSource } from 'typeorm';
import { IDashboard, IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import { Dashboard } from './dashboard.entity';

/**
 * Creates default dashboards for a list of employees within a specific tenant and organization.
 *
 * @param dataSource - The TypeORM DataSource instance.
 * @param tenant - The tenant object.
 * @param organization - The organization object.
 * @param employees - An array of employee objects.
 * @returns A promise that resolves to an array of created Dashboard entities.
 */
export const createDefaultEmployeeDashboards = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	employees: IEmployee[]
): Promise<IDashboard[]> => {
	const dashboards: Dashboard[] = employees.map((employee) => {
		return new Dashboard({
			name: 'Default Dashboard',
			identifier: `default_${employee.id}`,
			description: 'This is the default dashboard.',
			contentHtml: '<div>Welcome to your dashboard</div>',
			isDefault: true,
			tenantId: tenant.id,
			organizationId: organization.id,
			employeeId: employee.id,
			createdByUserId: employee.user.id
		});
	});

	// Insert the generated dashboards into the database
	return await insertDashboards(dataSource, dashboards);
};

/**
 * Creates random dashboards for employees across multiple tenants and organizations.
 *
 * @param dataSource - The TypeORM DataSource instance.
 * @param tenants - An array of tenant objects.
 * @param tenantOrganizationsMap - A map where each tenant maps to an array of its organizations.
 * @param organizationEmployeesMap - A map where each organization maps to an array of its employees.
 * @returns A promise that resolves to an array of created Dashboard entities.
 */
export const createRandomEmployeeDashboards = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>
): Promise<IDashboard[]> => {
	const dashboards: Dashboard[] = [];

	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant) || [];

		for (const organization of organizations) {
			const employees = organizationEmployeesMap.get(organization) || [];

			for (const employee of employees) {
				const dashboard = new Dashboard({
					name: `Dashboard for ${employee.fullName}`,
					identifier: `dashboard_${employee.id}`,
					description: 'This is a randomly generated dashboard.',
					contentHtml: '<div>Random dashboard content</div>',
					isDefault: false,
					tenantId: tenant.id,
					organizationId: organization.id,
					employeeId: employee.id,
					createdByUserId: employee.user.id
				});

				dashboards.push(dashboard);
			}
		}
	}

	// Insert the generated dashboards into the database
	return await insertDashboards(dataSource, dashboards);
};

/**
 * Inserts an array of dashboards into the database in batches.
 *
 * @param dataSource - The TypeORM DataSource instance.
 * @param dashboards - An array of Dashboard entities to insert.
 * @returns A promise that resolves to an array of inserted Dashboard entities.
 */
const insertDashboards = async (
	dataSource: DataSource,
	dashboards: Dashboard[],
	batchSize = 100 // Define the batch size to control the number of records inserted per query
): Promise<Dashboard[]> => {
	if (!dashboards.length) {
		console.warn('No dashboards to insert. Please check the input data and try again.');
		return [];
	}

	try {
		// Get the repository for EmployeeNotification
		const dashboardRepository = dataSource.getRepository(Dashboard);
		// Insert the notifications in batches
		return await dashboardRepository.save(dashboards, { chunk: batchSize });
	} catch (error) {
		console.error('Error while inserting dashboards:', error);
		return [];
	}
};
