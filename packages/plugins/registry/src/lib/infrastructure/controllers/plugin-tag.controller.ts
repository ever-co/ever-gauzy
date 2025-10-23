import { ID, IPagination } from '@gauzy/contracts';
import { CrudController, PermissionGuard, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	Put,
	Query,
	UseGuards,
	ValidationPipe
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult, UpdateResult } from 'typeorm';
import { PluginTag } from '../../domain/entities/plugin-tag.entity';
import { PluginTagService } from '../../domain/services/plugin-tag.service';
import {
	BulkCreatePluginTagDTO,
	BulkDeletePluginTagDTO,
	CreatePluginTagDTO,
	FindPluginsByTagsDTO,
	FindPluginTagDTO,
	FindTagsByPluginsDTO,
	ReplacePluginTagsDTO,
	UpdatePluginTagDTO
} from '../../shared/dto/plugin-tag.dto';
import { IPluginTag, IPluginTagBulkCreateResponse, IPluginTagStatistics } from '../../shared/models/plugin-tag.model';

/**
 * PluginTag Controller
 *
 * RESTful API controller for managing plugin-tag relationships.
 * Provides comprehensive CRUD operations, bulk operations, analytics, and advanced querying.
 *
 * Features:
 * - Standard CRUD operations
 * - Bulk tag association/disassociation
 * - Plugin discovery by tags
 * - Tag analytics and statistics
 * - Multi-tenant support
 * - Comprehensive API documentation
 * - Input validation and error handling
 */
@ApiTags('Plugin Tags')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('plugin-tags')
export class PluginTagController extends CrudController<PluginTag> {
	constructor(private readonly pluginTagService: PluginTagService) {
		super(pluginTagService);
	}

	/**
	 * Get all plugin-tag relationships with optional filtering
	 *
	 * @param options Pagination and filtering options
	 * @param filter Query filters
	 * @returns Paginated list of plugin-tag relationships
	 */
	@Get()
	@ApiOperation({
		summary: 'Get all plugin-tag relationships',
		description:
			'Retrieve a paginated list of plugin-tag relationships with optional filtering by plugin, tag, or tenant/organization.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved plugin-tag relationships',
		type: PluginTag,
		isArray: true
	})
	@ApiQuery({ name: 'pluginId', required: false, description: 'Filter by plugin ID' })
	@ApiQuery({ name: 'tagId', required: false, description: 'Filter by tag ID' })
	@ApiQuery({ name: 'pluginIds', required: false, description: 'Filter by multiple plugin IDs (comma-separated)' })
	@ApiQuery({ name: 'tagIds', required: false, description: 'Filter by multiple tag IDs (comma-separated)' })
	async findAll(
		@Query() options: any,
		@Query(new ValidationPipe({ transform: true })) filter: FindPluginTagDTO
	): Promise<IPagination<PluginTag>> {
		return this.pluginTagService.findAll({
			...options,
			where: filter
		});
	}

	/**
	 * Get a specific plugin-tag relationship by ID
	 *
	 * @param id Plugin-tag relationship ID
	 * @returns Plugin-tag relationship details
	 */
	@Get(':id')
	@ApiOperation({
		summary: 'Get plugin-tag relationship by ID',
		description: 'Retrieve a specific plugin-tag relationship by its unique identifier.'
	})
	@ApiParam({ name: 'id', description: 'Plugin-tag relationship ID', type: 'string', format: 'uuid' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved plugin-tag relationship',
		type: PluginTag
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Plugin-tag relationship not found'
	})
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<PluginTag> {
		return this.pluginTagService.findOneByIdString(id, {
			relations: ['plugin', 'tag']
		});
	}

