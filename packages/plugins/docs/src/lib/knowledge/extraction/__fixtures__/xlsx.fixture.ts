/**
 * XLSX fixture (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).
 *
 * Written with ExcelJS — the same library `XlsxExtractor` reads with, and already a
 * direct dependency of the plugin — so the fixture is a genuine workbook rather than a
 * hand-forged approximation of one.
 */
import * as ExcelJS from 'exceljs';

/**
 * Builds a multi-sheet workbook exercising the cell shapes `cellToString` has to render:
 *
 * - **Summary** — plain strings, numbers, a `Date`, and a rich-text cell.
 * - **Detail** — a formula cell with a cached result, a hyperlink cell, and a value
 *   containing a pipe (which must be escaped so the markdown table survives).
 * - **Notes** — a single column, narrower than the other sheets (padding path).
 * - **Empty** — no rows at all: must not be counted in `pageCount` and must not render.
 *
 * @returns The `.xlsx` bytes.
 */
export async function createMultiSheetXlsx(): Promise<Buffer> {
	const workbook = new ExcelJS.Workbook();

	const summary = workbook.addWorksheet('Summary');
	summary.addRow(['Region', 'Revenue', 'Closed']);
	summary.addRow(['EMEA', 1200, new Date(Date.UTC(2026, 0, 31))]);
	summary.addRow(['APAC', 980, new Date(Date.UTC(2026, 1, 28))]);
	summary.addRow([
		{ richText: [{ text: 'North ' }, { text: 'America' }] },
		1450,
		new Date(Date.UTC(2026, 2, 31))
	]);

	const detail = workbook.addWorksheet('Detail');
	detail.addRow(['Account', 'Total', 'Portal']);
	const formulaRow = detail.addRow(['Acme', null, null]);
	formulaRow.getCell(2).value = { formula: 'SUM(B2:B4)', result: 3630 } as ExcelJS.CellFormulaValue;
	formulaRow.getCell(3).value = {
		text: 'acme dashboard',
		hyperlink: 'https://ever.co/acme'
	} as ExcelJS.CellHyperlinkValue;
	detail.addRow(['Globex', 'tier a | tier b', 'n/a']);

	const notes = workbook.addWorksheet('Notes');
	notes.addRow(['Note']);
	notes.addRow(['Figures are unaudited.']);

	// Declared but never written to — must be skipped entirely.
	workbook.addWorksheet('Empty');

	const written = await workbook.xlsx.writeBuffer();
	return Buffer.from(written as ArrayBuffer);
}

/**
 * Builds a single-sheet workbook with more rows than `XLSX_MAX_ROWS_PER_SHEET`, so the
 * per-sheet row cap and its truncation note are exercised.
 *
 * @param rowCount Number of data rows to write (header excluded).
 */
export async function createOversizedXlsx(rowCount: number): Promise<Buffer> {
	const workbook = new ExcelJS.Workbook();
	const sheet = workbook.addWorksheet('Ledger');
	sheet.addRow(['id', 'value']);
	for (let i = 0; i < rowCount; i++) {
		sheet.addRow([i, `v${i}`]);
	}
	const written = await workbook.xlsx.writeBuffer();
	return Buffer.from(written as ArrayBuffer);
}

/** Bytes that are not a ZIP at all — the corrupt/password-protected workbook path. */
export function createCorruptXlsx(): Buffer {
	return Buffer.from('this is definitely not a spreadsheet', 'utf8');
}
