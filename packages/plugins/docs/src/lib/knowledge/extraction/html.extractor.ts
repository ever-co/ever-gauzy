import { Injectable } from '@nestjs/common';
import * as sanitizeHtml from 'sanitize-html';
import * as TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { DocsPermanentError } from '../errors';
import {
	capMarkdown,
	countWords,
	IDocumentExtractionContext,
	IDocumentExtractionResult,
	IDocumentExtractor,
	normalizeMarkdown
} from './extractor.interface';

/**
 * Builds a GFM-enabled Turndown converter (shared by the HTML and DOCX extractors).
 */
export function createTurndown(): TurndownService {
	const service = new TurndownService({
		headingStyle: 'atx',
		codeBlockStyle: 'fenced',
		bulletListMarker: '-'
	});
	service.use(gfm); // pipe tables preserved
	return service;
}

/**
 * HTML extractor: sanitize → markdown. Scripts/styles/frames/event handlers are stripped
 * BEFORE conversion; only text-level structure survives. No raw HTML is ever emitted.
 */
@Injectable()
export class HtmlExtractor implements IDocumentExtractor {
	/**
	 * @inheritdoc
	 */
	supports(mime: string): boolean {
		return mime === 'text/html';
	}

	/**
	 * @inheritdoc
	 */
	async extract(buffer: Buffer, ctx: IDocumentExtractionContext): Promise<IDocumentExtractionResult> {
		const html = buffer.toString('utf8');

		// Sanitize first — scripts, styles, frames, forms, and event handlers never reach
		// the converter. Text-level structure (headings, lists, tables, links) survives.
		const sanitized = sanitizeHtml(html, {
			allowedTags: [
				'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
				'p', 'br', 'hr', 'blockquote', 'pre', 'code',
				'ul', 'ol', 'li',
				'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
				'strong', 'b', 'em', 'i', 'u', 's', 'del', 'a', 'span', 'div'
			],
			allowedAttributes: {
				a: ['href', 'title']
			},
			allowedSchemes: ['http', 'https', 'mailto'],
			disallowedTagsMode: 'discard'
		});

		let converted: string;
		try {
			converted = createTurndown().turndown(sanitized);
		} catch (error) {
			throw new DocsPermanentError('The HTML file could not be converted to text.', error);
		}

		const normalized = normalizeMarkdown(converted);
		const { markdown, truncated } = capMarkdown(normalized, ctx.maxChars);
		return {
			markdown,
			metadata: { truncated, wordCount: countWords(markdown) }
		};
	}
}
