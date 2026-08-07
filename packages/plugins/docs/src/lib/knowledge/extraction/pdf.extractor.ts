import { Injectable } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';
import { DocsPermanentError, DocsTransientError, isTransientError } from '../errors';
import {
	capMarkdown,
	countWords,
	IDocumentExtractionContext,
	IDocumentExtractionResult,
	IDocumentExtractor,
	normalizeMarkdown
} from './extractor.interface';

/** Below this average of meaningful chars per page the PDF is considered scanned. */
export const PDF_SCANNED_CHARS_PER_PAGE = 50;

/**
 * PDF extractor (text layer): per-page extraction in reading order via `pdf-parse`,
 * with a `## Page N` locator heading per page when `pageCount > 1`. Pipe tables are not
 * reconstructed (raw text). Scanned PDFs (average < 50 meaningful chars/page) route to
 * the OCR path — P1 (M5), env-gated — and are a permanent error until it ships.
 * Corrupt or password-protected files are a permanent error.
 */
@Injectable()
export class PdfExtractor implements IDocumentExtractor {
	/**
	 * @inheritdoc
	 */
	supports(mime: string): boolean {
		return mime === 'application/pdf';
	}

	/**
	 * @inheritdoc
	 */
	async extract(buffer: Buffer, ctx: IDocumentExtractionContext): Promise<IDocumentExtractionResult> {
		const pages: string[] = [];

		let pageCount = 0;
		try {
			// `pagerender` collects per-page text so `## Page N` locators can be emitted.
			const result = await (pdfParse as any)(buffer, {
				pagerender: async (pageData: any) => {
					const textContent = await pageData.getTextContent({
						normalizeWhitespace: true,
						disableCombineTextItems: false
					});
					let lastY: number | undefined;
					let text = '';
					for (const item of textContent.items ?? []) {
						const y = item.transform?.[5];
						if (lastY !== undefined && y !== lastY) {
							text += '\n';
						}
						text += item.str ?? '';
						lastY = y;
					}
					pages.push(text);
					return text;
				}
			});
			pageCount = Number(result?.numpages) || pages.length;
		} catch (error) {
			if (isTransientError(error)) {
				throw new DocsTransientError('Temporary failure while reading the PDF.', error);
			}
			throw new DocsPermanentError(
				'The PDF could not be read — it may be corrupt or password-protected.',
				error
			);
		}

		// Scanned heuristic: average < 50 meaningful chars/page ⇒ OCR path (P1, M5).
		const meaningfulChars = pages.reduce((sum, page) => sum + page.replace(/\s+/g, '').length, 0);
		const average = pageCount > 0 ? meaningfulChars / pageCount : 0;
		if (average < PDF_SCANNED_CHARS_PER_PAGE) {
			throw new DocsPermanentError(
				'This PDF appears to be scanned (no usable text layer). OCR is not available yet.'
			);
		}

		const rendered =
			pageCount > 1
				? pages.map((page, index) => `## Page ${index + 1}\n\n${page.trim()}`).join('\n\n')
				: (pages[0] ?? '').trim();

		const normalized = normalizeMarkdown(rendered);
		const { markdown, truncated } = capMarkdown(normalized, ctx.maxChars);

		return {
			markdown,
			metadata: { pageCount, truncated, wordCount: countWords(markdown) }
		};
	}
}
