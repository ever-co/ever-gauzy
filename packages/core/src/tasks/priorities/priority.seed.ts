import { DataSource } from 'typeorm';
import { IPluginConfig } from '@gauzy/common';
import { ITaskPriority } from '@gauzy/contracts';
import { copyEverIcons } from './../../core/seeds/utils';
import { DEFAULT_GLOBAL_PRIORITIES } from './default-global-priorities';
import { TaskPriority } from './priority.entity';

/**
 * Default global system priority
 *
 * @param dataSource
 * @returns
 */
export const createDefaultPriorities = async (
	dataSource: DataSource,
	config: Partial<IPluginConfig>
): Promise<ITaskPriority[]> => {
	let priorities: ITaskPriority[] = [];
	for await (const priority of DEFAULT_GLOBAL_PRIORITIES) {
		priorities.push(new TaskPriority({
			...priority,
			icon: copyEverIcons(priority.icon, config)
		}));
	}
	return await dataSource.manager.save(priorities);
};
