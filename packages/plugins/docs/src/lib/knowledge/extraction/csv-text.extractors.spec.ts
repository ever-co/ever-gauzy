import { CSV_MAX_ROWS, CsvExtractor, detectDelimiter, parseCsv } from './csv.extractor';
import { TextExtractor } from './text.extractor';

describe('CsvExtractor', () => {
	const extractor = new CsvExtractor();

	it('renders a comma CSV as one pipe table under the sheet locator heading', async () => {
		const csv = Buffer.from('name,amount\nAcme,120\n"Smith, Jones",45\n');
		const result = await extractor.extract(csv, { filename: 'invoices.csv', mimeType: 'text/csv' });

		expect(result.markdown).toContain('## Sheet: invoices');
		expect(result.markdown).toContain('| name | amount |');
		expect(result.markdown).toContain('| --- | --- |');
		expect(result.markdown).toContain('| Acme | 120 |');
		// A quoted field keeps its embedded delimiter.
		expect(result.markdown).toContain('| Smith, Jones | 45 |');
		expect(result.metadata.pageCount).toBe(1);
	});

	it('auto-detects semicolon and tab delimiters', () => {
		expect(detectDelimiter('a;b;c\n1;2;3\n')).toBe(';');
		expect(detectDelimiter('a\tb\tc\n1\t2\t3\n')).toBe('\t');
		expect(detectDelimiter('a,b,c\n1,2,3\n')).toBe(',');
	});

	it('handles escaped quotes and pipes safely', async () => {
		const csv = Buffer.from('col,n\n"say ""hi""",1\nvalue|with|pipes,2\n');
		const result = await extractor.extract(csv, { filename: 'quotes.csv', mimeType: 'text/csv' });
		expect(result.markdown).toContain('say "hi"');
		// Pipes inside cells are escaped so the table structure survives.
		expect(result.markdown).toContain('value\\|with\\|pipes');
	});

	it('caps rows with a visible truncation note', async () => {
		const lines = ['id,value', ...Array.from({ length: CSV_MAX_ROWS + 50 }, (_, i) => `${i},v${i}`)];
		const csv = Buffer.from(lines.join('\n'));
		const result = await extractor.extract(csv, { filename: 'big.csv', mimeType: 'text/csv' });
		expect(result.markdown).toContain(`_Truncated: only the first ${CSV_MAX_ROWS} rows are shown._`);
		expect(result.metadata.truncated).toBe(true);
	});

	it('parseCsv is pure and deterministic', () => {
		const a = parseCsv('x,y\n1,2\n', ',', 10);
		const b = parseCsv('x,y\n1,2\n', ',', 10);
		expect(a).toEqual(b);
		expect(a.rows).toEqual([
			['x', 'y'],
			['1', '2']
		]);
	});
});

describe('TextExtractor', () => {
	const extractor = new TextExtractor();

	it('passes markdown through with heading structure intact', async () => {
		const md = Buffer.from('# Title\n\n## Section\n\nBody text here.\n');
		const result = await extractor.extract(md, { filename: 'readme.md', mimeType: 'text/markdown' });
		expect(result.markdown).toContain('# Title');
		expect(result.markdown).toContain('## Section');
		expect(result.metadata.wordCount).toBeGreaterThan(0);
	});

	it('normalizes CRLF to LF and strips NUL bytes and BOM', async () => {
		const raw = Buffer.concat([
			Buffer.from([0xef, 0xbb, 0xbf]), // UTF-8 BOM
			Buffer.from('line one\r\nline'),
			Buffer.from([0x00]),
			Buffer.from(' two\r\n')
		]);
		const result = await extractor.extract(raw, { filename: 'notes.txt', mimeType: 'text/plain' });
		expect(result.markdown).toBe('line one\nline two');
	});

	it('honors the maxChars cap with a truncation note at a line boundary', async () => {
		const text = Buffer.from(Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n'));
		const result = await extractor.extract(text, {
			filename: 'long.txt',
			mimeType: 'text/plain',
			maxChars: 120
		});
		expect(result.metadata.truncated).toBe(true);
		expect(result.markdown).toContain('_Truncated:');
		expect(result.markdown.indexOf('_Truncated:')).toBeLessThan(200);
	});

	it('supports txt and md MIME types only', () => {
		expect(extractor.supports('text/plain')).toBe(true);
		expect(extractor.supports('text/markdown')).toBe(true);
		expect(extractor.supports('text/csv')).toBe(false);
		expect(extractor.supports('text/html')).toBe(false);
	});
});
