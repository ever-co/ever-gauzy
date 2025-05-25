import { IPagination } from '@gauzy/contracts';
import { BadRequestException, Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FindManyOptions, FindOptionsWhere, IsNull } from 'typeorm';
import { PluginSourceService } from '../../../domain/services/plugin-source.service';
import { IPluginSource } from '../../../shared/models/plugin-source.model';
import { ListPluginSourcesQuery } from '../../queries/list-plugin-sources.query';
import { RequestContext } from '@gauzy/core';
import { PluginService } from '../../../domain/services/plugin.service';

/**
 * Query handler for listing plugin sources with pagination and filtering capabilities.
 * Handles filtering by plugin ID and version ID, with proper relation management.
 */
@Injectable()
@QueryHandler(ListPluginSourcesQuery)
export class ListPluginSourcesQueryHandler implements IQueryHandler<ListPluginSourcesQuery> {
	constructor(
		private readonly pluginSourceService: PluginSourceService,
		private readonly pluginService: PluginService
	) {}

	/**
	 * Handles the ListPluginSourcesQuery and returns a paginated list of plugin sources.
	 *
	 * @param query - The query containing plugin ID, version ID, and pagination options
	 * @throws {BadRequestException} When required parameters are invalid
	 * @returns Promise<IPagination<IPluginSource>> A paginated list of plugin sources
	 */
	public async execute(query: ListPluginSourcesQuery): Promise<IPagination<IPluginSource>> {
		try {
			const { pluginId, versionId, params = {} as FindManyOptions<IPluginSource> } = query;
			const employeeId = RequestContext.currentEmployeeId();

			// Validate required parameters
			if (!pluginId) {
				throw new BadRequestException('Plugin ID is required');
			}

			// Ensure relations is always an array
			const relations = Array.isArray(params.relations)
				? [...new Set(params.relations)] // Remove duplicates
				: [];

			// Add required relations if versionId is provided
			if (versionId) {
				const requiredRelations = ['version', 'version.plugin'];
				requiredRelations.forEach((relation) => {
					if (!relations.includes(relation)) {
						relations.push(relation);
					}
				});
			}

			// Build where clause with proper typing
			const where: FindOptionsWhere<IPluginSource> = {
				...params.where,
				version: {
					...(versionId ? { id: versionId } : {}),
					plugin: {
						id: pluginId,
						// Ensure we only get active plugins
						isActive: true,
						deletedAt: IsNull()
					}
				}
			};

			// Validate plugin ownership
			const withDeleted = await this.pluginService.validatePluginOwnership(pluginId, employeeId);

			// Execute paginated query
			return await this.pluginSourceService.paginate({
				...params,
				withDeleted,
				relations,
				where
			});
		} catch (error) {
			// Enhance error with context
			if (error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(`Failed to list plugin sources: ${error.message}`, { cause: error });
		}
	}
}
