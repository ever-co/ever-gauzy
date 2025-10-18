import {
	Controller,
	Get,
	Post,
	Put,
	Delete,
	Body,
	Param,
	Query,
	HttpStatus,
	HttpCode,
	UseGuards,
	ValidationPipe
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IPagination } from '@gauzy/contracts';
import { TenantPermissionGuard, PermissionGuard, UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';

import {
	CreatePluginCategoryCommand,
	UpdatePluginCategoryCommand,
	DeletePluginCategoryCommand
} from '../../domain/commands';
import { GetPluginCategoriesQuery, GetPluginCategoryQuery, GetPluginCategoryTreeQuery } from '../../domain/queries';
import { IPluginCategory, IPluginCategoryTree, IPluginCategoryFindInput } from '../../shared/models';
import { CreatePluginCategoryDTO } from '../../shared/dto/create-plugin-category.dto';
import { UpdatePluginCategoryDTO } from '../../shared/dto/update-plugin-category.dto';
import { PluginCategoryQueryDTO } from '../../shared/dto/plugin-category-query.dto';

@ApiTags('Plugin Categories')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('categories')
export class PluginCategoryController {
	constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

	/**
	 * Create a new plugin category
	 */
	@ApiOperation({ summary: 'Create plugin category' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Plugin category created successfully',
		type: 'IPluginCategory'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ whitelist: true })
	async create(@Body() input: CreatePluginCategoryDTO): Promise<IPluginCategory> {
		return this.commandBus.execute(new CreatePluginCategoryCommand(input));
	}

	/**
	 * Get all plugin categories
	 */
	@ApiOperation({ summary: 'Get all plugin categories' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin categories retrieved successfully'
	})
	@Get()
	async findAll(
		@Query(new ValidationPipe({ whitelist: true, transform: true }))
		options: PluginCategoryQueryDTO
	): Promise<IPagination<IPluginCategory>> {
		return this.queryBus.execute(new GetPluginCategoriesQuery(options));
	}

	/**
	 * Get plugin category tree structure
	 */
	@ApiOperation({ summary: 'Get plugin category tree' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin category tree retrieved successfully'
	})
	@Get('tree')
	async getTree(
		@Query(new ValidationPipe({ whitelist: true, transform: true }))
		options?: IPluginCategoryFindInput
	): Promise<IPluginCategoryTree[]> {
		return this.queryBus.execute(new GetPluginCategoryTreeQuery(options));
	}

	/**
	 * Get plugin category by ID
	 */
	@ApiOperation({ summary: 'Get plugin category by ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin category retrieved successfully'
	})
	@Get(':id')
	async findOne(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('relations') relations?: string[]
	): Promise<IPluginCategory> {
		return this.queryBus.execute(new GetPluginCategoryQuery(id, relations));
	}

	/**
	 * Update plugin category
	 */
	@ApiOperation({ summary: 'Update plugin category' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin category updated successfully'
	})
	@Put(':id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() input: UpdatePluginCategoryDTO
	): Promise<IPluginCategory> {
		return this.commandBus.execute(new UpdatePluginCategoryCommand(id, input));
	}

	/**
	 * Delete plugin category
	 */
	@ApiOperation({ summary: 'Delete plugin category' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'Plugin category deleted successfully'
	})
	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string): Promise<void> {
		await this.commandBus.execute(new DeletePluginCategoryCommand(id));
	}
}
