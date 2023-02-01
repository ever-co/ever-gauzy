import { DataSource } from 'typeorm';
import { ITaskSize } from '@gauzy/contracts';
import { DEFAULT_GLOBAL_SIZES } from './default-global-sizes';
import { TaskSize } from './size.entity';

/**
 * Default global system sizes
 *
 * @param dataSource
 * @returns
 */
export const createDefaultSizes = async (
	dataSource: DataSource
): Promise<ITaskSize[]> => {
	let sizes: ITaskSize[] = [];
	for await (const size of DEFAULT_GLOBAL_SIZES) {
		sizes.push(new TaskSize({ ...size }));
	}
	return await dataSource.manager.save(sizes);
};
