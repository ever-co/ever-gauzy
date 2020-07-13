import { Connection } from 'typeorm';
import * as faker from 'faker';
import { Tag } from './tag.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';

const tagGlobalNames = [
	'VIP',
	'Urgent',
	'Crazy',
	'Broken',
	'TODO',
	'In Process',
	'Verified',
	'Third Party API',
	'Killer',
	'Idiot',
	'Super',
	'WIP'
];

const tagOrganizationsNames = [
	'Program',
	'Web',
	'Mobile',
	'Frontend',
	'Backend',
	'Database',
	'Authentication',
	'Security',
	'Dashboard',
	'API',
	'Design',
	'Testing',
	'Local',
	'QC',
	'Production',
	'Crap',
	'WTF'
];

export const createDefaultTags = async (
	connection: Connection,
	tenant: Tenant,
	organizations: Organization[]
): Promise<Tag[]> => {
	let tags: Tag[] = [];

	organizations.forEach((org) => {
		const organizationTags: Tag[] = Object.values(defaultTags).map(
			(name) => {
				const orgTags = new Tag();
				orgTags.name = org.name + ' -' + name;
				orgTags.description = '';
				orgTags.color = faker.commerce.color();
				orgTags.organization = org;
				orgTags.tenant = tenant;
				return orgTags;
			}
		);
		tags = [...tags, ...organizationTags];
	});
	return await connection.manager.save(tags);
};

export const createTags = async (connection: Connection): Promise<Tag[]> => {
	const tags: Tag[] = [];
	for (const name of tagGlobalNames) {
		const tag = new Tag();
		tag.name = name;
		tag.description = '';
		tag.color = faker.commerce.color();
		tags.push(tag);
	}

	await connection
		.createQueryBuilder()
		.insert()
		.into(Tag)
		.values(tags)
		.execute();

	return tags;
};

export const createRandomOrganizationTags = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>
): Promise<Tag[]> => {
	let tags: Tag[] = [];

	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		organizations.forEach((org) => {
			const organizationTags: Tag[] = Object.values(tagGlobalNames).map(
				(name) => {
					const orgTags = new Tag();
					orgTags.name = name + '-' + org.name;
					orgTags.description = '';
					orgTags.color = faker.commerce.color();
					orgTags.organization = org;
					orgTags.tenant = tenant;
					return orgTags;
				}
			);
			tags = [...tags, ...organizationTags];
		});
	}
	return await connection.manager.save(tags);
};
