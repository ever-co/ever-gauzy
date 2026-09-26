/**
 * TASK 9 (improvement roadmap) — Unified Observability and Correlation IDs.
 *
 * `bulkReindex()` is the one docs queue producer that builds its job payload by hand instead of
 * through `DocumentProcessingService.snapshotOf()`, so it is the one place the request's correlation
 * id can be forgotten. These tests pin that every enqueued `docs.chunk` payload of the sweep carries
 * it, that it is absent (not a string "undefined", not a null) with no request context, and that
 * nothing else about the sweep's payload/options changed.
 *
 * `@gauzy/core` boots the entire application graph on import (entities -> bootstrap), so — same as
 * `document-processing.snapshot.spec.ts` — `RequestContext` is mocked at the module boundary, and
 * every collaborator the service's imports would pull in is stubbed; `bulkReindex()` itself is real.
 */
jest.mock('@gauzy/core', () => ({
	RequestContext: {
		currentTenantId: jest.fn(),
		currentUserId: jest.fn(),
		currentCorrelationId: jest.fn()
	}
}));
jest.mock('../docs.config', () => ({ getDocsConfig: () => ({ embeddingModel: 'test-embedding-model' }) }));
jest.mock('../dto', () => ({}));
jest.mock('../entities/document.entity', () => ({ Document: class {} }));
jest.mock('../knowledge/ai/docs-ai.service', () => ({ DocsAiService: class {} }));
jest.mock('../knowledge/indexing/document-index.service', () => ({ DocumentIndexService: class {} }));
jest.mock('../knowledge/queue/docs-queue.service', () => ({ DocsQueueService: class {} }));
jest.mock('../knowledge/vector-store/vector-store.registry', () => ({
	DocumentVectorStoreRegistry: { get: jest.fn() }
}));
jest.mock('../repositories/type-orm-document.repository', () => ({ TypeOrmDocumentRepository: class {} }));
jest.mock('./document-processing.service', () => ({ DocumentProcessingService: class {} }));
jest.mock('./document.service', () => ({ DocumentService: class {} }));

import { RequestContext } from '@gauzy/core';
import { DOCS_JOB_CHUNK } from '../knowledge/queue/constants';
import { DocumentKnowledgeService } from './document-knowledge.service';

describe('DocumentKnowledgeService.bulkReindex — correlation id propagation', () => {
	function buildService() {
		const documentService = { resolveOrganizationId: jest.fn().mockReturnValue('org-1') };
		const documentIndexService = {
			expectedEmbeddingModel: jest.fn().mockResolvedValue('test-embedding-model'),
			findModelDriftDocumentIds: jest.fn().mockResolvedValue(['doc-drifted'])
		};
		const docsQueueService = { enqueue: jest.fn().mockResolvedValue(true) };
		const typeOrmDocumentRepository = {
			find: jest.fn().mockResolvedValue([{ id: 'doc-1' }, { id: 'doc-2' }])
		};

		const service = new DocumentKnowledgeService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			documentService as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			documentIndexService as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			docsQueueService as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			typeOrmDocumentRepository as any
		);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);

		return { service, docsQueueService };
	}

	beforeEach(() => {
		(RequestContext.currentTenantId as jest.Mock).mockReturnValue('tenant-1');
		(RequestContext.currentUserId as jest.Mock).mockReturnValue('user-1');
	});

	afterEach(() => jest.resetAllMocks());

	it('stamps the request correlation id onto every enqueued docs.chunk payload (scope "all")', async () => {
		(RequestContext.currentCorrelationId as jest.Mock).mockReturnValue('correlation-abc');
		const { service, docsQueueService } = buildService();

		const result = await service.bulkReindex({ scope: 'all' });

		expect(result).toEqual({ scope: 'all', dryRun: false, affected: 2 });
		expect(docsQueueService.enqueue).toHaveBeenCalledTimes(2);
		for (const documentId of ['doc-1', 'doc-2']) {
			// The rest of the payload and the low-priority, run-unique options are unchanged.
			expect(docsQueueService.enqueue).toHaveBeenCalledWith(
				DOCS_JOB_CHUNK,
				{
					documentId,
					tenantId: 'tenant-1',
					organizationId: 'org-1',
					reason: 'reindex',
					initiatedByUserId: 'user-1',
					correlationId: 'correlation-abc',
					force: true
				},
				{ jobId: expect.stringMatching(new RegExp(`^docs:chunk:${documentId}:\\d+$`)), priority: 10 }
			);
		}
	});

	it('stamps it on the model-drift sweep too', async () => {
		(RequestContext.currentCorrelationId as jest.Mock).mockReturnValue('correlation-abc');
		const { service, docsQueueService } = buildService();

		await service.bulkReindex();

		expect(docsQueueService.enqueue).toHaveBeenCalledWith(
			DOCS_JOB_CHUNK,
			expect.objectContaining({
				documentId: 'doc-drifted',
				reason: 'model-changed',
				force: false,
				correlationId: 'correlation-abc'
			}),
			expect.objectContaining({ priority: 10 })
		);
	});

	it('leaves correlationId absent when there is no request correlation id, and still enqueues', async () => {
		(RequestContext.currentCorrelationId as jest.Mock).mockReturnValue(null);
		const { service, docsQueueService } = buildService();

		await service.bulkReindex({ scope: 'all' });

		expect(docsQueueService.enqueue).toHaveBeenCalledTimes(2);
		for (const [, payload] of docsQueueService.enqueue.mock.calls) {
			expect(payload.correlationId).toBeUndefined();
		}
	});

	it('enqueues nothing on a dry run', async () => {
		(RequestContext.currentCorrelationId as jest.Mock).mockReturnValue('correlation-abc');
		const { service, docsQueueService } = buildService();

		const result = await service.bulkReindex({ scope: 'all', dryRun: true });

		expect(result).toEqual({ scope: 'all', dryRun: true, affected: 2 });
		expect(docsQueueService.enqueue).not.toHaveBeenCalled();
	});
});
