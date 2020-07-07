import { Connection } from 'typeorm';
import * as faker from 'faker';
import { Tag } from '../tags/tag.entity';
import { OrganizationProjects } from './organization-projects.entity';
import { Organization } from '@gauzy/models';

const defaultProjects = [
	'Gauzy Platform (Open-Source)',
	'Gauzy Web Site',
	'Gauzy Platform SaaS',
	'Gauzy Platform DevOps'
];

export const createRandomOrganizationProjects = async (
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
