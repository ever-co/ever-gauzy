import { Connection } from 'typeorm';
import * as faker from 'faker';
import { DEFAULT_GLOBAL_TAGS, DEFAULT_ORGANIZATION_TAGS } from './default-tags';
import { IOrganization, ITenant } from '@gauzy/contracts';
import { Tag } from './../core/entities/internal';

export const createDefaultTags = async (
	connection: Connection,
	tenant: ITenant,
	organizations: IOrganization[]
): Promise<Tag[]> => {
	let tags: Tag[] = [];
	for (const organization of organizations) {
		const organizationTags: Tag[] = Object.values(DEFAULT_GLOBAL_TAGS).map(
			(name) => {
				const orgTags = new Tag();
				orgTags.name = name;
				orgTags.description = '';
				orgTags.color = faker.commerce.color();
				if (orgTags.color === '#FFFFFF') {
					orgTags.color = '#FF0000';
				}
				orgTags.organization = organization;
				orgTags.tenant = tenant;
				return orgTags;
			}
		);
		tags = [...tags, ...organizationTags];
	}
	return await connection.manager.save(tags);
};

export const createTags = async (connection: Connection): Promise<Tag[]> => {
	const tags: Tag[] = [];
	for (const name of DEFAULT_ORGANIZATION_TAGS) {
		const tag = new Tag();
		tag.name = name;
		tag.description = '';
		tag.color = faker.commerce.color();
		if (tag.color === '#FFFFFF') {
			tag.color = '#FF0000';
		}
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
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<Tag[]> => {
	let tags: Tag[] = [];

	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		organizations.forEach((org) => {
			const organizationTags: Tag[] = Object.values(
				DEFAULT_ORGANIZATION_TAGS
			).map((name) => {
				const orgTags = new Tag();
				orgTags.name = name;
				orgTags.description = '';
				orgTags.color = faker.commerce.color();
				orgTags.organization = org;
				orgTags.tenant = tenant;
				if (orgTags.color === '#FFFFFF') {
					orgTags.color = '#FF0000';
				}
				return orgTags;
			});
			tags = [...tags, ...organizationTags];
		});
	}
	return await connection.manager.save(tags);
};
