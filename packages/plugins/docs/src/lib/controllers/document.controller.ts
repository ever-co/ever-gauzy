import { Body, Controller, Get, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
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
import { docsRateLimit, getDocsConfig } from '../docs.config';
import { BulkDocumentActionCommand } from '../commands/bulk-document-action.command';
import { CreateDocumentCommand } from '../commands/create-document.command';
import { UpdateDocumentCommand } from '../commands/update-document.command';
import { UpdateDocumentContentCommand } from '../commands/update-document-content.command';
import {
	BulkDocumentActionDTO,
	CreateDocumentDTO,
	DocumentScopeQueryDTO,
	GetDocumentsQueryDTO,
	IDocumentBulkResult,
	UpdateDocumentContentDTO,
	UpdateDocumentDTO
} from '../dto';
import { Document } from '../entities/document.entity';
import { GetDocumentQuery } from '../queries/get-document.query';
import { GetDocumentCountQuery } from '../queries/get-document-count.query';
import { GetDocumentFacetsQuery } from '../queries/get-document-facets.query';
import { GetDocumentPathQuery } from '../queries/get-document-path.query';
import { GetDocumentsQuery } from '../queries/get-documents.query';
import { IDocumentPathSegment } from '../services/document-path.service';

/**
 * Relations a client may ask `GET /documents/:id` to join.
 *
 * 🛑 This is an **allowlist, and `children` is deliberately absent.** The row-level gate of
 * `findOneScoped()` proves the *requested* document is readable; it says nothing about the rows
 * TypeORM eager-loads alongside it. `?relations=children` therefore used to return every child of
 * a readable folder — including other people's `PRIVATE` pages, with `contentJson` and
 * `contentHtml` in full (`08-permissions-security.md` §3.4 row 6: unreadable ⇒ 404, never a
 * payload). Child listing has its own scoped route, `GET /documents?parentId=<id>`, which applies
 * the visibility predicate in SQL; the breadcrumb has `GET /documents/:id/path`, which masks
 * unreadable ancestors. Anything added here must be a relation whose rows carry no per-row
 * visibility of their own — or it needs the same post-load scrubbing `parent` gets in
 * `DocumentService.findOneScoped()`.
 *
 * `createdByUser` / `updatedByUser` satisfy that bar: they are the `ManyToOne → User` actor
 * relations every `BaseEntity` carries, they hold no document content, and a `User` has no
 * per-row visibility to scrub. The detail panel joins them to render the "Created by" / "Updated
 * by" rows of the metadata grid (`01-ux-spec.md` §8.4) — dropping them here would not error, it
 * would silently degrade both rows to a bare timestamp.
 */
export const ALLOWED_DOCUMENT_RELATIONS: readonly string[] = [
	'parent',
	'tags',
	'categories',
	'reviewedBy',
	'createdByUser',
	'updatedByUser'
];

/**
 * Normalizes the `relations` query parameter into the array the query handler expects, keeping
 * only the allowlisted names.
 *
 * Express hands over a string for one `?relations=` occurrence and an array for several; an absent
 * (or empty) value means "no relations". An unknown or non-allowlisted name is dropped rather than
 * rejected: `relations` is an optimization hint, and a client asking for one relation too many
 * should get a correctly-scoped document, not a 400 that breaks its whole detail panel.
 *
 * @param relations The raw query-parameter value.
 * @returns The allowlisted relation names to join.
 */
export function toRelationList(relations?: string | string[]): string[] {
	const requested = Array.isArray(relations) ? relations : relations ? [relations] : [];
	return requested.filter((relation: string) => ALLOWED_DOCUMENT_RELATIONS.includes(relation));
}

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
	// One request fans out to up to 200 documents (`08-permissions-security.md` §9).
	@Throttle(docsRateLimit(getDocsConfig().adminOpsRateLimit))
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
	 * Resolves the breadcrumb chain of a document, root → document.
	 *
	 * Server-side because the masking rule of `08-permissions-security.md` §3.2 cannot be applied
	 * in the client: an ancestor the requester may not read is returned as
	 * `{ id: null, restricted: true }` with **no name and no id**, and the client renders it as the
	 * `DOCS.BREADCRUMB.RESTRICTED` lock chip.
	 *
	 * Declared before `GET /:id` so the static `/path` segment is never swallowed by it.
	 */
	@ApiOperation({ summary: 'Get the breadcrumb path of a document (unreadable ancestors masked).' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Breadcrumb segments, root first.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Document not found.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@Get('/:id/path')
	public async getPath(@Param('id', UUIDValidationPipe) id: ID): Promise<IDocumentPathSegment[]> {
		return this.queryBus.execute(new GetDocumentPathQuery(id));
	}

	/**
	 * Retrieves a single document by id (`relations` query param honored).
	 *
	 * `organizationId` is the client's selected organization. Without it the scope is resolved
	 * from the token's `lastOrganizationId`, which is null for non-employee users (400) and stale
	 * when the client browses another organization of the tenant (404 on rows the list showed).
	 * `relations` stays a raw `@Query('relations')` extraction on purpose: its metatype is not a
	 * DTO class, so the route's ValidationPipe skips it and `toRelationList` remains the gate.
	 */
	@ApiOperation({ summary: 'Get document by ID.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Document retrieved successfully.', type: Document })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Document not found.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Get('/:id')
	public async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query('relations') relations?: string | string[],
		@Query() query?: DocumentScopeQueryDTO
	): Promise<IDocument> {
		return this.queryBus.execute(new GetDocumentQuery(id, toRelationList(relations), query?.organizationId));
	}
}
