/**
 * TASK 9 (improvement roadmap) — Unified Observability and Correlation IDs.
 *
 * `DocsPipelineService.baseOf()` — the function that carries the tenant/organization snapshot forward
 * at every chain hop (extract -> classify -> chunk -> embed -> index/thumbnail) — enumerates the fields
 * it copies, so a payload field it does not list (such as `correlationId`) is silently dropped at the
 * very first hop. Every later stage, and every requeue, would then lose the id that ties its logs back
 * to the request that started the run, and the propagation would never get past `docs.extract`.
 *
 * Carrying the id is only half of it: the worker-stage outcome and failure lines must also PRINT it
 * (the "Enqueued ..." line of `DocsQueueService` already did), otherwise the id rides along on every
 * payload and still cannot be grepped for next to the line that says what went wrong.
 *
 * Mirrors `docs-pipeline.safety.spec.ts`'s mocking/fixture pattern (trimmed to what this file needs).
 */
jest.mock('../../entities/document.entity', () => ({ Document: class {} }));
jest.mock('../../services/document-processing.service', () => ({ DocumentProcessingService: class {} }));
jest.mock('../classification/document-classifier.service', () => ({ DocumentClassifierService: class {} }));
jest.mock('../indexing/document-index.service', () => ({ DocumentIndexService: class {} }));
jest.mock('./docs-recovery.service', () => ({ DocsRecoveryService: class {} }));
jest.mock('./docs-queue.service', () => ({ DocsQueueService: class {} }));
jest.mock('../thumbnail/document-thumbnail.service', () => ({ DocumentThumbnailService: class {} }));
jest.mock('../../services/docs-feature.service', () => ({ DocsFeatureService: class {} }));

import { DocumentKnowledgeStatusEnum } from '@gauzy/contracts';
import { DOCS_JOB_CLASSIFY, DOCS_JOB_EXTRACT } from './constants';
import { DocsPipelineService } from './docs-pipeline.service';
import { inlineStageJob } from './docs-pipeline.types';

const PAYLOAD_WITH_CORRELATION_ID = {
	documentId: 'doc-1',
	tenantId: 'tenant-1',
	organizationId: 'org-1',
	reason: 'upload' as const,
	correlationId: 'correlation-abc'
};

/** The same payload as a job enqueued before this field existed (or by a system-initiated run). */
const { correlationId: _dropped, ...PAYLOAD_WITHOUT_CORRELATION_ID } = PAYLOAD_WITH_CORRELATION_ID;
void _dropped;

