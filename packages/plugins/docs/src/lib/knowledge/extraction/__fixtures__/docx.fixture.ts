/**
 * DOCX fixture (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`).
 *
 * A `.docx` is an OPC (ZIP) package, so the fixture is assembled at test time from
 * readable WordprocessingML through {@link createStoredZip} — the document body below is
 * the actual source of truth for what the extractor should produce, and a reviewer can
 * see it without unzipping a committed binary.
 *
 * Covers the constructs the implementation plan calls for: heading hierarchy and a table
 * (both a `<w:tblHeader/>` header-row table and a plain one, since Word emits both and
 * they take different paths through the markdown converter).
 */
import { createStoredZip } from './zip.util';

/** OPC content-type map — the minimum a WordprocessingML reader requires. */
const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

/** Package relationships — points the reader at the main document part. */
const PACKAGE_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

/**
 * Named paragraph styles. Declaring them keeps the conversion warning-free, which lets
 * the spec assert that a clean document produces **no** extraction warnings.
 */
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${W_NS}>
${[1, 2, 3]
	.map(
		(level) =>
			`<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/></w:style>`
	)
	.join('\n')}
</w:styles>`;

/** The `<w:pPr>` block naming a paragraph style; empty for an unstyled paragraph. */
const paragraphProperties = (style?: string): string =>
	style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';

/** A paragraph with an optional named style and optional run properties. */
const paragraph = (text: string, style?: string, runProperties = ''): string =>
	`<w:p>${paragraphProperties(style)}` +
	`<w:r>${runProperties}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

/** A table cell wrapping a single paragraph (Word never puts bare text in a `<w:tc>`). */
const cell = (text: string): string => `<w:tc><w:tcPr/>${paragraph(text)}</w:tc>`;

/** A table row; `header` marks it as a repeating header row (`<w:tblHeader/>`). */
const row = (cells: string[], header = false): string =>
	`<w:tr>${header ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells.map(cell).join('')}</w:tr>`;

/** A table with a grid of the given width. */
const table = (rows: string[], columns: number): string =>
	`<w:tbl><w:tblPr/><w:tblGrid>${'<w:gridCol/>'.repeat(columns)}</w:tblGrid>${rows.join('')}</w:tbl>`;

const DOCUMENT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${W_NS}><w:body>
${paragraph('Employee Handbook')}
${paragraph('Onboarding', 'Heading1')}
${paragraph('Every new hire completes the onboarding checklist during their first week.')}
${paragraph('Equipment', 'Heading2')}
${paragraph('Laptops are issued by the IT team on day one.', undefined, '<w:rPr><w:b/></w:rPr>')}
${paragraph('Return requests go to the office manager.', undefined, '<w:rPr><w:i/></w:rPr>')}
${table([row(['Item', 'Owner', 'Due'], true), row(['Laptop', 'IT', 'Day 1']), row(['Badge', 'Office', 'Day 2'])], 3)}
${paragraph('Policies', 'Heading2')}
${paragraph('Expense limits are listed below.')}
${table([row(['Meals', '40 USD']), row(['Travel', '600 USD'])], 2)}
${paragraph('Questions go to people@ever.co.')}
</w:body></w:document>`;

/**
 * Builds the canonical DOCX fixture: a lead paragraph, two heading levels, bold/italic
 * runs, a table **with** a header row and a table **without** one, and a closing
 * paragraph.
 */
export function createDocxFixture(): Buffer {
	return createStoredZip([
		{ name: '[Content_Types].xml', data: CONTENT_TYPES },
		{ name: '_rels/.rels', data: PACKAGE_RELS },
		{ name: 'word/document.xml', data: DOCUMENT },
		{ name: 'word/styles.xml', data: STYLES }
	]);
}

/**
 * A legacy binary `.doc` (OLE2 compound-file magic, not a ZIP). The extractor rejects it
 * on the signature check before mammoth is ever invoked.
 */
export function createLegacyDocFixture(): Buffer {
	return Buffer.concat([
		Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
		Buffer.alloc(64, 0)
	]);
}

/**
 * A ZIP whose parts are not a WordprocessingML package — the signature check passes but
 * mammoth cannot read it, which is the corrupt-docx permanent-failure path.
 */
export function createCorruptDocxFixture(): Buffer {
	return createStoredZip([{ name: 'readme.txt', data: 'not an OOXML package' }]);
}
