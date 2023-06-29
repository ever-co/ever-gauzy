import { DataSource } from 'typeorm';
import { ITaskVersion } from '@gauzy/contracts';
import { DEFAULT_GLOBAL_VERSIONS } from './default-global-versions';
import { TaskVersion } from './version.entity';

/**
 * Default global system version
 *
 * @param dataSource
 * @returns
 */
export const createDefaultVersions = async (dataSource: DataSource): Promise<ITaskVersion[]> => {
	let versions: TaskVersion[] = [];
	for await (const version of DEFAULT_GLOBAL_VERSIONS) {
		versions.push(new TaskVersion(version));
	}
	return await dataSource.manager.save(versions);
};
