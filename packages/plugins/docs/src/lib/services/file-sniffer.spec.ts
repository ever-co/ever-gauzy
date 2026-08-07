import { isMarkupContent, isProbablyUtf8Text, sniffFile, zipHasEntry } from './file-sniffer';

/** Builds a minimal ZIP local-file-header carrying one entry name. */
function zipWithEntry(entryName: string): Buffer {
	const name = Buffer.from(entryName, 'utf8');
	const header = Buffer.alloc(30);
	header.writeUInt32LE(0x04034b50, 0); // PK\x03\x04 (LE)
	header.writeUInt16LE(name.length, 26); // file name length
	header.writeUInt16LE(0, 28); // extra field length
	return Buffer.concat([header, name]);
}

/** Builds an ODF container: `mimetype` entry stored first with the given content. */
function odfContainer(mime: string): Buffer {
	const name = Buffer.from('mimetype', 'utf8');
	const data = Buffer.from(mime, 'utf8');
	const header = Buffer.alloc(30);
	header.writeUInt32LE(0x04034b50, 0);
	header.writeUInt32LE(data.length, 18); // compressed size (STORED)
	header.writeUInt32LE(data.length, 22); // uncompressed size
	header.writeUInt16LE(name.length, 26);
	header.writeUInt16LE(0, 28);
	return Buffer.concat([header, name, data]);
}

describe('file-sniffer', () => {
	describe('binary signatures', () => {
		it('accepts a PDF by %PDF magic', () => {
			const result = sniffFile(Buffer.from('%PDF-1.7 rest-of-file'), 'invoice.pdf', 'application/pdf');
			expect(result.ok).toBe(true);
			expect(result.type.mimeType).toBe('application/pdf');
			expect(result.type.extension).toBe('pdf');
		});

		it('accepts a PNG signature', () => {
			const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
			const result = sniffFile(png, 'logo.png', 'image/png');
			expect(result.ok).toBe(true);
			expect(result.type.mimeType).toBe('image/png');
		});

		it('accepts JPEG under both .jpg and .jpeg', () => {
			const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
			expect(sniffFile(jpg, 'a.jpg').ok).toBe(true);
			expect(sniffFile(jpg, 'a.jpeg').ok).toBe(true);
		});

		it('accepts WEBP (RIFF + WEBP at offset 8)', () => {
			const webp = Buffer.concat([
				Buffer.from('RIFF'),
				Buffer.from([0x10, 0x00, 0x00, 0x00]),
				Buffer.from('WEBP'),
				Buffer.alloc(8)
			]);
			expect(sniffFile(webp, 'pic.webp').ok).toBe(true);
		});

		it('discriminates docx / xlsx / pptx by ZIP internal entries', () => {
			expect(sniffFile(zipWithEntry('word/document.xml'), 'contract.docx').type.extension).toBe('docx');
			expect(sniffFile(zipWithEntry('xl/workbook.xml'), 'sheet.xlsx').type.extension).toBe('xlsx');
			expect(sniffFile(zipWithEntry('ppt/slides/slide1.xml'), 'deck.pptx').type.extension).toBe('pptx');
		});

		it('detects ODF containers by the mimetype entry', () => {
			expect(sniffFile(odfContainer('application/vnd.oasis.opendocument.text'), 'doc.odt').type.extension).toBe(
				'odt'
			);
			expect(
				sniffFile(odfContainer('application/vnd.oasis.opendocument.spreadsheet'), 'calc.ods').type.extension
			).toBe('ods');
		});
	});

	describe('rejections', () => {
		it('rejects a .png-named HTML file (markup masquerading as an image)', () => {
			const result = sniffFile(Buffer.from('<html><body>x</body></html>'), 'evil.png', 'image/png');
			expect(result.ok).toBe(false);
		});

		it('rejects SVG under any name', () => {
			const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
			expect(sniffFile(svg, 'image.svg').ok).toBe(false);
			expect(sniffFile(svg, 'image.svgz').ok).toBe(false);
			// Even renamed to an accepted text extension, markup outside .html is refused.
			expect(sniffFile(svg, 'image.txt').ok).toBe(false);
		});

		it('rejects a banned extension riding an accepted signature', () => {
			const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);
			expect(sniffFile(png, 'picture.svg').ok).toBe(false);
		});

		it('rejects extension/content mismatch', () => {
			const result = sniffFile(Buffer.from('%PDF-1.7 data'), 'invoice.docx');
			expect(result.ok).toBe(false);
			expect(result.code).toBe('DOCS_TYPE_MISMATCH');
		});

		it('rejects a conflicting declared MIME but tolerates octet-stream', () => {
			const pdf = Buffer.from('%PDF-1.7 data');
			expect(sniffFile(pdf, 'a.pdf', 'image/png').ok).toBe(false);
			expect(sniffFile(pdf, 'a.pdf', 'application/octet-stream').ok).toBe(true);
			expect(sniffFile(pdf, 'a.pdf', '').ok).toBe(true);
		});

		it('rejects binary junk with no known signature', () => {
			const junk = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xde, 0xad, 0xbe, 0xef]);
			expect(sniffFile(junk, 'thing.bin').ok).toBe(false);
		});

		it('rejects empty files', () => {
			expect(sniffFile(Buffer.alloc(0), 'empty.txt').ok).toBe(false);
		});
	});

	describe('text heuristic', () => {
		it('accepts plain UTF-8 text as txt/csv/md by extension', () => {
			const text = Buffer.from('hello,world\nfoo,bar\n', 'utf8');
			expect(sniffFile(text, 'data.csv').type.mimeType).toBe('text/csv');
			expect(sniffFile(text, 'notes.txt').type.mimeType).toBe('text/plain');
			expect(sniffFile(Buffer.from('# Title\n\nBody'), 'readme.md').type.mimeType).toBe('text/markdown');
		});

		it('accepts HTML only under the .html/.htm extension', () => {
			const html = Buffer.from('<!doctype html><p>hi</p>');
			expect(sniffFile(html, 'page.html').type.mimeType).toBe('text/html');
			expect(sniffFile(html, 'page.htm').type.mimeType).toBe('text/html');
		});

		it('refuses NUL bytes and UTF-16 BOMs as text', () => {
			expect(isProbablyUtf8Text(Buffer.from([0x68, 0x00, 0x69, 0x00]))).toBe(false);
			expect(isProbablyUtf8Text(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('hi')]))).toBe(false);
		});

		it('accepts multi-byte UTF-8 sequences', () => {
			expect(isProbablyUtf8Text(Buffer.from('naïve — résumé ✓', 'utf8'))).toBe(true);
		});
	});

	describe('isMarkupContent', () => {
		it('flags UTF-16/32 BOMs and leading < after whitespace', () => {
			expect(isMarkupContent(Buffer.from([0xff, 0xfe, 0x3c, 0x00]))).toBe(true);
			expect(isMarkupContent(Buffer.from('   <svg>'))).toBe(true);
			expect(isMarkupContent(Buffer.from('plain text'))).toBe(false);
		});
	});

	describe('zipHasEntry', () => {
		it('finds entry names across local headers', () => {
			const zip = Buffer.concat([zipWithEntry('docProps/core.xml'), zipWithEntry('word/document.xml')]);
			expect(zipHasEntry(zip, (name) => name.startsWith('word/'))).toBe(true);
			expect(zipHasEntry(zip, (name) => name.startsWith('xl/'))).toBe(false);
		});
	});
});
