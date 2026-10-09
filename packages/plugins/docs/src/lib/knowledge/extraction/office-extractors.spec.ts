// Stubbed at the module boundary: the OCR service reaches the AI seam and the whole
// `@gauzy/core` graph. These tests assert PARSING of the two formats this plugin parses itself.
jest.mock('./document-ocr.service', () => ({ DocumentOcrService: class {} }));

import { DocsPermanentError } from '../errors';
import {
	createContentlessOdfFixture,
	createNonZipOfficeFixture,
	createOdsFixture,
	createOdtFixture,
	createOversizedOdsFixture,
	createPptxFixture,
	createSlidelessPptxFixture,
	createStoredZip,
	createUnorderedPptxFixture
} from './__fixtures__';
import { CsvExtractor } from './csv.extractor';
import { DocxExtractor } from './docx.extractor';
import { ExtractionRegistryService } from './extraction-registry.service';
import { HtmlExtractor } from './html.extractor';
import { ImageExtractor } from './image.extractor';
import { ODS_MIME_TYPE, ODT_MIME_TYPE, OdfExtractor } from './odf.extractor';
import { openOfficePackage } from './office-package.util';
import { attribute, findAll, parseXml, textContent } from './office-xml.util';
import { PdfExtractor } from './pdf.extractor';
import { PPTX_MIME_TYPE, PptxExtractor } from './pptx.extractor';
import { TextExtractor } from './text.extractor';
import { XLSX_MAX_ROWS_PER_SHEET, XlsxExtractor } from './xlsx.extractor';

/**
 * `.pptx` / `.odt` / `.ods` extraction (07 §4 row 9).
 *
 * These three MIME types were accepted by `DOCS_ACCEPTED_TYPES` and validated by the file
 * sniffer, but no provider claimed them — so the registry threw `DocsPermanentError` and EVERY
 * such upload landed on `status=FAILED`. A type that is accepted and then guaranteed to fail is
 * worse than one that is rejected at the door, so these extractors close the gap.
 *
 * Both formats are parsed first-party (no archive or XML library in the dependency tree), which
 * puts three things under test that a library would normally own: the ZIP container reader, the
 * XML reader's hardening, and the format-specific ordering rules.
 */

const CTX = { maxChars: 500_000 };

describe('PptxExtractor', () => {
	const extractor = new PptxExtractor();
	const extract = (bytes: Buffer) => extractor.extract(bytes, { ...CTX, filename: 'deck.pptx', mimeType: PPTX_MIME_TYPE });

	it('claims only the PresentationML MIME', () => {
		expect(extractor.supports(PPTX_MIME_TYPE)).toBe(true);
		expect(extractor.supports('application/vnd.oasis.opendocument.presentation')).toBe(false);
	});

	it('emits one `## Page N` locator per slide with the slide text under it', async () => {
		const result = await extract(createPptxFixture());

		expect(result.metadata.pageCount).toBe(2);
		expect(result.markdown).toContain('## Page 1');
		expect(result.markdown).toContain('## Page 2');
		expect(result.markdown).toContain('Quarterly Review');
		expect(result.markdown).toContain('Revenue grew 12%');
		expect(result.metadata.truncated).toBe(false);
	});

	/**
	 * The defect a file-name sort produces: PowerPoint keeps a slide's original part name when
	 * the deck is reordered, so `slide1.xml` is the fixture's SECOND slide. Every `## Page N`
	 * citation depends on getting this right.
	 */
	it('orders slides by the presentation slide list, not by part name', async () => {
		const result = await extract(createPptxFixture());

		expect(result.markdown.indexOf('Quarterly Review')).toBeLessThan(result.markdown.indexOf('Next Quarter'));
		expect(result.markdown.indexOf('## Page 2')).toBeLessThan(result.markdown.indexOf('Next Quarter'));
	});

	it('falls back to part order when the deck declares no slide list', async () => {
		const result = await extract(createUnorderedPptxFixture());

		expect(result.metadata.pageCount).toBe(2);
		expect(result.markdown.indexOf('Next Quarter')).toBeLessThan(result.markdown.indexOf('Quarterly Review'));
	});

	it('renders a slide table as a pipe table', async () => {
		const result = await extract(createPptxFixture());

		expect(result.markdown).toContain('| Region | Revenue |');
		expect(result.markdown).toContain('| EMEA | 1.2M |');
	});

	it('renders speaker notes as a `> Notes:` blockquote on the slide that owns them', async () => {
		const result = await extract(createPptxFixture());

		expect(result.markdown).toContain('> Notes: Mention the hiring freeze.');
		expect(result.markdown).toContain('> Keep this to five minutes.');
		// The notes part is `notesSlide1.xml` but belongs to `slide2.xml` — i.e. page 2 of the
		// deck's ORDER is "Next Quarter", and the notes must not have landed there.
		expect(result.markdown.indexOf('> Notes:')).toBeLessThan(result.markdown.indexOf('## Page 2'));
	});

	it('drops page furniture rather than extracting it as content', async () => {
		const result = await extract(createPptxFixture());

		// The slide-number placeholder's only text is "2".
		expect(result.markdown.split('\n')).not.toContain('2');
	});

	it('rejects a package with no slides as a permanent failure', async () => {
		await expect(extract(createSlidelessPptxFixture())).rejects.toBeInstanceOf(DocsPermanentError);
	});

	it('rejects bytes that are not an office package as a permanent failure', async () => {
		await expect(extract(createNonZipOfficeFixture())).rejects.toBeInstanceOf(DocsPermanentError);
	});

	it('applies the extracted-markdown size cap', async () => {
		const result = await extractor.extract(createPptxFixture(), {
			filename: 'deck.pptx',
			mimeType: PPTX_MIME_TYPE,
			maxChars: 40
		});

		expect(result.metadata.truncated).toBe(true);
		expect(result.markdown).toContain('_Truncated:');
	});
});

