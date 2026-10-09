import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FeatureFlag } from '@gauzy/common';
import { FeatureEnum, ID, IDocumentCategory, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	BaseQueryDTO,
	FeatureFlagGuard,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { CreateDocumentCategoryCommand } from '../commands/create-document-category.command';
import { DeleteDocumentCategoryCommand } from '../commands/delete-document-category.command';
import { MergeDocumentCategoryCommand } from '../commands/merge-document-category.command';
import { UpdateDocumentCategoryCommand } from '../commands/update-document-category.command';
import { CreateDocumentCategoryDTO, MergeDocumentCategoryDTO, UpdateDocumentCategoryDTO } from '../dto';
import { DocumentCategory } from '../entities/document-category.entity';
import { GetDocumentCategoriesQuery } from '../queries/get-document-categories.query';

@ApiTags('Documents Plugin')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FeatureEnum.FEATURE_DOCUMENTS)
@Controller('/plugins/docs/categories')
export class DocumentCategoryController {
	constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

	/**
	 * The per-tenant/org category catalog, sorted by name; each item includes `documentCount`.
	 */
	@ApiOperation({ summary: 'List the document category catalog.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Catalog retrieved successfully.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Get('/')
	public async findAll(@Query() params: BaseQueryDTO<DocumentCategory>): Promise<IPagination<IDocumentCategory>> {
		return this.queryBus.execute(new GetDocumentCategoriesQuery(params));
	}

	/**
	 * Creates a catalog entry (duplicate name → 409 `DOCS_CATEGORY_EXISTS`; slug auto-derived
	 * when absent).
	 */
	@ApiOperation({ summary: 'Create a document category.' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Category created successfully.', type: DocumentCategory })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'A category with this name already exists.' })
	@Permissions(PermissionsEnum.DOCS_MANAGE)
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@Post('/')
	public async create(@Body() input: CreateDocumentCategoryDTO): Promise<IDocumentCategory> {
		return this.commandBus.execute(new CreateDocumentCategoryCommand(input));
	}

	/**
	 * Updates a catalog entry (`isSystem` rows: rename allowed, slug immutable).
	 */
	@ApiOperation({ summary: 'Update a document category.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Category updated successfully.', type: DocumentCategory })
	@Permissions(PermissionsEnum.DOCS_MANAGE)
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@Put('/:id')
	public async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: UpdateDocumentCategoryDTO
	): Promise<IDocumentCategory> {
		return this.commandBus.execute(new UpdateDocumentCategoryCommand(id, input));
	}

	/**
	 * Re-points all document assignments to `targetId` (deduplicated), then soft-deletes the
	 * source. Self-merge → 400.
	 */
	@ApiOperation({ summary: 'Merge one category into another.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Categories merged successfully.', type: DocumentCategory })
	@Permissions(PermissionsEnum.DOCS_MANAGE)
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@Post('/:id/merge')
	public async merge(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: MergeDocumentCategoryDTO
	): Promise<IDocumentCategory> {
		return this.commandBus.execute(new MergeDocumentCategoryCommand(id, input));
	}

	/**
	 * Deletes a catalog entry (`isSystem: true` → 409 `DOCS_CATEGORY_SYSTEM`); in-use categories
	 * are detached from documents, then soft-deleted.
	 */
	@ApiOperation({ summary: 'Delete a document category.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Category deleted successfully.', type: DocumentCategory })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'System categories cannot be deleted.' })
	@Permissions(PermissionsEnum.DOCS_MANAGE)
	@Delete('/:id')
	public async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<IDocumentCategory> {
		return this.commandBus.execute(new DeleteDocumentCategoryCommand(id));
	}
}
