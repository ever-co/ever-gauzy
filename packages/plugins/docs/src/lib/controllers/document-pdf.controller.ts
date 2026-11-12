import { Controller, Get, HttpStatus, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { FeatureFlag } from '@gauzy/common';
import { FeatureEnum, ID, IDocumentPdfExportCapabilities, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard, UseValidationPipe, UUIDValidationPipe } from '@gauzy/core';
import { docsRateLimit, getDocsConfig } from '../docs.config';
import { DocumentScopeQueryDTO } from '../dto/document-scope-query.dto';
import { DocsPdfExportEnabledGuard } from '../import/docs-flags.guard';
import { DocumentPdfService } from '../pdf/document-pdf.service';
import { pdfFileNameOf } from '../pdf/pdf-render';

/** A `Content-Disposition` attachment header for a file name (ASCII fallback + RFC 5987 UTF-8 form). */
function attachment(fileName: string): string {
	const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * PDF export of a page or a subtree (`docs-import-export` spec FR-13 … FR-16). Every route answers 404
 * `DOCS_PDF_EXPORT_DISABLED` while `GAUZY_DOCS_PDF_EXPORT_ENABLED` is off. Access is the Markdown export's.
 *
 * Registered before `DocumentController`, so `/documents/:id/export.pdf` is matched before the generic `/:id` routes.
 */
@ApiTags('Documents Plugin')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard, DocsPdfExportEnabledGuard)
@FeatureFlag(FeatureEnum.FEATURE_DOCUMENTS)
@Controller('/plugins/docs')
export class DocumentPdfController {
	constructor(private readonly pdf: DocumentPdfService) {}

	@ApiOperation({ summary: 'Whether PDF export is on, and the most pages a subtree PDF takes (the clients\u2019 probe).' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The PDF export capabilities.' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'PDF export is off on this installation (DOCS_PDF_EXPORT_DISABLED).' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@Get('/exports/pdf')
	public capabilities(): IDocumentPdfExportCapabilities {
		return this.pdf.capabilities();
	}

	/**
	 * A page as a PDF; with `subtree=true` the page and the readable pages under it as one PDF with a table of contents,
	 * or with `subtree=true&format=zip` as a zip of PDFs (one per page, at the Markdown export's paths).
	 */
	@ApiOperation({ summary: 'Export a page (or a subtree) as PDF.' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The PDF (application/pdf) or the zip of PDFs (application/zip).' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Document not found (or PDF export is off).' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'Not a page.' })
	@ApiResponse({ status: HttpStatus.PAYLOAD_TOO_LARGE, description: 'More readable pages than a PDF export takes.' })
	@Permissions(PermissionsEnum.DOCS_READ)
	@UseValidationPipe({ whitelist: true, transform: true })
	// Rendering reads every page and image of a subtree in one request, as the Markdown subtree export does.
	@Throttle(docsRateLimit(getDocsConfig().adminOpsRateLimit))
	@Get('/documents/:id/export.pdf')
	public async exportPdf(
		@Param('id', UUIDValidationPipe) id: ID,
		@Res() res: Response,
		@Query('subtree') subtree?: string,
		@Query('format') format?: string,
		@Query() query?: DocumentScopeQueryDTO
	): Promise<void> {
		res.setHeader('X-Content-Type-Options', 'nosniff');
		res.setHeader('Cache-Control', 'private, no-store');
		// The page is read (and refused) before any byte goes out: a 404 or a 409 is still an answer.
		const root = await this.pdf.requirePage(id, query?.organizationId);
		const withSubtree = subtree === 'true' || subtree === '1';
		if (withSubtree && format === 'zip') {
			res.setHeader('Content-Type', 'application/zip');
			res.setHeader('Content-Disposition', attachment(pdfFileNameOf(root.name, 'pages').replace(/\.pdf$/, '.zip')));
			try {
				await this.pdf.writeSubtreeZip(root, query?.organizationId, res);
			} catch (error) {
				// Nothing of the zip went out: the error answer must not travel under the zip's headers.
				if (!res.headersSent) {
					res.removeHeader('Content-Type');
					res.removeHeader('Content-Disposition');
				}
				throw error;
			}
			return;
		}
		const rendered = withSubtree ? await this.pdf.renderSubtree(root, query?.organizationId) : await this.pdf.renderPage(root, query?.organizationId);
		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader('Content-Length', String(rendered.buffer.length));
		res.setHeader('Content-Disposition', attachment(rendered.fileName));
		res.end(rendered.buffer);
	}
}
