/**
 * Pipeline wiring of `docs.thumbnail` (07 §4.4).
 *
 * The stage is enqueued after a successful extract and is best-effort in the strongest
 * sense: **no thumbnail problem may ever change a document's status.** These tests drive
 * the wiring from both sides of the seam it has to survive —
 *
 * - the failure of the *enqueue* itself, which runs on the extract job's error budget and
 *   would otherwise dead-letter a perfectly extracted document as `FAILED`;
 * - the failure of the *stage*, which must not reach `markKnowledgeFailed` either.
 *
 * `runStage` (queue mode) and `runStageSafely` (inline mode) are exercised separately,
 * because the two dispatchers have different error contracts and the thumbnail must be inert
 * under both.
 */
jest.mock('../../entities/document.entity', () => ({ Document: class {} }));
jest.mock('../../services/document-processing.service', () => ({ DocumentProcessingService: class {} }));
jest.mock('../classification/document-classifier.service', () => ({ DocumentClassifierService: class {} }));
jest.mock('../indexing/document-index.service', () => ({ DocumentIndexService: class {} }));
jest.mock('./docs-recovery.service', () => ({ DocsRecoveryService: class {} }));
jest.mock('./docs-queue.service', () => ({ DocsQueueService: class {} }));
// Reaches `FileStorage` and, through it, the whole `@gauzy/core` graph.
jest.mock('../thumbnail/document-thumbnail.service', () => ({ DocumentThumbnailService: class {} }));
jest.mock('../../services/docs-feature.service', () => ({ DocsFeatureService: class {} }));

import { DocumentKnowledgeStatusEnum } from '@gauzy/contracts';
import { DOCS_JOB_CLASSIFY, DOCS_JOB_EXTRACT, DOCS_JOB_THUMBNAIL } from './constants';
import { DocsPipelineService } from './docs-pipeline.service';
import { inlineStageJob } from './docs-pipeline.types';

const PAYLOAD = {
	documentId: 'doc-1',
	tenantId: 'tenant-1',
	organizationId: 'org-1',
	reason: 'upload' as const
};

/**
 * Builds the pipeline with stub collaborators.
 *
 * @param overrides `mimeType` — what the loaded document claims; `generate` — the thumbnail
 *                  service; `enqueue` — the dispatch seam.
 */
const buildPipeline = (
	overrides: { mimeType?: string; generate?: jest.Mock; enqueue?: jest.Mock } = {}
) => {
	const document: any = {
		id: 'doc-1',
		tenantId: 'tenant-1',
		organizationId: 'org-1',
		mimeType: overrides.mimeType ?? 'image/png',
		knowledgeStatus: DocumentKnowledgeStatusEnum.QUEUED
	};
	const processingService: any = {
		loadSnapshot: jest.fn().mockResolvedValue(document),
		runExtraction: jest.fn().mockResolvedValue(undefined),
		markExtractionFailed: jest.fn().mockResolvedValue(undefined),
		markKnowledgeFailed: jest.fn().mockResolvedValue(undefined)
	};
	const enqueue = overrides.enqueue ?? jest.fn().mockResolvedValue(true);
	const queueService: any = {
		enqueue,
		jobIdFor: (jobName: string, documentId: string) =>
			`docs:${jobName.startsWith('docs.') ? jobName.slice(5) : jobName}:${documentId}`
	};
	const thumbnailService: any = { generate: overrides.generate ?? jest.fn().mockResolvedValue('generated') };

	const pipeline = new DocsPipelineService(
		processingService,
		queueService,
		{ runScan: jest.fn() } as any,
		{ classify: jest.fn().mockResolvedValue('classified') } as any,
		{} as any,
		thumbnailService,
		{ isEnabledFor: jest.fn().mockResolvedValue(true) } as any
	);
	jest.spyOn((pipeline as any).logger, 'error').mockImplementation(() => undefined);
	jest.spyOn((pipeline as any).logger, 'warn').mockImplementation(() => undefined);
	jest.spyOn((pipeline as any).logger, 'log').mockImplementation(() => undefined);

	return { pipeline, processingService, queueService, thumbnailService, enqueue, document };
};

/** The stage names dispatched, in order. */
const enqueuedStages = (enqueue: jest.Mock): string[] => enqueue.mock.calls.map(([name]: any[]) => name);

/** The payload of the thumbnail enqueue. */
const thumbnailPayload = (enqueue: jest.Mock): any =>
	enqueue.mock.calls.find(([name]: any[]) => name === DOCS_JOB_THUMBNAIL)?.[1];

