/**
 * PDF fixtures (`application/pdf`) built as readable byte strings.
 *
 * A PDF is a plain-text object graph plus a byte-offset cross-reference table, so the
 * whole file can be generated here: the xref offsets are computed while the body is
 * assembled, which keeps the fixture honest (no hand-maintained magic numbers) and lets
 * a reviewer read the page content directly out of the source.
 *
 * Covers the three paths `PdfExtractor` distinguishes:
 * text layer (happy path), no text layer (the scanned heuristic → OCR-not-available),
 * and unreadable input (corrupt / password-protected).
 */

/** A page of the generated PDF: one string per line of text. */
export type PdfPageLines = string[];

/**
 * Escapes a string for a PDF literal-string operand `( … )`.
 */
function escapePdfText(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * Assembles a PDF file from numbered objects, computing the cross-reference offsets.
 *
 * @param objects Sparse array of object bodies — index = object number (index 0 unused).
 * @param trailerExtras Extra key/value pairs merged into the trailer dictionary.
 * @returns The complete PDF bytes (latin1 — PDF syntax is byte-oriented).
 */
function assemblePdf(objects: (string | undefined)[], trailerExtras = ''): Buffer {
	let pdf = '%PDF-1.4\n';
	const offsets: number[] = [];

	for (let n = 1; n < objects.length; n++) {
		offsets[n] = Buffer.byteLength(pdf, 'latin1');
		pdf += `${n} 0 obj\n${objects[n]}\nendobj\n`;
	}

	const xrefOffset = Buffer.byteLength(pdf, 'latin1');
	const size = objects.length;
	pdf += `xref\n0 ${size}\n0000000000 65535 f \n`;
	for (let n = 1; n < size; n++) {
		pdf += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
	}
	pdf += `trailer\n<< /Size ${size} /Root 1 0 R${trailerExtras} >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

	return Buffer.from(pdf, 'latin1');
}

/**
 * Builds a PDF whose pages carry a real text layer (Helvetica `Tj` runs), which is what
 * `PdfExtractor` reads through `pdf-parse`'s `pagerender` hook.
 *
 * @param pages One entry per page; each entry is the list of text lines on that page.
 * @returns The PDF bytes.
 */
export function createTextLayerPdf(pages: PdfPageLines[]): Buffer {
	const objects: (string | undefined)[] = [undefined];
	// 1 = catalog, 2 = page tree, 3 = font; page/content objects follow from 4.
	const pageObjects = pages.map((_, index) => ({ page: 4 + index * 2, content: 5 + index * 2 }));

	objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
	objects[2] = `<< /Type /Pages /Kids [${pageObjects
		.map((entry) => `${entry.page} 0 R`)
		.join(' ')}] /Count ${pages.length} >>`;
	objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

	pages.forEach((lines, index) => {
		const { page, content } = pageObjects[index];
		objects[page] =
			'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
			`/Resources << /Font << /F1 3 0 R >> >> /Contents ${content} 0 R >>`;

		const operators = ['BT', '/F1 12 Tf', '16 TL', '72 720 Td'];
		lines.forEach((line, lineIndex) => {
			if (lineIndex > 0) {
				operators.push('T*'); // next line — gives each line its own Y, so the
				// extractor's `lastY` comparison emits a newline.
			}
			operators.push(`(${escapePdfText(line)}) Tj`);
		});
		operators.push('ET');

		const stream = operators.join('\n');
		objects[content] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
	});

	return assemblePdf(objects);
}

/**
 * Builds a structurally valid PDF with **no text layer** — a single page whose content
 * stream only draws a filled rectangle. This is the "scanned document" shape: the page
 * renders, but `getTextContent()` yields nothing, so the extractor's
 * `PDF_SCANNED_CHARS_PER_PAGE` heuristic routes it to the (not-yet-shipped) OCR path.
 */
export function createScannedPdf(): Buffer {
	const stream = '0.5 0.5 0.5 rg\n72 600 400 120 re\nf';
	return assemblePdf([
		undefined,
		'<< /Type /Catalog /Pages 2 0 R >>',
		'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
		'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>',
		`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`
	]);
}

/**
 * Builds a password-protected PDF: a valid object graph whose trailer points at a
 * standard-security-handler `/Encrypt` dictionary. `pdf-parse` cannot decrypt it without
 * the user password, so the extractor reports the permanent "corrupt or
 * password-protected" failure.
 */
export function createEncryptedPdf(): Buffer {
	const owner = 'O'.repeat(32);
	const user = 'U'.repeat(32);
	const objects: (string | undefined)[] = [
		undefined,
		'<< /Type /Catalog /Pages 2 0 R >>',
		'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
		'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>',
		`<< /Filter /Standard /V 1 /R 2 /P -1 /O (${owner}) /U (${user}) >>`
	];
	return assemblePdf(objects, ' /Encrypt 4 0 R /ID [<0102030405060708090A0B0C0D0E0F10> <0102030405060708090A0B0C0D0E0F10>]');
}

/**
 * Bytes that claim to be a PDF (correct `%PDF-` header, so MIME sniffing routes them to
 * the PDF extractor) but whose body is truncated garbage.
 */
export function createCorruptPdf(): Buffer {
	return Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n%%truncated', 'latin1');
}

/**
 * The canonical two-page text-layer fixture used across the extraction specs.
 * Page 1 and page 2 carry enough prose to clear the scanned-PDF heuristic.
 */
export const TEXT_LAYER_PDF_PAGES: PdfPageLines[] = [
	[
		'Quarterly Revenue Report',
		'Revenue grew twelve percent across every region this quarter.',
		'The strongest growth came from the professional services line.'
	],
	[
		'Appendix A: Regional Detail',
		'Regional breakdowns are attached in the companion workbook.',
		'Contact the finance team for the underlying ledger extracts.'
	]
];
