import { Injectable } from '@nestjs/common';
import * as sanitizeHtml from 'sanitize-html';
import * as TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { DocsPermanentError } from '../errors';
import {
	capMarkdown,
	countWords,
	escapeTableCell,
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
	service.use(gfm); // strikethrough, task lists, GFM block handling
	service.addRule('pipeTable', pipeTableRule);
	return service;
}

/**
 * Renders every `<table>` as a GitHub-style pipe table, treating the first row as the
 * header — the same shape the CSV and XLSX extractors produce.
 *
 * This replaces `turndown-plugin-gfm`'s table handling, which produces markdown that is
 * either invalid or not markdown at all for three shapes extraction hits constantly:
 *
 * 1. **No `<th>` header row.** The plugin only converts a table whose first row is a
 *    heading row and `keep()`s every other table **as raw HTML** — so a Word table
 *    without a repeating header row, or hand-written `<table><tr><td>`, landed in
 *    `document.extractedText` as literal `<table>` markup, breaking the contract that
 *    extraction always yields normalized markdown (§4.1) and pushing tag soup into the
 *    chunker and the search index.
 * 2. **Block content inside a cell.** mammoth always wraps docx cell text in `<p>`, and
 *    the plugin's cell rule passes the rendered block content through verbatim — the
 *    embedded newlines split one table row across several lines, so *every* docx table
 *    came out malformed.
 * 3. **A literal `|` in a cell.** The plugin does not escape it, so one pipe in the data
 *    silently changes the table's column count.
 *
 * Trade-off, deliberate: cell content is rendered as escaped plain text, so inline
 * emphasis *inside a cell* (`<td><strong>x</strong></td>` → `x`) is not carried into the
 * markdown. Extracted text feeds retrieval, where a well-formed row matters and
 * intra-cell bold does not; everything outside tables keeps its full inline formatting.
 */
const pipeTableRule: TurndownService.Rule = {
	filter: (node: any): boolean => node.nodeName === 'TABLE' && (node.rows?.length ?? 0) > 0,
	replacement: (_content: string, node: any): string => {
		const rows: string[][] = Array.from(node.rows ?? []).map((row: any) =>
			Array.from(row.cells ?? []).map((cell: any) => escapeTableCell(String(cell.textContent ?? '')))
		);
		const width = Math.max(...rows.map((row) => row.length), 1);
		const pad = (row: string[]): string[] => {
			const cells = [...row];
			while (cells.length < width) {
				cells.push('');
			}
			return cells;
		};
		const lines = [
			`| ${pad(rows[0]).join(' | ')} |`,
			`| ${pad(rows[0])
				.map(() => '---')
				.join(' | ')} |`,
			...rows.slice(1).map((row) => `| ${pad(row).join(' | ')} |`)
		];
		return `\n\n${lines.join('\n')}\n\n`;
	}
};

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
