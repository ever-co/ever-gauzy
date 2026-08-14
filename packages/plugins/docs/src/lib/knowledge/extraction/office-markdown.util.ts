import { escapeTableCell } from './extractor.interface';

/**
 * Markdown helpers shared by the PPTX and OpenDocument extractors.
 *
 * Kept out of `extractor.interface.ts` (the contract every extractor implements) because these
 * are rendering details of the two formats this plugin parses itself; the OOXML formats handled
 * by `mammoth` / `exceljs` get their table rendering from those libraries.
 */

/**
 * Renders a grid as a GitHub-style pipe table with the first row as its header.
 *
 * Ragged rows are padded to the widest one — a markdown table whose rows disagree on column
 * count renders as literal pipes rather than as a table, and office formats routinely produce
 * ragged grids (merged cells, trailing empty cells trimmed by the writer).
 *
 * Every cell goes through {@link escapeTableCell}, which neutralizes pipes, backslashes and
 * embedded line breaks — the values come from an untrusted upload and must not be able to
 * restructure the table.
 *
 * @param rows The grid, outermost array = rows.
 * @returns The markdown table, or an empty string when there is nothing to render.
 */
export function renderPipeTable(rows: string[][]): string {
	const populated = rows.filter((row) => row.length > 0);
	if (!populated.length) {
		return '';
	}

	const width = Math.max(...populated.map((row) => row.length), 1);
	const pad = (row: string[]): string[] => {
		const cells = row.map((cell) => escapeTableCell(cell));
		while (cells.length < width) {
			cells.push('');
		}
		return cells;
	};

	const header = pad(populated[0]);
	return [
		`| ${header.join(' | ')} |`,
		`| ${header.map(() => '---').join(' | ')} |`,
		...populated.slice(1).map((row) => `| ${pad(row).join(' | ')} |`)
	].join('\n');
}

/**
 * Collapses the runs of blank lines that fall out of section-by-section assembly into the single
 * blank line markdown treats as a paragraph break.
 *
 * @param lines The assembled lines.
 * @returns The joined markdown.
 */
export function joinBlocks(lines: string[]): string {
	return lines
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}
