import { IQuery } from '@nestjs/cqrs';
import { PluginSearchFilterDTO } from '../../shared/dto/plugin-search-filter.dto';

/**
 * Query to search and filter plugins with advanced criteria
 */
export class SearchPluginsQuery implements IQuery {
	public static readonly type = '[Plugins] Search';

	/**
	 * @param filters - Search and filtering criteria for plugins
	 */
	constructor(public readonly filters: PluginSearchFilterDTO) {}
}
