import { DataSource } from 'typeorm';
import { getConfig } from '@gauzy/config';
import { IIntegration, IIntegrationType } from '@gauzy/contracts';
import { cleanAssets, copyAssets } from './../core/seeds/utils';
import { Integration } from './integration.entity';
import { DEFAULT_INTEGRATIONS } from './default-integration';

// Get the application configuration
const config = getConfig();

/**
 * Creates default integrations by mapping predefined integrations to their respective types,
 * copying assets, and saving them to the database.
 *
 * If no `integrationTypes` are provided, the function logs a warning and exits without creating integrations.
 *
 * @param dataSource - The data source for database operations.
 * @param integrationTypes - An array of available integration types or void if none are provided.
 * @returns A promise resolving to the created `IIntegration[]` or void if no integrations are created.
 */
export const createDefaultIntegrations = async (
	dataSource: DataSource,
	integrationTypes: IIntegrationType[] | void
): Promise<IIntegration[] | void> => {
	// Ensure integrationTypes are provided
	if (!integrationTypes) {
		console.warn(
			'Warning: integrationTypes not found, DefaultIntegrations will not be created'
		);
		return;
	}

	// Clean up old assets in the integrations directory
	const destDir = 'integrations';
	await cleanAssets(config, destDir);

	// Map and create new integration entities
	const integrations = await Promise.all(
		DEFAULT_INTEGRATIONS.map(async (integration) => {
			const {
				name,
				imgSrc,
				isComingSoon,
				integrationTypesMap,
				order,
				provider,
				redirectUrl
			} = integration;

			// Create a new Integration entity
			const entity = new Integration();
			entity.name = name;
			entity.imgSrc = await copyAssets(imgSrc, config, destDir);
			entity.isComingSoon = isComingSoon;
			entity.order = order;
			entity.redirectUrl = redirectUrl;
			entity.provider = provider;

			// Associate integration types by filtering the provided types
			entity.integrationTypes = integrationTypes.filter((type) =>
				integrationTypesMap.includes(type.name)
			);

			return entity;
		})
	);

	// Save the created integrations to the database
	return insertIntegrations(dataSource, integrations);
};


/**
 * Inserts integrations into the database.
 *
 * @param dataSource - The data source for database operations.
 * @param integrations - An array of integrations to be inserted.
 * @returns A promise resolving to the saved integrations.
 */
const insertIntegrations = (dataSource: DataSource, integrations: IIntegration[]): Promise<IIntegration[]> => {
    return dataSource.manager.save(integrations);
};
