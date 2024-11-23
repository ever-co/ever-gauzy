import { DataSource } from 'typeorm';
import { getConfig } from '@gauzy/config';
import { ITaskPriority } from '@gauzy/contracts';
import { cleanAssets, copyAssets } from './../../core/seeds/utils';
import { DEFAULT_GLOBAL_PRIORITIES } from './default-global-priorities';
import { TaskPriority } from './priority.entity';

// Get the application configuration
const config = getConfig();

/**
 * Default global system priorities.
 *
 * Creates and saves default task priorities in the database, ensuring associated icons
 * are copied to the correct asset location. Cleans up existing assets before processing.
 *
 * @param dataSource - The data source for database operations.
 * @returns A promise resolving to the created `ITaskPriority[]`.
 */
export const createDefaultPriorities = async (
	dataSource: DataSource
): Promise<ITaskPriority[]> => {
	try {
		// Clean up old task priority assets
		await cleanAssets(config, 'ever-icons/task-priorities');

		// Map default priorities to TaskPriority entities with updated icons
		const priorities = DEFAULT_GLOBAL_PRIORITIES.map(
			(priority) =>
				new TaskPriority({
					...priority,
					icon: copyAssets(priority.icon, config)
				})
		);

		// Save all task priorities to the database
		return dataSource.manager.save(priorities);
	} catch (error) {
		console.log('Error while saving task priorities', error);
	}
};
