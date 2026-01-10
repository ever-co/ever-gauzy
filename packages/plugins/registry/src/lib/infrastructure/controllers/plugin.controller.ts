import { Public } from '@gauzy/common';
import { HttpStatus, ID, IPagination } from '@gauzy/contracts';
import { UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetPluginQuery, ListPluginsQuery, SearchPluginsQuery } from '../../application';
import { Plugin } from '../../domain';
import { IPlugin, PluginQueryOptions, PluginSearchFilterDTO } from '../../shared';

@ApiTags('Plugin Registry')
@Controller('/plugins')
@Public()
export class PluginController {
	constructor(private readonly queryBus: QueryBus) {}

	/**
	 * Retrieves a paginated list of plugins with optional filtering and search.
	 */
	@ApiOperation({
		summary: 'List all plugins with optional search and filtering',
		description:
			'Retrieve a paginated list of plugins with optional filtering and search capabilities. Use query parameters for search, category, status, type filtering.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'List of plugins retrieved successfully.',
		type: Plugin,
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No plugins found matching the provided criteria.'
	})
	@ApiResponse({
		status: HttpStatus.UNAUTHORIZED,
		description: 'Unauthorized access.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid search or filter criteria provided.'
	})
	@UseValidationPipe({
		whitelist: true,
		transform: true,
		forbidNonWhitelisted: true
	})
	@Get()
	public async findAll(@Query() params: PluginSearchFilterDTO): Promise<IPagination<IPlugin>> {
		// If search parameters are provided, use search query, otherwise use list query
		if (params.search || params.type || params.status || params.categoryId || params.tags || params.author) {
			return this.queryBus.execute(new SearchPluginsQuery(params));
		}
		// Use simple base parameters for list query
		return this.queryBus.execute(new ListPluginsQuery(params));
	}

	/**
	 * Retrieves a plugin by ID.
	 */
	@ApiOperation({
		summary: 'Get plugin by ID',
		description: 'Retrieves detailed information about a specific plugin by its UUID.'
	})
	@ApiParam({
		name: 'id',
		type: String,
		format: 'uuid',
		description: 'UUID of the plugin to retrieve',
		required: true
	})
	@ApiQuery({
		name: 'relations',
		required: false,
		isArray: true,
		description: 'Entity relations to include in the response'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin retrieved successfully.',
		type: Plugin
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Plugin record not found.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input provided. Check the response body for error details.'
	})
	@ApiResponse({
		status: HttpStatus.UNAUTHORIZED,
		description: 'Unauthorized access.'
	})
	@UseValidationPipe({
		whitelist: true,
		transform: true,
		forbidNonWhitelisted: true
	})
	@Get(':id')
	public async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() options: PluginQueryOptions
	): Promise<IPlugin> {
		return this.queryBus.execute(new GetPluginQuery(id, options));
	}
}
