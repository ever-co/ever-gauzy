/**
 * Per-MIME extraction fixtures (10-implementation-plan.md §8.1).
 *
 * Everything here is generated at test time from readable source rather than committed
 * as opaque binaries, so a reviewer can see exactly what each extractor is fed:
 *
 * | MIME | Fixture |
 * |---|---|
 * | `application/pdf` (text layer) | {@link createTextLayerPdf} / {@link TEXT_LAYER_PDF_PAGES} |
 * | `application/pdf` (no text layer) | {@link createScannedPdf} |
 * | `application/pdf` (unreadable) | {@link createEncryptedPdf}, {@link createCorruptPdf} |
 * | `…wordprocessingml.document` | {@link createDocxFixture} |
 * | legacy `.doc` / corrupt docx | {@link createLegacyDocFixture}, {@link createCorruptDocxFixture} |
 * | `…spreadsheetml.sheet` | {@link createMultiSheetXlsx}, {@link createOversizedXlsx} |
 * | `text/csv` | {@link CSV_EDGE_CASES}, {@link CSV_SEMICOLON}, {@link CSV_TAB} |
 * | `text/markdown` | {@link MARKDOWN_SOURCE} |
 * | `text/html` | {@link HTML_REQUIRING_SANITIZATION}, {@link HTML_HEADERLESS_TABLE} |
 * | `image/png` (no-text path) | {@link createPng} |
 *
 * `.pptx` and `.odt` fixtures land with their M4 extractors, per the plan.
 */
export * from './zip.util';
export * from './pdf.fixture';
export * from './docx.fixture';
export * from './xlsx.fixture';
export * from './text.fixture';
