import { ID } from '@gauzy/contracts';
import { BaseQueryDTO } from '@gauzy/core';
import { IQuery } from '@nestjs/cqrs';
import { IPluginSource } from '../../shared/models/plugin-source.model';

/**
 * Query to fetch paginated list of plugin sources
 */
export class ListPluginSourcesQuery implements IQuery {
	public static readonly type = '[Plugin Sources] List';

	/**
	 * @param params - Pagination and filtering parameters for plugin versions
	 */
	constructor(
		public readonly pluginId: ID,
		public readonly versionId: ID,
		public readonly params: BaseQueryDTO<IPluginSource>
	) {}
}
