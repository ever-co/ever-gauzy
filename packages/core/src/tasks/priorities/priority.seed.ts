import { DataSource } from 'typeorm';
import { getConfig } from '@gauzy/config';
import { ITaskPriority } from '@gauzy/contracts';
import { cleanEverIcons, copyEverIcons } from './../../core/seeds/utils';
import { DEFAULT_GLOBAL_PRIORITIES } from './default-global-priorities';
import { TaskPriority } from './priority.entity';

const config = getConfig();

/**
 * Default global system priority
 *
 * @param dataSource
 * @returns
 */
export const createDefaultPriorities = async (
	dataSource: DataSource
): Promise<ITaskPriority[]> => {
	await cleanEverIcons(config, 'ever-icons/task-priorities');

	let priorities: ITaskPriority[] = [];
	for await (const priority of DEFAULT_GLOBAL_PRIORITIES) {
		priorities.push(new TaskPriority({
			...priority,
			icon: copyEverIcons(priority.icon, config)
		}));
	}
	return await dataSource.manager.save(priorities);
};
