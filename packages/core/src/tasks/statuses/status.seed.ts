import { DataSource } from 'typeorm';
import { getConfig } from '@gauzy/config';
import { ITaskStatus } from '@gauzy/contracts';
import { cleanEverIcons, copyEverIcons } from './../../core/seeds/utils';
import { DEFAULT_GLOBAL_STATUSES } from './default-global-statuses';
import { TaskStatus } from './status.entity';

const config = getConfig();

/**
 * Default global system status
 *
 * @param dataSource
 * @returns
 */
export const createDefaultStatuses = async (dataSource: DataSource): Promise<ITaskStatus[]> => {
	await cleanEverIcons(config, 'ever-icons/task-statuses');

	let statuses: ITaskStatus[] = [];
	for await (const status of DEFAULT_GLOBAL_STATUSES) {
		statuses.push(
			new TaskStatus({
				...status,
				icon: copyEverIcons(status.icon, config)
			})
		);
	}
	return await dataSource.manager.save(statuses);
};
