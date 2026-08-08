/**
 * Knowledge-chain gate regression tests for the `docs-processing` pipeline.
 *
 * `handleExtract` (the `keepExtractedText` branch) and `handleClassify` decide whether the
 * freshly extracted text continues into `docs.chunk`. Gating that on
 * `knowledgeStatus === QUEUED` silently broke every re-run of an already-indexed document:
 * a reprocess re-extracted the text and then stopped, leaving the vector index serving the
 * SUPERSEDED extraction forever. The gate is "in the knowledge system at all" — anything
 * other than `NONE`/`EXCLUDED`.
 *
 * The stage logic now lives in `DocsPipelineService` (one definition, two dispatchers), so
 * these tests drive it through `DocsProcessingWorker` — the BullMQ adapter — proving the
 * queue path still reaches the same code.
 *
 * `@gauzy/scheduler` and the collaborating services are mocked at the module boundary; the
 * pipeline and worker under test are real.
 */
jest.mock(
	'@gauzy/scheduler',
	() => ({
		QueueWorker: () => () => undefined,
		QueueJobHandler: () => () => undefined,
		QueueWorkerHost: class {}
	}),
	{ virtual: true }
);
jest.mock('../../entities/document.entity', () => ({ Document: class {} }));
jest.mock('../../services/document-processing.service', () => ({ DocumentProcessingService: class {} }));
jest.mock('../classification/document-classifier.service', () => ({ DocumentClassifierService: class {} }));
jest.mock('../indexing/document-index.service', () => ({ DocumentIndexService: class {} }));
jest.mock('./docs-recovery.service', () => ({ DocsRecoveryService: class {} }));
jest.mock('./docs-queue.service', () => ({ DocsQueueService: class {} }));
jest.mock('../../docs.config', () => ({ getDocsConfig: () => ({ queueConcurrency: 1 }) }));

import { DocumentKnowledgeStatusEnum } from '@gauzy/contracts';
import { DOCS_JOB_CHUNK, DOCS_JOB_CLASSIFY } from './constants';
import { DocsPipelineService } from './docs-pipeline.service';
import { DocsProcessingWorker } from './docs-processing.worker';

/** Every knowledge status that means "this document is in the knowledge system". */
const IN_KNOWLEDGE = [
	DocumentKnowledgeStatusEnum.QUEUED,
	DocumentKnowledgeStatusEnum.INDEXING,
	DocumentKnowledgeStatusEnum.INDEXED,
	DocumentKnowledgeStatusEnum.FAILED
];

/** The two statuses that must abort the chain. */
const OUT_OF_KNOWLEDGE = [DocumentKnowledgeStatusEnum.NONE, DocumentKnowledgeStatusEnum.EXCLUDED];

/**
 * Builds the worker (over a real pipeline with stub collaborators) for a document in the
 * given knowledge status.
 */
const buildWorker = (knowledgeStatus: DocumentKnowledgeStatusEnum, indexService: any = {}) => {
	const document: any = { id: 'doc-1', tenantId: 'tenant-1', organizationId: 'org-1', knowledgeStatus };
	const enqueue = jest.fn().mockResolvedValue(true);
	const queueService: any = {
		enqueue,
		jobIdFor: (jobName: string, documentId: string) =>
			`docs:${jobName.startsWith('docs.') ? jobName.slice(5) : jobName}:${documentId}`
	};
	const processingService: any = {
		loadSnapshot: jest.fn().mockResolvedValue(document),
		runExtraction: jest.fn().mockResolvedValue(undefined)
	};
	const classifierService: any = { classify: jest.fn().mockResolvedValue('classified') };

	const pipeline = new DocsPipelineService(
		processingService,
		queueService,
		{} as any,
		classifierService,
		indexService
	);
	const worker = new DocsProcessingWorker(pipeline);
	return { worker, pipeline, enqueue, document };
};

/** A minimal BullMQ job stand-in. */
const jobOf = (name: string, data: Record<string, unknown> = {}): any => ({
	id: `${name}-job-id`,
	name,
	attemptsMade: 0,
	opts: { attempts: 3 },
	data: { documentId: 'doc-1', tenantId: 'tenant-1', organizationId: 'org-1', reason: 'reindex', ...data }
});

