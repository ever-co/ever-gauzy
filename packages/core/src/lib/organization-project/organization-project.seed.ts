import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
import { chain } from 'underscore';
import {
	IOrganization,
	IOrganizationProject,
	ITenant,
	OrganizationProjectBudgetTypeEnum,
	TaskListTypeEnum,
	TaskStatusEnum
} from '@gauzy/contracts';
import { DatabaseTypeEnum } from '@gauzy/config';
import { DEFAULT_ORGANIZATION_PROJECTS } from './default-organization-projects';
import { Employee, OrganizationContact, OrganizationProjectEmployee, Tag } from './../core/entities/internal';
import { OrganizationProject } from './organization-project.entity';
import { prepareSQLQuery as p } from '../database/database.helper';
import { replacePlaceholders } from '../core/utils';

/**
 * Creates default organization projects, assigns them to employees, and seeds project member counts.
 *
 * @param dataSource - The TypeORM data source instance for database operations.
 * @param tenant - The tenant information.
 * @param organization - The organization information.
 * @returns A promise that resolves to an array of created organization projects.
 */
export const createDefaultOrganizationProjects = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization
): Promise<IOrganizationProject[]> => {
	const { id: organizationId, tenantId } = organization;

	try {
		// Create and save the Tag
		const tags = await dataSource.getRepository(Tag).save([
			{
				name: 'Web',
				description: '',
				color: faker.color.human()
			},
			{
				name: 'API',
				description: '',
				color: faker.color.human()
			}
		]);

		// Fetch all OrganizationContacts once to avoid redundant queries
		const organizationContacts = await dataSource.manager.findBy(OrganizationContact, {
			tenantId,
			organizationId
		});

		// Define a mapping between Budget Types and their respective min and max values
		const budgetRanges: Record<OrganizationProjectBudgetTypeEnum, { min: number; max: number }> = {
			[OrganizationProjectBudgetTypeEnum.COST]: { min: 500, max: 5000 },
			[OrganizationProjectBudgetTypeEnum.HOURS]: { min: 40, max: 400 }
		};

		// Initialize an array to hold the created projects
		const projects: OrganizationProject[] = [];

		// Iterate over the default project names and create OrganizationProject instances
		for (const projectName of DEFAULT_ORGANIZATION_PROJECTS) {
			const budgetType = faker.helpers.arrayElement(Object.values(OrganizationProjectBudgetTypeEnum));

			// Retrieve the budget range based on the budgetType
			const { min, max } = budgetRanges[budgetType] || { min: 0, max: 0 };

			// Generate the budget using faker with the determined range
			const budget = faker.number.int({ min, max });

			// Create a new OrganizationProject instance
			const project = new OrganizationProject();
			project.name = projectName;
			project.status = faker.helpers.arrayElement(Object.values(TaskStatusEnum));
			project.tags = tags;
			project.organizationContact = faker.helpers.arrayElement(organizationContacts);
			project.organization = organization;
			project.tenant = tenant;
			project.budgetType = budgetType;
			project.budget = budget;
			project.taskListType = faker.helpers.arrayElement(Object.values(TaskListTypeEnum));

			// If organizationContacts is not empty, assign a random organization contact
			if (organizationContacts.length > 0) {
				project.organizationContact = faker.helpers.arrayElement(organizationContacts);
			}

			// Add project to projects array
			projects.push(project);
		}

		// Bulk save all projects
		const savedProjects = await dataSource.manager.save(projects, { chunk: 100 });

		// Assign projects to employees
		await assignOrganizationProjectToEmployee(dataSource, organization);

		// Seed project member counts for the tenant
		await seedProjectMembersCount(dataSource, [tenant]);

		return savedProjects;
	} catch (error) {
		console.log('Error creating default organization projects:', error?.message);
	}
};

/**
 * Creates random organization projects for given tenants and their organizations.
 *
 * @param dataSource - The TypeORM data source instance for database operations.
 * @param tenants - An array of tenant entities.
 * @param tenantOrganizationsMap - A map linking each tenant to its organizations.
 * @param tags - An array of tag entities to associate with projects.
 * @param maxProjectsPerOrganization - The maximum number of projects to create per organization.
 * @returns A promise that resolves to an array of created OrganizationProject entities.
 */
