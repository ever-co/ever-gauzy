import { Public } from '@gauzy/common';
import { ID, IPagination } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
	ValidationPipe
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteResult, UpdateResult } from 'typeorm';
import { PluginTag } from '../../domain/entities/plugin-tag.entity';
import { PluginTagService } from '../../domain/services/plugin-tag.service';
import {
	BulkCreatePluginTagDTO,
	BulkDeletePluginTagDTO,
	CreatePluginTagDTO,
	FindPluginTagDTO,
	UpdatePluginTagDTO
} from '../../shared/dto/plugin-tag.dto';
import { IPluginTag, IPluginTagBulkCreateResponse } from '../../shared/models/plugin-tag.model';

/**
 * PluginTag Relationship Controller
 *
 * Pure RESTful API controller for managing plugin-tag relationship entities.
 * Focuses solely on CRUD operations for the plugin-tag relationship resource.
 *
 * Features:
 * - Standard CRUD operations for plugin-tag relationships
 * - Batch operations for bulk relationship management
 * - Query-based filtering and aggregation
 * - Multi-tenant support
 * - Full REST compliance
 *
 * Related Controllers:
 * - PluginTagsController: /plugins/{id}/tags (managing tags for a specific plugin)
 * - TagPluginsController: /tags/{id}/plugins (managing plugins for a specific tag)
 * - PluginRecommendationsController: /plugins/{id}?similar=true (plugin recommendations)
 */
@ApiTags('Plugin Tags')
@Controller('plugin-tags')
export class PluginTagController {
	constructor(private readonly pluginTagService: PluginTagService) {}

	/**
	 * Get all plugin-tag relationships with optional filtering
	 *
	 * @param options Pagination and filtering options
	 * @param filter Query filters
	 * @param aggregate Type of aggregation (count, etc.)
	 * @returns Paginated list of plugin-tag relationships or redirects to count endpoint
	 */
	@Get()
	@ApiOperation({
		summary: 'Get all plugin-tag relationships',
		description:
			'Retrieve a paginated list of plugin-tag relationships with optional filtering by plugin, tag, or tenant/organization. Use ?aggregate=count for count aggregation.'
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
	@ApiQuery({
		name: 'aggregate',
		required: false,
		description: 'Type of aggregation: count (redirects to count endpoint)'
	})
	@Public()
	async findAll(
		@Query() options: any,
		@Query(new ValidationPipe({ transform: true })) filter: FindPluginTagDTO,
		@Query('aggregate') aggregate?: string
	): Promise<IPagination<PluginTag>> {
		// For count aggregation, users should use GET /plugin-tags?aggregate=count which internally calls the count method
		if (aggregate === 'count') {
			// Return count data in IPagination format for consistency
			const count = await this.pluginTagService.count({ where: filter });
			return {
				items: [],
				total: count
			} as IPagination<PluginTag>;
		}

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
	@Public()
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
	@UseGuards(TenantPermissionGuard, PermissionGuard)
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
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return this.pluginTagService.delete(id);
	}

	/**
	 * Batch create plugin-tag relationships
	 */
	@Post('batch')
	@ApiOperation({
		summary: 'Batch create plugin-tag relationships',
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
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	async batchCreate(
		@Body(new ValidationPipe({ transform: true })) bulkCreateDto: BulkCreatePluginTagDTO
	): Promise<IPluginTagBulkCreateResponse> {
		return this.pluginTagService.bulkCreate(bulkCreateDto);
	}

	/**
	 * Batch delete plugin-tag relationships
	 */
	@Delete('batch')
	@ApiOperation({
		summary: 'Batch delete plugin-tag relationships',
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
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	async batchDelete(
		@Body(new ValidationPipe({ transform: true })) bulkDeleteDto: BulkDeletePluginTagDTO
	): Promise<{ deleted: number }> {
		const deleted = await this.pluginTagService.bulkDelete(bulkDeleteDto);
		return { deleted };
	}

	// NOTE: The following endpoints should be moved to their respective controllers for proper REST architecture:
	// - PUT /plugins/{pluginId}/tags -> PluginController
	// - GET /plugins/{pluginId}/tags -> PluginController
	// - GET /tags/{tagId}/plugins -> TagController
	// - GET /plugins/{pluginId}/similar -> PluginController (as /plugins/{pluginId}?similar=true)
	// These endpoints are temporarily kept here but marked for refactoring
}
