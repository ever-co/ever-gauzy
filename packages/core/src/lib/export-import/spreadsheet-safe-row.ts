// cspell:ignore unneutralize
import { neutralizeSpreadsheetCell, unneutralizeSpreadsheetCell } from '@gauzy/utils';

/**
 * Makes one export cell safe to open in a spreadsheet (GHSA-7xp5-j564-4752).
 *
 * Strings go through {@link neutralizeSpreadsheetCell}. Non-strings need care: `csv-writer` writes
 * every non-empty value as `String(value)`, so a `simple-array` / `jsonb` array holding `['=cmd']`
 * would reach the file as the cell text `=cmd` behind a `typeof value === 'string'` check. For such
 * objects the text `csv-writer` is about to write is checked instead, and replaced by its escaped
 * form only when it needs one — otherwise the original value is passed through so the bytes of every
 * harmless cell stay exactly what they were.
 *
 * Numbers, booleans, `null`/`undefined` and `Date`s are returned as they are: none of them can
 * stringify to a formula (a negative number is still a number, and a `Date` prints as a weekday).
 *
 * @param value - One hydrated column value.
 * @returns The value to hand to `csv-writer`.
 */
export function toSpreadsheetSafeCsvValue(value: unknown): unknown {
	if (typeof value === 'string') {
		return neutralizeSpreadsheetCell(value);
	}
	if (value === null || typeof value !== 'object' || value instanceof Date) {
		return value;
	}

	let text: string;
	try {
		text = String(value);
	} catch {
		// `csv-writer` would throw on this value itself (e.g. a null-prototype object); leave it to do so.
		return value;
	}
	const safe = neutralizeSpreadsheetCell(text);
	return safe === text ? value : safe;
}

/**
 * Applies {@link toSpreadsheetSafeCsvValue} to every value of one row, keeping its keys and their order
 * (the CSV header is built from the first row's keys).
 *
 * @param row - One plain row about to be written.
 * @returns A new row; the input is not modified.
 */
export function toSpreadsheetSafeCsvRow(row: Record<string, unknown>): Record<string, unknown> {
	const safe: Record<string, unknown> = {};
	for (const key of Object.keys(row)) {
		safe[key] = toSpreadsheetSafeCsvValue(row[key]);
	}
	return safe;
}

/**
 * Undoes {@link toSpreadsheetSafeCsvRow} on one row parsed back out of an export CSV, so that
 * export → import round-trips exactly. `csv-parser` yields strings only.
 *
 * Note: an archive made before the escape existed that holds a value such as `'=x` (a literal quote
 * followed by a formula trigger) loses that one leading quote on import; `'Twas` and `'-12` do not.
 *
 * @param row - One row as parsed by `csv-parser`.
 * @returns A new row with the escape removed from every value that carries it.
 */
export function fromSpreadsheetSafeCsvRow<T extends Record<string, unknown>>(row: T): T {
	if (!row || typeof row !== 'object') {
		return row;
	}
	const original: Record<string, unknown> = {};
	for (const key of Object.keys(row)) {
		original[key] = unneutralizeSpreadsheetCell(row[key]);
	}
	return original as T;
}
