import { DataSource } from 'typeorm';
import { getConfig } from '@gauzy/config';
import { ITaskSize } from '@gauzy/contracts';
import { cleanAssets, copyAssets } from './../../core/seeds/utils';
import { DEFAULT_GLOBAL_SIZES } from './default-global-sizes';
import { TaskSize } from './size.entity';

const config = getConfig();

/**
 * Default global system sizes
 *
 * @param dataSource
 * @returns
 */
export const createDefaultSizes = async (
	dataSource: DataSource
): Promise<ITaskSize[]> => {
	await cleanAssets(config, 'ever-icons/task-sizes');

	let sizes: ITaskSize[] = [];
	for await (const size of DEFAULT_GLOBAL_SIZES) {
		sizes.push(new TaskSize({
			...size,
			icon: copyAssets(size.icon, config)
		}));
	}
	return await dataSource.manager.save(sizes);
};
