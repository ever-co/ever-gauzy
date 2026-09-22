/**
 * OCR gating, cost fuse, and failure classification (07 §4, rows 2 and 8).
 *
 * The single most important property here is **that nothing changes unless it is switched
 * on**. OCR arrived long after scanned PDFs and images already had a defined outcome
 * (permanent extraction failure → `FAILED` + review), and a deployment that sets no new
 * environment variable must keep getting exactly that — same class, same message. Every
 * "cannot" path is therefore asserted against the *pre-OCR* error, not against a new one.
 *
 * The second property is the fuse: `GAUZY_DOCS_OCR_MAX_PAGES` is applied at RENDER time, so
 * pages past the cap cost neither pixels nor tokens, and the drop is stated in the output
 * rather than hidden.
 *
 * `DocsAiService` is stubbed at the module boundary — importing it for real pulls the whole
 * `@gauzy/core` application graph into a unit test.
 */
jest.mock('../ai/docs-ai.service', () => ({ DocsAiService: class {} }));

import { DocsPermanentError, DocsTransientError } from '../errors';
import { DocumentOcrService } from './document-ocr.service';
import { IMAGE_OCR_UNAVAILABLE_MESSAGE, ImageExtractor } from './image.extractor';
import { PDF_OCR_UNAVAILABLE_MESSAGE, PdfExtractor } from './pdf.extractor';

const config: { ocrEnabled: boolean; ocrMaxPages: number; maxExtractedChars: number } = {
	ocrEnabled: false,
	ocrMaxPages: 20,
	maxExtractedChars: 500_000
};
jest.mock('../../docs.config', () => ({ getDocsConfig: () => config }));

const CTX = {
	filename: 'scan.pdf',
	mimeType: 'application/pdf',
	maxChars: 500_000,
	tenantId: 'tenant-1',
	organizationId: 'org-1'
};

/** A minimal but valid PNG, so the real `sharp` downscale runs rather than being stubbed. */
const PNG_BYTES = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64'
);

/**
 * Builds the OCR service with stubbed AI and rasterizer seams.
 *
 * @param options `model` — what `resolveVisionModel` answers; `generateText` — the provider
 *                call; `renderPages` — what the rasterizer produces.
 */
const buildOcr = (
	options: {
		model?: any;
		generateText?: jest.Mock;
		renderPages?: jest.Mock;
	} = {}
) => {
	const model =
		options.model === undefined
			? { model: {} as any, providerId: 'openai', modelId: 'gpt-4o-mini' }
			: options.model;

	const generateText = options.generateText ?? jest.fn(async () => ({ text: 'transcribed line' }));
	const emitUsage = jest.fn();
	const docsAiService: any = {
		resolveVisionModel: jest.fn(async () => (config.ocrEnabled ? model : null)),
		loadAiSdk: jest.fn(async () => ({ generateText })),
		emitUsage
	};
	const renderPages = options.renderPages ?? jest.fn(async () => ({ pages: [PNG_BYTES], pageCount: 1 }));
	const rasterizer: any = { renderPages, isAvailable: jest.fn(async () => true) };

	const service = new DocumentOcrService(docsAiService, rasterizer);
	jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
	jest.spyOn((service as any).logger, 'debug').mockImplementation(() => undefined);

	return { service, docsAiService, generateText, emitUsage, renderPages };
};

beforeEach(() => {
	config.ocrEnabled = false;
	config.ocrMaxPages = 20;
});