describe('OdfExtractor', () => {
	const extractor = new OdfExtractor();

	it('claims both OpenDocument MIMEs and nothing else', () => {
		expect(extractor.supports(ODT_MIME_TYPE)).toBe(true);
		expect(extractor.supports(ODS_MIME_TYPE)).toBe(true);
		expect(extractor.supports('application/vnd.oasis.opendocument.presentation')).toBe(false);
	});

	describe('.odt', () => {
		const extract = (bytes: Buffer) =>
			extractor.extract(bytes, { ...CTX, filename: 'policy.odt', mimeType: ODT_MIME_TYPE });

		it('renders headings at their own outline level', async () => {
			const result = await extract(createOdtFixture());

			expect(result.markdown).toContain('# Travel Policy');
			expect(result.markdown).toContain('## Reimbursement');
		});

		/**
		 * Document ORDER is the property under test. A `findAll`-style walk would emit every
		 * heading, then every paragraph, then every table — putting each section's body under the
		 * wrong heading and making the extracted text actively misleading.
		 */
		it('keeps body content in document order', async () => {
			const result = await extract(createOdtFixture());

			expect(result.markdown.indexOf('# Travel Policy')).toBeLessThan(
				result.markdown.indexOf('Book travel at least fourteen days in advance.')
			);
			expect(result.markdown.indexOf('Book travel at least fourteen days in advance.')).toBeLessThan(
				result.markdown.indexOf('## Reimbursement')
			);
			expect(result.markdown.indexOf('## Reimbursement')).toBeLessThan(result.markdown.indexOf('| Category |'));
		});

		it('renders list items as a tight bullet list', async () => {
			const result = await extract(createOdtFixture());

			expect(result.markdown).toContain('- Meals up to 40 USD per day\n- Rail before air on domestic trips');
		});

		it('renders a body table as a pipe table', async () => {
			const result = await extract(createOdtFixture());

			expect(result.markdown).toContain('| Category | Limit |');
			expect(result.markdown).toContain('| Hotel | 180 USD |');
		});

		it('rejects a package with no content part as a permanent failure', async () => {
			await expect(extract(createContentlessOdfFixture())).rejects.toBeInstanceOf(DocsPermanentError);
		});
	});

	describe('.ods', () => {
		const extract = (bytes: Buffer) =>
			extractor.extract(bytes, { ...CTX, filename: 'q3.ods', mimeType: ODS_MIME_TYPE });

		it('emits the `## Sheet: <name>` locator the XLSX extractor emits', async () => {
			const result = await extract(createOdsFixture());

			expect(result.markdown).toContain('## Sheet: Q3');
			expect(result.markdown).toContain('## Sheet: Notes');
		});

		/**
		 * The repeat counts are the whole risk of this format: a writer pads every sheet to
		 * 16 384 columns and 1 048 576 rows, so expanding them literally turns a three-row sheet
		 * into a heap exhaustion — and, short of that, into a table of empty columns.
		 */
		it('treats trailing repeated empty cells and rows as grid padding', async () => {
			const result = await extract(createOdsFixture());

			expect(result.markdown).toContain('| Region | Revenue | Owner |');
			expect(result.markdown).toContain('| EMEA | 1.2M | Ada |');
			// Exactly three columns — no padding leaked into the header row.
			const header = result.markdown.split('\n').find((line) => line.startsWith('| Region'));
			expect(header.split('|').filter((cell) => cell.trim().length > 0)).toHaveLength(3);
		});

		it('counts only sheets that hold data', async () => {
			const result = await extract(createOdsFixture());

			expect(result.metadata.pageCount).toBe(2);
			expect(result.markdown).not.toContain('## Sheet: Empty');
		});

		it('applies the same per-sheet row cap as the XLSX extractor, and says so', async () => {
			const result = await extract(createOversizedOdsFixture(XLSX_MAX_ROWS_PER_SHEET + 100));

			expect(result.markdown).toContain(
				`_Truncated: only the first ${XLSX_MAX_ROWS_PER_SHEET} of ${XLSX_MAX_ROWS_PER_SHEET + 100} rows are shown._`
			);
			expect(result.metadata.warnings[0]).toContain('row cap applied');
			expect(result.markdown).toContain(`| Row ${XLSX_MAX_ROWS_PER_SHEET} |`);
			expect(result.markdown).not.toContain(`| Row ${XLSX_MAX_ROWS_PER_SHEET + 1} |`);
		});
	});
});

