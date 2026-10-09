import { Injectable } from '@nestjs/common';
import * as mammoth from 'mammoth';
import { DocsPermanentError } from '../errors';
import {
	capMarkdown,
	countWords,
	IDocumentExtractionContext,
	IDocumentExtractionResult,
	IDocumentExtractor,
	normalizeMarkdown
} from './extractor.interface';
import { createTurndown } from './html.extractor';

/** The ZIP local-file-header signature — a legacy binary `.doc` never starts with it. */
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/**
 * DOCX extractor: docx → semantic HTML (mammoth) → markdown (turndown + GFM, pipe tables
 * preserved). Legacy binary `.doc` is a permanent error with an actionable message.
 */
@Injectable()
export class DocxExtractor implements IDocumentExtractor {
	/**
	 * @inheritdoc
	 */
	supports(mime: string): boolean {
		return mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
	}

	/**
	 * @inheritdoc
	 */
	async extract(buffer: Buffer, ctx: IDocumentExtractionContext): Promise<IDocumentExtractionResult> {
		if (buffer.length < 4 || !buffer.subarray(0, 4).equals(ZIP_SIGNATURE)) {
			throw new DocsPermanentError('Legacy .doc is not supported — save as .docx and re-upload.');
		}

		let html: string;
		let warnings: string[] | undefined;
		try {
			const result = await mammoth.convertToHtml({ buffer });
			html = result.value ?? '';
			const messages = (result.messages ?? [])
				.filter((message: any) => message?.type === 'warning')
				.map((message: any) => String(message.message).slice(0, 200))
				.slice(0, 10);
			warnings = messages.length > 0 ? messages : undefined;
		} catch (error) {
			throw new DocsPermanentError('The document could not be read — it may be corrupt or password-protected.', error);
		}

		const converted = createTurndown().turndown(html);
		const normalized = normalizeMarkdown(converted);
		const { markdown, truncated } = capMarkdown(normalized, ctx.maxChars);

		return {
			markdown,
			metadata: { truncated, warnings, wordCount: countWords(markdown) }
		};
	}
}
