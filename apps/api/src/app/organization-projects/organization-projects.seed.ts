import { Connection } from 'typeorm';
import * as faker from 'faker';
import * as _ from 'underscore';
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

	defaultProjects.forEach((name) => {
		const project = new OrganizationProjects();
		project.tags = [tag];
		project.name = name;
		project.organizationId = defaultOrganizations[0].id;
		project.tenant = defaultOrganizations[0].tenant;
		projects.push(project);
	});
	await connection.manager.save(projects);
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
			for (let i = 0; i < projectsPerOrganization; i++) {
				const project = new OrganizationProjects();
				project.tags = [tags[Math.floor(Math.random() * tags.length)]];
				project.name = faker.company.companyName();
				project.organizationId = org.id;
				project.tenant = tenant;
				projects.push(project);
			}
		});
	}
	await connection.manager.save(projects);
};