export const createRandomOrganizationProjects = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	tags: Tag[] = [],
	maxProjectsPerOrganization: number
) => {
	// Iterate over each tenant and create random projects for each organization
	for await (const tenant of tenants) {
		// Get the ID of the current tenant
		const { id: tenantId } = tenant;
		// Fetch organizations for the current tenant
		const organizations = tenantOrganizationsMap.get(tenant);

		// Determine the number of projects to create for each organization
		const projectsPerOrganization = Math.floor(Math.random() * (maxProjectsPerOrganization - 5)) + 5;

		if (!organizations || organizations.length === 0) {
			console.warn(`No organizations found for tenant ID: ${tenantId}`);
			continue; // Skip to the next tenant if no organizations are found
		}

		// Define a mapping between Budget Types and their respective min and max values
		const budgetRanges: Record<OrganizationProjectBudgetTypeEnum, { min: number; max: number }> = {
			[OrganizationProjectBudgetTypeEnum.COST]: { min: 500, max: 5000 },
			[OrganizationProjectBudgetTypeEnum.HOURS]: { min: 40, max: 400 }
		};

		// Create random projects for each organization
		for await (const organization of organizations) {
			const { id: organizationId } = organization;

			// Fetch all OrganizationContacts once to avoid redundant queries
			const organizationContacts = await dataSource.manager.findBy(OrganizationContact, {
				tenantId,
				organizationId
			});

			const projects: OrganizationProject[] = [];

			// Iterate over each organization and create projects
			for (let i = 0; i < projectsPerOrganization; i++) {
				const budgetType = faker.helpers.arrayElement(Object.values(OrganizationProjectBudgetTypeEnum));
				// Retrieve the budget range based on the budgetType
				const { min, max } = budgetRanges[budgetType] || { min: 0, max: 0 };
				// Generate the budget using faker with the determined range
				const budget = faker.number.int({ min, max });

				// Create a new OrganizationProject instance
				const project = new OrganizationProject();
				project.tags = [tags[Math.floor(Math.random() * tags.length)]];
				project.name = faker.company.name();
				project.status = faker.helpers.arrayElement(Object.values(TaskStatusEnum));
				project.organization = organization;
				project.tenant = tenant;
				project.budgetType = budgetType;
				project.budget = budget;
				project.startDate = faker.date.past({ years: 5 });
				project.endDate = faker.date.between({ from: project.startDate, to: new Date() });

				// If organizationContacts is not empty, assign a random organization contact
				if (organizationContacts.length > 0) {
					project.organizationContact = faker.helpers.arrayElement(organizationContacts);
				}

				projects.push(project);
			}

			// Bulk save all projects
			await dataSource.manager.save(projects, { chunk: 100 });

			// Assign projects to employees
			await assignOrganizationProjectToEmployee(dataSource, organization);
		}

		// Seed project member counts for the tenant
		await seedProjectMembersCount(dataSource, [tenant]);
	}
};

/**
 * Assigns unique Organization Projects to each Employee within an Organization.
 *
 * @param dataSource - The data source instance for database operations.
 * @param organization - The organization object containing `id` and `tenantId`.
 */
export const assignOrganizationProjectToEmployee = async (dataSource: DataSource, organization: IOrganization) => {
	const { id: organizationId, tenantId } = organization;

	// Fetch all projects and employees for the organization and tenant
	const [organizationProjects, employees] = await Promise.all([
		dataSource.manager.findBy(OrganizationProject, { tenantId, organizationId }),
		dataSource.manager.findBy(Employee, { tenantId, organizationId })
	]);

	// Check if there are enough projects to assign
	if (organizationProjects.length == 0) {
		console.warn('Not enough projects to assign. At least 1 projects are required.');
		return;
	}

	// Initialize an array to store the OrganizationProjectEmployee instances
	const members: OrganizationProjectEmployee[] = [];

	// Iterate over each employee and assign projects
	for (const employee of employees) {
		// Determine the number of projects to assign (between 2 and 4)
		const numberOfProjects = faker.number.int({ min: 2, max: 4 });

		// Shuffle and select unique projects
		const projects = chain(organizationProjects).shuffle().take(numberOfProjects).value();

		// Create OrganizationProjectEmployee instances for the selected projects
		for (const project of projects) {
			const projectEmployee = new OrganizationProjectEmployee();
			projectEmployee.employee = employee;
			projectEmployee.organizationProject = project;
			projectEmployee.organization = organization;
			projectEmployee.tenant = organization.tenant;

			members.push(projectEmployee);
		}
	}

	// Save all OrganizationProjectEmployee relationships in bulk
	await dataSource.manager.save(members, { chunk: 100 });
};

/**
 * Seeds the members count for each organization project associated with the provided tenants.
 *
 * @param dataSource - The TypeORM data source instance for database operations.
 * @param tenants - An array of tenant entities.
 *
 * @returns A promise that resolves when the seeding is complete.
 */
export async function seedProjectMembersCount(dataSource: DataSource, tenants: ITenant[]): Promise<void> {
	try {
		for (const tenant of tenants) {
			const tenantId = tenant.id;

			let query: string;

			// Check if the database type is MySQL
			if (dataSource.options.type === DatabaseTypeEnum.mysql) {
				// Rewrite the query for MySQL without using the FROM clause
				query = `
					UPDATE \`organization_project\` op
					JOIN (
						SELECT \`organizationProjectId\`, COUNT(\`employeeId\`) AS count
						FROM \`organization_project_employee\`
						GROUP BY \`organizationProjectId\`
					) AS sub
					ON op.id = sub.\`organizationProjectId\`
					SET op.\`membersCount\` = sub.count
					WHERE op.\`tenantId\` = ?;
				`;
			} else {
				// Consolidated SQL to update membersCount for all projects of the current tenant
				query = replacePlaceholders(
					p(`
					UPDATE "organization_project" AS op
					SET "membersCount" = sub.count
					FROM (
						SELECT "organizationProjectId", COUNT("employeeId") AS count
						FROM "organization_project_employee"
						GROUP BY "organizationProjectId"
					) AS sub
					WHERE op.id = sub."organizationProjectId"
					AND op."tenantId" = $1;
				`),
					dataSource.options.type as DatabaseTypeEnum
				);
			}
			// Execute the consolidated update query with the appropriate parameter
			await dataSource.manager.query(query, [tenantId]);
			console.log(`Updated membersCount for tenant ID: ${tenantId}`);
		}
	} catch (error) {
		console.error('Error seeding project members count:', error);
	}
}
