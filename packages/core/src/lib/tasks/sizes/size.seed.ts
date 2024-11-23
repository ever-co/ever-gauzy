import { DataSource } from 'typeorm';
import { getConfig } from '@gauzy/config';
import { ITaskSize } from '@gauzy/contracts';
import { cleanAssets, copyAssets } from './../../core/seeds/utils';
import { DEFAULT_GLOBAL_SIZES } from './default-global-sizes';
import { TaskSize } from './size.entity';

// Get the application configuration
const config = getConfig();

/**
 * Default global system sizes.
 *
 * Creates and saves default task sizes in the database, ensuring associated icons
 * are copied to the correct asset location. Cleans up existing assets before processing.
 *
 * @param dataSource - The data source for database operations.
 * @returns A promise resolving to the created `ITaskSize[]`.
 */
export const createDefaultSizes = async (
	dataSource: DataSource
): Promise<ITaskSize[]> => {
	try {
		// Clean up old task size assets
		await cleanAssets(config, 'ever-icons/task-sizes');

		// Map default sizes to TaskSize entities with updated icons
		const sizes = DEFAULT_GLOBAL_SIZES.map(
			(size) =>
				new TaskSize({
					...size,
					icon: copyAssets(size.icon, config)
				})
		);

		// Save all task sizes to the database
		return dataSource.manager.save(sizes);
	} catch (error) {
		console.log('Error while saving task sizes', error);
	}
};
