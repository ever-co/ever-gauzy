/**
 * Inline-mode safety-net tests for `DocsPipelineService`.
 *
 * Inline runs are fire-and-forget background promises with a single attempt, so two things
 * must hold that the BullMQ path gets for free from Redis:
 *  - a stage failure NEVER escapes as an unhandled rejection;
 *  - it dead-letters onto the document row through the SAME `markExtractionFailed` /
 *    `markKnowledgeFailed` path the queue handlers use, so no row is left stuck in
 *    `PROCESSING` / `INDEXING` with no `statusMessage`.
 *
 * `runStage` (the queue path) must keep rethrowing — BullMQ needs the rejection to retry.
 */
jest.mock('../../entities/document.entity', () => ({ Document: class {} }));
jest.mock('../../services/document-processing.service', () => ({ DocumentProcessingService: class {} }));
jest.mock('../classification/document-classifier.service', () => ({ DocumentClassifierService: class {} }));
jest.mock('../indexing/document-index.service', () => ({ DocumentIndexService: class {} }));
jest.mock('./docs-recovery.service', () => ({ DocsRecoveryService: class {} }));
jest.mock('./docs-queue.service', () => ({ DocsQueueService: class {} }));
// The thumbnail service reaches `FileStorage` (and through it the whole `@gauzy/core` graph).
jest.mock('../thumbnail/document-thumbnail.service', () => ({ DocumentThumbnailService: class {} }));

import { DocumentKnowledgeStatusEnum } from '@gauzy/contracts';
import { DOCS_JOB_CHUNK, DOCS_JOB_CLASSIFY, DOCS_JOB_EXTRACT, DOCS_JOB_RECONCILE } from './constants';
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
 */
const buildPipeline = (
	overrides: { indexService?: any; classifierService?: any; processing?: any; thumbnailService?: any } = {}
) => {
	const document: any = {
		id: 'doc-1',
		tenantId: 'tenant-1',
		organizationId: 'org-1',
		knowledgeStatus: DocumentKnowledgeStatusEnum.QUEUED
	};
	const processingService: any = {
		loadSnapshot: jest.fn().mockResolvedValue(document),
		runExtraction: jest.fn().mockResolvedValue(undefined),
		markExtractionFailed: jest.fn().mockResolvedValue(undefined),
		markKnowledgeFailed: jest.fn().mockResolvedValue(undefined),
		...overrides.processing
	};
	const queueService: any = {
		enqueue: jest.fn().mockResolvedValue(true),
		jobIdFor: (jobName: string, documentId: string) =>
			`docs:${jobName.startsWith('docs.') ? jobName.slice(5) : jobName}:${documentId}`
	};
	const recoveryService: any = { runScan: jest.fn().mockResolvedValue({}) };
	const classifierService: any = overrides.classifierService ?? {
		classify: jest.fn().mockResolvedValue('classified')
	};

	const thumbnailService: any = overrides.thumbnailService ?? {
		generate: jest.fn().mockResolvedValue('generated')
	};

	const pipeline = new DocsPipelineService(
		processingService,
		queueService,
		recoveryService,
		classifierService,
		overrides.indexService ?? {},
		thumbnailService
	);
	jest.spyOn((pipeline as any).logger, 'error').mockImplementation(() => undefined);
	jest.spyOn((pipeline as any).logger, 'log').mockImplementation(() => undefined);

	return { pipeline, processingService, queueService, recoveryService, classifierService, thumbnailService, document };
};

describe('DocsPipelineService — runStage dispatch', () => {
	it('routes every stage name to its handler', async () => {
		const { pipeline, recoveryService } = buildPipeline();
		const spy = jest.spyOn(pipeline, 'handleExtract');

		await pipeline.runStage(DOCS_JOB_EXTRACT, inlineStageJob('docs:extract:doc-1', PAYLOAD));
		expect(spy).toHaveBeenCalledTimes(1);

		await pipeline.runStage(DOCS_JOB_RECONCILE, inlineStageJob('docs:reconcile:sweep', {
			requestedAt: '2026-01-01T00:00:00.000Z'
		}) as any);
		expect(recoveryService.runScan).toHaveBeenCalledWith('reconcile');
	});

	it('rejects on an unknown stage name', async () => {
		const { pipeline } = buildPipeline();

		await expect(
			pipeline.runStage('docs.nope', inlineStageJob('docs:nope:doc-1', PAYLOAD))
		).rejects.toThrow('No handler found for docs pipeline stage "docs.nope"');
	});
});

/**
 * The "Classify with AI" toggle of the upload dialog is a per-upload override of the org
 * `autoClassify` default. It reaches the pipeline as `classify` on the `docs.extract`
 * payload (resolved on the request thread, where `RequestContext` still has a tenant), and
 * THIS is where honoring it happens — the toggle used to be collected by the dialog and
 * dropped on the floor, so classification ran no matter what the user chose.
 */
