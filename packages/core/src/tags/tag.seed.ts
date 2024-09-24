import { DataSource } from 'typeorm';
import { faker } from '@faker-js/faker';
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
		const organizationTags: Tag[] = Object.values(DEFAULT_GLOBAL_TAGS).map((name) => {
			const orgTags = new Tag();
			orgTags.name = name;
			orgTags.description = '';
			orgTags.color = faker.color.human();
			if (orgTags.color === 'white') {
				orgTags.color = 'red';
			}
			orgTags.organization = organization;
			orgTags.tenant = tenant;
			return orgTags;
		});
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
		tag.color = faker.color.human();
		if (tag.color === 'white') {
			tag.color = 'red';
		}
		tags.push(tag);
	}

	await dataSource.createQueryBuilder().insert().into(Tag).values(tags).execute();

	return tags;
};

/**
 * Creates random organization tags for given tenants and their organizations.
 *
 * @param dataSource - The TypeORM data source instance for database operations.
 * @param tenants - An array of tenant entities.
 * @param tenantOrganizationsMap - A map linking each tenant to its organizations.
 * @returns A promise that resolves to an array of created Tag entities.
 */
export const createRandomOrganizationTags = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<Tag[]> => {
	let tags: Tag[] = [];

	for (const tenant of tenants) {
		// Fetch organizations for the current tenant
		const organizations = tenantOrganizationsMap.get(tenant);

		if (!organizations || organizations.length === 0) {
			console.warn(`No organizations found for tenant ID: ${tenant.id}`);
			continue; // Skip to the next tenant if no organizations are found
		}

		for (const organization of organizations) {
			// If DEFAULT_ORGANIZATION_TAGS is an object, use Object.values; otherwise, use it directly if it's already an array
			const tags = Array.isArray(DEFAULT_ORGANIZATION_TAGS)
				? DEFAULT_ORGANIZATION_TAGS
				: Object.values(DEFAULT_ORGANIZATION_TAGS);

			// Create Tag instances for the current organization
			const organizationTags: Tag[] = tags.map((name: string) => {
				const tag = new Tag();
				tag.name = name;
				tag.description = ''; // Consider adding meaningful descriptions if applicable
				tag.color = faker.color.human();
				tag.organization = organization;
				tag.tenant = tenant;
				return tag;
			});

			// Efficiently add the new tags to the 'tags' array using push with spread
			tags.push(...organizationTags);
		}
	}

	// Bulk save all tags
	return await dataSource.manager.save(tags);
};
