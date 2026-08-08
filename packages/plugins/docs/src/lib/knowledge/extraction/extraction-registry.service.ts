import { Injectable, Logger } from '@nestjs/common';
import { DocsPermanentError } from '../errors';
import { CsvExtractor } from './csv.extractor';
import { DocxExtractor } from './docx.extractor';
import {
	IDocumentExtractionContext,
	IDocumentExtractionResult,
	IDocumentExtractor
} from './extractor.interface';
import { HtmlExtractor } from './html.extractor';
import { PdfExtractor } from './pdf.extractor';
import { TextExtractor } from './text.extractor';
import { XlsxExtractor } from './xlsx.extractor';

/**
 * Ordered, first-match extraction provider registry.
 *
 * The built-in providers are registered at construction (each is its own `@Injectable`
 * provider class in `DocsModule`); third parties extend extraction by injecting this
 * registry and calling `register()` — providers registered later are consulted **before**
 * the built-ins, so an override for an already-supported MIME wins.
 */
@Injectable()
export class ExtractionRegistryService {
	private readonly logger = new Logger(ExtractionRegistryService.name);
	private readonly extractors: IDocumentExtractor[] = [];

	constructor(
		pdfExtractor: PdfExtractor,
		docxExtractor: DocxExtractor,
		xlsxExtractor: XlsxExtractor,
		csvExtractor: CsvExtractor,
		textExtractor: TextExtractor,
		htmlExtractor: HtmlExtractor
	) {
		// Built-in provider order (consulted after any third-party registrations).
		this.extractors.push(pdfExtractor, docxExtractor, xlsxExtractor, csvExtractor, textExtractor, htmlExtractor);
	}

	/**
	 * Registers an additional extraction provider ahead of the existing ones
	 * (first-match resolution — later registrations win).
	 *
	 * @param extractor The provider to add.
	 */
	public register(extractor: IDocumentExtractor): void {
		this.extractors.unshift(extractor);
	}

	/**
	 * Resolves the first provider that supports the given MIME/filename, or null.
	 *
	 * @param mime The sniffed canonical MIME.
	 * @param filename The original filename (extension hint for providers that need it).
	 */
	public resolve(mime: string, filename: string): IDocumentExtractor | null {
		return this.extractors.find((extractor) => extractor.supports(mime, filename)) ?? null;
	}

	/**
	 * Runs extraction through the first matching provider.
	 *
	 * @param buffer The stored file bytes.
	 * @param ctx The extraction context (sniffed MIME, filename, caps).
	 * @returns The normalized-markdown extraction result.
	 * @throws DocsPermanentError when no provider supports the input.
	 */
	public async extract(buffer: Buffer, ctx: IDocumentExtractionContext): Promise<IDocumentExtractionResult> {
		const extractor = this.resolve(ctx.mimeType, ctx.filename);
		if (!extractor) {
			throw new DocsPermanentError(`No extractor supports this file type (${ctx.mimeType}).`);
		}
		const startedAt = Date.now();
		const result = await extractor.extract(buffer, ctx);
		this.logger.log(
			`Extracted ${ctx.mimeType} via ${extractor.constructor?.name ?? 'extractor'} in ${Date.now() - startedAt}ms`
		);
		return result;
	}
}
