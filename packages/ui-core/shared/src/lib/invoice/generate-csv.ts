import { saveAs } from 'file-saver';
import {
	CSV_MIME_TYPE,
	CSV_RECORD_SEPARATOR,
	CSV_UTF8_BOM,
	neutralizeSpreadsheetText,
	quoteCsvText
} from '@gauzy/ui-core/common';

/**
 * Prefixes `'` to text a spreadsheet would otherwise evaluate as a formula (GHSA-7xp5-j564-4752):
 * contact names, payment notes and user names are written by other tenant users and end up in
 * this file. The guard lives with the shared CSV encoding in `@gauzy/ui-core/common`; it stays
 * exported from here for the callers that import it from this module.
 */
export { neutralizeSpreadsheetText };

/**
 * The text of one cell, before it is quoted.
 *
 * A value with a `toJSON()` — a `Date`, a moment — serialises to a JSON *string literal*, quote
 * characters and all, so it is unwrapped: the old encoder wrote a date as the bare ISO timestamp,
 * and re-quoting `"2024-01-01T00:00:00.000Z"` would leave those quotes visible inside the cell.
 * Anything else that is not a string keeps its JSON form, which quoting below makes CSV-safe.
 */
function toCellText(value: unknown): string {
	if (value === null) {
		return 'N/A';
	}
	if (typeof value === 'string') {
		return value;
	}
	const serialized = JSON.stringify(value);
	if (serialized === undefined) {
		return '';
	}
	return serialized.startsWith('"') ? (JSON.parse(serialized) as string) : serialized;
}

/**
 * One RFC 4180 field. Text is always quoted with embedded quotes doubled, so a value such as
 * `x",=1+1,"` stays inside its own cell (the old `JSON.stringify` quoting escaped `"` as `\"`,
 * which CSV does not understand, and let such a value close the field and start a new one).
 *
 * `null` is written as `N/A` and `undefined` as an empty field, as before; numbers and booleans are
 * written bare so spreadsheets keep reading them as numbers.
 */
function toCsvField(value: unknown): string {
	if (value === undefined) {
		return '';
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value);
	}
	return quoteCsvText(toCellText(value));
}

/**
 * The header line: every title is encoded like any other cell.
 *
 * The parameter is typed `string[]` and both callers pass one. A pre-joined line used to be accepted
 * and written through verbatim, which was the one path reaching the file without quoting or
 * neutralization; such a line is split here instead, so an untyped JavaScript caller still gets a
 * safe file.
 *
 * @param headers - Column titles, one per column.
 */
function toHeaderLine(headers: string[]): string {
	const titles = Array.isArray(headers) ? headers : String(headers).split(',');
	return titles.map((title) => toCsvField(title)).join(',');
}

/**
 * Builds the CSV text: a header line, then one line per row, with the columns taken from the keys of
 * the first row.
 *
 * @param data - Rows to export.
 * @param headers - Column titles, one per column.
 */
export function buildCsv(data: any[], headers: string[]): string {
	const columns = Object.keys(data[0] ?? {});
	const lines = data.map((row) => columns.map((column) => toCsvField(row[column])).join(','));
	lines.unshift(toHeaderLine(headers));
	return lines.join(CSV_RECORD_SEPARATOR);
}

export async function generateCsv(data: any[], headers: string[], fileName: string) {
	const csvArray = CSV_UTF8_BOM + buildCsv(data, headers);
	const blob = new Blob([csvArray], { type: CSV_MIME_TYPE });
	saveAs(blob, `${fileName}.csv`);
}
