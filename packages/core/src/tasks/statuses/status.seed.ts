import { ITaskStatus } from '@gauzy/contracts';
import { DataSource } from 'typeorm';
import { DEFAULT_GLOBAL_STATUSES } from './default-global-statuses';
import { TaskStatus } from './status.entity';

/**
 * Default global system status
 *
 * @param dataSource
 * @returns
 */
export const createDefaultStatuses = async (
	dataSource: DataSource
): Promise<ITaskStatus[]> => {
	let statuses: ITaskStatus[] = [];
	for await (const status of DEFAULT_GLOBAL_STATUSES) {
		statuses.push(new TaskStatus({ ...status }));
	}
	return await dataSource.manager.save(statuses);
};
