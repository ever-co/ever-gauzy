import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetPluginQuery } from '../../queries/get-plugin.query';
import { PluginService } from '../../../domain/services/plugin.service';
import { NotFoundException } from '@nestjs/common';
import { IPlugin } from '../../../shared/models/plugin.model';

@QueryHandler(GetPluginQuery)
export class GetPluginQueryHandler implements IQueryHandler<GetPluginQuery> {
	constructor(private readonly pluginService: PluginService) {}

	public async execute(query: GetPluginQuery): Promise<IPlugin> {
		// Destructure the query to extract the plugin ID and options
		const { id, options = {} } = query;

		// Step 1: Fetch the plugin entity from the database
		const plugin = await this.pluginService.findOneOrFailByIdString(id, options);

		// Step 2: Throw a NotFoundException if the plugin does not exist
		if (!plugin.success) {
			throw new NotFoundException(`Plugin with ID ${id} not found.`);
		}

		// Step 3: Return the plugin entity
		return plugin.record;
	}
}
