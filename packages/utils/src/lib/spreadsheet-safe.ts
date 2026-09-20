/**
 * Spreadsheet-safe cell encoding (CSV / formula injection, CWE-1236).
 *
 * Excel, LibreOffice and Google Sheets evaluate a cell as a formula when its text starts with one of
 * `= + - @`, a tab or a carriage return — and they do so even when the CSV field is quoted, because
 * the quotes are CSV syntax and are stripped before the cell is interpreted. Stored free text that a
 * low-privileged user wrote (a tag name, a task title, their own first name) is therefore executed
 * when an admin opens an export: a live `=HYPERLINK(...)` exfiltration link, a `WEBSERVICE` fetch,
 * or DDE on legacy Excel (GHSA-7xp5-j564-4752).
 *
 * The defence is the OWASP one: prefix such a cell with a single quote, which every spreadsheet
 * treats as "this cell is text". A value that already starts with a quote is prefixed too, so that
 * {@link unneutralizeSpreadsheetCell} can undo the escape exactly and a Gauzy export → import
 * round-trips byte for byte.
 */

/**
 * Leading characters a spreadsheet may treat as the start of a formula, plus their full-width
 * (U+FFxx) forms, which some locales / IMEs produce and which Excel normalises to the ASCII ones.
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r＝＋－＠]/;

/**
 * A strictly numeric string. `-12.50` (a PostgreSQL `numeric` hydrates as a string) must stay a
 * number in the spreadsheet, and a leading sign on a plain number cannot start a formula. Anchored
 * on both ends so `-1+1` or `-2+3+cmd|' /C calc'!A0` are NOT numeric and still get escaped.
 */
const STRICTLY_NUMERIC = /^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/;

/** The escape prefix. */
const ESCAPE = "'";

/**
 * Whether `value` needs the escape prefix: it starts with a formula trigger and is not a plain
 * number, or it starts with the escape character itself (so the escape stays reversible).
 */
function needsNeutralization(value: string): boolean {
	if (value.startsWith(ESCAPE)) {
		return true;
	}
	return FORMULA_TRIGGER.test(value) && !STRICTLY_NUMERIC.test(value);
}

/**
 * Makes one cell value safe to open in a spreadsheet.
 *
 * - Strings starting with `=`, `+`, `-`, `@`, tab, carriage return (or the full-width `＝ ＋ － ＠`),
 *   or with a single quote, are prefixed with `'`.
 * - Strictly numeric strings such as `-12.50` or `+3` are returned unchanged.
 * - Every other value — including non-strings — is returned unchanged.
 *
 * @param value - The raw cell value.
 * @returns The value to write into the CSV cell.
 */
export function neutralizeSpreadsheetCell<T>(value: T): T | string {
	if (typeof value !== 'string' || !needsNeutralization(value)) {
		return value;
	}
	return ESCAPE + value;
}

/**
 * Exact inverse of {@link neutralizeSpreadsheetCell}: removes the escape prefix only when
 * `neutralizeSpreadsheetCell` would have added it, i.e. when the text after the quote would itself
 * be escaped. Any other leading quote (for example `'Twas` in an archive made before the escape
 * existed) is left alone.
 *
 * @param value - A cell value read back from a CSV.
 * @returns The original value.
 */
export function unneutralizeSpreadsheetCell<T>(value: T): T | string {
	if (typeof value !== 'string' || !value.startsWith(ESCAPE)) {
		return value;
	}
	const rest = value.slice(ESCAPE.length);
	return needsNeutralization(rest) ? rest : value;
}