describe('ExtractionRegistryService — office coverage', () => {
	const registry = new ExtractionRegistryService(
		new PdfExtractor(),
		new DocxExtractor(),
		new XlsxExtractor(),
		new CsvExtractor(),
		new TextExtractor(),
		new HtmlExtractor(),
		new ImageExtractor(),
		new PptxExtractor(),
		new OdfExtractor()
	);

	/**
	 * The actual gap this work closes: `DOCS_ACCEPTED_TYPES` lists `pptx`, `odt` and `ods`, so
	 * the registry MUST resolve a provider for each — otherwise every such upload is accepted at
	 * the door and then permanently fails in the pipeline.
	 */
	it('resolves a provider for every office MIME the upload endpoint accepts', () => {
		expect(registry.resolve(PPTX_MIME_TYPE, 'deck.pptx')).toBeInstanceOf(PptxExtractor);
		expect(registry.resolve(ODT_MIME_TYPE, 'policy.odt')).toBeInstanceOf(OdfExtractor);
		expect(registry.resolve(ODS_MIME_TYPE, 'q3.ods')).toBeInstanceOf(OdfExtractor);
	});

	it('leaves the pre-existing resolutions untouched', () => {
		expect(registry.resolve('application/pdf', 'a.pdf')).toBeInstanceOf(PdfExtractor);
		expect(registry.resolve('text/csv', 'a.csv')).toBeInstanceOf(CsvExtractor);
		expect(registry.resolve('video/mp4', 'clip.mp4')).toBeNull();
	});
});

describe('openOfficePackage', () => {
	it('reads a stored entry back verbatim', () => {
		const pkg = openOfficePackage(createStoredZip([{ name: 'content.xml', data: '<a>hello</a>' }]));

		expect(pkg.has('content.xml')).toBe(true);
		expect(pkg.readText('content.xml')).toBe('<a>hello</a>');
		expect(pkg.read('missing.xml')).toBeUndefined();
	});

	it('reads a DEFLATE entry (what every real office writer produces)', () => {
		const payload = Buffer.from(`<a>${'compress me '.repeat(200)}</a>`, 'utf8');
		const pkg = openOfficePackage(createDeflatedZip('content.xml', payload));

		expect(pkg.readText('content.xml')).toBe(payload.toString('utf8'));
	});

	it('rejects bytes with no central directory', () => {
		expect(() => openOfficePackage(Buffer.alloc(64, 0x41))).toThrow(DocsPermanentError);
	});

	it('ignores archive members whose names escape the package root', () => {
		const pkg = openOfficePackage(
			createStoredZip([
				{ name: '../escape.xml', data: 'no' },
				{ name: 'content.xml', data: 'yes' }
			])
		);

		expect(pkg.names()).toEqual(['content.xml']);
	});
});

