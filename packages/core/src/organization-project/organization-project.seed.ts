import { Connection } from 'typeorm';
import * as faker from 'faker';
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
	organizations: IOrganization[]
): Promise<IOrganizationProject[]> => {
	const tag = await connection.getRepository(Tag).save({
		name: 'Web',
		description: '',
		color: faker.commerce.color()
	});

	const projects: IOrganizationProject[] = [];
	for (let index = 0; index < DEFAULT_ORGANIZATION_PROJECTS.length; index++) {
		const name = DEFAULT_ORGANIZATION_PROJECTS[index];
		const organization = faker.random.arrayElement(organizations);
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
				? faker.datatype.number({ min: 200, max: 2000 })
				: faker.datatype.number({ min: 20, max: 40 });
		project.taskListType = faker.random.arrayElement(
			Object.values(TaskListTypeEnum)
		);
		// TODO: this seed creates default projects without tenantId.
		projects.push(project);
	}
 	await connection.manager.save(projects);
 	await assignOrganizationProjectToEmployee(
		connection,
		tenant,
		organizations
	);
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
		const projects: OrganizationProject[] = [];
		const projectsPerOrganization = Math.floor(Math.random() * (maxProjectsPerOrganization - 5)) + 5;
		const organizations = tenantOrganizationsMap.get(tenant);

		for await (const organization of organizations) {
			const organizationContacts = await connection.manager.find(OrganizationContact, {
				where: { 
					tenant,
					organization
				}
			});
			const organizationContact = faker.random.arrayElement(
				organizationContacts
			);
      
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
						? faker.datatype.number({ min: 200, max: 2000 })
						: faker.datatype.number({ min: 10, max: 30 });

				project.startDate = faker.date.past(5);
				project.endDate = faker.date.past(2);
				projects.push(project);
			}
			await connection.manager.save(projects);
			await assignOrganizationProjectToEmployee(
				connection,
				tenant,
				organizations
			);
		}
	}

};

/*
* Assign Organization Project To Respective Employees
*/
export const assignOrganizationProjectToEmployee = async (
	connection: Connection,
	tenant: ITenant,
	organizations: IOrganization[]
) => {
	for await (const organization of organizations) {
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
	}
};
