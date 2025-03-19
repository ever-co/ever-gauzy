import { IPagination } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FindManyOptions, FindOptionsWhere } from 'typeorm';
import { PluginVersionService } from '../../../domain/services/plugin-version.service';
import { IPluginVersion } from '../../../shared/models/plugin-version.model';
import { ListPluginVersionsQuery } from '../../queries/list-plugin-versions.query';

@QueryHandler(ListPluginVersionsQuery)
export class ListPluginVersionsQueryHandler implements IQueryHandler<ListPluginVersionsQuery> {
	constructor(private readonly pluginVersionService: PluginVersionService) {}

	/**
	 * Handles the ListPluginVersionsQuery and returns a paginated list of plugin versions.
	 *
	 * @param query - The query containing plugin ID and pagination options.
	 * @returns A promise resolving to paginated plugin version results.
	 */
	public async execute(query: ListPluginVersionsQuery): Promise<IPagination<IPluginVersion>> {
		const { pluginId, params = {} as FindManyOptions<IPluginVersion> } = query;
		const { where = {} as FindOptionsWhere<IPluginVersion> } = params;

		return this.pluginVersionService.paginate({
			...params,
			where: Object.assign({}, where, { pluginId })
		});
	}
}
