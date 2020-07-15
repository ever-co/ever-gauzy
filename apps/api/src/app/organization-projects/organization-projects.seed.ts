import { Connection } from 'typeorm';
import * as faker from 'faker';
import { Tag } from '../tags/tag.entity';
import { OrganizationProjects } from './organization-projects.entity';
import { Organization } from '@gauzy/models';
import { Tenant } from '../tenant/tenant.entity';

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

	const organizations = faker.random.arrayElement(defaultOrganizations);

	defaultProjects.forEach((name) => {
		const project = new OrganizationProjects();
		project.tags = [tag];
		project.name = name;
		project.organizationId = organizations.id;
		project.tenant = organizations.tenant;
		// TODO: this seed creates default projects without tenantId.
		projects.push(project);
	});
	return await connection.manager.save(projects);
};

export const createRandomOrganizationProjects = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>,
	tags: Tag[],
	maxProjectsPerOrganization
) => {
	const projects: OrganizationProjects[] = [];
	for (const tenant of tenants) {
		const projectsPerOrganization =
			Math.floor(Math.random() * (maxProjectsPerOrganization - 5)) + 5;
		const orgs = tenantOrganizationsMap.get(tenant);
		orgs.forEach((org) => {
			let orgTags: Tag[] = [];
			orgTags = tags.filter((x) => (x.organization = org));
			for (let i = 0; i < projectsPerOrganization; i++) {
				const project = new OrganizationProjects();
				project.tags = [tags[Math.floor(Math.random() * tags.length)]];
				project.name = faker.company.companyName();
				project.organizationId = org.id;
				project.tenant = tenant;
				project.startDate = faker.date.past(5);
				project.endDate = faker.date.past(2);
				projects.push(project);
			}
		});
	}
	await connection.manager.save(projects);
};