function buildPipeline(
	overrides: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		indexService?: any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		classifierService?: any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		thumbnailService?: any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		processing?: any;
		enqueue?: jest.Mock;
		knowledgeStatus?: DocumentKnowledgeStatusEnum;
		mimeType?: string;
		featureEnabled?: boolean;
	} = {}
) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const document: any = {
		id: 'doc-1',
		tenantId: 'tenant-1',
		organizationId: 'org-1',
		mimeType: overrides.mimeType,
		// Default NONE: not in the knowledge system -> no thumbnail/chunk branch noise
		knowledgeStatus: overrides.knowledgeStatus ?? DocumentKnowledgeStatusEnum.NONE
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const processingService: any = {
		loadSnapshot: jest.fn().mockResolvedValue(document),
		runExtraction: jest.fn().mockResolvedValue(undefined),
		markExtractionFailed: jest.fn().mockResolvedValue(undefined),
		markKnowledgeFailed: jest.fn().mockResolvedValue(undefined),
		...overrides.processing
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const queueService: any = {
		enqueue: overrides.enqueue ?? jest.fn().mockResolvedValue(true),
		jobIdFor: (jobName: string, documentId: string) =>
			`docs:${jobName.startsWith('docs.') ? jobName.slice(5) : jobName}:${documentId}`
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const recoveryService: any = { runScan: jest.fn().mockResolvedValue({}) };
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const classifierService: any = overrides.classifierService ?? {
		classify: jest.fn().mockResolvedValue('classified')
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const thumbnailService: any = overrides.thumbnailService ?? { generate: jest.fn().mockResolvedValue('generated') };
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const docsFeatureService: any = { isEnabledFor: jest.fn().mockResolvedValue(overrides.featureEnabled ?? true) };

	const pipeline = new DocsPipelineService(
		processingService,
		queueService,
		recoveryService,
		classifierService,
		overrides.indexService ?? {},
		thumbnailService,
		docsFeatureService
	);
	const logger = {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		error: jest.spyOn((pipeline as any).logger, 'error').mockImplementation(() => undefined),
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		log: jest.spyOn((pipeline as any).logger, 'log').mockImplementation(() => undefined),
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		warn: jest.spyOn((pipeline as any).logger, 'warn').mockImplementation(() => undefined)
	};

	return { pipeline, queueService, processingService, classifierService, logger };
}

/** Every line the pipeline logged, at any level. */
function allLogLines(logger: ReturnType<typeof buildPipeline>['logger']): string[] {
	return [...logger.log.mock.calls, ...logger.warn.mock.calls, ...logger.error.mock.calls].map(([line]) =>
		String(line)
	);
}

describe('DocsPipelineService — correlation id survives the chain', () => {
	it('carries correlationId from docs.extract into the chained docs.classify payload', async () => {
		const { pipeline, queueService } = buildPipeline();

		await pipeline.handleExtract(inlineStageJob('docs:extract:doc-1', PAYLOAD_WITH_CORRELATION_ID));

		expect(queueService.enqueue).toHaveBeenCalledWith(
			'docs.classify',
			expect.objectContaining({ correlationId: 'correlation-abc' }),
			expect.anything()
		);
	});

	it('is absent (not "undefined" as a string, not dropped-silently-into-something-truthy) for a system-initiated run with no correlation id', async () => {
		const { pipeline, queueService } = buildPipeline();

		await pipeline.handleExtract(inlineStageJob('docs:extract:doc-1', PAYLOAD_WITHOUT_CORRELATION_ID));

		const [, forwardedPayload] = queueService.enqueue.mock.calls[0];
		expect(forwardedPayload.correlationId).toBeUndefined();
	});
});

describe('DocsPipelineService — correlation id on worker-stage outcome and error log lines', () => {
	it('tags the docs.classify outcome line', async () => {
		const { pipeline, logger } = buildPipeline();

		await pipeline.handleClassify(inlineStageJob('docs:classify:doc-1', PAYLOAD_WITH_CORRELATION_ID));

		expect(logger.log).toHaveBeenCalledWith(
			'docs.classify outcome for document doc-1 (correlationId correlation-abc): classified'
		);
	});

	it('still processes a job enqueued before the field existed, and logs its outcome exactly as before', async () => {
		const { pipeline, classifierService, queueService, logger } = buildPipeline({
			knowledgeStatus: DocumentKnowledgeStatusEnum.QUEUED
		});

		await pipeline.handleClassify(inlineStageJob('docs:classify:doc-1', PAYLOAD_WITHOUT_CORRELATION_ID));

		expect(classifierService.classify).toHaveBeenCalledTimes(1);
		expect(queueService.enqueue).toHaveBeenCalledWith('docs.chunk', expect.anything(), expect.anything());
		expect(logger.log).toHaveBeenCalledWith('docs.classify outcome for document doc-1: classified');
		expect(allLogLines(logger).some((line) => line.includes('correlationId'))).toBe(false);
	});

	it('tags the docs.thumbnail outcome line, and its cosmetic failure line', async () => {
		const ok = buildPipeline();
		await ok.pipeline.handleThumbnail(inlineStageJob('docs:thumbnail:doc-1', PAYLOAD_WITH_CORRELATION_ID));
		expect(ok.logger.log).toHaveBeenCalledWith(
			'docs.thumbnail outcome for document doc-1 (correlationId correlation-abc): generated'
		);

		const failing = buildPipeline({
			thumbnailService: { generate: jest.fn().mockRejectedValue(new Error('resize failed')) }
		});
		await failing.pipeline.handleThumbnail(inlineStageJob('docs:thumbnail:doc-1', PAYLOAD_WITH_CORRELATION_ID));
		expect(failing.logger.warn).toHaveBeenCalledWith(
			'docs.thumbnail failed for document doc-1 (correlationId correlation-abc): resize failed ' +
				'(cosmetic — the document is unaffected)'
		);
	});

	it('puts it inside the stage-error parenthetical, and leaves that line unchanged without one', async () => {
		const failingChunk = () =>
			buildPipeline({
				knowledgeStatus: DocumentKnowledgeStatusEnum.QUEUED,
				indexService: { runChunkStage: jest.fn().mockRejectedValue(new Error('bad input')) }
			});

		const tagged = failingChunk();
		await tagged.pipeline.handleChunk(inlineStageJob('docs:chunk:doc-1', PAYLOAD_WITH_CORRELATION_ID));
		expect(tagged.logger.error).toHaveBeenCalledWith(
			'docs.knowledge failed for document doc-1 (attempt 1/1, transient=false, correlationId correlation-abc): bad input'
		);

		const legacy = failingChunk();
		await legacy.pipeline.handleChunk(inlineStageJob('docs:chunk:doc-1', PAYLOAD_WITHOUT_CORRELATION_ID));
		expect(legacy.logger.error).toHaveBeenCalledWith(
			'docs.knowledge failed for document doc-1 (attempt 1/1, transient=false): bad input'
		);
		expect(legacy.processingService.markKnowledgeFailed).toHaveBeenCalledTimes(1);
	});

	it('tags the inline dead-letter line and the dead-letter-write failure line', async () => {
		const { pipeline, logger } = buildPipeline({
			// Escape the handler's own try/catch: fail on the chained enqueue, which is outside it.
			enqueue: jest.fn().mockRejectedValue(new Error('boom')),
			processing: { markExtractionFailed: jest.fn().mockRejectedValue(new Error('db is down too')) }
		});

		await pipeline.runStageSafely(
			DOCS_JOB_EXTRACT,
			inlineStageJob('docs:extract:doc-1', PAYLOAD_WITH_CORRELATION_ID)
		);

		expect(logger.error).toHaveBeenCalledWith(
			'docs.extract failed inline for document doc-1 (correlationId correlation-abc): boom'
		);
		expect(logger.error).toHaveBeenCalledWith(
			'Failed to dead-letter docs.extract for document doc-1 (correlationId correlation-abc): db is down too'
		);
	});

	it('tags the enqueue-failure warnings of the park and thumbnail paths', async () => {
		const parked = buildPipeline({
			featureEnabled: false,
			enqueue: jest.fn().mockRejectedValue(new Error('redis down'))
		});
		await parked.pipeline.runStage(
			DOCS_JOB_CLASSIFY,
			inlineStageJob('docs:classify:doc-1', PAYLOAD_WITH_CORRELATION_ID)
		);
		expect(parked.logger.warn).toHaveBeenCalledWith(
			'Could not park docs.classify for document doc-1 (correlationId correlation-abc): redis down'
		);

		const thumbnail = buildPipeline({
			mimeType: 'image/png',
			enqueue: jest.fn((jobName: string) =>
				jobName === 'docs.thumbnail' ? Promise.reject(new Error('queue down')) : Promise.resolve(true)
			)
		});
		await thumbnail.pipeline.handleExtract(inlineStageJob('docs:extract:doc-1', PAYLOAD_WITH_CORRELATION_ID));
		expect(thumbnail.logger.warn).toHaveBeenCalledWith(
			'Could not enqueue docs.thumbnail for document doc-1 (correlationId correlation-abc): queue down ' +
				'(cosmetic — extraction is unaffected)'
		);
	});

	it('never interpolates any other payload content into those lines', async () => {
		const { pipeline, logger } = buildPipeline({
			classifierService: { classify: jest.fn().mockRejectedValue(new Error('provider exploded')) }
		});
		const payload = {
			...PAYLOAD_WITH_CORRELATION_ID,
			initiatedByUserId: 'user-must-not-be-logged'
		};

		await pipeline.runStageSafely(DOCS_JOB_CLASSIFY, inlineStageJob('docs:classify:doc-1', payload));

		const lines = allLogLines(logger);
		expect(lines.some((line) => line.includes('correlation-abc'))).toBe(true);
		expect(lines.some((line) => line.includes('user-must-not-be-logged'))).toBe(false);
	});
});
