/**
 * PPTX fixture (`application/vnd.openxmlformats-officedocument.presentationml.presentation`).
 *
 * A `.pptx` is an OPC (ZIP) package, so — exactly like the DOCX fixture — the deck is assembled
 * at test time from readable PresentationML through {@link createStoredZip}, and the markup
 * below is the source of truth for what the extractor should produce.
 *
 * The deck is built to exercise the three things that can silently go wrong:
 *
 * 1. **Slide order.** `slide1.xml` is the SECOND slide of the deck. PowerPoint keeps a slide's
 *    original part name when the deck is reordered, so an extractor that sorts by file name
 *    numbers every `## Page N` citation wrongly. `<p:sldIdLst>` is authoritative.
 * 2. **Notes association.** The notes part is `notesSlide1.xml` but belongs to `slide2.xml`,
 *    reached only through that slide's relationships — matching numbers would attach the notes
 *    to the wrong slide.
 * 3. **Page furniture.** A slide-number placeholder must not become extracted text.
 */
import { createStoredZip } from './zip.util';

const A_NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const P_NS = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const R_NS = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/** OPC content-type map — the minimum a PresentationML reader requires. */
const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
</Types>`;

/** Package relationships — points the reader at the presentation part. */
const PACKAGE_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;

/**
 * The deck's slide list. `rId2` (→ `slide2.xml`) comes FIRST: this is a reordered deck, which is
 * the case a file-name sort gets wrong.
 */
const PRESENTATION = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation ${P_NS} ${R_NS}>
<p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId1"/></p:sldIdLst>
</p:presentation>`;

const PRESENTATION_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
</Relationships>`;

/** `slide2.xml` owns the notes part, and it is numbered `notesSlide1.xml`. */
const SLIDE2_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"/>
</Relationships>`;

/** A run of text inside a paragraph. */
const run = (text: string): string => `<a:r><a:rPr lang="en-US"/><a:t>${text}</a:t></a:r>`;

/** A text paragraph; `lines` become separate `<a:p>` elements. */
const paragraphs = (lines: string[]): string => lines.map((line) => `<a:p>${run(line)}</a:p>`).join('');

/** A shape carrying a text body under the given placeholder type. */
const shape = (placeholder: string, lines: string[]): string =>
	`<p:sp><p:nvSpPr><p:cNvPr id="2" name="${placeholder}"/><p:cNvSpPr/>` +
	`<p:nvPr><p:ph type="${placeholder}" idx="1"/></p:nvPr></p:nvSpPr>` +
	`<p:spPr/><p:txBody><a:bodyPr/>${paragraphs(lines)}</p:txBody></p:sp>`;

/** A table cell wrapping a single paragraph (DrawingML never puts bare text in a `<a:tc>`). */
const tableCell = (text: string): string => `<a:tc><a:txBody><a:bodyPr/><a:p>${run(text)}</a:p></a:txBody></a:tc>`;

/** A DrawingML table inside the graphic frame PowerPoint wraps every table in. */
const table = (rows: string[][]): string =>
	`<p:graphicFrame><p:nvGraphicFramePr/><a:graphic><a:graphicData>` +
	`<a:tbl><a:tblPr/>${rows.map((cells) => `<a:tr>${cells.map(tableCell).join('')}</a:tr>`).join('')}</a:tbl>` +
	`</a:graphicData></a:graphic></p:graphicFrame>`;

/** Wraps a shape tree in the slide envelope. */
const slide = (body: string): string =>
	`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld ${A_NS} ${P_NS} ${R_NS}><p:cSld><p:spTree>${body}</p:spTree></p:cSld></p:sld>`;

/** The deck's SECOND slide (part name `slide1.xml`). */
const SLIDE_1 = slide(
	shape('title', ['Next Quarter']) +
		shape('body', ['Ship the Documents hub', 'Hire two engineers']) +
		// Page furniture: must never appear in the extracted text.
		`<p:sp><p:nvSpPr><p:cNvPr id="9" name="slide number"/><p:cNvSpPr/><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr>` +
		`<p:spPr/><p:txBody><a:bodyPr/><a:p><a:fld id="{1}" type="slidenum"><a:t>2</a:t></a:fld></a:p></p:txBody></p:sp>`
);

/** The deck's FIRST slide (part name `slide2.xml`), the one that owns the speaker notes. */
const SLIDE_2 = slide(
	shape('title', ['Quarterly Review']) +
		shape('body', ['Revenue grew 12%', 'Headcount stayed flat']) +
		table([
			['Region', 'Revenue'],
			['EMEA', '1.2M'],
			['APAC', '0.8M']
		])
);

const NOTES_SLIDE_1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notesSlide ${A_NS} ${P_NS}><p:cSld><p:spTree>
<p:sp><p:nvSpPr><p:cNvPr id="2" name="slide image"/><p:cNvSpPr/><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>
${shape('body', ['Mention the hiring freeze.', 'Keep this to five minutes.'])}
</p:spTree></p:cSld></p:notesSlide>`;

/**
 * Builds the canonical PPTX fixture: a two-slide deck whose part numbering is deliberately the
 * reverse of its presentation order, with a table, a slide-number placeholder and speaker notes.
 */
export function createPptxFixture(): Buffer {
	return createStoredZip([
		{ name: '[Content_Types].xml', data: CONTENT_TYPES },
		{ name: '_rels/.rels', data: PACKAGE_RELS },
		{ name: 'ppt/presentation.xml', data: PRESENTATION },
		{ name: 'ppt/_rels/presentation.xml.rels', data: PRESENTATION_RELS },
		{ name: 'ppt/slides/slide1.xml', data: SLIDE_1 },
		{ name: 'ppt/slides/slide2.xml', data: SLIDE_2 },
		{ name: 'ppt/slides/_rels/slide2.xml.rels', data: SLIDE2_RELS },
		{ name: 'ppt/notesSlides/notesSlide1.xml', data: NOTES_SLIDE_1 }
	]);
}

/**
 * A deck with no `<p:sldIdLst>` and no presentation relationships — the fallback path, where the
 * extractor has nothing to go on but the part numbering.
 */
export function createUnorderedPptxFixture(): Buffer {
	return createStoredZip([
		{ name: '[Content_Types].xml', data: CONTENT_TYPES },
		{ name: '_rels/.rels', data: PACKAGE_RELS },
		{ name: 'ppt/slides/slide1.xml', data: SLIDE_1 },
		{ name: 'ppt/slides/slide2.xml', data: SLIDE_2 }
	]);
}

/**
 * A ZIP with no slide parts — the signature check passes, but there is nothing to extract, which
 * is the corrupt-presentation permanent-failure path.
 */
export function createSlidelessPptxFixture(): Buffer {
	return createStoredZip([{ name: '[Content_Types].xml', data: CONTENT_TYPES }]);
}
