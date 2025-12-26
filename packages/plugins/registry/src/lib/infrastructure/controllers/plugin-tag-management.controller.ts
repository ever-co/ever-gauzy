import { Public } from '@gauzy/common';
import { ID } from '@gauzy/contracts';
import { UUIDValidationPipe } from '@gauzy/core';
import { Body, Controller, Get, HttpStatus, Param, ParseIntPipe, Put, Query, ValidationPipe } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PluginTag, PluginTagService } from '../../domain';
import { IPluginTag, ReplacePluginTagsDTO } from '../../shared';

/**
 * Plugin Tags Management Controller
 * Handles tag-related operations for plugins
 */
@ApiTags('Plugins - Tag Management')
@Controller('plugins/:pluginId/tags')
export class PluginTagsController {
	constructor(private readonly pluginTagService: PluginTagService) {}

	/**
	 * Get all tags for a specific plugin
	 */
	@Get()
	@ApiOperation({
		summary: 'Get tags for a plugin',
		description: 'Retrieve all tags associated with a specific plugin.'
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: 'string', format: 'uuid' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved plugin tags',
		type: PluginTag,
		isArray: true
	})
	@Public()
	async getPluginTags(@Param('pluginId', UUIDValidationPipe) pluginId: ID): Promise<PluginTag[]> {
		const result = await this.pluginTagService.findAll({
			where: { pluginId },
			relations: ['tag']
		});
		return result.items;
	}

	/**
	 * Replace all tags for a plugin
	 */
	@Put()
	@ApiOperation({
		summary: 'Replace all tags for a plugin',
		description: 'Remove all existing tags from a plugin and associate it with a new set of tags.'
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: 'string', format: 'uuid' })
	@ApiBody({ type: ReplacePluginTagsDTO })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully replaced plugin tags',
		type: PluginTag,
		isArray: true
	})
	async replacePluginTags(
		@Param('pluginId', UUIDValidationPipe) pluginId: ID,
		@Body(new ValidationPipe({ transform: true })) replaceDto: ReplacePluginTagsDTO
	): Promise<IPluginTag[]> {
		return this.pluginTagService.replacePluginTags(
			pluginId,
			replaceDto.tagIds,
			replaceDto.tenantId,
			replaceDto.organizationId
		);
	}
}

/**
 * Plugin Recommendations Controller
 * Handles plugin recommendation and similarity operations
 */
@ApiTags('Plugins - Recommendations')
@Controller('plugins/:pluginId')
export class PluginRecommendationsController {
	constructor(private readonly pluginTagService: PluginTagService) {}

	/**
	 * Find similar plugins based on shared tags
	 */
	@Get('similar')
	@ApiOperation({
		summary: 'Get plugin with optional similar plugins',
		description: 'Get plugin details with optional similar plugins based on shared tags.'
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: 'string', format: 'uuid' })
	@ApiQuery({
		name: 'similar',
		required: false,
		description: 'Include similar plugins in response',
		type: 'boolean'
	})
	@ApiQuery({
		name: 'limit',
		required: false,
		description: 'Maximum number of similar plugins to return',
		type: 'number'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved plugin information',
		schema: {
			type: 'object',
			properties: {
				similar: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							pluginId: { type: 'string', format: 'uuid' },
							sharedTagsCount: { type: 'number' }
						}
					}
				}
			}
		}
	})
	@Public()
	async getPluginWithSimilar(
		@Param('pluginId', UUIDValidationPipe) pluginId: ID,
		@Query('similar') similar?: boolean,
		@Query('limit', new ParseIntPipe({ optional: true })) limit?: number
	): Promise<{ similar?: Array<{ pluginId: ID; sharedTagsCount: number }> }> {
		const result: any = {};

		if (similar) {
			result.similar = await this.pluginTagService.findSimilarPlugins(pluginId, limit || 10);
		}

		return result;
	}
}

/**
 * Tag Plugins Controller
 * Handles plugin operations for specific tags
 */
@ApiTags('Tags - Plugin Management')
@Controller('tags/:tagId/plugins')
export class TagPluginsController {
	constructor(private readonly pluginTagService: PluginTagService) {}

	/**
	 * Get all plugins for a specific tag
	 */
	@Get()
	@ApiOperation({
		summary: 'Get plugins for a tag',
		description: 'Retrieve all plugins associated with a specific tag.'
	})
	@ApiParam({ name: 'tagId', description: 'Tag ID', type: 'string', format: 'uuid' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved tag plugins',
		type: PluginTag,
		isArray: true
	})
	async getTagPlugins(@Param('tagId', UUIDValidationPipe) tagId: ID): Promise<PluginTag[]> {
		const result = await this.pluginTagService.findAll({
			where: { tagId },
			relations: ['plugin']
		});
		return result.items;
	}
}
