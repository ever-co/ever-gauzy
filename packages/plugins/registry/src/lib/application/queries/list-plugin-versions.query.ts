import { ID } from '@gauzy/contracts';
import { BaseQueryDTO } from '@gauzy/core';
import { IQuery } from '@nestjs/cqrs';
import { IPluginVersion } from '../../shared/models/plugin-version.model';

/**
 * Query to fetch paginated list of plugin versions
 */
export class ListPluginVersionsQuery implements IQuery {
	public static readonly type = '[Plugin Versions] List';

	/**
	 * @param params - Pagination and filtering parameters for plugin versions
	 */
	constructor(public readonly pluginId: ID, public readonly params: BaseQueryDTO<IPluginVersion>) {}
}
