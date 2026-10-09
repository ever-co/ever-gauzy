// The OCR service reaches the AI seam and, through it, the whole `@gauzy/core` module graph.
// These are pure resolution tests, and both OCR-capable extractors take it `@Optional()` —
// stubbing it at the module boundary keeps the suite dependency-free AND exercises the
// "no OCR available" shape, which is what a deployment with OCR switched off looks like.
jest.mock('./document-ocr.service', () => ({ DocumentOcrService: class {} }));

import { DocsPermanentError } from '../errors';
import { CsvExtractor } from './csv.extractor';
import { DocxExtractor } from './docx.extractor';
import { ExtractionRegistryService } from './extraction-registry.service';
import { IDocumentExtractor } from './extractor.interface';
import { HtmlExtractor } from './html.extractor';
import { ImageExtractor } from './image.extractor';
import { PdfExtractor } from './pdf.extractor';
import { TextExtractor } from './text.extractor';
import { XlsxExtractor } from './xlsx.extractor';

const buildRegistry = () =>
	new ExtractionRegistryService(
		new PdfExtractor(),
		new DocxExtractor(),
		new XlsxExtractor(),
		new CsvExtractor(),
		new TextExtractor(),
		new HtmlExtractor(),
		new ImageExtractor()
	);

describe('ExtractionRegistryService', () => {
	it('resolves the built-in provider per canonical MIME', () => {
		const registry = buildRegistry();
		expect(registry.resolve('application/pdf', 'a.pdf')).toBeInstanceOf(PdfExtractor);
		expect(
			registry.resolve('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'a.docx')
		).toBeInstanceOf(DocxExtractor);
		expect(
			registry.resolve('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'a.xlsx')
		).toBeInstanceOf(XlsxExtractor);
		expect(registry.resolve('text/csv', 'a.csv')).toBeInstanceOf(CsvExtractor);
		expect(registry.resolve('text/plain', 'a.txt')).toBeInstanceOf(TextExtractor);
		expect(registry.resolve('text/markdown', 'a.md')).toBeInstanceOf(TextExtractor);
		expect(registry.resolve('text/html', 'a.html')).toBeInstanceOf(HtmlExtractor);
		expect(registry.resolve('image/png', 'pic.png')).toBeInstanceOf(ImageExtractor);
		expect(registry.resolve('image/jpeg', 'pic.jpg')).toBeInstanceOf(ImageExtractor);
		expect(registry.resolve('image/webp', 'pic.webp')).toBeInstanceOf(ImageExtractor);
		expect(registry.resolve('image/gif', 'pic.gif')).toBeInstanceOf(ImageExtractor);
	});

	it('returns null for unsupported MIME types', () => {
		const registry = buildRegistry();
		expect(registry.resolve('video/mp4', 'clip.mp4')).toBeNull();
		expect(registry.resolve('application/zip', 'bundle.zip')).toBeNull();
	});

	it('lets a later registration win over a built-in (first-match, third-party override)', async () => {
		const registry = buildRegistry();
		const custom: IDocumentExtractor = {
			supports: (mime) => mime === 'text/plain',
			extract: async () => ({ markdown: 'custom output' })
		};
		registry.register(custom);
		expect(registry.resolve('text/plain', 'a.txt')).toBe(custom);

		const result = await registry.extract(Buffer.from('anything'), {
			filename: 'a.txt',
			mimeType: 'text/plain'
		});
		expect(result.markdown).toBe('custom output');
	});

	it('supports third-party providers for brand-new MIME types', () => {
		const registry = buildRegistry();
		const custom: IDocumentExtractor = {
			supports: (mime, filename) => mime === 'application/x-custom' || filename.endsWith('.custom'),
			extract: async () => ({ markdown: 'x' })
		};
		registry.register(custom);
		expect(registry.resolve('application/x-custom', 'file.bin')).toBe(custom);
		expect(registry.resolve('application/octet-stream', 'file.custom')).toBe(custom);
	});

	it('throws a permanent error when no provider supports the input', async () => {
		const registry = buildRegistry();
		await expect(
			registry.extract(Buffer.from('x'), { filename: 'clip.mp4', mimeType: 'video/mp4' })
		).rejects.toBeInstanceOf(DocsPermanentError);
	});
});