describe('OCR gating — GAUZY_DOCS_OCR_ENABLED=false reproduces the pre-OCR behavior', () => {
	it('never resolves a model and never calls a provider', async () => {
		const { service, docsAiService, generateText } = buildOcr();

		expect(await service.transcribeImage(PNG_BYTES, CTX)).toBeNull();
		expect(await service.transcribePdf(Buffer.from('%PDF-1.4'), CTX)).toBeNull();

		expect(docsAiService.resolveVisionModel).not.toHaveBeenCalled();
		expect(generateText).not.toHaveBeenCalled();
	});

	it('leaves the scanned-PDF permanent error byte-identical', async () => {
		const { service } = buildOcr();
		const extractor = new PdfExtractor(service);

		// `forceOcr` is the most aggressive entry point there is — even it must not change
		// the outcome while the switch is off.
		await expect(extractor.extract(Buffer.from('%PDF-1.4'), { ...CTX, forceOcr: true })).rejects.toThrow(
			PDF_OCR_UNAVAILABLE_MESSAGE
		);
		await expect(
			extractor.extract(Buffer.from('%PDF-1.4'), { ...CTX, forceOcr: true })
		).rejects.toBeInstanceOf(DocsPermanentError);
	});

	it('fails an image permanently — an image with no OCR has no content at all', async () => {
		const { service } = buildOcr();
		const extractor = new ImageExtractor(service);

		await expect(
			extractor.extract(PNG_BYTES, { ...CTX, filename: 'diagram.png', mimeType: 'image/png' })
		).rejects.toThrow(IMAGE_OCR_UNAVAILABLE_MESSAGE);
	});
});

describe('OCR gating — enabled but no vision model resolves', () => {
	beforeEach(() => {
		config.ocrEnabled = true;
	});

	it('degrades to the same permanent errors instead of throwing something new', async () => {
		const { service, generateText } = buildOcr({ model: null });

		await expect(
			new PdfExtractor(service).extract(Buffer.from('%PDF-1.4'), { ...CTX, forceOcr: true })
		).rejects.toThrow(
			PDF_OCR_UNAVAILABLE_MESSAGE
		);
		await expect(
			new ImageExtractor(service).extract(PNG_BYTES, { ...CTX, mimeType: 'image/png' })
		).rejects.toThrow(IMAGE_OCR_UNAVAILABLE_MESSAGE);

		// No credentials means no spend: not one provider call was attempted.
		expect(generateText).not.toHaveBeenCalled();
	});

	it('degrades the PDF path when no rasterizer is installed in this process', async () => {
		// `sharp`'s prebuilt libvips cannot load a PDF, so rendering is an optional
		// dependency. Missing it must skip OCR, not invent a different failure.
		const { service, generateText } = buildOcr({ renderPages: jest.fn(async () => null) });

		await expect(
			new PdfExtractor(service).extract(Buffer.from('%PDF-1.4'), { ...CTX, forceOcr: true })
		).rejects.toThrow(
			PDF_OCR_UNAVAILABLE_MESSAGE
		);
		expect(generateText).not.toHaveBeenCalled();
	});
});

describe('OCR enabled + a model available — the chain continues', () => {
	beforeEach(() => {
		config.ocrEnabled = true;
	});

	it('transcribes an image and returns markdown with OCR provenance', async () => {
		const { service } = buildOcr({ generateText: jest.fn(async () => ({ text: 'Invoice 12345' })) });

		const result = await new ImageExtractor(service).extract(PNG_BYTES, {
			...CTX,
			filename: 'invoice.png',
			mimeType: 'image/png'
		});

		expect(result.markdown).toContain('Invoice 12345');
		expect(result.metadata).toMatchObject({
			pageCount: 1,
			ocr: expect.objectContaining({ providerId: 'openai', model: 'gpt-4o-mini', pagesTranscribed: 1 })
		});
	});

	it('emits the docs-ocr usage event on success AND on failure', async () => {
		const { service, emitUsage } = buildOcr();
		await service.transcribeImage(PNG_BYTES, CTX);
		expect(emitUsage).toHaveBeenCalledWith(
			expect.objectContaining({ feature: 'docs-ocr', tenantId: 'tenant-1', success: true })
		);

		const failing = buildOcr({ generateText: jest.fn(async () => Promise.reject(new Error('429'))) });
		await expect(failing.service.transcribeImage(PNG_BYTES, CTX)).rejects.toBeInstanceOf(DocsTransientError);
		expect(failing.emitUsage).toHaveBeenCalledWith(
			expect.objectContaining({ feature: 'docs-ocr', success: false })
		);
	});

	it('emits `## Page N` locators so the chunker can cite a page', async () => {
		const { service } = buildOcr({
			renderPages: jest.fn(async () => ({ pages: [PNG_BYTES, PNG_BYTES], pageCount: 2 }))
		});

		const result = await new PdfExtractor(service).extract(Buffer.from('%PDF-1.4'), { ...CTX, forceOcr: true });

		expect(result.markdown).toContain('## Page 1');
		expect(result.markdown).toContain('## Page 2');
		expect(result.metadata?.pageCount).toBe(2);
	});
});

