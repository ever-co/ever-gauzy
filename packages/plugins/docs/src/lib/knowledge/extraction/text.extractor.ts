import { Injectable } from '@nestjs/common';
import {
	capMarkdown,
	countWords,
	IDocumentExtractionContext,
	IDocumentExtractionResult,
	IDocumentExtractor,
	normalizeMarkdown
} from './extractor.interface';

/**
 * Passthrough extractor for `text/plain` and `text/markdown`: UTF-8 normalize, strip
 * NULs, LF-only. Markdown headings in `.md` are kept and feed `headingPath` directly.
 */
@Injectable()
export class TextExtractor implements IDocumentExtractor {
	/**
	 * @inheritdoc
	 */
	supports(mime: string): boolean {
		return mime === 'text/plain' || mime === 'text/markdown';
	}

	/**
	 * @inheritdoc
	 */
	async extract(buffer: Buffer, ctx: IDocumentExtractionContext): Promise<IDocumentExtractionResult> {
		const normalized = normalizeMarkdown(buffer.toString('utf8'));
		const { markdown, truncated } = capMarkdown(normalized, ctx.maxChars);
		return {
			markdown,
			metadata: { truncated, wordCount: countWords(markdown) }
		};
	}
}