describe('DocsPipelineService — the classification opt-out', () => {
	const extractJob = (id: string, data: Record<string, unknown>) => inlineStageJob(id, { ...PAYLOAD, ...data });
	const enqueuedStages = (queueService: any): string[] => queueService.enqueue.mock.calls.map(([name]: any[]) => name);

	it('skips `docs.classify` when the upload opted out', async () => {
		const { pipeline, queueService, classifierService } = buildPipeline();

		await pipeline.handleExtract(extractJob('docs:extract:doc-1', { classify: false }) as any);

		expect(enqueuedStages(queueService)).not.toContain(DOCS_JOB_CLASSIFY);
		expect(classifierService.classify).not.toHaveBeenCalled();
	});

	it('still runs the knowledge chain for an opted-out document (only classification is skipped)', async () => {
		const { pipeline, queueService, processingService } = buildPipeline();

		await pipeline.handleExtract(extractJob('docs:extract:doc-1', { classify: false }) as any);

		expect(processingService.runExtraction).toHaveBeenCalledTimes(1);
		expect(enqueuedStages(queueService)).toEqual([DOCS_JOB_CHUNK]);
	});

	it('classifies when the upload opted in', async () => {
		const { pipeline, queueService } = buildPipeline();

		await pipeline.handleExtract(extractJob('docs:extract:doc-1', { classify: true }) as any);

		expect(enqueuedStages(queueService)).toEqual([DOCS_JOB_CLASSIFY]);
	});

	it('classifies when the payload expresses no opinion (pre-existing jobs, reprocess, capture)', async () => {
		const { pipeline, queueService } = buildPipeline();

		await pipeline.handleExtract(extractJob('docs:extract:doc-1', {}) as any);

		expect(enqueuedStages(queueService)).toEqual([DOCS_JOB_CLASSIFY]);
	});

	it('leaves a document outside the knowledge system alone entirely', async () => {
		const { pipeline, queueService, document } = buildPipeline();
		document.knowledgeStatus = DocumentKnowledgeStatusEnum.NONE;

		await pipeline.handleExtract(extractJob('docs:extract:doc-1', { classify: false }) as any);

		expect(queueService.enqueue).not.toHaveBeenCalled();
	});
});

describe('DocsPipelineService — inline single-attempt policy', () => {
	it('dead-letters a TRANSIENT knowledge failure instead of rethrowing (attempts = 1)', async () => {
		const transient = Object.assign(new Error('ETIMEDOUT'), { code: 'ETIMEDOUT' });
		const { pipeline, processingService, document } = buildPipeline({
			indexService: { runChunkStage: jest.fn().mockRejectedValue(transient) }
		});

		// The queue path with attempts=1 behaves the same: every attempt IS the final one.
		await expect(
			pipeline.runStage(DOCS_JOB_CHUNK, inlineStageJob('docs:chunk:doc-1', PAYLOAD))
		).resolves.toBeUndefined();

		expect(processingService.markKnowledgeFailed).toHaveBeenCalledWith(document, transient);
	});
});

describe('DocsPipelineService — runStageSafely dead-letters', () => {
	it('never rejects and marks the extraction failed when the extract stage escapes', async () => {
		const boom = new Error('loadSnapshot blew up after the stage started');
		const { pipeline, processingService, document } = buildPipeline();
		// Escape the handler's own try/catch: fail on the chained enqueue, which is outside it.
		(pipeline as any).docsQueueService.enqueue = jest.fn().mockRejectedValue(boom);

		await expect(
			pipeline.runStageSafely(DOCS_JOB_EXTRACT, inlineStageJob('docs:extract:doc-1', PAYLOAD))
		).resolves.toBeUndefined();

		expect(processingService.markExtractionFailed).toHaveBeenCalledWith(document, boom);
	});

	it('marks the extraction failed when classification escapes', async () => {
		const boom = new Error('provider exploded');
		const { pipeline, processingService, document } = buildPipeline({
			classifierService: { classify: jest.fn().mockRejectedValue(boom) }
		});

		await expect(
			pipeline.runStageSafely(DOCS_JOB_CLASSIFY, inlineStageJob('docs:classify:doc-1', PAYLOAD))
		).resolves.toBeUndefined();

		expect(processingService.markExtractionFailed).toHaveBeenCalledWith(document, boom);
	});

	it('marks the knowledge projection failed when a knowledge stage escapes', async () => {
		const boom = new Error('vector store unreachable');
		const { pipeline, processingService, document } = buildPipeline({
			indexService: { runChunkStage: jest.fn().mockResolvedValue({ outcome: 'chunked', contentHash: 'h' }) }
		});
		(pipeline as any).docsQueueService.enqueue = jest.fn().mockRejectedValue(boom);

		await expect(
			pipeline.runStageSafely(DOCS_JOB_CHUNK, inlineStageJob('docs:chunk:doc-1', PAYLOAD))
		).resolves.toBeUndefined();

		expect(processingService.markKnowledgeFailed).toHaveBeenCalledWith(document, boom);
		expect(processingService.markExtractionFailed).not.toHaveBeenCalled();
	});

	it('does not try to dead-letter a reconcile sweep (it carries no document)', async () => {
		const { pipeline, processingService, recoveryService } = buildPipeline();
		recoveryService.runScan.mockRejectedValue(new Error('scan failed'));

		await expect(
			pipeline.runStageSafely(DOCS_JOB_RECONCILE, inlineStageJob('docs:reconcile:sweep', {
				requestedAt: 'now'
			}) as any)
		).resolves.toBeUndefined();

		expect(processingService.markExtractionFailed).not.toHaveBeenCalled();
		expect(processingService.markKnowledgeFailed).not.toHaveBeenCalled();
	});

	it('swallows a failure of the dead-letter write itself', async () => {
		const { pipeline, processingService } = buildPipeline();
		(pipeline as any).docsQueueService.enqueue = jest.fn().mockRejectedValue(new Error('boom'));
		processingService.markExtractionFailed.mockRejectedValue(new Error('db is down too'));

		await expect(
			pipeline.runStageSafely(DOCS_JOB_EXTRACT, inlineStageJob('docs:extract:doc-1', PAYLOAD))
		).resolves.toBeUndefined();
	});
});
