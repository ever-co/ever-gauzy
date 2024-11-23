import { DataSource } from 'typeorm';
import { getConfig } from '@gauzy/config';
import { ITaskStatus } from '@gauzy/contracts';
import { cleanAssets, copyAssets } from './../../core/seeds/utils';
import { DEFAULT_GLOBAL_STATUSES } from './default-global-statuses';
import { TaskStatus } from './status.entity';

// Get the application configuration
const config = getConfig();

/**
 * Creates default global system task statuses.
 *
 * @param dataSource - The TypeORM DataSource instance.
 * @returns A promise that resolves to an array of saved task statuses.
 */
export const createDefaultStatuses = async (
    dataSource: DataSource
): Promise<ITaskStatus[]> => {
	try {
		// Clean task status assets directory
		await cleanAssets(config, 'ever-icons/task-statuses');

		// Map default statuses to TaskStatus entities with updated icons
		const statuses = DEFAULT_GLOBAL_STATUSES.map(
			(status) =>
				new TaskStatus({
					...status,
					icon: copyAssets(status.icon, config)
				})
		);

		// Save all statuses in the database and return them
		return dataSource.manager.save(statuses);
	} catch (error) {
		console.log('Error while moving task status icons', error);
	}
};
