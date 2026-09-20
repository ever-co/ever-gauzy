import { saveAs } from 'file-saver';

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

/**
 * Prefixes `'` to text a spreadsheet would otherwise evaluate as a formula (GHSA-7xp5-j564-4752):
 * contact names, payment notes and user names are written by other tenant users and end up in
 * this file. A value that already starts with `'` is prefixed too, like the server-side export.
 */
export function neutralizeSpreadsheetText(value: string): string {
	if (value.startsWith("'") || (FORMULA_TRIGGER.test(value) && !STRICTLY_NUMERIC.test(value))) {
		return "'" + value;
	}
	return value;
}

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
	return `"${neutralizeSpreadsheetText(toCellText(value)).replace(/"/g, '""')}"`;
}

/**
 * Builds the CSV text: a header line, then one line per row, with the columns taken from the keys of
 * the first row.
 *
 * @param data - Rows to export.
 * @param headers - Column titles, one per column; a pre-joined header line is accepted as is.
 */
export function buildCsv(data: any[], headers: string[] | string): string {
	const columns = Object.keys(data[0] ?? {});
	const lines = data.map((row) => columns.map((column) => toCsvField(row[column])).join(','));
	const headerLine = Array.isArray(headers) ? headers.map((title) => toCsvField(title)).join(',') : headers;
	lines.unshift(headerLine);
	return lines.join('\r\n');
}

export async function generateCsv(data: any[], headers: string[] | string, fileName: string) {
	const BOM = '﻿';
	const csvArray = BOM + buildCsv(data, headers);
	const blob = new Blob([csvArray], { type: 'text/csv;charset=utf-8' });
	saveAs(blob, `${fileName}.csv`);
}
