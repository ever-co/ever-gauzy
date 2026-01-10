import { IPagination } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginService } from '../../../../domain';
import { IPlugin } from '../../../../shared';
import { ListPluginsQuery } from '../list-plugins.query';

@QueryHandler(ListPluginsQuery)
export class ListPluginsQueryHandler implements IQueryHandler<ListPluginsQuery> {
	constructor(private readonly pluginService: PluginService) {}

	/**
	 * Executes the ListPluginsQuery and returns paginated plugin results
	 * @param query - The query containing pagination and filter parameters
	 * @returns A promise resolving to paginated plugin results
	 */
	public async execute(query: ListPluginsQuery): Promise<IPagination<IPlugin>> {
		const { params = {} } = query;
		return this.pluginService.paginate(params);
	}
}
