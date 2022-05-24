import { Connection } from 'typeorm';
import { faker } from '@ever-co/faker';
import { chain } from 'underscore';
import { OrganizationProject } from './organization-project.entity';
import {
	IOrganization,
	IOrganizationProject,
	ITag,
	ITenant,
	OrganizationProjectBudgetTypeEnum,
	TaskListTypeEnum
} from '@gauzy/contracts';
import { DEFAULT_ORGANIZATION_PROJECTS } from './default-organization-projects';
import { Employee, OrganizationContact, Tag } from './../core/entities/internal';

export const createDefaultOrganizationProjects = async (
	connection: Connection,
	tenant: ITenant,
	organization: IOrganization
): Promise<IOrganizationProject[]> => {
	const tag = await connection.getRepository(Tag).save({
		name: 'Web',
		description: '',
		color: faker.commerce.color()
	});

	const projects: IOrganizationProject[] = [];
	for (let index = 0; index < DEFAULT_ORGANIZATION_PROJECTS.length; index++) {
		const name = DEFAULT_ORGANIZATION_PROJECTS[index];
		const organizationContacts = await connection.manager.find(OrganizationContact, {
			where: {
				organization,
				tenant
			}
		});
		const project = new OrganizationProject();
		project.tags = [tag];
		project.name = name;
		project.organizationContact = faker.random.arrayElement(organizationContacts);
		project.organization = organization;
		project.tenant = tenant;
		project.budgetType = faker.random.arrayElement(
			Object.values(OrganizationProjectBudgetTypeEnum)
		);
		project.budget =
			project.budgetType == OrganizationProjectBudgetTypeEnum.COST
				? faker.datatype.number({ min: 500, max: 5000 })
				: faker.datatype.number({ min: 40, max: 400 });
		project.taskListType = faker.random.arrayElement(
			Object.values(TaskListTypeEnum)
		);
		// TODO: this seed creates default projects without tenantId.
		projects.push(project);
	}
 	await connection.manager.save(projects);

	/**
	* Seeder for assign organization project to the employee of the specific organization
	*/
 	await assignOrganizationProjectToEmployee(
		connection,
		tenant,
		organization
	);

	/**
	* Seeder for update project member count for specific tenant
	*/
	await seedProjectMembersCount(
		connection,
		[tenant]
	)
	return projects;
};

export const createRandomOrganizationProjects = async (
	connection: Connection,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	tags: ITag[] | void,
	maxProjectsPerOrganization
) => {
	if (!tags) {
		console.warn(
			'Warning: tags not found, RandomOrganizationProjects will not be created'
		);
		return;
	}

	for await (const tenant of tenants) {
		const projectsPerOrganization = Math.floor(Math.random() * (maxProjectsPerOrganization - 5)) + 5;
		const organizations = tenantOrganizationsMap.get(tenant);

		for await (const organization of organizations) {
			const organizationContacts = await connection.manager.find(OrganizationContact, {
				where: {
					tenant,
					organization
				}
			});
			const organizationContact = faker.random.arrayElement(organizationContacts);

			const projects: OrganizationProject[] = [];
			for (let i = 0; i < projectsPerOrganization; i++) {
				const project = new OrganizationProject();
				project.tags = [tags[Math.floor(Math.random() * tags.length)]];
				project.name = faker.company.companyName();
				project.organizationContact = organizationContact;
				project.organization = organization;
				project.tenant = tenant;
				project.budgetType = faker.random.arrayElement(
					Object.values(OrganizationProjectBudgetTypeEnum)
				);
				project.budget =
					project.budgetType == OrganizationProjectBudgetTypeEnum.COST
						? faker.datatype.number({ min: 500, max: 5000 })
						: faker.datatype.number({ min: 40, max: 400 });

				project.startDate = faker.date.past(5);
				project.endDate = faker.date.past(2);
				projects.push(project);
			}
			await connection.manager.save(projects);

			/**
			* Seeder for assign organization project to the employee of the specific organization
			*/
			await assignOrganizationProjectToEmployee(
				connection,
				tenant,
				organization
			);
		}

		/**
		* Seeder for update project member count for specific tenant
		*/
		await seedProjectMembersCount(
			connection,
			[tenant]
		)
	}
};

/*
* Assign Organization Project To Respective Employees
*/
export const assignOrganizationProjectToEmployee = async (
	connection: Connection,
	tenant: ITenant,
	organization: IOrganization
) => {
	const organizationProjects = await connection.manager.find(OrganizationProject, {
		where: {
			tenant,
			organization
		}
	});
	const employees = await connection.manager.find(Employee, {
		where: {
			tenant,
			organization
		}
	});
	for await (const employee of employees) {
		employee.projects = chain(organizationProjects)
			.shuffle()
			.take(faker.datatype.number({ min: 2, max: 4 }))
			.unique()
			.values()
			.value();
	}
	await connection.manager.save(employees);
};

export async function seedProjectMembersCount(
	connection: Connection,
	tenants: ITenant[]
) {
	/**
	 * GET all tenants in the system
	 */
	for await (const tenant of tenants) {
		const tenantId = tenant.id;

    	console.log(`Processing tenant: ${tenantId}`);

		/**
		 * GET all tenant projects for specific tenant
		 */
		const projects = await connection.manager.query(`SELECT * FROM "organization_project" WHERE "organization_project"."tenantId" = $1`, [
			tenantId
		]);

    	console.log(`Find ${projects.length} projects in tenant ${tenantId}`);

		for await (const project of projects) {

			const projectId = project.id;

      		console.log(`Processing project ${projectId} in tenant ${tenantId}`);

			/**
			 * GET member counts for organization project
			 */
			const [ members ] = await connection.manager.query(`
				SELECT
					COUNT("organization_project_employee"."employeeId") AS count
				FROM "organization_project_employee"
				INNER JOIN
					"employee" ON "employee"."id"="organization_project_employee"."employeeId"
				INNER JOIN
					"organization_project" ON "organization_project"."id"="organization_project_employee"."organizationProjectId"
				WHERE
					"organization_project_employee"."organizationProjectId" = $1
			`, [ projectId ]);

			const count = members['count'];

      		console.log(`Members qty: ${count}`);

			await connection.manager.query(`UPDATE "organization_project" SET "membersCount" = $1 WHERE "id" = $2`, [count, projectId]);

      		console.log('Updated Members qty');
		}
	}
}
