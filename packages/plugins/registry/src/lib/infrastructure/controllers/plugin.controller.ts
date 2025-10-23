import { Public } from '@gauzy/common';
import { HttpStatus, ID, IPagination } from '@gauzy/contracts';
import { BaseQueryDTO, UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FindOneOptions } from 'typeorm';
import { GetPluginQuery } from '../../application/queries/get-plugin.query';
import { ListPluginsQuery } from '../../application/queries/list-plugins.query';
import { SearchPluginsQuery } from '../../application/queries/search-plugins.query';
import { Plugin } from '../../domain/entities/plugin.entity';
import { PluginSearchFilterDTO } from '../../shared/dto/plugin-search-filter.dto';
import { IPlugin } from '../../shared/models/plugin.model';

@ApiTags('Plugin Registry')
@Public()
@Controller('/plugins')
export class PluginController {
	constructor(private readonly queryBus: QueryBus) {}

	/**
	 * Search and filter plugins with advanced criteria.
	 */
	@ApiOperation({
		summary: 'Search and filter plugins',
		description: 'Search and filter plugins using advanced criteria including text search, type, status, category, and more.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugins found and filtered successfully.',
		type: Plugin,
		isArray: true
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid search criteria provided.'
	})
	@UseValidationPipe({
		whitelist: true,
		transform: true,
		forbidNonWhitelisted: true
	})
	@Get('search')
	public async search(@Query() filters: PluginSearchFilterDTO): Promise<IPagination<IPlugin>> {
		return this.queryBus.execute(new SearchPluginsQuery(filters));
	}

	/**
	 * Retrieves a paginated list of plugins with optional filtering.
	 */
	@ApiOperation({
		summary: 'List all plugins',
		description: 'Retrieve a paginated list of plugins with optional filtering capabilities.'
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
	@Get()
	public async findAll(@Query() params: BaseQueryDTO<IPlugin>): Promise<IPagination<IPlugin>> {
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
		@Query() options: FindOneOptions<Plugin>
	): Promise<IPlugin> {
		return this.queryBus.execute(new GetPluginQuery(id, options));
	}
}
