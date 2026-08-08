/**
 * Pipeline status / review transitions driven by real extraction outcomes
 * (10-implementation-plan.md §8.1: "assert extracted markdown snapshots + status/review
 * transitions").
 *
 * The extractor fixtures in `knowledge/extraction/__fixtures__` are pushed through the
 * real `ExtractionRegistryService`, and the resulting success/failure is handed to the
 * real `DocumentProcessingService` so the row patches it writes are asserted end to end.
 *
 * `@gauzy/core` boots the entire application graph on import (entities → bootstrap), so
 * the handful of framework seams this service touches — `FileStorage`, `RequestContext`,
 * `EventBus` — are mocked at the module boundary. Everything under test is real.
 */
jest.mock(
	'@gauzy/core',
	() => ({
		FileStorage: class {
			getProvider() {
				return { getFile: async () => Buffer.alloc(0) };
			}
		},
		RequestContext: {
			currentUserId: () => undefined,
			currentRequestContext: () => ({})
		},
		EventBus: class {}
	}),
	{ virtual: true }
);
jest.mock('@gauzy/config', () => ({ isSqlite: () => false, isBetterSqlite3: () => false }), { virtual: true });
jest.mock('../docs.config', () => ({ getDocsConfig: () => ({ maxExtractedChars: 500_000 }) }));
jest.mock('../entities/document.entity', () => ({ Document: class {} }));
jest.mock('../events/document.event', () => ({ DocumentEvent: class {} }));
jest.mock('../repositories/type-orm-document.repository', () => ({ TypeOrmDocumentRepository: class {} }));
jest.mock('../dto', () => ({}));
jest.mock('./document.service', () => ({ DocumentService: class {} }));
jest.mock('../knowledge/queue/docs-queue.service', () => ({ DocsQueueService: class {} }));

import {
	DocumentReviewReasonEnum,
	DocumentReviewStatusEnum,
	DocumentStatusEnum
} from '@gauzy/contracts';
import { DocsPermanentError } from '../knowledge/errors';
import {
	createCorruptPdf,
	createDocxFixture,
	createEncryptedPdf,
	createPng,
	createScannedPdf,
	createTextLayerPdf,
	TEXT_LAYER_PDF_PAGES
} from '../knowledge/extraction/__fixtures__';
import { CsvExtractor } from '../knowledge/extraction/csv.extractor';
import { DocxExtractor } from '../knowledge/extraction/docx.extractor';
import { ExtractionRegistryService } from '../knowledge/extraction/extraction-registry.service';
import { HtmlExtractor } from '../knowledge/extraction/html.extractor';
import { IMAGE_OCR_UNAVAILABLE_MESSAGE, ImageExtractor } from '../knowledge/extraction/image.extractor';
import { PDF_OCR_UNAVAILABLE_MESSAGE, PdfExtractor } from '../knowledge/extraction/pdf.extractor';
import { TextExtractor } from '../knowledge/extraction/text.extractor';
import { XlsxExtractor } from '../knowledge/extraction/xlsx.extractor';
import { DocumentProcessingService } from './document-processing.service';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** A document row stub carrying only the fields the transition code reads/writes. */
const documentRow = (overrides: Record<string, any> = {}): any => ({
	id: 'doc-1',
	tenantId: 'tenant-1',
	organizationId: 'org-1',
	name: 'fixture',
	originalFilename: 'fixture.pdf',
	mimeType: 'application/pdf',
	storageKey: 'docs/org-1/fixture.pdf',
	storageProvider: 'LOCAL',
	status: DocumentStatusEnum.UPLOADED,
	reviewStatus: DocumentReviewStatusEnum.NONE,
	reviewReason: null,
	extractedText: null,
	extractedTextEdited: false,
	metadata: null,
	...overrides
});

/**
 * Builds the service with the real extraction registry and a recording repository.
 * `getFile` returns whichever fixture bytes the test supplies.
 */
const buildService = (fileBytes: Buffer, ocrService?: any) => {
	const updates: any[] = [];
	const repository: any = {
		update: jest.fn(async (_criteria: any, patch: any) => {
			updates.push(patch);
			return { affected: 1 };
		})
	};
	const registry = new ExtractionRegistryService(
		new PdfExtractor(ocrService),
		new DocxExtractor(),
		new XlsxExtractor(),
		new CsvExtractor(),
		new TextExtractor(),
		new HtmlExtractor(),
		new ImageExtractor(ocrService)
	);
	const service = new DocumentProcessingService(
		repository,
		{} as any,
		{ enqueue: jest.fn(async () => true) } as any,
		registry,
		{ publish: jest.fn() } as any
	);

	// The storage seam: the pipeline reads the blob through the recorded provider.
	const { FileStorage } = jest.requireMock('@gauzy/core') as any;
	FileStorage.prototype.getProvider = () => ({ getFile: async () => fileBytes });

	return { service, repository, updates };
};

