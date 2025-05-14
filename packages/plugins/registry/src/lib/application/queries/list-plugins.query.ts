import { BaseQueryDTO } from '@gauzy/core';
import { IQuery } from '@nestjs/cqrs';
import { IPlugin } from '../../shared/models/plugin.model';

/**
 * Query to fetch paginated list of plugins
 */
export class ListPluginsQuery implements IQuery {
	public static readonly type = '[Plugins] List';

	/**
	 * @param params - Pagination and filtering parameters for plugins
	 */
	constructor(public readonly params: BaseQueryDTO<IPlugin>) {}
}
