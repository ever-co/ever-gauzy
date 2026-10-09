import { Injectable, Optional } from '@nestjs/common';
import { DocsPermanentError } from '../errors';
import { DocumentOcrService } from './document-ocr.service';
import {
	capMarkdown,
	countWords,
	IDocumentExtractionContext,
	IDocumentExtractionResult,
	IDocumentExtractor,
	normalizeMarkdown
} from './extractor.interface';

/** The raster image types the upload sniffer accepts (`services/file-sniffer.ts`). */
export const IMAGE_OCR_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/**
 * The message an image upload fails with when OCR cannot run.
 *
 * 🛑 Unlike classification, which degrades silently, an image with no OCR has **no content at
 * all** — there is nothing to index and nothing to search, so the honest outcome is a
 * permanent failure the reviewer can see and act on (07 §4 row 8).
 */
export const IMAGE_OCR_UNAVAILABLE_MESSAGE =
	'This image contains no machine-readable text. Text recognition (OCR) is not enabled for this deployment.';

/**
 * Image extractor: `image/png|jpeg|webp|gif` → provider-vision OCR (07 §4 row 8).
 *
 * `pageCount` is always 1. The OCR service is injected `@Optional()` so the extractor stays
 * constructible on its own (as the sibling extractors are, and as the extraction specs build
 * them) — without it, and whenever OCR is switched off or no vision model resolves, the
 * result is the same permanent error, which `DocumentProcessingService.markExtractionFailed`
 * turns into `FAILED` + `PENDING / extraction-failed`.
 */
@Injectable()
export class ImageExtractor implements IDocumentExtractor {
	constructor(@Optional() private readonly ocrService?: DocumentOcrService) {}

	/**
	 * @inheritdoc
	 */
	supports(mime: string): boolean {
		return IMAGE_OCR_MIME_TYPES.includes(mime);
	}

	/**
	 * @inheritdoc
	 */
	async extract(buffer: Buffer, ctx: IDocumentExtractionContext): Promise<IDocumentExtractionResult> {
		const ocr = this.ocrService ? await this.ocrService.transcribeImage(buffer, ctx) : null;
		if (!ocr) {
			throw new DocsPermanentError(IMAGE_OCR_UNAVAILABLE_MESSAGE);
		}

		const normalized = normalizeMarkdown(ocr.markdown);
		const { markdown, truncated } = capMarkdown(normalized, ctx.maxChars);

		return {
			markdown,
			metadata: {
				pageCount: 1,
				truncated,
				warnings: ocr.warnings.length ? ocr.warnings : undefined,
				wordCount: countWords(markdown),
				ocr: ocr.provenance
			}
		};
	}
}
