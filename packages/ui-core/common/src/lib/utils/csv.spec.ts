import {
	buildCsvText,
	CSV_RECORD_SEPARATOR,
	neutralizeSpreadsheetText,
	quoteCsvText,
	toCsvField,
	toCsvRecord
} from './csv';

describe('CSV encoding', () => {
	describe('neutralizeSpreadsheetText', () => {
		it.each(['=1+1', '+A1', '-A1', '@SUM(A1)', '\tx', '\rx', '＝1', '＋1', '－1', '＠x'])(
			'prefixes the formula trigger in %j',
			(value) => {
				expect(neutralizeSpreadsheetText(value)).toBe(`'${value}`);
			}
		);

		it('prefixes a value that already starts with an apostrophe, like the server-side export', () => {
			expect(neutralizeSpreadsheetText("'quoted")).toBe("''quoted");
		});

		it('leaves numbers written as text, and ordinary text, alone', () => {
			expect(neutralizeSpreadsheetText('-12.50')).toBe('-12.50');
			expect(neutralizeSpreadsheetText('+1')).toBe('+1');
			expect(neutralizeSpreadsheetText('+3e5')).toBe('+3e5');
			expect(neutralizeSpreadsheetText('Ada Lovelace')).toBe('Ada Lovelace');
		});
	});

	describe('quoteCsvText', () => {
		it('quotes the text and doubles embedded quotes (RFC 4180)', () => {
			expect(quoteCsvText('say "hi"')).toBe('"say ""hi"""');
		});

		it('keeps a quote-comma breakout inside one field', () => {
			expect(quoteCsvText('x",=1+1,"')).toBe('"x"",=1+1,"""');
		});

		it('keeps line breaks inside the quoted field', () => {
			expect(quoteCsvText('line 1\nline 2')).toBe('"line 1\nline 2"');
		});

		it('neutralizes before quoting', () => {
			expect(quoteCsvText('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
		});
	});

	describe('toCsvField', () => {
		it('writes numbers and booleans bare, so a spreadsheet can sum them', () => {
			expect(toCsvField(12.5)).toBe('12.5');
			expect(toCsvField(-3)).toBe('-3');
			expect(toCsvField(0)).toBe('0');
			expect(toCsvField(true)).toBe('true');
		});

		it('writes a missing value, or a number that is not finite, as an empty field', () => {
			expect(toCsvField(null)).toBe('');
			expect(toCsvField(undefined)).toBe('');
			expect(toCsvField(Number.NaN)).toBe('');
			expect(toCsvField(Number.POSITIVE_INFINITY)).toBe('');
		});

		it('writes a date as its quoted ISO timestamp, and an invalid date as an empty field', () => {
			expect(toCsvField(new Date('2026-10-31T08:00:00.000Z'))).toBe('"2026-10-31T08:00:00.000Z"');
			expect(toCsvField(new Date('not a date'))).toBe('');
		});

		it('quotes text, the empty string included', () => {
			expect(toCsvField('Ada')).toBe('"Ada"');
			expect(toCsvField('')).toBe('""');
		});
	});

	describe('toCsvRecord and buildCsvText', () => {
		it('separates fields with commas and records with CRLF', () => {
			expect(toCsvRecord(['a', 1, null, 'b'])).toBe('"a",1,,"b"');
			expect(
				buildCsvText([
					['Name', 'Hours'],
					['Ada', 1.5]
				])
			).toBe(['"Name","Hours"', '"Ada",1.5'].join(CSV_RECORD_SEPARATOR));
		});

		it('writes nothing for no records', () => {
			expect(buildCsvText([])).toBe('');
		});
	});
});
