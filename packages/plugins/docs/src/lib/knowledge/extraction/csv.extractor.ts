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
 * Accumulator of the CSV scan: owns the completed rows plus the row/field currently being
 * built, so the scanner itself stays a flat character dispatch.
 */
class CsvRowAccumulator {
	/** The rows completed so far — the array handed back to the caller. */
	readonly rows: string[][] = [];
	private row: string[] = [];
	private field = '';

	/** Appends one character to the field under construction. */
	appendChar(ch: string): void {
		this.field += ch;
	}

	/** Closes the field under construction and starts a new one. */
	pushField(): void {
		this.row.push(this.field);
		this.field = '';
	}

	/** Closes the current field and row; fully-empty trailing rows are skipped. */
	pushRow(): void {
		this.pushField();
		// Skip fully-empty trailing rows
		if (this.row.length > 1 || this.row[0].trim() !== '') {
			this.rows.push(this.row);
		}
		this.row = [];
	}

	/** True while a field or row is still under construction (an unterminated last line). */
	get hasPendingInput(): boolean {
		return this.field.length > 0 || this.row.length > 0;
	}
}

/**
 * Consumes the body of a quoted field into `accumulator`, starting at the first character
 * after the opening quote. `""` is an escaped quote; a lone `"` closes the field.
 *
 * @param text The CSV text.
 * @param start Index of the first character inside the quotes.
 * @param accumulator The row accumulator receiving the decoded characters.
 * @returns The index of the closing quote, or `text.length` when the quote is never closed.
 */
function consumeQuotedField(text: string, start: number, accumulator: CsvRowAccumulator): number {
	let i = start;
	while (i < text.length) {
		const ch = text[i];
		if (ch !== '"') {
			accumulator.appendChar(ch);
			i++;
		} else if (text[i + 1] === '"') {
			accumulator.appendChar('"'); // escaped quote
			i += 2;
		} else {
			return i; // a lone quote closes the field
		}
	}
	return i;
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
	const accumulator = new CsvRowAccumulator();
	let capped = false;

	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (ch === '"') {
			// The scan resumes on the closing quote; the loop's own `i++` steps past it.
			i = consumeQuotedField(text, i + 1, accumulator);
		} else if (ch === delimiter) {
			accumulator.pushField();
		} else if (ch === '\n') {
			accumulator.pushRow();
			if (accumulator.rows.length > maxRows) {
				capped = true;
				break;
			}
		} else if (ch !== '\r') {
			accumulator.appendChar(ch);
		}
	}
	if (!capped && accumulator.hasPendingInput) {
		accumulator.pushRow();
	}
	return { rows: accumulator.rows, capped };
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
