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
