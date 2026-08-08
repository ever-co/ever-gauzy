import { Injectable, Logger } from '@nestjs/common';
import * as sharp from 'sharp';
import { ID } from '@gauzy/contracts';
import { getDocsConfig } from '../../docs.config';
import { DocsAiService, IResolvedChatModel } from '../ai/docs-ai.service';
import { DocsTransientError } from '../errors';
import { IDocumentExtractionContext, IDocumentOcrProvenance } from './extractor.interface';
import { buildOcrCapNote, buildOcrPageFailureNote, OCR_MAX_OUTPUT_TOKENS, OCR_SYSTEM_PROMPT, OCR_USER_PROMPT } from './ocr.prompt';
import { PdfRasterizerService } from './pdf-rasterizer.service';

/** Longest side an image is downscaled to before it is sent to the model (07 §4 row 8). */
export const OCR_IMAGE_MAX_PX = 2000;

/** What a completed OCR run produced. */
export interface IDocumentOcrResult {
	/** Normalized-ish markdown (the caller still runs it through `normalizeMarkdown`). */
	markdown: string;
	/** Provenance block persisted under `metadata.extraction.ocr`. */
	provenance: IDocumentOcrProvenance;
	/** Per-page failures and cap notices, surfaced on `metadata.extraction.warnings`. */
	warnings: string[];
}

/**
 * Provider-vision OCR for scanned PDFs and image uploads (07 §4, rows 2 and 8).
 *
 * **It adds no third-party OCR engine.** Transcription is one `generateText` call per page
 * against the very model classification uses, resolved through {@link DocsAiService} with the
 * same credential order (tenant BYOK → environment → platform). Rasterization of PDF pages is
 * delegated to {@link PdfRasterizerService}; images only need `sharp`, which the plugin
 * already ships.
 *
 * 🛑 **Every "cannot" answer is `null`, not an exception**, and that is the compatibility
 * contract: OCR off, AI off, no provider credentials, no vision model, no PDF renderer — all
 * return `null`, and the calling extractor then throws the exact permanent error it threw
 * before OCR existed. A deployment that changes nothing sees no behavior change whatsoever.
 *
 * Cost safety: the page cap (`GAUZY_DOCS_OCR_MAX_PAGES`, default 20) is applied *before* any
 * call is made, and every call — successful or not — emits the `docs-ocr` usage event the
 * classification and embedding paths already emit.
 */
@Injectable()
export class DocumentOcrService {
	private readonly logger = new Logger(DocumentOcrService.name);

	constructor(private readonly docsAiService: DocsAiService, private readonly rasterizer: PdfRasterizerService) {}

	/**
	 * True when the OCR switch is on. Says nothing about provider availability — that is
	 * only knowable by resolving a model.
	 */
	public isEnabled(): boolean {
		return getDocsConfig().ocrEnabled;
	}

	/**
	 * Transcribes a single image (png/jpeg/webp/gif) — `pageCount` is always 1.
	 *
	 * @param buffer The image bytes.
	 * @param ctx The extraction context (tenant snapshot, filename).
	 * @returns The transcription, or `null` when OCR is unavailable.
	 * @throws DocsTransientError when the provider call fails (a retry may succeed).
	 */
	public async transcribeImage(buffer: Buffer, ctx: IDocumentExtractionContext): Promise<IDocumentOcrResult | null> {
		const model = await this.resolveModel(ctx.tenantId);
		if (!model) {
			return null;
		}

		const png = await this.downscale(buffer);
		const text = await this.transcribePage(model, png, ctx, 1);
		if (text === null) {
			// A single-page source has nothing left to salvage — retryable, not terminal.
			throw new DocsTransientError('The image could not be transcribed by the vision provider.');
		}

		return {
			markdown: text,
			provenance: this.provenanceOf(model, 1, 1, false),
			warnings: []
		};
	}

	/**
	 * Transcribes a scanned PDF page by page, capped at `GAUZY_DOCS_OCR_MAX_PAGES`.
	 *
	 * Per-page failures skip that page (with a visible note) rather than losing the document;
	 * an all-pages-failed run is classified transient, per the spec.
	 *
	 * @param buffer The PDF bytes.
	 * @param ctx The extraction context (tenant snapshot, filename).
	 * @returns The transcription, or `null` when OCR — or the PDF renderer — is unavailable.
	 */
	public async transcribePdf(buffer: Buffer, ctx: IDocumentExtractionContext): Promise<IDocumentOcrResult | null> {
		const model = await this.resolveModel(ctx.tenantId);
		if (!model) {
			return null;
		}

		const maxPages = getDocsConfig().ocrMaxPages;
		// The cap is applied at RENDER time, so capped pages cost neither pixels nor tokens.
		const rendered = await this.rasterizer.renderPages(buffer, maxPages);
		if (!rendered || rendered.pages.length === 0) {
			return null;
		}

		const warnings: string[] = [];
		const sections: string[] = [];
		let transcribed = 0;

		for (let index = 0; index < rendered.pages.length; index++) {
			const pageNumber = index + 1;
			const text = await this.transcribePage(model, rendered.pages[index], ctx, pageNumber);
			if (text === null) {
				warnings.push(buildOcrPageFailureNote(pageNumber));
				sections.push(`## Page ${pageNumber}\n\n${buildOcrPageFailureNote(pageNumber)}`);
				continue;
			}
			transcribed++;
			sections.push(`## Page ${pageNumber}\n\n${text}`);
		}

		if (transcribed === 0) {
			throw new DocsTransientError('No page of this PDF could be transcribed by the vision provider.');
		}

		const capped = rendered.pageCount > rendered.pages.length;
		if (capped) {
			const note = buildOcrCapNote(rendered.pages.length, rendered.pageCount);
			warnings.push(note);
			sections.push(note);
		}

		return {
			markdown: sections.join('\n\n'),
			provenance: this.provenanceOf(model, rendered.pageCount, transcribed, capped),
			warnings
		};
	}