describe('DocsProcessingWorker — knowledge-chain gate', () => {
	describe('handleClassify', () => {
		it.each(IN_KNOWLEDGE)('chains docs.chunk for a %s document', async (knowledgeStatus) => {
			const { worker, enqueue } = buildWorker(knowledgeStatus);

			await worker.handleClassify(jobOf(DOCS_JOB_CLASSIFY));

			expect(enqueue).toHaveBeenCalledTimes(1);
			expect(enqueue.mock.calls[0][0]).toBe(DOCS_JOB_CHUNK);
		});

		it.each(OUT_OF_KNOWLEDGE)('does NOT chain docs.chunk for a %s document', async (knowledgeStatus) => {
			const { worker, enqueue } = buildWorker(knowledgeStatus);

			await worker.handleClassify(jobOf(DOCS_JOB_CLASSIFY));

			expect(enqueue).not.toHaveBeenCalled();
		});
	});

	describe('handleExtract (keepExtractedText branch)', () => {
		it.each(IN_KNOWLEDGE)('chains docs.chunk for a %s document', async (knowledgeStatus) => {
			const { worker, enqueue } = buildWorker(knowledgeStatus);

			await worker.handleExtract(jobOf('docs.extract', { keepExtractedText: true }));

			expect(enqueue).toHaveBeenCalledTimes(1);
			expect(enqueue.mock.calls[0][0]).toBe(DOCS_JOB_CHUNK);
		});

		it.each(OUT_OF_KNOWLEDGE)('does NOT chain docs.chunk for a %s document', async (knowledgeStatus) => {
			const { worker, enqueue } = buildWorker(knowledgeStatus);

			await worker.handleExtract(jobOf('docs.extract', { keepExtractedText: true }));

			expect(enqueue).not.toHaveBeenCalled();
		});
	});

	it('re-chunks an INDEXED document on reprocess — the index must not keep the superseded extraction', async () => {
		const { worker, enqueue } = buildWorker(DocumentKnowledgeStatusEnum.INDEXED);

		// extract (no keepExtractedText) → classify → chunk
		await worker.handleExtract(jobOf('docs.extract', { reason: 'reindex' }));
		expect(enqueue.mock.calls[0][0]).toBe(DOCS_JOB_CLASSIFY);

		await worker.handleClassify(jobOf(DOCS_JOB_CLASSIFY, { reason: 'reindex' }));
		expect(enqueue.mock.calls[1][0]).toBe(DOCS_JOB_CHUNK);
	});

	it('carries a PAGE `content-changed` re-enqueue through the chunk stage of an INDEXED page', async () => {
		const runChunkStage = jest.fn().mockResolvedValue({ outcome: 'chunked', contentHash: 'hash-2' });
		const { worker, document } = buildWorker(DocumentKnowledgeStatusEnum.INDEXED, { runChunkStage });

		await worker.handleChunk(jobOf(DOCS_JOB_CHUNK, { reason: 'content-changed' }));

		// INDEXED is "in the knowledge system", so the stage runs rather than aborting.
		expect(runChunkStage).toHaveBeenCalledWith(document, expect.objectContaining({ reason: 'content-changed' }));
	});

	it('carries the BullMQ retry policy through to the stage-error handler (transient → rethrow)', async () => {
		// `attempts: 3`, `attemptsMade: 0` → not the final attempt, so a transient error must
		// propagate out of the worker for BullMQ to retry with backoff.
		const transient = Object.assign(new Error('ECONNRESET'), { code: 'ECONNRESET' });
		const runChunkStage = jest.fn().mockRejectedValue(transient);
		const { worker, pipeline } = buildWorker(DocumentKnowledgeStatusEnum.QUEUED, { runChunkStage });
		(pipeline as any).processingService.markKnowledgeFailed = jest.fn().mockResolvedValue(undefined);

		await expect(worker.handleChunk(jobOf(DOCS_JOB_CHUNK))).rejects.toThrow('ECONNRESET');
		expect((pipeline as any).processingService.markKnowledgeFailed).not.toHaveBeenCalled();
	});
});
