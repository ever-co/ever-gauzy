import { CsvExtractor } from './csv.extractor';
import { DocxExtractor } from './docx.extractor';
import { ExtractionRegistryService } from './extraction-registry.service';
import { HtmlExtractor } from './html.extractor';
import { PdfExtractor } from './pdf.extractor';
import { TextExtractor } from './text.extractor';
import { XlsxExtractor } from './xlsx.extractor';

export * from './extractor.interface';
export * from './extraction-registry.service';
export * from './pdf.extractor';
export * from './docx.extractor';
export * from './xlsx.extractor';
export * from './csv.extractor';
export * from './text.extractor';
export * from './html.extractor';

/**
 * Every built-in extraction provider + the registry — spread into the `DocsModule`
 * providers array. Third parties add providers via `ExtractionRegistryService.register()`.
 */
export const ExtractionProviders = [
	PdfExtractor,
	DocxExtractor,
	XlsxExtractor,
	CsvExtractor,
	TextExtractor,
	HtmlExtractor,
	ExtractionRegistryService
];