	/**
	 * Create a new plugin-tag relationship
	 *
	 * @param createDto Plugin-tag creation data
	 * @returns Created plugin-tag relationship
	 */
	@Post()
	@ApiOperation({
		summary: 'Create plugin-tag relationship',
		description:
			"Create a new relationship between a plugin and a tag. Validates that the relationship doesn't already exist."
	})
	@ApiBody({ type: CreatePluginTagDTO })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Successfully created plugin-tag relationship',
		type: PluginTag
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input data or relationship already exists'
	})
	async create(@Body(new ValidationPipe({ transform: true })) createDto: CreatePluginTagDTO): Promise<IPluginTag> {
		return this.pluginTagService.create(createDto);
	}

	/**
	 * Update a plugin-tag relationship
	 *
	 * @param id Plugin-tag relationship ID
	 * @param updateDto Update data
	 * @returns Updated plugin-tag relationship
	 */
	@Put(':id')
	@ApiOperation({
		summary: 'Update plugin-tag relationship',
		description: 'Update properties of an existing plugin-tag relationship such as priority or featured status.'
	})
	@ApiParam({ name: 'id', description: 'Plugin-tag relationship ID', type: 'string', format: 'uuid' })
	@ApiBody({ type: UpdatePluginTagDTO })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully updated plugin-tag relationship',
		type: PluginTag
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Plugin-tag relationship not found'
	})
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body(new ValidationPipe({ transform: true })) updateDto: UpdatePluginTagDTO
	): Promise<IPluginTag | UpdateResult> {
		return this.pluginTagService.update(id, updateDto);
	}

	/**
	 * Delete a plugin-tag relationship
	 *
	 * @param id Plugin-tag relationship ID
	 * @returns Deletion result
	 */
	@Delete(':id')
	@ApiOperation({
		summary: 'Delete plugin-tag relationship',
		description: 'Remove a specific plugin-tag relationship by its ID.'
	})
	@ApiParam({ name: 'id', description: 'Plugin-tag relationship ID', type: 'string', format: 'uuid' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully deleted plugin-tag relationship'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Plugin-tag relationship not found'
	})
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return this.pluginTagService.delete(id);
	}

	/**
	 * Bulk create plugin-tag relationships
	 *
	 * @param bulkCreateDto Bulk creation data
	 * @returns Bulk creation results
	 */
	@Post('bulk')
	@ApiOperation({
		summary: 'Bulk create plugin-tag relationships',
		description: 'Associate multiple tags with a single plugin in one operation. Skips existing relationships.'
	})
	@ApiBody({ type: BulkCreatePluginTagDTO })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Successfully created plugin-tag relationships',
		schema: {
			type: 'object',
			properties: {
				created: { type: 'number', description: 'Number of relationships created' },
				existing: { type: 'number', description: 'Number of relationships that already existed' },
				pluginTags: { type: 'array', items: { $ref: '#/components/schemas/PluginTag' } }
			}
		}
	})
	async bulkCreate(
		@Body(new ValidationPipe({ transform: true })) bulkCreateDto: BulkCreatePluginTagDTO
	): Promise<IPluginTagBulkCreateResponse> {
		return this.pluginTagService.bulkCreate(bulkCreateDto);
	}

	/**
	 * Bulk delete plugin-tag relationships
	 *
	 * @param bulkDeleteDto Bulk deletion criteria
	 * @returns Number of deleted relationships
	 */
	@Delete('bulk')
	@ApiOperation({
		summary: 'Bulk delete plugin-tag relationships',
		description:
			'Remove multiple plugin-tag relationships based on various criteria such as plugin ID, tag ID, or specific relationship IDs.'
	})
	@ApiBody({ type: BulkDeletePluginTagDTO })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully deleted plugin-tag relationships',
		schema: {
			type: 'object',
			properties: {
				deleted: { type: 'number', description: 'Number of relationships deleted' }
			}
		}
	})
	async bulkDelete(
		@Body(new ValidationPipe({ transform: true })) bulkDeleteDto: BulkDeletePluginTagDTO
	): Promise<{ deleted: number }> {
		const deleted = await this.pluginTagService.bulkDelete(bulkDeleteDto);
		return { deleted };
	}

	/**
	 * Find plugins by tags
	 *
	 * @param query Query parameters for plugin discovery
	 * @returns Plugins matching the tag criteria
	 */
	@Post('find-plugins-by-tags')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Find plugins by tags',
		description:
			'Discover plugins that have specific tags. Supports both "any" and "all" match types for flexible filtering.'
	})
	@ApiBody({ type: FindPluginsByTagsDTO })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully found plugins by tags',
		schema: {
			type: 'object',
			properties: {
				items: { type: 'array', items: { type: 'object' } },
				total: { type: 'number' }
			}
		}
	})
	async findPluginsByTags(
		@Body(new ValidationPipe({ transform: true })) query: FindPluginsByTagsDTO
	): Promise<IPagination<any>> {
		return this.pluginTagService.findPluginsByTags(query);
	}

	/**
	 * Find tags by plugins
	 *
	 * @param query Query parameters for tag discovery
	 * @returns Tags associated with the specified plugins
	 */
	@Post('find-tags-by-plugins')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: 'Find tags by plugins',
		description: 'Retrieve all tags associated with specific plugins. Optionally includes usage statistics.'
	})
	@ApiBody({ type: FindTagsByPluginsDTO })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully found tags by plugins',
		schema: {
			type: 'object',
			properties: {
				items: { type: 'array', items: { type: 'object' } },
				total: { type: 'number' }
			}
		}
	})
	async findTagsByPlugins(
		@Body(new ValidationPipe({ transform: true })) query: FindTagsByPluginsDTO
	): Promise<IPagination<any>> {
		return this.pluginTagService.findTagsByPlugins(query);
	}

	/**
	 * Replace all tags for a plugin
	 *
	 * @param pluginId Plugin ID
	 * @param replaceDto New tags data
	 * @returns Updated plugin-tag relationships
	 */
	@Put('plugin/:pluginId/replace-tags')
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

	/**
	 * Get tags for a specific plugin
	 *
	 * @param pluginId Plugin ID
	 * @returns Plugin's tags
	 */
	@Get('plugin/:pluginId/tags')
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
	async getPluginTags(@Param('pluginId', UUIDValidationPipe) pluginId: ID): Promise<PluginTag[]> {
		const result = await this.pluginTagService.findAll({
			where: { pluginId },
			relations: ['tag']
		});
		return result.items;
	}

	/**
	 * Get plugins for a specific tag
	 *
	 * @param tagId Tag ID
	 * @returns Tag's plugins
	 */
	@Get('tag/:tagId/plugins')
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

	/**
	 * Get plugin-tag statistics
	 *
	 * @param tenantId Optional tenant ID filter
	 * @param organizationId Optional organization ID filter
	 * @returns Plugin-tag analytics and statistics
	 */
	@Get('statistics')
	@ApiOperation({
		summary: 'Get plugin-tag statistics',
		description:
			'Retrieve analytics and statistics about plugin-tag relationships including most popular tags and most tagged plugins.'
	})
	@ApiQuery({ name: 'tenantId', required: false, description: 'Filter statistics by tenant ID' })
	@ApiQuery({ name: 'organizationId', required: false, description: 'Filter statistics by organization ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved plugin-tag statistics',
		schema: {
			type: 'object',
			properties: {
				totalRelationships: { type: 'number' },
				taggedPlugins: { type: 'number' },
				usedTags: { type: 'number' },
				popularTags: { type: 'array', items: { type: 'object' } },
				mostTaggedPlugins: { type: 'array', items: { type: 'object' } }
			}
		}
	})
	async getStatistics(
		@Query('tenantId', new ParseUUIDPipe({ optional: true })) tenantId?: ID,
		@Query('organizationId', new ParseUUIDPipe({ optional: true })) organizationId?: ID
	): Promise<IPluginTagStatistics> {
		return this.pluginTagService.getStatistics(tenantId, organizationId);
	}

	/**
	 * Find similar plugins based on shared tags
	 *
	 * @param pluginId Plugin ID to find similar plugins for
	 * @param limit Maximum number of similar plugins to return
	 * @returns Plugins with shared tags
	 */
	@Get('plugin/:pluginId/similar')
	@ApiOperation({
		summary: 'Find similar plugins',
		description: 'Find plugins that share the most tags with a given plugin. Useful for recommendation systems.'
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: 'string', format: 'uuid' })
	@ApiQuery({
		name: 'limit',
		required: false,
		description: 'Maximum number of similar plugins to return',
		type: 'number'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully found similar plugins',
		schema: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					pluginId: { type: 'string', format: 'uuid' },
					sharedTagsCount: { type: 'number' }
				}
			}
		}
	})
	async findSimilarPlugins(
		@Param('pluginId', UUIDValidationPipe) pluginId: ID,
		@Query('limit', new ParseUUIDPipe({ optional: true })) limit?: number
	): Promise<Array<{ pluginId: ID; sharedTagsCount: number }>> {
		return this.pluginTagService.findSimilarPlugins(pluginId, limit || 10);
	}

	/**
	 * Get count of relationships
	 *
	 * @param options Count options
	 * @returns Number of plugin-tag relationships
	 */
	@Get('count')
	@ApiOperation({
		summary: 'Get plugin-tag relationships count',
		description: 'Get the total count of plugin-tag relationships with optional filtering.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved count',
		schema: { type: 'number' }
	})
	async getCount(@Query(new ValidationPipe({ transform: true })) options: FindPluginTagDTO): Promise<number> {
		return this.pluginTagService.count({ where: options });
	}
}
