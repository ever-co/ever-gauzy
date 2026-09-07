import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
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

/** Row cap per sheet of the XLSX → markdown conversion (spec: 500 rows/sheet). */
export const XLSX_MAX_ROWS_PER_SHEET = 500;

/**
 * XLSX extractor: sheet-aware — one GitHub-style pipe table per sheet under the
 * mandatory `## Sheet: <name>` locator heading (always emitted, even for one sheet —
 * it is the sheet locator). Caps 500 rows/sheet with a visible truncation note.
 * `pageCount` = non-empty sheets.
 */
@Injectable()
export class XlsxExtractor implements IDocumentExtractor {
	/**
	 * @inheritdoc
	 */
	supports(mime: string): boolean {
		return mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
	}

	/**
	 * @inheritdoc
	 */
	async extract(buffer: Buffer, ctx: IDocumentExtractionContext): Promise<IDocumentExtractionResult> {
		const workbook = new ExcelJS.Workbook();
		try {
			await workbook.xlsx.load(buffer as any);
		} catch (error) {
			throw new DocsPermanentError(
				'The spreadsheet could not be read — it may be corrupt or password-protected.',
				error
			);
		}

		const sections: string[] = [];
		const warnings: string[] = [];
		let nonEmptySheets = 0;

		workbook.eachSheet((worksheet: ExcelJS.Worksheet) => {
			const rows: string[][] = [];
			let capped = false;
			const totalRows = worksheet.actualRowCount ?? worksheet.rowCount ?? 0;

			worksheet.eachRow({ includeEmpty: false }, (row: ExcelJS.Row) => {
				if (rows.length >= XLSX_MAX_ROWS_PER_SHEET) {
					capped = true;
					return;
				}
				const cells: string[] = [];
				// row.values is 1-based; index 0 is always empty.
				const values = Array.isArray(row.values) ? row.values.slice(1) : [];
				for (const value of values) {
					cells.push(escapeTableCell(this.cellToString(value)));
				}
				rows.push(cells);
			});

			if (rows.length === 0) {
				return; // empty sheet — not counted, not rendered
			}
			nonEmptySheets++;

			const width = Math.max(...rows.map((row) => row.length), 1);
			const pad = (row: string[]) => {
				const cells = [...row];
				while (cells.length < width) {
					cells.push('');
				}
				return cells;
			};

			const header = pad(rows[0]);
			const lines = [
				`## Sheet: ${worksheet.name}`,
				'',
				`| ${header.join(' | ')} |`,
				`| ${header.map(() => '---').join(' | ')} |`,
				...rows.slice(1).map((row) => `| ${pad(row).join(' | ')} |`)
			];
			if (capped) {
				lines.push('', `_Truncated: only the first ${XLSX_MAX_ROWS_PER_SHEET} of ${totalRows} rows are shown._`);
				warnings.push(`Sheet "${worksheet.name}" row cap applied (${XLSX_MAX_ROWS_PER_SHEET})`);
			}
			sections.push(lines.join('\n'));
		});

		const rendered = sections.length > 0 ? sections.join('\n\n') : '_Empty workbook._';
		const normalized = normalizeMarkdown(rendered);
		const { markdown, truncated } = capMarkdown(normalized, ctx.maxChars);

		return {
			markdown,
			metadata: {
				pageCount: nonEmptySheets,
				truncated: truncated || warnings.length > 0,
				warnings: warnings.length > 0 ? warnings : undefined,
				wordCount: countWords(markdown)
			}
		};
	}

	/**
	 * Renders an ExcelJS cell value (rich text, formula results, dates, hyperlinks) as
	 * plain text.
	 */
	private cellToString(value: unknown): string {
		if (value === null || value === undefined) {
			return '';
		}
		if (value instanceof Date) {
			return value.toISOString().slice(0, 10);
		}
		if (typeof value === 'object') {
			const anyValue: any = value;
			if (anyValue.richText && Array.isArray(anyValue.richText)) {
				return anyValue.richText.map((part: any) => part.text ?? '').join('');
			}
			if (anyValue.text !== undefined) {
				return String(anyValue.text); // hyperlink cells
			}
			if (anyValue.result !== undefined) {
				return this.cellToString(anyValue.result); // formula cells
			}
			if (anyValue.formula !== undefined) {
				return ''; // formula without cached result
			}
			if (anyValue.error !== undefined) {
				return String(anyValue.error);
			}
			return String(anyValue);
		}
		return String(value);
	}
}
