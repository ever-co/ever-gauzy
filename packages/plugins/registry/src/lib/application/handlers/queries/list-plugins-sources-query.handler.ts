import { IPagination } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FindManyOptions, FindOptionsWhere } from 'typeorm';
import { PluginSourceService } from '../../../domain/services/plugin-source.service';
import { IPluginSource } from '../../../shared/models/plugin-source.model';
import { ListPluginSourcesQuery } from '../../queries/list-plugin-sources.query';

@QueryHandler(ListPluginSourcesQuery)
export class ListPluginSourcesQueryHandler implements IQueryHandler<ListPluginSourcesQuery> {
	constructor(private readonly pluginSourceService: PluginSourceService) {}
	/**
	 * Handles the ListPluginSourcesQuery and returns a paginated list of plugin sources.
	 *
	 * @param query - The query containing plugin ID and pagination options.
	 * @returns A promise resolving to paginated plugin source results.
	 */
	public async execute(query: ListPluginSourcesQuery): Promise<IPagination<IPluginSource>> {
		const { pluginId, versionId: id, params = {} as FindManyOptions<IPluginSource> } = query;
		const { where = {} as FindOptionsWhere<IPluginSource> } = params;

		return this.pluginSourceService.paginate({
			...params,
			where: Object.assign({}, where, {
				version: {
					pluginId,
					id
				}
			})
		});
	}
}
