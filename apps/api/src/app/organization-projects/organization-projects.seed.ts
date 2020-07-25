import { Connection } from 'typeorm';
import * as faker from 'faker';
import { Tag } from '../tags/tag.entity';
import { OrganizationProjects } from './organization-projects.entity';
import { Organization } from '@gauzy/models';
import { Tenant } from '../tenant/tenant.entity';
import { OrganizationContact } from '../organization-contact/organization-contact.entity';

const defaultProjects = [
	'Gauzy Platform (Open-Source)',
	'Gauzy Web Site',
	'Gauzy Platform SaaS',
	'Gauzy Platform DevOps'
];

export const createDefaultOrganizationProjects = async (
	connection: Connection,
	defaultOrganizations: Organization[]
) => {
	const tag = await connection.getRepository(Tag).create({
		name: 'Web',
		description: '',
		color: faker.commerce.color()
	});
	const projects: OrganizationProjects[] = [];

	const organization = faker.random.arrayElement(defaultOrganizations);

	const organizationContacts = await connection
		.getRepository(OrganizationContact)
		.find({ where: { organizationId: organization.id } });
	const organizationContact = faker.random.arrayElement(organizationContacts);

	defaultProjects.forEach((name) => {
		const project = new OrganizationProjects();
		project.tags = [tag];
		project.name = name;
		project.organizationContact = organizationContact;
		project.organizationId = organization.id;
		project.tenant = organization.tenant;
		// TODO: this seed creates default projects without tenantId.
		projects.push(project);
	});
	return await connection.manager.save(projects);
};

export const createRandomOrganizationProjects = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>,
	tags: Tag[] | void,
	maxProjectsPerOrganization
) => {
	if (!tags) {
		console.warn(
			'Warning: tags not found, RandomOrganizationProjects will not be created'
		);
		return;
	}

	const projects: OrganizationProjects[] = [];
	for (const tenant of tenants) {
		const projectsPerOrganization =
			Math.floor(Math.random() * (maxProjectsPerOrganization - 5)) + 5;
		const orgs = tenantOrganizationsMap.get(tenant);

		for (const org of orgs) {
			const organizationContacts = await connection
				.getRepository(OrganizationContact)
				.find({ where: { organizationId: org.id } });
			const organizationContact = faker.random.arrayElement(
				organizationContacts
			);
			let orgTags: Tag[] = [];
			orgTags = tags.filter((x) => (x.organization = org));
			for (let i = 0; i < projectsPerOrganization; i++) {
				const project = new OrganizationProjects();
				project.tags = [tags[Math.floor(Math.random() * tags.length)]];
				project.name = faker.company.companyName();
				project.organizationContact = organizationContact;
				project.organizationId = org.id;
				project.tenant = tenant;
				project.startDate = faker.date.past(5);
				project.endDate = faker.date.past(2);
				projects.push(project);
			}
		}
	}
	await connection.manager.save(projects);
};
