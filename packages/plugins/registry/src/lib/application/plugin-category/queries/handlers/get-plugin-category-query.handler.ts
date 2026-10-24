import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginCategoryService } from '../../../../domain';
import { IPluginCategory } from '../../../../shared';
import { GetPluginCategoryQuery } from '../get-plugin-category.query';

/**
 * The relations a category node read may load: the category's own tree and the marketplace plugins filed under
 * it, which is also what the read loads when the caller names none.
 *
 * `GET /plugin-categories/:id` is `@Public` and used to load whatever relations the query string named. With no
 * request user the tenant-aware read is not narrowed to a tenant, so an anonymous caller could load any tenant's
 * category with its `settings` (plugin setting values, encrypted ones included), its tenant and organization
 * rows, or nested paths through them. Anything outside this list is now refused.
 */
export const PLUGIN_CATEGORY_READABLE_RELATIONS: readonly string[] = Object.freeze(['parent', 'children', 'plugins']);

@QueryHandler(GetPluginCategoryQuery)
export class GetPluginCategoryHandler implements IQueryHandler<GetPluginCategoryQuery> {
	constructor(private readonly pluginCategoryService: PluginCategoryService) {}

	async execute(query: GetPluginCategoryQuery): Promise<IPluginCategory> {
		const { id, relations } = query;

		// A single `?relations=x` arrives as a string, several as an array. An empty list names no relation either:
		// it is what the controller hands on once it has dropped the relations a public read may not load.
		const requested =
			relations === undefined || relations === null || (Array.isArray(relations) && relations.length === 0)
				? [...PLUGIN_CATEGORY_READABLE_RELATIONS]
				: ([] as string[]).concat(relations);
		const refused = requested.filter((relation) => !PLUGIN_CATEGORY_READABLE_RELATIONS.includes(relation));

		if (refused.length > 0) {
			throw new BadRequestException(
				`A plugin category can only be read with ${PLUGIN_CATEGORY_READABLE_RELATIONS.join(', ')}; refused: ${refused.join(', ')}`
			);
		}

		try {
			const category = await this.pluginCategoryService.findOneByIdString(id, {
				relations: requested
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
