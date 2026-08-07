import { Body, Controller, Get, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FeatureFlag } from '@gauzy/common';
import { FeatureEnum, ID, IDocument, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { BulkDocumentActionCommand } from '../commands/bulk-document-action.command';
import { CreateDocumentCommand } from '../commands/create-document.command';
import { UpdateDocumentCommand } from '../commands/update-document.command';
import { UpdateDocumentContentCommand } from '../commands/update-document-content.command';
import {
	BulkDocumentActionDTO,
	CreateDocumentDTO,
	GetDocumentsQueryDTO,
	IDocumentBulkResult,
	UpdateDocumentContentDTO,
	UpdateDocumentDTO
} from '../dto';
import { Document } from '../entities/document.entity';
import { GetDocumentQuery } from '../queries/get-document.query';
import { GetDocumentCountQuery } from '../queries/get-document-count.query';
import { GetDocumentFacetsQuery } from '../queries/get-document-facets.query';
import { GetDocumentsQuery } from '../queries/get-documents.query';

@ApiTags('Documents Plugin')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FeatureEnum.FEATURE_DOCUMENTS)
@Controller('/plugins/docs/documents')
export class DocumentController {
	constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

	/**
	 * Retrieves a paginated, filtered document list. List projections never include content
	 * columns — they carry `hasContent`/`hasExtractedText`/`hasChildren`/`childrenCount` instead.
	 */
	@ApiOperation({ summary: 'Retrieve a paginated, filtered list of documents.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'List of documents retrieved successfully.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Get('/')
	public async findAll(@Query() params: GetDocumentsQueryDTO): Promise<IPagination<IDocument>> {
		return this.queryBus.execute(new GetDocumentsQuery(params));
	}

	/**
	 * Retrieves the document count for the same filter set as the list.
	 */
	@ApiOperation({ summary: 'Get document count for a filter set.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Successfully retrieved the document count.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Get('/count')
	public async getCount(@Query() params: GetDocumentsQueryDTO): Promise<number> {
		return this.queryBus.execute(new GetDocumentCountQuery(params));
	}

	/**
	 * Retrieves facet counts for the filter chips (each bucket computed over the other filters).
	 */
	@ApiOperation({ summary: 'Get facet counts for the filter chips.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Facet counts retrieved successfully.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Get('/facets')
	public async getFacets(@Query() params: GetDocumentsQueryDTO): Promise<Record<string, any>> {
		return this.queryBus.execute(new GetDocumentFacetsQuery(params));
	}

	/**
	 * Creates a FOLDER or PAGE document (`kind: FILE` → 400 `DOCS_FILE_VIA_UPLOAD`).
	 */
	@ApiOperation({ summary: 'Create a FOLDER or PAGE document.' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Document created successfully.', type: Document })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input provided.' })
	@Permissions(PermissionsEnum.DOCS_CREATE)
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@Post('/')
	public async create(@Body() input: CreateDocumentDTO): Promise<IDocument> {
		return this.commandBus.execute(new CreateDocumentCommand(input));
	}

	/**
	 * Applies one bulk action to up to 200 documents with per-id partial failure (one HTTP 200).
	 */
	@ApiOperation({ summary: 'Apply a bulk action to a set of documents.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Per-id bulk results returned.' })
	@Permissions(PermissionsEnum.DOCS_MANAGE, PermissionsEnum.DOCS_REVIEW)
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@Post('/bulk')
	public async bulk(@Body() input: BulkDocumentActionDTO): Promise<IDocumentBulkResult> {
		return this.commandBus.execute(new BulkDocumentActionCommand(input));
	}

	/**
	 * Partial **metadata-only** update — content fields are rejected here (`forbidNonWhitelisted`);
	 * PAGE content saves go through `PUT /:id/content`.
	 */
	@ApiOperation({ summary: 'Update document metadata by ID.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Document updated successfully.', type: Document })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Document not found.' })
	@Permissions(PermissionsEnum.DOCS_UPDATE)
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@Put('/:id')
	public async update(@Param('id', UUIDValidationPipe) id: ID, @Body() input: UpdateDocumentDTO): Promise<IDocument> {
		return this.commandBus.execute(new UpdateDocumentCommand(id, input));
	}

	/**
	 * PAGE content save. Stale `expectedUpdatedAt` → 409 `DOCS_CONTENT_CONFLICT`; locked
	 * document → 423 `DOCS_LOCKED`. `forceSnapshot: true` bypasses the version-snapshot debounce.
	 */
	@ApiOperation({ summary: 'Save PAGE content (optimistic concurrency + version snapshot).' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Content saved successfully.', type: Document })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'Content changed since it was loaded.' })
	@Permissions(PermissionsEnum.DOCS_UPDATE)
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@Put('/:id/content')
	public async updateContent(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: UpdateDocumentContentDTO
	): Promise<IDocument> {
		return this.commandBus.execute(new UpdateDocumentContentCommand(id, input));
	}

	/**
	 * Retrieves a single document by id (`relations` query param honored).
	 */
	@ApiOperation({ summary: 'Get document by ID.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Document retrieved successfully.', type: Document })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Document not found.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@Get('/:id')
	public async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query('relations') relations?: string | string[]
	): Promise<IDocument> {
		const relationList = Array.isArray(relations) ? relations : relations ? [relations] : [];
		return this.queryBus.execute(new GetDocumentQuery(id, relationList));
	}
}
