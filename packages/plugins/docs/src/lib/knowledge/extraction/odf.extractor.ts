import { Injectable } from '@nestjs/common';
import { DocsPermanentError } from '../errors';
import {
	capMarkdown,
	countWords,
	IDocumentExtractionContext,
	IDocumentExtractionResult,
	IDocumentExtractor,
	normalizeMarkdown
} from './extractor.interface';
import { joinBlocks, renderPipeTable } from './office-markdown.util';
import { openOfficePackage } from './office-package.util';
import { attribute, findAll, IXmlNode, parseXml, textContent } from './office-xml.util';
import { XLSX_MAX_ROWS_PER_SHEET } from './xlsx.extractor';

/** Canonical MIME of an OpenDocument text document (`.odt`). */
export const ODT_MIME_TYPE = 'application/vnd.oasis.opendocument.text';

/** Canonical MIME of an OpenDocument spreadsheet (`.ods`). */
export const ODS_MIME_TYPE = 'application/vnd.oasis.opendocument.spreadsheet';

/**
 * Largest number of columns rendered per spreadsheet row.
 *
 * OpenDocument writers pad every row out to the sheet's full width with
 * `table:number-columns-repeated="16384"`, so expanding a repeat count literally is how a
 * three-cell row becomes sixteen thousand.
 */
export const ODS_MAX_COLUMNS_PER_ROW = 256;

/** Deepest markdown heading level (`######`) an outline level can map to. */
const MAX_HEADING_LEVEL = 6;

/** OpenDocument elements that stand for a literal rather than carrying text. */
const TEXT_REPLACEMENTS: Record<string, string> = {
	tab: '\t',
	'line-break': '\n',
	s: ' '
};

/**
 * OpenDocument extractor for `.odt` and `.ods`.
 *
 * - **`.odt`** → the body in document order: `text:h` becomes a markdown heading at its own
 *   outline level, `text:p` a paragraph, `text:list` a bullet list (nesting preserved), and
 *   `table:table` a GitHub-style pipe table.
 * - **`.ods`** → one `## Sheet: <name>` section per sheet with a pipe table under it, sharing
 *   the XLSX extractor's {@link XLSX_MAX_ROWS_PER_SHEET} row cap so the two spreadsheet formats
 *   truncate identically.
 *
 * Both formats are ZIP packages holding a single `content.xml`, parsed with this plugin's own
 * package + XML readers — OpenDocument has no parser in the dependency tree, and these two MIME
 * types were already accepted by the upload endpoint and sniffer, so without an extractor every
 * such upload was a guaranteed `FAILED`.
 */
@Injectable()
export class OdfExtractor implements IDocumentExtractor {
	/**
	 * @inheritdoc
	 */
	supports(mime: string): boolean {
		return mime === ODT_MIME_TYPE || mime === ODS_MIME_TYPE;
	}

	/**
	 * @inheritdoc
	 */
	async extract(buffer: Buffer, ctx: IDocumentExtractionContext): Promise<IDocumentExtractionResult> {
		const pkg = openOfficePackage(buffer);
		const xml = pkg.readText('content.xml');
		if (!xml) {
			throw new DocsPermanentError('The document could not be read — it is not an OpenDocument package.');
		}

		const content = parseXml(xml);
		const warnings: string[] = [];
		const isSpreadsheet = ctx.mimeType === ODS_MIME_TYPE;
		const { markdown: rendered, pageCount } = isSpreadsheet
			? this.renderSpreadsheet(content, warnings)
			: this.renderText(content);

		const normalized = normalizeMarkdown(rendered || '_Empty document._');
		const { markdown, truncated } = capMarkdown(normalized, ctx.maxChars);

		return {
			markdown,
			metadata: {
				pageCount,
				truncated: truncated || warnings.length > 0,
				warnings: warnings.length > 0 ? warnings : undefined,
				wordCount: countWords(markdown)
			}
		};
	}

	/* ------------------------------------------------------------------ */
	/* .odt                                                               */
	/* ------------------------------------------------------------------ */