describe('DocumentProcessingService — extraction status/review transitions', () => {
	describe('success path', () => {
		it('drives UPLOADED → PROCESSING → READY and stores the extracted markdown', async () => {
			const { service, updates } = buildService(createTextLayerPdf(TEXT_LAYER_PDF_PAGES));
			const document = documentRow();

			const wrote = await service.runExtraction(document, { documentId: 'doc-1' } as any);

			expect(wrote).toBe(true);
			// First write is the PROCESSING transition, second the terminal READY write.
			expect(updates[0]).toMatchObject({ status: DocumentStatusEnum.PROCESSING });
			expect(updates[1]).toMatchObject({
				status: DocumentStatusEnum.READY,
				statusMessage: null
			});
			expect(updates[1].extractedText).toContain('## Page 1');
			expect(document.status).toBe(DocumentStatusEnum.READY);
			// No review is requested for a clean extraction.
			expect(updates.some((patch) => patch.reviewStatus)).toBe(false);
		});

		it('records the extraction metadata under metadata.extraction', async () => {
			const { service, updates } = buildService(createDocxFixture());
			const document = documentRow({ originalFilename: 'handbook.docx', mimeType: DOCX_MIME });

			await service.runExtraction(document, { documentId: 'doc-1' } as any);

			expect(updates[1].metadata.extraction).toEqual(
				expect.objectContaining({
					truncated: false,
					wordCount: expect.any(Number),
					extractedAt: expect.any(String)
				})
			);
		});

		it('preserves a human correction and goes straight to READY (keepExtractedText)', async () => {
			const { service, updates } = buildService(createTextLayerPdf(TEXT_LAYER_PDF_PAGES));
			const document = documentRow({
				extractedText: 'corrected by a human',
				extractedTextEdited: true
			});

			const wrote = await service.runExtraction(document, { documentId: 'doc-1' } as any);

			expect(wrote).toBe(true);
			expect(updates).toHaveLength(1);
			expect(updates[0]).toMatchObject({ status: DocumentStatusEnum.READY, statusMessage: null });
			// The extractor never ran, so the stored text is untouched.
			expect(document.extractedText).toBe('corrected by a human');
		});
	});

	/**
	 * OCR (07 §4 rows 2 and 8) changes two things about a successful extraction and nothing
	 * else: the text is a *transcription*, so the row is flagged for review, and the
	 * provenance is recorded so the reviewer knows why. Status still reaches `READY`, which
	 * is what lets `DocsPipelineService` continue the normal classify → chunk → embed → index
	 * chain — the review flag gates AI *retrieval*, not indexing.
	 */
	describe('OCR-derived extraction → READY + PENDING / low-confidence', () => {
		/** An OCR service stub that transcribes anything handed to it. */
		const workingOcr = (overrides: Record<string, any> = {}) => ({
			isEnabled: () => true,
			transcribeImage: jest.fn(async () => ({
				markdown: 'Invoice 12345\n\nTotal: 99.00',
				provenance: {
					pageCount: 1,
					pagesTranscribed: 1,
					capped: false,
					providerId: 'openai',
					model: 'gpt-4o-mini',
					transcribedAt: '2026-08-08T00:00:00.000Z'
				},
				warnings: []
			})),
			transcribePdf: jest.fn(async () => ({
				markdown: '## Page 1\n\nScanned line one',
				provenance: {
					pageCount: 42,
					pagesTranscribed: 20,
					capped: true,
					providerId: 'openai',
					model: 'gpt-4o-mini',
					transcribedAt: '2026-08-08T00:00:00.000Z'
				},
				warnings: ['_Only the first 20 of 42 pages were transcribed._']
			})),
			...overrides
		});

		it('stores the transcription, reaches READY, and gates the row for review (image)', async () => {
			const { service, updates } = buildService(createPng(), workingOcr());
			const document = documentRow({ originalFilename: 'invoice.png', mimeType: 'image/png' });

			const wrote = await service.runExtraction(document, {
				documentId: 'doc-1',
				tenantId: 'tenant-1',
				organizationId: 'org-1'
			} as any);

			expect(wrote).toBe(true);
			expect(updates[1]).toMatchObject({
				status: DocumentStatusEnum.READY,
				statusMessage: null,
				reviewStatus: DocumentReviewStatusEnum.PENDING,
				reviewReason: DocumentReviewReasonEnum.LOW_CONFIDENCE
			});
			expect(updates[1].extractedText).toContain('Invoice 12345');
			// READY is the flag `handleExtract` reads to continue the chain.
			expect(document.status).toBe(DocumentStatusEnum.READY);
			expect(document.reviewStatus).toBe(DocumentReviewStatusEnum.PENDING);
		});

		it('records the OCR provenance (and the page cap) under metadata.extraction.ocr', async () => {
			const { service, updates } = buildService(createScannedPdf(), workingOcr());
			const document = documentRow({ originalFilename: 'scan.pdf', mimeType: 'application/pdf' });

			await service.runExtraction(document, {
				documentId: 'doc-1',
				tenantId: 'tenant-1',
				organizationId: 'org-1'
			} as any);

			expect(updates[1].metadata.extraction).toEqual(
				expect.objectContaining({
					pageCount: 42,
					truncated: true,
					warnings: ['_Only the first 20 of 42 pages were transcribed._'],
					ocr: expect.objectContaining({ pagesTranscribed: 20, capped: true, providerId: 'openai' })
				})
			);
		});

		it('hands the OCR path the JOB tenant snapshot, never a request context', async () => {
			const ocr = workingOcr();
			const { service } = buildService(createPng(), ocr);
			const document = documentRow({ originalFilename: 'invoice.png', mimeType: 'image/png' });

			await service.runExtraction(document, {
				documentId: 'doc-1',
				tenantId: 'tenant-from-job',
				organizationId: 'org-from-job'
			} as any);

			expect(ocr.transcribeImage).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ tenantId: 'tenant-from-job', organizationId: 'org-from-job' })
			);
		});

		it('leaves a NON-OCR extraction unflagged (the review gate is provenance-driven)', async () => {
			const { service, updates } = buildService(createTextLayerPdf(TEXT_LAYER_PDF_PAGES), workingOcr());
			const document = documentRow();

			await service.runExtraction(document, { documentId: 'doc-1' } as any);

			expect(updates[1].reviewStatus).toBeUndefined();
			expect(updates[1].metadata.extraction.ocr).toBeUndefined();
			expect(document.reviewStatus).toBe(DocumentReviewStatusEnum.NONE);
		});
	});

	describe('failure path → FAILED + PENDING / extraction-failed', () => {
		/**
		 * The three fixture shapes that make an extractor signal a permanent failure.
		 * Each must dead-letter onto the row identically: terminal `FAILED`, the
		 * user-safe message, and a `PENDING` review flagged `extraction-failed`.
		 */
		const cases: { label: string; bytes: () => Buffer; mimeType: string; message: RegExp }[] = [
			{
				label: 'password-protected pdf',
				bytes: createEncryptedPdf,
				mimeType: 'application/pdf',
				message: /corrupt or password-protected/i
			},
			{
				label: 'corrupt pdf',
				bytes: createCorruptPdf,
				mimeType: 'application/pdf',
				message: /corrupt or password-protected/i
			},
			{
				label: 'scanned pdf (no text layer)',
				bytes: createScannedPdf,
				mimeType: 'application/pdf',
				message: /scanned/i
			},
			{
				label: 'png with OCR unavailable',
				bytes: createPng,
				mimeType: 'image/png',
				message: /Text recognition \(OCR\) is not enabled/i
			}
		];

		it.each(cases)('$label → FAILED + PENDING / extraction-failed', async ({ bytes, mimeType, message }) => {
			const { service, updates } = buildService(bytes());
			const document = documentRow({ mimeType });

			let thrown: unknown;
			try {
				await service.runExtraction(document, { documentId: 'doc-1' } as any);
			} catch (error) {
				thrown = error;
			}

			expect(thrown).toBeInstanceOf(DocsPermanentError);
			expect((thrown as Error).message).toMatch(message);

			// The worker's stage-error handler dead-letters the failure onto the row.
			await service.markExtractionFailed(document, thrown);

			const terminal = updates[updates.length - 1];
			expect(terminal).toMatchObject({
				status: DocumentStatusEnum.FAILED,
				reviewStatus: DocumentReviewStatusEnum.PENDING,
				reviewReason: DocumentReviewReasonEnum.EXTRACTION_FAILED
			});
			expect(terminal.statusMessage).toMatch(message);
			expect(document.status).toBe(DocumentStatusEnum.FAILED);
		});

		it('never leaks an unexpected error message to the user', async () => {
			const { service, updates } = buildService(Buffer.alloc(0));
			const document = documentRow();

			await service.markExtractionFailed(document, new Error('ECONNRESET at pg://user:pw@host'));

			const terminal = updates[updates.length - 1];
			expect(terminal.statusMessage).toBe('An unexpected error occurred while processing the document.');
			expect(terminal.statusMessage).not.toContain('pg://');
			expect(terminal).toMatchObject({
				status: DocumentStatusEnum.FAILED,
				reviewReason: DocumentReviewReasonEnum.EXTRACTION_FAILED
			});
		});

		it('caps the user-facing status message at 500 characters', async () => {
			const { service, updates } = buildService(Buffer.alloc(0));
			const document = documentRow();

			await service.markExtractionFailed(document, new DocsPermanentError('x'.repeat(900)));

			expect(updates[updates.length - 1].statusMessage).toHaveLength(500);
		});

		it('fails a FILE document with no stored blob before touching the extractor', async () => {
			const { service, updates } = buildService(Buffer.alloc(0));
			const document = documentRow({ storageKey: null });

			await expect(service.runExtraction(document, { documentId: 'doc-1' } as any)).rejects.toBeInstanceOf(
				DocsPermanentError
			);
			// It never reached the PROCESSING transition.
			expect(updates).toHaveLength(0);
		});
	});
});
