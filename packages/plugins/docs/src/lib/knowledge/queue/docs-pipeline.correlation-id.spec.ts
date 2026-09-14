/**
 * TASK 9 (improvement roadmap) — Unified Observability and Correlation IDs.
 *
 * Real review finding on this PR: `DocsPipelineService.baseOf()` — the function that carries the
 * tenant/organization snapshot forward at every chain hop (extract -> classify -> chunk -> embed ->
 * index/thumbnail) — enumerated the fields it copies and had not been updated to include the new
 * `correlationId` field, so it was silently dropped at the very first hop. Every later stage, and
 * every requeue, lost the id that ties its logs back to the request that started the run — the
 * propagation TASK 9 set out to add never actually survived past `docs.extract`.
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
import { DocsPipelineService } from './docs-pipeline.service';
import { inlineStageJob } from './docs-pipeline.types';

const PAYLOAD_WITH_CORRELATION_ID = {
	documentId: 'doc-1',
	tenantId: 'tenant-1',
	organizationId: 'org-1',
	reason: 'upload' as const,
	correlationId: 'correlation-abc'
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPipeline(overrides: { indexService?: any } = {}) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const document: any = {
		id: 'doc-1',
		tenantId: 'tenant-1',
		organizationId: 'org-1',
		knowledgeStatus: DocumentKnowledgeStatusEnum.NONE // not in the knowledge system -> no thumbnail/chunk branch noise
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const processingService: any = {
		loadSnapshot: jest.fn().mockResolvedValue(document),
		runExtraction: jest.fn().mockResolvedValue(undefined)
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const queueService: any = {
		enqueue: jest.fn().mockResolvedValue(true),
		jobIdFor: (jobName: string, documentId: string) =>
			`docs:${jobName.startsWith('docs.') ? jobName.slice(5) : jobName}:${documentId}`
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const recoveryService: any = { runScan: jest.fn().mockResolvedValue({}) };
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const classifierService: any = { classify: jest.fn().mockResolvedValue('classified') };
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const thumbnailService: any = { generate: jest.fn().mockResolvedValue('generated') };
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const docsFeatureService: any = { isEnabledFor: jest.fn().mockResolvedValue(true) };

	const pipeline = new DocsPipelineService(
		processingService,
		queueService,
		recoveryService,
		classifierService,
		overrides.indexService ?? {},
		thumbnailService,
		docsFeatureService
	);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	jest.spyOn((pipeline as any).logger, 'error').mockImplementation(() => undefined);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	jest.spyOn((pipeline as any).logger, 'log').mockImplementation(() => undefined);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	jest.spyOn((pipeline as any).logger, 'warn').mockImplementation(() => undefined);

	return { pipeline, queueService };
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
		const { correlationId, ...withoutCorrelationId } = PAYLOAD_WITH_CORRELATION_ID;
		void correlationId;

		await pipeline.handleExtract(inlineStageJob('docs:extract:doc-1', withoutCorrelationId));

		const [, forwardedPayload] = queueService.enqueue.mock.calls[0];
		expect(forwardedPayload.correlationId).toBeUndefined();
	});
});