	/**
	 * Renders `office:text` in document order.
	 *
	 * Walked recursively rather than through `findAll`, because order is the whole point: a
	 * flattened collection of headings, then paragraphs, then tables would put every section's
	 * body under the wrong heading and make the extracted text actively misleading.
	 *
	 * @param content The parsed `content.xml`.
	 * @returns The markdown plus a `pageCount` of 1 (a text document has no page structure the
	 *          extractor can see — pagination is a rendering-time property of ODF).
	 */
	private renderText(content: IXmlNode): { markdown: string; pageCount: number } {
		const body = this.findBody(content, 'text');
		if (!body) {
			return { markdown: '', pageCount: 0 };
		}
		return { markdown: joinBlocks(this.renderBlocks(body, 0)), pageCount: 1 };
	}

	/**
	 * Renders one level of body content into markdown lines.
	 *
	 * @param node The container whose children are rendered.
	 * @param listDepth Current bullet-list nesting depth (0 = not in a list).
	 * @returns The markdown lines for this level.
	 */
	private renderBlocks(node: IXmlNode, listDepth: number): string[] {
		const lines: string[] = [];

		for (const child of node.children) {
			switch (child.localName) {
				case 'h': {
					const level = Math.min(Math.max(Number(attribute(child, 'outline-level') ?? 1) || 1, 1), MAX_HEADING_LEVEL);
					const text = this.inlineText(child);
					if (text) {
						lines.push('', `${'#'.repeat(level)} ${text}`, '');
					}
					break;
				}
				case 'p': {
					const text = this.inlineText(child);
					if (!text) break;
					if (listDepth > 0) {
						// No trailing blank line: a blank line between bullets makes markdown
						// render a LOOSE list (each item wrapped in its own paragraph).
						lines.push(`${'  '.repeat(listDepth - 1)}- ${text}`);
					} else {
						lines.push(text, '');
					}
					break;
				}
				case 'list':
					// The list itself is one block, so the blank line goes around the whole thing.
					lines.push('', ...this.renderBlocks(child, listDepth + 1), '');
					break;
				case 'list-item':
					// A list item's own children are paragraphs (and possibly nested lists), which
					// the paragraph branch above renders with the current bullet depth.
					lines.push(...this.renderBlocks(child, listDepth));
					break;
				case 'table':
					lines.push('', renderPipeTable(this.tableRows(child, XLSX_MAX_ROWS_PER_SHEET).rows), '');
					break;
				case 'section':
				case 'frame':
				case 'text-box':
					// Structural wrappers: they carry no text of their own, only more blocks.
					lines.push(...this.renderBlocks(child, listDepth));
					break;
				default:
					break;
			}
		}

		return lines;
	}

	/* ------------------------------------------------------------------ */
	/* .ods                                                               */
	/* ------------------------------------------------------------------ */

	/**
	 * Renders every non-empty sheet under its mandatory `## Sheet: <name>` locator heading — the
	 * same machine-readable shape the XLSX extractor emits, so a citation into a spreadsheet
	 * reads identically whichever format it came from.
	 *
	 * @param content The parsed `content.xml`.
	 * @param warnings Collector for truncation notes.
	 * @returns The markdown plus the non-empty sheet count.
	 */
	private renderSpreadsheet(content: IXmlNode, warnings: string[]): { markdown: string; pageCount: number } {
		const body = this.findBody(content, 'spreadsheet');
		if (!body) {
			return { markdown: '', pageCount: 0 };
		}

		const sections: string[] = [];
		let nonEmptySheets = 0;

		for (const sheet of findAll(body, 'table')) {
			const name = attribute(sheet, 'name') ?? `Sheet ${nonEmptySheets + 1}`;
			const { rows, capped, totalRows } = this.tableRows(sheet, XLSX_MAX_ROWS_PER_SHEET);
			if (!rows.length) {
				continue; // empty sheet — not counted, not rendered
			}
			nonEmptySheets++;

			const lines = [`## Sheet: ${name}`, '', renderPipeTable(rows)];
			if (capped) {
				lines.push('', `_Truncated: only the first ${XLSX_MAX_ROWS_PER_SHEET} of ${totalRows} rows are shown._`);
				warnings.push(`Sheet "${name}" row cap applied (${XLSX_MAX_ROWS_PER_SHEET})`);
			}
			sections.push(lines.join('\n'));
		}

		return { markdown: sections.join('\n\n'), pageCount: nonEmptySheets };
	}

