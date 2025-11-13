import { IPagination } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FindManyOptions, FindOptionsWhere } from 'typeorm';
import { PluginService, PluginVersionService } from '../../../../domain';
import { IPluginVersion } from '../../../../shared';
import { ListPluginVersionsQuery } from '../list-plugin-versions.query';

@QueryHandler(ListPluginVersionsQuery)
export class ListPluginVersionsQueryHandler implements IQueryHandler<ListPluginVersionsQuery> {
	constructor(
		private readonly pluginVersionService: PluginVersionService,
		private readonly pluginService: PluginService
	) {}

	/**
	 * Handles the ListPluginVersionsQuery and returns a paginated list of plugin versions.
	 *
	 * @param query - The query containing plugin ID and pagination options.
	 * @returns A promise resolving to paginated plugin version results.
	 */
	public async execute(query: ListPluginVersionsQuery): Promise<IPagination<IPluginVersion>> {
		const { pluginId, params = {} as FindManyOptions<IPluginVersion> } = query;
		const { where = {} as FindOptionsWhere<IPluginVersion> } = params;
		const employeeId = RequestContext.currentEmployeeId();

		const withDeleted = await this.pluginService.validatePluginOwnership(pluginId, employeeId);

		return this.pluginVersionService.paginate({
			...params,
			withDeleted,
			where: Object.assign({}, where, { pluginId })
		});
	}
}
