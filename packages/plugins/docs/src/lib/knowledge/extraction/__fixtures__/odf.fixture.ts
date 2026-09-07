/**
 * OpenDocument fixtures (`application/vnd.oasis.opendocument.{text,spreadsheet}`).
 *
 * An `.odt` / `.ods` is a ZIP package whose only part that matters to extraction is
 * `content.xml`, so the fixtures are assembled at test time from readable OpenDocument markup
 * through {@link createStoredZip} — the same reviewability rule as the DOCX and PPTX fixtures.
 *
 * The spreadsheet fixture deliberately uses `table:number-columns-repeated` and
 * `table:number-rows-repeated`, because that is how every real writer pads a sheet out to its
 * full grid: an extractor that expands those counts literally allocates sixteen thousand columns
 * and a million rows for a three-cell sheet.
 */
import { createStoredZip } from './zip.util';

const OFFICE_NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"';
const TEXT_NS = 'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"';
const TABLE_NS = 'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"';

/** The `mimetype` entry every OpenDocument package carries first, uncompressed. */
const mimetypeEntry = (mimeType: string) => ({ name: 'mimetype', data: mimeType });

/** Package manifest — not read by the extractor, present so the fixture is a real package. */
const manifest = (mimeType: string) => `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">
<manifest:file-entry manifest:full-path="/" manifest:media-type="${mimeType}"/>
<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;

/** A heading at the given outline level. */
const heading = (level: number, text: string): string =>
	`<text:h text:style-name="Heading_20_${level}" text:outline-level="${level}">${text}</text:h>`;

/** A body paragraph. */
const paragraph = (text: string): string => `<text:p text:style-name="Standard">${text}</text:p>`;

/** A bullet list from plain strings. */
const list = (items: string[]): string =>
	`<text:list text:style-name="L1">${items
		.map((item) => `<text:list-item>${paragraph(item)}</text:list-item>`)
		.join('')}</text:list>`;

/** A text-document table (cells hold paragraphs, never bare text). */
const textTable = (name: string, rows: string[][]): string =>
	`<table:table table:name="${name}">${rows
		.map(
			(cells) =>
				`<table:table-row>${cells
					.map((cell) => `<table:table-cell office:value-type="string">${paragraph(cell)}</table:table-cell>`)
					.join('')}</table:table-row>`
		)
		.join('')}</table:table>`;

const TEXT_CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${OFFICE_NS} ${TEXT_NS} ${TABLE_NS} office:version="1.3">
<office:body><office:text>
${heading(1, 'Travel Policy')}
${paragraph('Book travel at least fourteen days in advance.')}
${heading(2, 'Reimbursement')}
${paragraph('File the claim with a receipt attached.')}
${list(['Meals up to 40 USD per day', 'Rail before air on domestic trips'])}
${textTable('Limits', [
	['Category', 'Limit'],
	['Meals', '40 USD'],
	['Hotel', '180 USD']
])}
${paragraph('Questions go to finance@ever.co.')}
</office:text></office:body></office:document-content>`;

/**
 * Builds the canonical `.odt` fixture: two heading levels, paragraphs, a bullet list and a
 * table, in an order that only survives a document-order walk.
 */
export function createOdtFixture(): Buffer {
	return createStoredZip([
		mimetypeEntry('application/vnd.oasis.opendocument.text'),
		{ name: 'META-INF/manifest.xml', data: manifest('application/vnd.oasis.opendocument.text') },
		{ name: 'content.xml', data: TEXT_CONTENT }
	]);
}

/** A spreadsheet cell holding a string value. */
const cell = (text: string, repeated?: number): string =>
	`<table:table-cell office:value-type="string"${
		repeated ? ` table:number-columns-repeated="${repeated}"` : ''
	}>${paragraph(text)}</table:table-cell>`;

/** An empty cell, optionally repeated — this is the grid padding real writers emit. */
const emptyCell = (repeated: number): string => `<table:table-cell table:number-columns-repeated="${repeated}"/>`;

/** A spreadsheet row from pre-rendered cell markup. */
const sheetRow = (cells: string, repeated?: number): string =>
	`<table:table-row${repeated ? ` table:number-rows-repeated="${repeated}"` : ''}>${cells}</table:table-row>`;

/**
 * Two sheets. `Q3` carries the grid padding a real writer emits — a trailing run of 16 381 empty
 * columns and a trailing run of 1 048 573 empty rows — which must contribute NOTHING.
 */
const SPREADSHEET_CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${OFFICE_NS} ${TEXT_NS} ${TABLE_NS} office:version="1.3">
<office:body><office:spreadsheet>
<table:table table:name="Q3">
<table:table-column table:number-columns-repeated="16384"/>
${sheetRow(cell('Region') + cell('Revenue') + cell('Owner') + emptyCell(16381))}
${sheetRow(cell('EMEA') + cell('1.2M') + cell('Ada') + emptyCell(16381))}
${sheetRow(cell('APAC') + cell('0.8M') + cell('Grace') + emptyCell(16381))}
${sheetRow(emptyCell(16384), 1048573)}
</table:table>
<table:table table:name="Notes">
${sheetRow(cell('Comment'))}
${sheetRow(cell('Numbers are unaudited'))}
</table:table>
<table:table table:name="Empty">
${sheetRow(emptyCell(16384), 1048576)}
</table:table>
</office:spreadsheet></office:body></office:document-content>`;

/**
 * Builds the canonical `.ods` fixture: two populated sheets, one entirely empty sheet, and the
 * repeat-count padding a real writer emits.
 */
export function createOdsFixture(): Buffer {
	return createStoredZip([
		mimetypeEntry('application/vnd.oasis.opendocument.spreadsheet'),
		{ name: 'META-INF/manifest.xml', data: manifest('application/vnd.oasis.opendocument.spreadsheet') },
		{ name: 'content.xml', data: SPREADSHEET_CONTENT }
	]);
}

/**
 * An `.ods` whose single sheet has more rows than the per-sheet cap, so the truncation note and
 * the warning can be asserted.
 *
 * @param rowCount How many populated rows to emit.
 */
export function createOversizedOdsFixture(rowCount: number): Buffer {
	const rows = Array.from({ length: rowCount }, (_value, index) =>
		sheetRow(cell(`Row ${index + 1}`) + cell(String(index + 1)))
	).join('\n');

	const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content ${OFFICE_NS} ${TEXT_NS} ${TABLE_NS} office:version="1.3">
<office:body><office:spreadsheet>
<table:table table:name="Big">
${rows}
</table:table>
</office:spreadsheet></office:body></office:document-content>`;

	return createStoredZip([
		mimetypeEntry('application/vnd.oasis.opendocument.spreadsheet'),
		{ name: 'content.xml', data: content }
	]);
}

/**
 * A ZIP with no `content.xml` — the signature check passes but there is nothing to read, which
 * is the corrupt-package permanent-failure path.
 */
export function createContentlessOdfFixture(): Buffer {
	return createStoredZip([mimetypeEntry('application/vnd.oasis.opendocument.text')]);
}

/** Bytes that are not a ZIP at all (an OLE2 header), for the not-an-office-package path. */
export function createNonZipOfficeFixture(): Buffer {
	return Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(64, 0)]);
}
