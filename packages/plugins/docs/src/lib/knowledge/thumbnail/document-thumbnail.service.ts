import { Injectable, Logger } from '@nestjs/common';
import * as sharp from 'sharp';
import { DocumentKindEnum } from '@gauzy/contracts';
import { FileStorage } from '@gauzy/core';
import { Document } from '../../entities/document.entity';
import { TypeOrmDocumentRepository } from '../../repositories/type-orm-document.repository';
import { PdfRasterizerService } from '../extraction/pdf-rasterizer.service';
import { IDocsThumbnailJob } from '../queue/docs-job.types';
import {
	DOCS_THUMBNAIL_MAX_PX,
	DOCS_THUMBNAIL_QUALITY,
	isThumbnailableMime,
	THUMBNAILABLE_PDF_MIME_TYPE,
	thumbnailKeyFor
} from './thumbnail.constants';

/** Why one thumbnail run ended — logged by the pipeline, never surfaced to the user. */
export type ThumbnailOutcome =
	| 'generated'
	| 'skipped-existing'
	| 'skipped-unsupported'
	| 'skipped-no-file'
	| 'failed';

/**
 * Thumbnail generation for the Documents grid (07 §4.4).
 *
 * Images are resized directly; a PDF has its first page rasterized first (through the shared
 * {@link PdfRasterizerService}, the same one scanned-PDF OCR uses). Output is one small WebP
 * written back through the **same FileStorage provider** the source lives on, adjacent to it,
 * with the key stored on `document.thumbKey`. The `DocumentSubscriber` already resolves
 * `thumbUrl` from `thumbKey` on load, so nothing else has to change for the UI to see it.
 *
 * 🛑 **This method never throws and never touches `status` or `knowledgeStatus`.** A
 * thumbnail is cosmetic: the failure mode of a missing one is a kind icon, and no upload may
 * ever be marked `FAILED` because an image could not be resized. Every failure path returns
 * an outcome the caller logs.
 *
 * Idempotent by default: a document that already has a `thumbKey` is skipped, so a
 * re-extract, a recovery sweep or a duplicate enqueue costs nothing. `force` (set by the
 * reprocess/replace paths) is the only way to regenerate.
 */
@Injectable()
export class DocumentThumbnailService {
	private readonly logger = new Logger(DocumentThumbnailService.name);

	constructor(
		private readonly typeOrmDocumentRepository: TypeOrmDocumentRepository,
		private readonly rasterizer: PdfRasterizerService
	) {}

	/**
	 * Generates (or deliberately skips) the thumbnail of one document.
	 *
	 * @param document The snapshot-loaded document row.
	 * @param job The thumbnail-job payload (tenant/organization snapshot + `force`).
	 * @returns What happened — informational only; the caller never branches on failure.
	 */
	public async generate(document: Document, job: IDocsThumbnailJob): Promise<ThumbnailOutcome> {
		try {
			if (document.kind !== DocumentKindEnum.FILE || !document.storageKey) {
				return 'skipped-no-file';
			}
			if (!isThumbnailableMime(document.mimeType)) {
				return 'skipped-unsupported';
			}
			if (document.thumbKey && !job.force) {
				return 'skipped-existing';
			}

			const provider = new FileStorage().setProvider(document.storageProvider).getProviderInstance();
			const source = (await provider.getFile(document.storageKey)) as Buffer;

			const pixels = await this.sourcePixels(document, source);
			if (!pixels) {
				return 'skipped-unsupported';
			}

			const thumbnail = await sharp(pixels, { failOn: 'none' })
				.resize({
					width: DOCS_THUMBNAIL_MAX_PX,
					height: DOCS_THUMBNAIL_MAX_PX,
					fit: 'inside',
					withoutEnlargement: true
				})
				.webp({ quality: DOCS_THUMBNAIL_QUALITY })
				.toBuffer();

			const destination = thumbnailKeyFor(document.storageKey);
			const uploaded: any = await provider.putFile(thumbnail, destination);
			// Providers that rewrite the key (S3 prefixes, the local provider's absolute path)
			// report the effective one; fall back to what we asked for.
			const thumbKey = uploaded?.key || destination;

			await this.typeOrmDocumentRepository.update(
				{ id: document.id, tenantId: document.tenantId, organizationId: document.organizationId },
				{ thumbKey }
			);
			document.thumbKey = thumbKey;

			this.logger.log(`Thumbnail generated for document ${document.id} (${thumbnail.length} bytes).`);
			return 'generated';
		} catch (error) {
			// Cosmetic by contract — log it and leave every status column alone.
			this.logger.warn(`Thumbnail generation failed for document ${document.id}: ${(error as Error).message}`);
			return 'failed';
		}
	}

	/**
	 * The bytes `sharp` will resize: the source itself for an image, or the rendered first
	 * page for a PDF. `null` means "no thumbnail is possible here" — a PDF in a process with
	 * no rasterizer installed, which is a skip and not a failure.
	 */
	private async sourcePixels(document: Document, source: Buffer): Promise<Buffer | null> {
		if (document.mimeType !== THUMBNAILABLE_PDF_MIME_TYPE) {
			return source;
		}
		const rendered = await this.rasterizer.renderPages(source, 1);
		return rendered?.pages?.[0] ?? null;
	}
}
