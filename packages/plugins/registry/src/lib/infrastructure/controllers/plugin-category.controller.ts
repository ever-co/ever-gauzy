import { IPagination } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard, UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
	ValidationPipe
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import {
	CreatePluginCategoryCommand,
	DeletePluginCategoryCommand,
	UpdatePluginCategoryCommand
} from '../../application/commands';
import {
	GetPluginCategoriesQuery,
	GetPluginCategoryQuery,
	GetPluginCategoryTreeQuery
} from '../../application/queries';
import { CreatePluginCategoryDTO } from '../../shared/dto/create-plugin-category.dto';
import { PluginCategoryQueryDTO } from '../../shared/dto/plugin-category-query.dto';
import { UpdatePluginCategoryDTO } from '../../shared/dto/update-plugin-category.dto';
import { IPluginCategory, IPluginCategoryFindInput, IPluginCategoryTree } from '../../shared/models';

@ApiTags('Plugin Categories')
@ApiBearerAuth()
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('plugin-categories')
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
		// Ensure order has a default value if not provided
		const inputWithDefaults = {
			...input,
			order: input.order ?? 0,
			isActive: input.isActive ?? true
		};
		return this.commandBus.execute(new CreatePluginCategoryCommand(inputWithDefaults));
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
