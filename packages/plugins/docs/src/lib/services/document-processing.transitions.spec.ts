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
import { PdfExtractor } from '../knowledge/extraction/pdf.extractor';
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
const buildService = (fileBytes: Buffer) => {
	const updates: any[] = [];
	const repository: any = {
		update: jest.fn(async (_criteria: any, patch: any) => {
			updates.push(patch);
			return { affected: 1 };
		})
	};
	const registry = new ExtractionRegistryService(
		new PdfExtractor(),
		new DocxExtractor(),
		new XlsxExtractor(),
		new CsvExtractor(),
		new TextExtractor(),
		new HtmlExtractor()
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
				label: 'png (no extractor — OCR is P1/M5)',
				bytes: createPng,
				mimeType: 'image/png',
				message: /No extractor supports this file type/i
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
