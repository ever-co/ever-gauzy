import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginCategoryService } from '../../../../domain';
import { IPluginCategory } from '../../../../shared';
import { GetPluginCategoryQuery } from '../get-plugin-category.query';

@QueryHandler(GetPluginCategoryQuery)
export class GetPluginCategoryHandler implements IQueryHandler<GetPluginCategoryQuery> {
	constructor(private readonly pluginCategoryService: PluginCategoryService) {}

	async execute(query: GetPluginCategoryQuery): Promise<IPluginCategory> {
		const { id, relations } = query;

		try {
			const category = await this.pluginCategoryService.findOneByIdString(id, {
				relations: relations || ['parent', 'children', 'plugins']
			});

			if (!category) {
				throw new NotFoundException(`Plugin category with ID '${id}' not found`);
			}

			return category;
		} catch (error) {
			if (error instanceof NotFoundException) {
				throw error;
			}
			throw new Error(`Failed to get plugin category: ${error.message}`);
		}
	}
}
