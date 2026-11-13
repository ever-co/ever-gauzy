import { Body, Controller, ExecutionContext, Get, HttpStatus, Param, Post, Query, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { FeatureFlag } from '@gauzy/common';
import { FeatureEnum, ID, IDocumentImport, IDocumentImportList, PermissionsEnum, UploadedFile } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	FileStorage,
	PermissionGuard,
	Permissions,
	RequestContext,
	TenantPermissionGuard,
	UseValidationPipe,
	UUIDValidationPipe
} from '@gauzy/core';
import { docsRateLimit, getDocsConfig } from '../docs.config';
import { CreateDocumentImportDTO } from '../dto/document-import.dto';
import { DocumentScopeQueryDTO } from '../dto/document-scope-query.dto';
import { DeleteUploadsOnErrorInterceptor } from '../import/delete-uploads-on-error.interceptor';
import { DocsImportEnabledGuard } from '../import/docs-flags.guard';
import { DocumentImportService } from '../import/document-import.service';
import { LazyFilesInterceptor, UploadedFilesStorage } from '../interceptors';
import { documentStorageOrganizationSegment } from './document-storage-scope';

/**
 * The storage engine of the import upload: the zip lands under `documents/<tenantId>/<organizationId>/imports/` with a
 * server-generated `<uuid>.zip` name (the client's file name never enters the key), exactly the scoping of the upload
 * endpoint's keys. The runner reads it from there and deletes it when the import ends.
 */
const importsStorage = (ctx: ExecutionContext) => {
	const request: any = ctx.switchToHttp().getRequest();
	const tenantId = RequestContext.currentTenantId() || uuid();
	const organizationId = documentStorageOrganizationSegment(RequestContext.currentOrganizationId(), request?.headers?.['organization-id'], () => uuid());
	return new FileStorage().storage({
		dest: () => path.join('documents', tenantId, organizationId, 'imports'),
		prefix: 'documents',
		filename: () => `${uuid()}.zip`
	});
};

/**
 * Import of exported workspaces (`docs-import-export` spec): a Markdown vault or an HTML export zip becomes a tree of
 * folders, pages and files. Every route answers 404 `DOCS_IMPORT_DISABLED` while `GAUZY_DOCS_IMPORT_ENABLED` is off —
 * the guard answers before the upload interceptor stores anything.
 *
 * Registered before the document controllers; its routes are under `/plugins/docs/imports`.
 */
@ApiTags('Documents Plugin')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard, DocsImportEnabledGuard)
@FeatureFlag(FeatureEnum.FEATURE_DOCUMENTS)
@Controller('/plugins/docs/imports')
export class DocumentImportController {
	constructor(private readonly importService: DocumentImportService) {}

	@ApiOperation({ summary: "The caller's last imports and the largest zip the import takes (the clients' capability probe)." })
	@ApiResponse({ status: HttpStatus.OK, description: 'The imports, newest first.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Import is off on this installation (DOCS_IMPORT_DISABLED).' })
	@Permissions(PermissionsEnum.DOCS_CREATE)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Get('/')
	public async list(@Query() query: DocumentScopeQueryDTO, @Res({ passthrough: true }) res: Response): Promise<IDocumentImportList> {
		res.setHeader('Cache-Control', 'private, no-store');
		return this.importService.list(query?.organizationId);
	}

	@ApiOperation({ summary: 'Import a Markdown vault or an HTML export zip (multipart field `file`) under a parent or into a space.' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'The import, queued.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'No zip, not a zip, an unsafe path, a symbolic link, or no page file.' })
	@ApiResponse({ status: HttpStatus.PAYLOAD_TOO_LARGE, description: 'The zip, its entries or what it unpacks to are over the limits.' })
	@ApiConsumes('multipart/form-data')
	@Permissions(PermissionsEnum.DOCS_CREATE)
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	// The most expensive intake there is: it shares the upload budget.
	@Throttle(docsRateLimit(getDocsConfig().uploadRateLimit))
	@UseInterceptors(
		LazyFilesInterceptor('file', 1, {
			storage: importsStorage,
			limits: { files: 1, fileSize: getDocsConfig().importMaxZipBytes }
		}),
		// After the upload: a body the validation refuses (or any later error) deletes the zip it stored.
		DeleteUploadsOnErrorInterceptor
	)
	@Post('/')
	public async start(@Body() input: CreateDocumentImportDTO, @UploadedFilesStorage() files: UploadedFile[]): Promise<IDocumentImport> {
		return this.importService.start(files?.[0], input);
	}

	@ApiOperation({ summary: 'An import: state, phase, progress and report.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The import.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: "Not found, or another member's import." })
	@Permissions(PermissionsEnum.DOCS_CREATE)
	@UseValidationPipe({ whitelist: true, transform: true })
	@Get('/:id')
	public async get(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() query: DocumentScopeQueryDTO,
		@Res({ passthrough: true }) res: Response
	): Promise<IDocumentImport> {
		res.setHeader('Cache-Control', 'private, no-store');
		return this.importService.get(id, query?.organizationId);
	}
}