	/* ------------------------------------------------------------------ */
	/* Shared                                                             */
	/* ------------------------------------------------------------------ */

	/**
	 * Reads a `table:table` into a grid, expanding the repeat counts OpenDocument uses to
	 * compress runs of identical cells and rows.
	 *
	 * 🛑 Both expansions are bounded, and that is not defensive decoration: a writer pads every
	 * sheet to its full grid, so `table:number-rows-repeated="1048576"` on a trailing empty row
	 * is the NORMAL case, and expanding it literally would allocate a million rows for a
	 * three-row sheet. Trailing empty rows and cells are dropped instead of expanded, so the cap
	 * only ever bites on real data.
	 *
	 * @param table The `table:table` element.
	 * @param maxRows Row cap for the grid.
	 * @returns The grid, whether the cap bit, and the pre-cap row count.
	 */
	private tableRows(
		table: IXmlNode,
		maxRows: number
	): { rows: string[][]; capped: boolean; totalRows: number } {
		const rows: string[][] = [];
		let totalRows = 0;
		let capped = false;

		for (const row of findAll(table, 'table-row')) {
			const cells = this.rowCells(row);
			const repeat = this.repeatCount(row, 'number-rows-repeated');
			// A repeated EMPTY row is grid padding, never content.
			const effectiveRepeat = cells.length === 0 ? 0 : Math.min(repeat, maxRows);

			for (let i = 0; i < effectiveRepeat; i++) {
				totalRows++;
				if (rows.length >= maxRows) {
					capped = true;
					continue;
				}
				rows.push(cells);
			}
		}

		return { rows, capped, totalRows };
	}

	/** One spreadsheet row as plain cell strings, with trailing empty padding removed. */
	private rowCells(row: IXmlNode): string[] {
		const cells: string[] = [];

		for (const cell of row.children) {
			if (cell.localName !== 'table-cell' && cell.localName !== 'covered-table-cell') {
				continue;
			}
			const value = this.inlineText(cell);
			const repeat = Math.min(this.repeatCount(cell, 'number-columns-repeated'), ODS_MAX_COLUMNS_PER_ROW);
			for (let i = 0; i < repeat && cells.length < ODS_MAX_COLUMNS_PER_ROW; i++) {
				cells.push(value);
			}
		}

		while (cells.length > 0 && cells[cells.length - 1] === '') {
			cells.pop();
		}
		return cells;
	}

	/** An OpenDocument repeat attribute as a sane positive integer (absent / bogus ⇒ 1). */
	private repeatCount(node: IXmlNode, name: string): number {
		const parsed = Number(attribute(node, name) ?? 1);
		return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
	}

	/**
	 * The text of one element with the format's non-text glyphs resolved, collapsed to a single
	 * line (a cell or paragraph is one line of markdown; embedded breaks would break a table).
	 */
	private inlineText(node: IXmlNode): string {
		return textContent(node, TEXT_REPLACEMENTS).replace(/\s+/g, ' ').trim();
	}

	/**
	 * The `office:text` / `office:spreadsheet` element inside `office:body`.
	 *
	 * @param content The parsed `content.xml`.
	 * @param localName `text` for `.odt`, `spreadsheet` for `.ods`.
	 */
	private findBody(content: IXmlNode, localName: string): IXmlNode | undefined {
		const body = findAll(content, 'body')[0];
		return body ? body.children.find((child) => child.localName === localName) : undefined;
	}
}
