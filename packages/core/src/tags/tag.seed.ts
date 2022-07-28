import { DataSource } from 'typeorm';
import { faker } from '@ever-co/faker';
import { DEFAULT_GLOBAL_TAGS, DEFAULT_ORGANIZATION_TAGS } from './default-tags';
import { IOrganization, ITenant } from '@gauzy/contracts';
import { Tag } from './../core/entities/internal';

export const createDefaultTags = async (
	dataSource: DataSource,
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
				if (orgTags.color === 'white') {
					orgTags.color = 'red';
				}
				orgTags.organization = organization;
				orgTags.tenant = tenant;
				return orgTags;
			}
		);
		tags = [...tags, ...organizationTags];
	}
	return await dataSource.manager.save(tags);
};

export const createTags = async (dataSource: DataSource): Promise<Tag[]> => {
	const tags: Tag[] = [];
	for (const name of DEFAULT_ORGANIZATION_TAGS) {
		const tag = new Tag();
		tag.name = name;
		tag.description = '';
		tag.color = faker.commerce.color();
		if (tag.color === 'white') {
			tag.color = 'red';
		}
		tags.push(tag);
	}

	await dataSource
		.createQueryBuilder()
		.insert()
		.into(Tag)
		.values(tags)
		.execute();

	return tags;
};

export const createRandomOrganizationTags = async (
	dataSource: DataSource,
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
				if (orgTags.color === 'white') {
					orgTags.color = 'red';
				}
				return orgTags;
			});
			tags = [...tags, ...organizationTags];
		});
	}
	return await dataSource.manager.save(tags);
};
