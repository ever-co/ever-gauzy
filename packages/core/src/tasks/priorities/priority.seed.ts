import { DataSource } from 'typeorm';
import { ITaskPriority } from '@gauzy/contracts';
import { DEFAULT_GLOBAL_PRIORITIES } from './default-global-priorities';
import { TaskPriority } from './priority.entity';

/**
 * Default global system priority
 *
 * @param dataSource
 * @returns
 */
export const createDefaultPriorities = async (
	dataSource: DataSource
): Promise<ITaskPriority[]> => {
	let priorities: ITaskPriority[] = [];
	for await (const priority of DEFAULT_GLOBAL_PRIORITIES) {
		priorities.push(new TaskPriority({ ...priority }));
	}
	return await dataSource.manager.save(priorities);
};
