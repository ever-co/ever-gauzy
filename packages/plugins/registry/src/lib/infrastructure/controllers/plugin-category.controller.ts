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
	Patch,
	Post,
	Put,
	Query,
	UseGuards,
	ValidationPipe
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

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
import { IPluginCategory, IPluginCategoryTree } from '../../shared/models';

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
	 * Get all plugin categories with optional tree format
	 */
	@ApiOperation({ summary: 'Get all plugin categories' })
	@ApiQuery({
		name: 'format',
		required: false,
		description: 'Response format (tree for hierarchical structure)',
		enum: ['tree', 'flat']
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin categories retrieved successfully'
	})
	@Get()
	async findAll(
		@Query('format') format?: 'tree' | 'flat',
		@Query(new ValidationPipe({ whitelist: true, transform: true }))
		options?: PluginCategoryQueryDTO
	): Promise<IPagination<IPluginCategory> | IPluginCategoryTree[]> {
		if (format === 'tree') {
			return this.queryBus.execute(new GetPluginCategoryTreeQuery(options));
		}
		return this.queryBus.execute(new GetPluginCategoriesQuery(options));
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
	 * Update plugin category (full replacement)
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
	 * Partially update plugin category
	 */
	@ApiOperation({ summary: 'Partially update plugin category' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin category partially updated successfully'
	})
	@Patch(':id')
	@UseValidationPipe({ whitelist: true })
	async partialUpdate(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() input: Partial<UpdatePluginCategoryDTO>
	): Promise<IPluginCategory> {
		return this.commandBus.execute(new UpdatePluginCategoryCommand(id, input as UpdatePluginCategoryDTO));
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