describe('parseXml', () => {
	it('keeps namespace prefixes addressable by local name', () => {
		const root = parseXml('<p:sld xmlns:p="urn:x"><a:t>hi</a:t></p:sld>');

		expect(findAll(root, 't')).toHaveLength(1);
		expect(textContent(findAll(root, 'sld')[0])).toBe('hi');
	});

	it('reads attributes by local name regardless of prefix', () => {
		const root = parseXml('<table:table table:name="Q3"/>');

		expect(attribute(findAll(root, 'table')[0], 'name')).toBe('Q3');
	});

	it('decodes the predefined entities and numeric references, and leaves unknown ones alone', () => {
		const root = parseXml('<t>a &amp; b &#65; &#x42; &nope;</t>');

		expect(textContent(root)).toBe('a & b A B &nope;');
	});

	it('substitutes the elements that stand for a literal', () => {
		const root = parseXml('<p>Name<text:tab/>Role<text:line-break/>next</p>');

		expect(textContent(root, { tab: '\t', 'line-break': '\n' })).toBe('Name\tRole\nnext');
	});

	it('reads CDATA literally', () => {
		const root = parseXml('<t><![CDATA[a & <b>]]></t>');

		expect(textContent(root)).toBe('a & <b>');
	});

	/**
	 * 🛑 The entity-expansion defense. The doctype — internal subset included — is skipped
	 * WHOLE, so a declared entity is never available to expand. A parser that stopped at the
	 * first `>` would leave the subset to be re-parsed as document content, which is exactly the
	 * shape a billion-laughs payload needs.
	 */
	it('never expands an entity declared in the doctype', () => {
		const xml =
			'<?xml version="1.0"?><!DOCTYPE t [<!ENTITY boom "AAAAAAAAAA">]><t>&boom;</t>';
		const root = parseXml(xml);

		expect(textContent(root)).toBe('&boom;');
		expect(textContent(root)).not.toContain('AAAA');
	});

	it('does not treat a `>` inside a quoted attribute value as the end of the tag', () => {
		const root = parseXml('<a:hlinkClick r:id="a>b"/>');

		expect(attribute(findAll(root, 'hlinkClick')[0], 'id')).toBe('a>b');
	});

	it('rejects an unterminated tag as a permanent failure', () => {
		expect(() => parseXml('<t><unterminated')).toThrow(DocsPermanentError);
	});
});

/**
 * Builds a one-entry ZIP whose payload is DEFLATE-compressed (method 8) — the fixture writer
 * only produces STORED entries, and real office writers only produce compressed ones.
 */
function createDeflatedZip(name: string, payload: Buffer): Buffer {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const { deflateRawSync } = require('zlib');
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const { crc32 } = require('./__fixtures__/zip.util');
	const compressed = deflateRawSync(payload);
	const nameBytes = Buffer.from(name, 'utf8');
	const crc = crc32(payload);

	const local = Buffer.alloc(30 + nameBytes.length);
	local.writeUInt32LE(0x04034b50, 0);
	local.writeUInt16LE(20, 4);
	local.writeUInt16LE(8, 8); // method: DEFLATE
	local.writeUInt32LE(crc, 14);
	local.writeUInt32LE(compressed.length, 18);
	local.writeUInt32LE(payload.length, 22);
	local.writeUInt16LE(nameBytes.length, 26);
	nameBytes.copy(local, 30);

	const central = Buffer.alloc(46 + nameBytes.length);
	central.writeUInt32LE(0x02014b50, 0);
	central.writeUInt16LE(20, 4);
	central.writeUInt16LE(20, 6);
	central.writeUInt16LE(8, 10); // method: DEFLATE
	central.writeUInt32LE(crc, 16);
	central.writeUInt32LE(compressed.length, 20);
	central.writeUInt32LE(payload.length, 24);
	central.writeUInt16LE(nameBytes.length, 28);
	central.writeUInt32LE(0, 42); // local header offset
	nameBytes.copy(central, 46);

	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(1, 8);
	end.writeUInt16LE(1, 10);
	end.writeUInt32LE(central.length, 12);
	end.writeUInt32LE(local.length + compressed.length, 16);

	return Buffer.concat([local, compressed, central, end]);
}
