import { Injectable } from '@nestjs/common';
import {
	capMarkdown,
	countWords,
	escapeTableCell,
	IDocumentExtractionContext,
	IDocumentExtractionResult,
	IDocumentExtractor,
	normalizeMarkdown
} from './extractor.interface';

/** Row cap of the CSV → markdown-table conversion (spec: 1000 rows + truncation note). */
export const CSV_MAX_ROWS = 1000;

/** Candidate delimiters for auto-detection, in preference order. */
const DELIMITER_CANDIDATES = [',', ';', '\t', '|'];

/**
 * Detects the most plausible delimiter by counting unquoted occurrences on the first
 * non-empty lines; ties break by candidate order.
 *
 * @param text The CSV text (first lines are enough).
 * @returns The detected delimiter character.
 */
export function detectDelimiter(text: string): string {
	const lines = text.split('\n').filter((line) => line.trim().length > 0).slice(0, 10);
	let best = ',';
	let bestScore = 0;
	for (const candidate of DELIMITER_CANDIDATES) {
		let score = 0;
		for (const line of lines) {
			let inQuotes = false;
			for (const ch of line) {
				if (ch === '"') {
					inQuotes = !inQuotes;
				} else if (!inQuotes && ch === candidate) {
					score++;
				}
			}
		}
		if (score > bestScore) {
			best = candidate;
			bestScore = score;
		}
	}
	return best;
}

/**
 * Lenient RFC-4180-style CSV parse: quoted fields, escaped quotes (`""`), delimiter
 * auto-detected by the caller. Pure and deterministic — no dependencies.
 *
 * @param text The CSV text.
 * @param delimiter The field delimiter.
 * @param maxRows Hard row cap (parsing stops beyond it).
 * @returns The parsed rows plus a flag for capped input.
 */
export function parseCsv(text: string, delimiter: string, maxRows: number): { rows: string[][]; capped: boolean } {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;
	let capped = false;

	const pushField = () => {
		row.push(field);
		field = '';
	};
	const pushRow = () => {
		pushField();
		// Skip fully-empty trailing rows
		if (row.length > 1 || row[0].trim() !== '') {
			rows.push(row);
		}
		row = [];
	};

	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (inQuotes) {
			if (ch === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += ch;
			}
			continue;
		}
		if (ch === '"') {
			inQuotes = true;
		} else if (ch === delimiter) {
			pushField();
		} else if (ch === '\n') {
			pushRow();
			if (rows.length > maxRows) {
				capped = true;
				break;
			}
		} else if (ch !== '\r') {
			field += ch;
		}
	}
	if (!capped && (field.length > 0 || row.length > 0)) {
		pushRow();
	}
	return { rows, capped };
}

/**
 * Renders parsed CSV rows as one GitHub-style pipe table under the mandatory
 * `## Sheet: <filename-stem>` locator heading.
 */
export function csvRowsToMarkdown(rows: string[][], sheetName: string, totalNote?: string): string {
	if (rows.length === 0) {
		return `## Sheet: ${sheetName}\n\n_Empty file._`;
	}
	const width = Math.max(...rows.map((row) => row.length));
	const pad = (row: string[]) => {
		const cells = row.map((cell) => escapeTableCell(cell));
		while (cells.length < width) {
			cells.push('');
		}
		return cells;
	};
	const header = pad(rows[0]);
	const lines = [
		`## Sheet: ${sheetName}`,
		'',
		`| ${header.join(' | ')} |`,
		`| ${header.map(() => '---').join(' | ')} |`,
		...rows.slice(1).map((row) => `| ${pad(row).join(' | ')} |`)
	];
	if (totalNote) {
		lines.push('', totalNote);
	}
	return lines.join('\n');
}

/**
 * CSV extractor: delimiter auto-detect, lenient parse → single markdown pipe table with
 * a `## Sheet: <filename-stem>` heading, capped at 1000 rows with a truncation note.
 */
@Injectable()
export class CsvExtractor implements IDocumentExtractor {
	/**
	 * @inheritdoc
	 */
	supports(mime: string): boolean {
		return mime === 'text/csv';
	}

	/**
	 * @inheritdoc
	 */
	async extract(buffer: Buffer, ctx: IDocumentExtractionContext): Promise<IDocumentExtractionResult> {
		const text = normalizeMarkdown(buffer.toString('utf8'));
		const delimiter = detectDelimiter(text);
		const { rows, capped } = parseCsv(text, delimiter, CSV_MAX_ROWS);

		const stem = (ctx.filename ?? 'data').replace(/\.[A-Za-z0-9]+$/, '') || 'data';
		const kept = rows.slice(0, CSV_MAX_ROWS);
		const note = capped
			? `_Truncated: only the first ${CSV_MAX_ROWS} rows are shown._`
			: undefined;

		const rendered = csvRowsToMarkdown(kept, stem, note);
		const { markdown, truncated } = capMarkdown(rendered, ctx.maxChars);

		return {
			markdown,
			metadata: {
				pageCount: 1,
				truncated: capped || truncated,
				wordCount: countWords(markdown),
				warnings: capped ? [`Row cap applied (${CSV_MAX_ROWS})`] : undefined
			}
		};
	}
}