	/**
	 * Resolves the vision model, or `null` when OCR cannot run at all.
	 */
	private async resolveModel(tenantId?: ID): Promise<IResolvedChatModel | null> {
		if (!this.isEnabled()) {
			return null;
		}
		const resolved = await this.docsAiService.resolveVisionModel(tenantId);
		if (!resolved) {
			this.logger.debug('OCR is enabled but no vision model resolves — falling back to the pre-OCR behavior.');
		}
		return resolved;
	}

	/**
	 * One page → one provider call. Returns `null` on failure (the caller decides whether a
	 * single failed page is fatal); the usage event is emitted either way.
	 */
	private async transcribePage(
		resolved: IResolvedChatModel,
		png: Buffer,
		ctx: IDocumentExtractionContext,
		pageNumber: number
	): Promise<string | null> {
		const sdk = await this.docsAiService.loadAiSdk();
		if (!sdk) {
			return null;
		}

		const startedAt = Date.now();
		// Image tokens are not chars/4 — the estimate covers the text turns only and is
		// flagged `estimated` so the cost rollup never mistakes it for a provider number.
		let usage = {
			inputTokens: Math.ceil((OCR_SYSTEM_PROMPT.length + OCR_USER_PROMPT.length) / 4),
			outputTokens: 0,
			estimated: true
		};

		try {
			const messages: any[] = [
				{ role: 'system', content: OCR_SYSTEM_PROMPT },
				{
					role: 'user',
					content: [
						{ type: 'text', text: OCR_USER_PROMPT },
						{ type: 'image', image: png, mediaType: 'image/png' }
					]
				}
			];
			const result = await sdk.generateText({
				model: resolved.model,
				messages,
				temperature: 0,
				maxOutputTokens: OCR_MAX_OUTPUT_TOKENS
			});

			const text = (result.text ?? '').trim();
			const reported = (result as any).usage;
			if (Number.isFinite(reported?.inputTokens) && Number.isFinite(reported?.outputTokens)) {
				usage = { inputTokens: reported.inputTokens, outputTokens: reported.outputTokens, estimated: false };
			} else {
				usage.outputTokens = Math.ceil(text.length / 4);
			}
			this.emitUsage(ctx, resolved, usage, startedAt, true);
			return text;
		} catch (error) {
			this.emitUsage(ctx, resolved, usage, startedAt, false);
			this.logger.warn(`OCR failed for page ${pageNumber} of "${ctx.filename}": ${(error as Error).message}`);
			return null;
		}
	}

	/**
	 * Downscales an image to {@link OCR_IMAGE_MAX_PX} on its longest side and normalizes it to
	 * PNG — smaller upload, fewer image tokens, one media type for every provider. A `sharp`
	 * failure degrades to the original bytes: a provider that can read the source directly
	 * should still get its chance.
	 */
	private async downscale(buffer: Buffer): Promise<Buffer> {
		try {
			return await sharp(buffer, { failOn: 'none' })
				.resize({ width: OCR_IMAGE_MAX_PX, height: OCR_IMAGE_MAX_PX, fit: 'inside', withoutEnlargement: true })
				.png()
				.toBuffer();
		} catch (error) {
			this.logger.debug(`Image downscale before OCR failed, sending the original bytes: ${(error as Error).message}`);
			return buffer;
		}
	}

	/** Builds the provenance block persisted under `metadata.extraction.ocr`. */
	private provenanceOf(
		resolved: IResolvedChatModel,
		pageCount: number,
		pagesTranscribed: number,
		capped: boolean
	): IDocumentOcrProvenance {
		return {
			pageCount,
			pagesTranscribed,
			capped,
			providerId: resolved.providerId,
			model: resolved.modelId,
			transcribedAt: new Date().toISOString()
		};
	}

	/** Cost accounting for one OCR call — the same event embedding/classification emit (§7.4). */
	private emitUsage(
		ctx: IDocumentExtractionContext,
		resolved: IResolvedChatModel,
		usage: { inputTokens: number; outputTokens: number; estimated: boolean },
		startedAt: number,
		success: boolean
	): void {
		this.docsAiService.emitUsage({
			tenantId: ctx.tenantId,
			organizationId: ctx.organizationId,
			feature: 'docs-ocr',
			providerId: resolved.providerId,
			model: resolved.modelId,
			inputTokens: usage.inputTokens,
			outputTokens: usage.outputTokens,
			estimated: usage.estimated,
			durationMs: Date.now() - startedAt,
			success
		});
	}
}