describe('OCR cost fuse — the page cap', () => {
	beforeEach(() => {
		config.ocrEnabled = true;
	});

	it('applies the cap at RENDER time, so capped pages cost no tokens', async () => {
		config.ocrMaxPages = 3;
		const { service, renderPages, generateText } = buildOcr({
			renderPages: jest.fn(async () => ({ pages: [PNG_BYTES, PNG_BYTES, PNG_BYTES], pageCount: 40 }))
		});

		await service.transcribePdf(Buffer.from('%PDF-1.4'), CTX);

		expect(renderPages).toHaveBeenCalledWith(expect.anything(), 3);
		// Three pages rendered ⇒ exactly three provider calls, not forty.
		expect(generateText).toHaveBeenCalledTimes(3);
	});

	it('states the truncation in the output and in the provenance', async () => {
		config.ocrMaxPages = 2;
		const { service } = buildOcr({
			renderPages: jest.fn(async () => ({ pages: [PNG_BYTES, PNG_BYTES], pageCount: 9 }))
		});

		const result = await service.transcribePdf(Buffer.from('%PDF-1.4'), CTX);

		expect(result?.markdown).toContain('_Only the first 2 of 9 pages were transcribed._');
		expect(result?.warnings).toContain('_Only the first 2 of 9 pages were transcribed._');
		expect(result?.provenance).toMatchObject({ pageCount: 9, pagesTranscribed: 2, capped: true });
	});

	it('does not mark an uncapped run as truncated', async () => {
		const { service } = buildOcr({
			renderPages: jest.fn(async () => ({ pages: [PNG_BYTES], pageCount: 1 }))
		});

		const result = await service.transcribePdf(Buffer.from('%PDF-1.4'), CTX);

		expect(result?.provenance.capped).toBe(false);
		expect(result?.markdown).not.toContain('were transcribed');
	});
});

describe('OCR failure classification', () => {
	beforeEach(() => {
		config.ocrEnabled = true;
	});

	it('skips a single failed page with a visible note and keeps the rest', async () => {
		let call = 0;
		const generateText = jest.fn(async () => {
			call++;
			if (call === 2) {
				throw new Error('provider hiccup');
			}
			return { text: `page ${call}` };
		});
		const { service } = buildOcr({
			generateText,
			renderPages: jest.fn(async () => ({ pages: [PNG_BYTES, PNG_BYTES, PNG_BYTES], pageCount: 3 }))
		});

		const result = await service.transcribePdf(Buffer.from('%PDF-1.4'), CTX);

		expect(result?.markdown).toContain('_Page 2 could not be transcribed._');
		expect(result?.provenance.pagesTranscribed).toBe(2);
		expect(result?.warnings).toContain('_Page 2 could not be transcribed._');
	});

	it('classifies an all-pages-failed run as TRANSIENT (a retry may succeed)', async () => {
		const { service } = buildOcr({
			generateText: jest.fn(async () => Promise.reject(new Error('503'))),
			renderPages: jest.fn(async () => ({ pages: [PNG_BYTES, PNG_BYTES], pageCount: 2 }))
		});

		await expect(service.transcribePdf(Buffer.from('%PDF-1.4'), CTX)).rejects.toBeInstanceOf(DocsTransientError);
	});
});
