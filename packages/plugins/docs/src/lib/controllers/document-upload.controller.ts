import {
	Body,
	Controller,
	ExecutionContext,
	Get,
	HttpStatus,
	Param,
	Post,
	Res,
	UseGuards,
	UseInterceptors
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import * as path from 'path';
import { v4 as uuid } from 'uuid';
import { FeatureFlag } from '@gauzy/common';
import { FeatureEnum, ID, IDocument, PermissionsEnum, UploadedFile } from '@gauzy/contracts';
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
import { getDocsConfig } from '../docs.config';
import { DOCS_UPLOAD_MAX_FILES } from '../docs.constants';
import { IDocumentUploadResponse, ReprocessDocumentDTO, UploadDocumentsDTO } from '../dto';
import { LazyFilesInterceptor, UploadedFilesStorage } from '../interceptors';
import { ReprocessDocumentCommand } from '../commands/reprocess-document.command';
import { UploadDocumentsCommand } from '../commands/upload-documents.command';
import { DocumentUploadService } from '../services/document-upload.service';

/**
 * Object-name extensions that a static file server would happily render in the browser. The
 * canonical type is kept on `document.mimeType` (and in `metadata.upload.canonicalExtension`),
 * so the stored object can safely carry a neutral extension instead — that keeps the LOCAL
 * provider's unauthenticated `/public/` path from becoming a same-origin XSS sink for an
 * uploaded `.html` file. Bytes are always served through `/documents/:id/raw`.
 */
const RENDERABLE_KEY_EXTENSIONS = new Set(['html', 'htm', 'xhtml', 'xml', 'svg', 'svgz', 'js', 'mjs', 'css']);

/**
 * Builds the per-request storage engine of the upload endpoint. Keys land under the
 * `documents/<tenantId>/<organizationId>/` prefix with a server-generated
 * `<uuid>.<ext>` object name — the client filename never enters the key.
 */
const documentsStorage = (ctx: ExecutionContext) => {
	const request: any = ctx.switchToHttp().getRequest();
	const tenantId = RequestContext.currentTenantId() || uuid();
	const rawOrganizationId: string = request?.headers?.['organization-id'] || uuid();
	// Path-sanitize: ids are UUIDs, but never trust a header verbatim.
	const organizationId = String(rawOrganizationId).replace(/[^a-zA-Z0-9-]/g, '') || uuid();

	return new FileStorage().storage({
		dest: () => path.join('documents', tenantId, organizationId),
		prefix: 'documents',
		filename: (_file: any, extension: string) => {
			const safeExtension = String(extension ?? '')
				.toLowerCase()
				.replace(/[^a-z0-9]/g, '');
			if (!safeExtension) {
				return `${uuid()}`;
			}
			// Never let a browser-renderable extension onto the stored object name.
			const storedExtension = RENDERABLE_KEY_EXTENSIONS.has(safeExtension) ? 'bin' : safeExtension;
			return `${uuid()}.${storedExtension}`;
		}
	});
};

@ApiTags('Documents Plugin')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FeatureEnum.FEATURE_DOCUMENTS)
@Controller('/plugins/docs/documents')
export class DocumentUploadController {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly documentUploadService: DocumentUploadService
	) {}

	/**
	 * Multi-file upload (field `files`, 1–10 files) with per-file accept/reject results.
	 *
	 * The magic-byte gauntlet never trusts the client MIME: sniffed canonical types only,
	 * markup-in-image rejected, no SVG under any name. Oversize → per-file rejection with
	 * 413 only when every file is oversize. `importToKnowledge` defaults to the org
	 * setting; accepted files are born `status: UPLOADED` and enter the pipeline at
	 * `docs.extract`.
	 */
	@ApiOperation({ summary: 'Upload 1–10 FILE documents (multipart field `files`).' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Per-file upload results returned.' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Every file in the batch was rejected.' })
	@ApiResponse({ status: HttpStatus.PAYLOAD_TOO_LARGE, description: 'Every file in the batch is oversize.' })
	@ApiConsumes('multipart/form-data')
	@Permissions(PermissionsEnum.DOCS_CREATE)
	@UseValidationPipe({ whitelist: true, transform: true })
	@UseInterceptors(
		LazyFilesInterceptor('files', DOCS_UPLOAD_MAX_FILES, {
			storage: documentsStorage,
			limits: {
				files: DOCS_UPLOAD_MAX_FILES,
				// DoS backstop only — the real per-file cap is enforced per file in the
				// service so one oversize file cannot abort the whole batch.
				fileSize: DOCS_UPLOAD_MAX_FILES * getDocsConfig().maxFileSize + 10 * 1024 * 1024
			}
		})
	)
	@Post('/upload')
	public async upload(
		@Body() input: UploadDocumentsDTO,
		@UploadedFilesStorage() files: UploadedFile[]
	): Promise<IDocumentUploadResponse> {
		return this.commandBus.execute(new UploadDocumentsCommand(input, files));
	}

	/**
	 * Resolves a provider URL for the stored blob and returns `{ url }` — signed with the
	 * provider's `expiresIn` ceiling on S3-compatible storage, minted per request and never
	 * cached. FILE documents only (409 `DOCS_NOT_A_FILE` otherwise); an id outside the
	 * caller's tenant/organization/visibility scope is a 404.
	 */
	@ApiOperation({ summary: 'Get a short-lived download URL for a FILE document.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Download URL resolved successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Document not found or has no stored file.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@Get('/:id/download')
	public async download(@Param('id', UUIDValidationPipe) id: ID): Promise<{ url: string }> {
		return this.documentUploadService.getDownloadUrl(id);
	}

	/**
	 * Authenticated byte stream of the stored blob — the path used by the preview modal and by
	 * every image embedded in a wiki page.
	 *
	 * Hardening per `08-permissions-security.md` §5.5: `X-Content-Type-Options: nosniff` always,
	 * the stored (sniffed) content type only for the render-safe allowlist, and `attachment` +
	 * `application/octet-stream` for everything else — stored `text/html` is never served as
	 * `text/html` from the API origin.
	 */
	@ApiOperation({ summary: 'Stream the stored bytes of a FILE document.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'File streamed successfully.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Document not found or has no stored file.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@Get('/:id/raw')
	public async raw(@Param('id', UUIDValidationPipe) id: ID, @Res() res: Response): Promise<void> {
		const file = await this.documentUploadService.getRawFile(id);

		// Set explicitly rather than via `@Header()`: the handler owns the response object here.
		res.setHeader('X-Content-Type-Options', 'nosniff');
		res.setHeader('Cache-Control', 'private, no-store');
		res.setHeader('Content-Type', file.contentType);
		res.setHeader('Content-Length', file.buffer.length);
		res.setHeader(
			'Content-Disposition',
			`${file.disposition}; filename="${file.fileName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
		);
		res.end(file.buffer);
	}

	/**
	 * Re-runs the pipeline from `docs.extract` for a FILE document.
	 * `extractedTextEdited && !overwriteEdited` → 409 `DOCS_EXTRACTED_TEXT_EDITED`.
	 */
	@ApiOperation({ summary: 'Reprocess a FILE document from the extract stage.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Reprocess enqueued.' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'Human-edited extraction would be overwritten.' })
	@Permissions(PermissionsEnum.DOCS_UPDATE)
	@UseValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
	@Post('/:id/reprocess')
	public async reprocess(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() input: ReprocessDocumentDTO
	): Promise<IDocument> {
		return this.commandBus.execute(new ReprocessDocumentCommand(id, input));
	}
}
