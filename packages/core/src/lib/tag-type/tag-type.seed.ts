import { DataSource } from 'typeorm';
import { IOrganization, ITagType, ITenant } from '@gauzy/contracts';
import { TagType } from './tag-type.entity';
import { DEFAULT_TAG_TYPES } from './default-tag-types';

/**
 * Creates and inserts tag types into the database for a specified tenant and organizations.
 *
 * @function createTagTypes
 * @async
 * @param {DataSource} dataSource - The TypeORM `DataSource` instance used for database operations.
 * @param {ITenant} tenant - The tenant for which the tag types are being created.
 * @param {IOrganization[]} organizations - An array of organizations associated with the tag types.
 * @returns {Promise<ITagType[]>} - A promise that resolves to the array of created and inserted `ITagType` entities.
 *
 * @description
 * This function iterates over the predefined `DEFAULT_TAG_TYPES` and creates `TagType` entities
 * for each organization provided. It assigns the `type` from `DEFAULT_TAG_TYPES`, associates the
 * organization and tenant, and saves the resulting entities into the database.
 *
 * @example
 * const organizations = [
 *   { id: 'org1', name: 'Org 1' },
 *   { id: 'org2', name: 'Org 2' },
 * ];
 *
 * const tenant = { id: 'tenant1', name: 'Tenant 1' };
 *
 * const createdTags = await createTagTypes(dataSource, tenant, organizations);
 * console.log(createdTags);
 *
 * @throws Will throw an error if the database save operation fails.
 */
export const createTagTypes = async (
	dataSource: DataSource,
	tenant: ITenant,
	organizations: IOrganization[]
): Promise<ITagType[]> => {
	// Array to store the new tag type entities
	const tagTypes: TagType[] = [];

	// Iterate over the predefined default tag types
	DEFAULT_TAG_TYPES.forEach(({ type }) => {
		// Create a tag type for each organization
		for (const organization of organizations) {
			const entity = new TagType();
			entity.type = type; // Assign type from default list
			entity.organization = organization; // Associate organization
			entity.tenant = tenant; // Associate tenant
			tagTypes.push(entity);
		}
	});

	// Save the created tag types into the database
	return insertTagTypes(dataSource, tagTypes);
};

/**
 * Creates random organization tag types for given tenants and their organizations.
 *
 * @function createRandomOrganizationTagTypes
 * @async
 * @param {DataSource} dataSource - The TypeORM `DataSource` instance used for database operations.
 * @param {ITenant[]} tenants - An array of tenant entities for which random tag types are being created.
 * @param {Map<ITenant, IOrganization[]>} tenantOrganizationsMap - A map linking each tenant to its associated organizations.
 * @returns {Promise<ITagType[]>} - A promise that resolves to an array of created and saved `ITagType` entities.
 *
 * @description
 * This function generates random tag types for multiple tenants and their organizations.
 * For each tenant, it retrieves the associated organizations from the `tenantOrganizationsMap`.
 * It iterates over the organizations and creates `TagType` entities based on predefined
 * `DEFAULT_TAG_TYPES`. The generated entities are saved in bulk into the database.
 *
 * If a tenant does not have any organizations, the function logs a warning and skips the tenant.
 *
 * @throws Will throw an error if the database save operation fails.
 */
export const createRandomOrganizationTagTypes = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<ITagType[]> => {
	let tagTypes: TagType[] = [];

	for (const tenant of tenants) {
		// Fetch organizations for the current tenant
		const organizations = tenantOrganizationsMap.get(tenant);

		if (!organizations || organizations.length === 0) {
			console.warn(`No organizations found for tenant ID: ${tenant.id}`);
			continue; // Skip to the next tenant if no organizations are found
		}

		for (const organization of organizations) {
			// Create TagType instances for the current organization
			const organizationTagTypes: TagType[] = DEFAULT_TAG_TYPES.map(({ type }) => {
				const tagType = new TagType();
				tagType.type = type;
				tagType.organization = organization;
				tagType.tenantId = tenant.id;
				return tagType;
			});

			// Add the new TagType entities to the tagTypes array
			tagTypes.push(...organizationTagTypes);
		}
	}

	// Bulk save all created tag types into the database
	return await dataSource.manager.save(tagTypes);
};

/**
 * Inserts an array of tag types into the database.
 *
 * @function insertTagTypes
 * @async
 * @param {DataSource} dataSource - The TypeORM `DataSource` instance used to interact with the database.
 * @param {TagType[]} tagTypes - An array of `TagType` entities to be saved into the database.
 * @returns {Promise<TagType[]>} - A promise that resolves with the array of saved `TagType` entities.
 *
 * @example
 * // Example usage:
 * const tagTypes = [
 *   { type: 'Equipment' },
 *   { type: 'Income' },
 * ];
 *
 * await insertTagTypes(dataSource, tagTypes);
 *
 * @throws Will throw an error if the database save operation fails.
 */
const insertTagTypes = async (dataSource: DataSource, tagTypes: TagType[]): Promise<TagType[]> => {
	return await dataSource.manager.save(tagTypes);
};
