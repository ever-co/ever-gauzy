import { DataSource } from 'typeorm';
import { IPluginConfig } from '@gauzy/common';
import { ITaskSize } from '@gauzy/contracts';
import { cleanEverIcons, copyEverIcons } from './../../core/seeds/utils';
import { DEFAULT_GLOBAL_SIZES } from './default-global-sizes';
import { TaskSize } from './size.entity';

/**
 * Default global system sizes
 *
 * @param dataSource
 * @returns
 */
export const createDefaultSizes = async (
	dataSource: DataSource,
	config: Partial<IPluginConfig>
): Promise<ITaskSize[]> => {
	await cleanEverIcons(config, 'ever-icons/task-sizes');

	let sizes: ITaskSize[] = [];
	for await (const size of DEFAULT_GLOBAL_SIZES) {
		sizes.push(new TaskSize({
			...size,
			icon: copyEverIcons(size.icon, config)
		}));
	}
	return await dataSource.manager.save(sizes);
};