describe('docs.extract → docs.thumbnail enqueue', () => {
	it('enqueues the thumbnail alongside classification for an image', async () => {
		const { pipeline, enqueue } = buildPipeline({ mimeType: 'image/png' });

		await pipeline.handleExtract(inlineStageJob('docs:extract:doc-1', PAYLOAD) as any);

		expect(enqueuedStages(enqueue)).toEqual([DOCS_JOB_THUMBNAIL, DOCS_JOB_CLASSIFY]);
	});

	it('enqueues it for a PDF too', async () => {
		const { pipeline, enqueue } = buildPipeline({ mimeType: 'application/pdf' });

		await pipeline.handleExtract(inlineStageJob('docs:extract:doc-1', PAYLOAD) as any);

		expect(enqueuedStages(enqueue)).toContain(DOCS_JOB_THUMBNAIL);
	});

	it('never enqueues it for a format that cannot produce one', async () => {
		for (const mimeType of ['text/csv', 'text/plain', 'text/html', 'application/vnd.ms-excel']) {
			const { pipeline, enqueue } = buildPipeline({ mimeType });

			await pipeline.handleExtract(inlineStageJob('docs:extract:doc-1', PAYLOAD) as any);

			expect(enqueuedStages(enqueue)).not.toContain(DOCS_JOB_THUMBNAIL);
		}
	});

	it('asks for a regeneration only when the run replaced or redid the bytes', async () => {
		const cases: { reason: string; force: boolean }[] = [
			{ reason: 'upload', force: false },
			{ reason: 'import', force: false },
			{ reason: 'recovery', force: false },
			{ reason: 'replace', force: true },
			{ reason: 'reindex', force: true }
		];

		for (const { reason, force } of cases) {
			const { pipeline, enqueue } = buildPipeline();

			await pipeline.handleExtract(inlineStageJob('docs:extract:doc-1', { ...PAYLOAD, reason }) as any);

			expect(thumbnailPayload(enqueue)).toMatchObject({ force, documentId: 'doc-1', tenantId: 'tenant-1' });
		}
	});

	it('carries the tenant snapshot, never a request context', async () => {
		const { pipeline, enqueue } = buildPipeline();

		await pipeline.handleExtract(inlineStageJob('docs:extract:doc-1', PAYLOAD) as any);

		expect(thumbnailPayload(enqueue)).toMatchObject({ tenantId: 'tenant-1', organizationId: 'org-1' });
	});
});

describe('a thumbnail failure never fails the document', () => {
	it('survives an enqueue that rejects — extraction still succeeds', async () => {
		// The enqueue runs inside `handleExtract`, i.e. on the extract job's error budget:
		// unguarded, an unavailable queue would mark a fully extracted document FAILED.
		const enqueue = jest.fn(async (name: string) => {
			if (name === DOCS_JOB_THUMBNAIL) {
				throw new Error('queue unavailable');
			}
			return true;
		});
		const { pipeline, processingService } = buildPipeline({ enqueue });

		await expect(
			pipeline.runStageSafely(DOCS_JOB_EXTRACT, inlineStageJob('docs:extract:doc-1', PAYLOAD))
		).resolves.toBeUndefined();

		expect(processingService.runExtraction).toHaveBeenCalledTimes(1);
		expect(processingService.markExtractionFailed).not.toHaveBeenCalled();
		expect(enqueuedStages(enqueue)).toContain(DOCS_JOB_CLASSIFY); // the chain continued
	});

	it('swallows a stage failure in QUEUE mode (runStage does not reject)', async () => {
		const { pipeline, processingService } = buildPipeline({
			generate: jest.fn().mockRejectedValue(new Error('sharp exploded'))
		});

		await expect(
			pipeline.runStage(DOCS_JOB_THUMBNAIL, inlineStageJob('docs:thumbnail:doc-1', PAYLOAD))
		).resolves.toBeUndefined();

		expect(processingService.markExtractionFailed).not.toHaveBeenCalled();
		expect(processingService.markKnowledgeFailed).not.toHaveBeenCalled();
	});

	it('swallows a stage failure in INLINE mode without dead-lettering the row', async () => {
		const { pipeline, processingService } = buildPipeline({
			generate: jest.fn().mockRejectedValue(new Error('storage unreachable'))
		});

		await expect(
			pipeline.runStageSafely(DOCS_JOB_THUMBNAIL, inlineStageJob('docs:thumbnail:doc-1', PAYLOAD))
		).resolves.toBeUndefined();

		expect(processingService.markKnowledgeFailed).not.toHaveBeenCalled();
	});

	it('does not dead-letter a thumbnail even when the snapshot load itself blows up', async () => {
		const { pipeline, processingService } = buildPipeline();
		processingService.loadSnapshot.mockRejectedValue(new Error('db is down'));

		await expect(
			pipeline.runStageSafely(DOCS_JOB_THUMBNAIL, inlineStageJob('docs:thumbnail:doc-1', PAYLOAD))
		).resolves.toBeUndefined();

		expect(processingService.markExtractionFailed).not.toHaveBeenCalled();
		expect(processingService.markKnowledgeFailed).not.toHaveBeenCalled();
	});
});

describe('docs.thumbnail stage dispatch', () => {
	it('runs the thumbnail service with the loaded document and the job payload', async () => {
		const { pipeline, thumbnailService, document } = buildPipeline();

		await pipeline.runStage(
			DOCS_JOB_THUMBNAIL,
			inlineStageJob('docs:thumbnail:doc-1', { ...PAYLOAD, force: true })
		);

		expect(thumbnailService.generate).toHaveBeenCalledWith(document, expect.objectContaining({ force: true }));
	});

	it('completes without calling the service when the document is gone', async () => {
		const { pipeline, processingService, thumbnailService } = buildPipeline();
		processingService.loadSnapshot.mockResolvedValue(null);

		await pipeline.runStage(DOCS_JOB_THUMBNAIL, inlineStageJob('docs:thumbnail:doc-1', PAYLOAD));

		expect(thumbnailService.generate).not.toHaveBeenCalled();
	});
});
