import { CsvExtractor } from './csv.extractor';
import { DocumentOcrService } from './document-ocr.service';
import { DocxExtractor } from './docx.extractor';
import { ExtractionRegistryService } from './extraction-registry.service';
import { HtmlExtractor } from './html.extractor';
import { ImageExtractor } from './image.extractor';
import { OdfExtractor } from './odf.extractor';
import { PdfExtractor } from './pdf.extractor';
import { PdfRasterizerService } from './pdf-rasterizer.service';
import { PptxExtractor } from './pptx.extractor';
import { TextExtractor } from './text.extractor';
import { XlsxExtractor } from './xlsx.extractor';

export * from './extractor.interface';
export * from './extraction-registry.service';
export * from './pdf.extractor';
export * from './pdf-rasterizer.service';
export * from './docx.extractor';
export * from './xlsx.extractor';
export * from './pptx.extractor';
export * from './odf.extractor';
export * from './office-markdown.util';
export * from './office-package.util';
export * from './office-xml.util';
export * from './csv.extractor';
export * from './text.extractor';
export * from './html.extractor';
export * from './image.extractor';
export * from './document-ocr.service';
export * from './ocr.prompt';

/**
 * Every built-in extraction provider + the registry — spread into the `DocsModule`
 * providers array. Third parties add providers via `ExtractionRegistryService.register()`.
 *
 * `PdfRasterizerService` and `DocumentOcrService` are listed here rather than with the
 * knowledge providers because they exist for extraction: the OCR service is what turns a
 * scanned PDF or an image into markdown. (The rasterizer is also reused by the thumbnail
 * job, which injects it from this same container.)
 */
export const ExtractionProviders = [
	PdfRasterizerService,
	DocumentOcrService,
	PdfExtractor,
	DocxExtractor,
	XlsxExtractor,
	PptxExtractor,
	OdfExtractor,
	CsvExtractor,
	TextExtractor,
	HtmlExtractor,
	ImageExtractor,
	ExtractionRegistryService
];
