import { Connection } from 'typeorm';
import * as faker from 'faker';
import { Tag } from '../tags/tag.entity';
import { OrganizationProject } from './organization-projects.entity';
import {
	IOrganization,
	ITenant,
	OrganizationProjectBudgetTypeEnum,
	TaskListTypeEnum
} from '@gauzy/contracts';
import { OrganizationContact } from '../organization-contact/organization-contact.entity';
import { DEFAULT_ORGANIZATION_PROJECTS } from './default-organization-projects';

export const createDefaultOrganizationProjects = async (
	connection: Connection,
	tenant: ITenant,
	defaultOrganizations: IOrganization[]
) => {
	const tag = await connection.getRepository(Tag).create({
		name: 'Web',
		description: '',
		color: faker.commerce.color()
	});
	const projects: OrganizationProject[] = [];

	for (let index = 0; index < DEFAULT_ORGANIZATION_PROJECTS.length; index++) {
		const name = DEFAULT_ORGANIZATION_PROJECTS[index];

		const organization = faker.random.arrayElement(defaultOrganizations);
		const organizationContacts = await connection
			.getRepository(OrganizationContact)
			.find({
				where: {
					organizationId: organization.id,
					tenantId: tenant.id
				}
			});
		const organizationContact = faker.random.arrayElement(
			organizationContacts
		);

		const project = new OrganizationProject();
		project.tags = [tag];
		project.name = name;
		project.organizationContact = organizationContact;
		project.organizationId = organization.id;
		project.tenant = tenant;
		project.budgetType = faker.random.arrayElement(
			Object.values(OrganizationProjectBudgetTypeEnum)
		);
		project.budget =
			project.budgetType == OrganizationProjectBudgetTypeEnum.COST
				? faker.datatype.number({ min: 2000, max: 40000 })
				: faker.datatype.number({ min: 20, max: 40 });
		project.taskListType = faker.random.arrayElement(
			Object.values(TaskListTypeEnum)
		);
		// TODO: this seed creates default projects without tenantId.
		projects.push(project);
	}
	return await connection.manager.save(projects);
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

	const projects: OrganizationProject[] = [];

	for (const tenant of tenants) {

		const projectsPerOrganization =
			Math.floor(Math.random() * (maxProjectsPerOrganization - 5)) + 5;

		const orgs = tenantOrganizationsMap.get(tenant);

		for (const org of orgs) {

			const organizationContacts = await connection
				.getRepository(OrganizationContact)
				.find({
					where: { organizationId: org.id, tenantId: org.tenantId }
				});

			const organizationContact = faker.random.arrayElement(
				organizationContacts
			);

			// tags.filter((x) => (x.organization = org));
      
			for (let i = 0; i < projectsPerOrganization; i++) {
				const project = new OrganizationProject();
				project.tags = [tags[Math.floor(Math.random() * tags.length)]];
				project.name = faker.company.companyName();
				project.organizationContact = organizationContact;
				project.organizationId = org.id;
				project.tenant = tenant;
				project.budgetType = faker.random.arrayElement(
					Object.values(OrganizationProjectBudgetTypeEnum)
				);
				project.budget =
					project.budgetType == OrganizationProjectBudgetTypeEnum.COST
						? faker.datatype.number({ min: 2000, max: 40000 })
						: faker.datatype.number({ min: 20, max: 40 });

				project.startDate = faker.date.past(5);
				project.endDate = faker.date.past(2);
				projects.push(project);
			}
		}
	}

	await connection.manager.save(projects);
};
