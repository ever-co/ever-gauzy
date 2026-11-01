/**
 * Spreadsheet-safe CSV encoding (RFC 4180) for every CSV file the UI writes.
 *
 * The values that end up in an exported file — names, notes, descriptions — are written by other users of
 * the tenant, and a spreadsheet evaluates a cell that starts with a formula trigger. Every text cell is
 * therefore neutralized before it is quoted (GHSA-7xp5-j564-4752).
 */

/**
 * Leading characters a spreadsheet may treat as the start of a formula, plus their full-width forms.
 *
 * Kept in step with `neutralizeSpreadsheetCell` in `@gauzy/utils` (packages/utils/src/lib/spreadsheet-safe.ts).
 * `@gauzy/ui-core` does not depend on `@gauzy/utils`, and that barrel pulls in Node's `crypto`, so the
 * few lines are copied here rather than imported into the browser bundle.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r＝＋－＠]/;

/** A strictly numeric string such as `-12.50`, which must stay a number in the spreadsheet. */
const STRICTLY_NUMERIC = /^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/;

/** The byte order mark that makes Excel read a CSV file as UTF-8 rather than the system code page. */
export const CSV_UTF8_BOM = '﻿';

/** RFC 4180 separates records with CRLF. */
export const CSV_RECORD_SEPARATOR = '\r\n';

/** The media type of a UTF-8 CSV file. */
export const CSV_MIME_TYPE = 'text/csv;charset=utf-8';

/** A value one CSV field can hold. */
export type CsvFieldValue = string | number | boolean | Date | null | undefined;

/**
 * Prefixes `'` to text a spreadsheet would otherwise evaluate as a formula (GHSA-7xp5-j564-4752).
 * A value that already starts with `'` is prefixed too, like the server-side export.
 *
 * @param value - The text of a cell.
 * @returns The text, safe to open in a spreadsheet.
 */
export function neutralizeSpreadsheetText(value: string): string {
	if (value.startsWith("'") || (FORMULA_TRIGGER.test(value) && !STRICTLY_NUMERIC.test(value))) {
		return "'" + value;
	}
	return value;
}

/**
 * One RFC 4180 text field: neutralized, embedded quotes doubled, and always quoted, so a value such as
 * `x",=1+1,"` stays inside its own cell.
 *
 * @param text - The text of a cell.
 * @returns The quoted field.
 */
export function quoteCsvText(text: string): string {
	return `"${neutralizeSpreadsheetText(text).replace(/"/g, '""')}"`;
}

/**
 * One CSV field for a plain value.
 *
 * Numbers and booleans are written bare so spreadsheets keep reading them as numbers; a missing value, or a
 * number that is not finite, is an empty field; a date is its ISO timestamp; everything else is quoted text.
 *
 * @param value - The value of a cell.
 * @returns The encoded field.
 */
export function toCsvField(value: CsvFieldValue): string {
	if (value === null || value === undefined) {
		return '';
	}
	if (typeof value === 'number') {
		return Number.isFinite(value) ? String(value) : '';
	}
	if (typeof value === 'boolean') {
		return String(value);
	}
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? '' : quoteCsvText(value.toISOString());
	}
	return quoteCsvText(String(value));
}

/**
 * One CSV record: the fields of one line, separated by commas.
 *
 * @param values - The values of the line, in column order.
 * @returns The encoded record, without a line break.
 */
export function toCsvRecord(values: ReadonlyArray<CsvFieldValue>): string {
	return values.map(toCsvField).join(',');
}

/**
 * The text of a CSV document: one record per line, separated by CRLF.
 *
 * @param records - The lines of the document, header first when there is one.
 * @returns The CSV text, without a byte order mark.
 */
export function buildCsvText(records: ReadonlyArray<ReadonlyArray<CsvFieldValue>>): string {
	return records.map(toCsvRecord).join(CSV_RECORD_SEPARATOR);
}
