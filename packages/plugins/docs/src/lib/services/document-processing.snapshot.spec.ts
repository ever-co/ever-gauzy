/**
 * TASK 9 (improvement roadmap) — Unified Observability and Correlation IDs.
 *
 * `@gauzy/core` boots the entire application graph on import (entities -> bootstrap), so — same as
 * `document-processing.transitions.spec.ts` — the framework seam this test touches
 * (`RequestContext`) is mocked at the module boundary; `snapshotOf()` itself is real.
 */
jest.mock(
	'@gauzy/core',
	() => ({
		FileStorage: class {},
		EventBus: class {},
		RequestContext: {
			currentUserId: jest.fn(),
			currentCorrelationId: jest.fn()
		}
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

import { IDocument } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { DocumentProcessingService } from './document-processing.service';

describe('DocumentProcessingService.snapshotOf — correlation id propagation', () => {
	function buildService(docsQueueService?: { enqueue: jest.Mock }): DocumentProcessingService {
		// snapshotOf() touches none of these five collaborators; enqueueExtract() additionally needs
		// the queue service (3rd param) when a test drives it instead of snapshotOf() directly.
		return new DocumentProcessingService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(docsQueueService ?? {}) as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any
		);
	}

	const document = { id: 'doc-1', tenantId: 'tenant-1', organizationId: 'org-1' } as IDocument;

	afterEach(() => jest.resetAllMocks());

	it('stamps the current correlation id onto the job snapshot', () => {
		(RequestContext.currentCorrelationId as jest.Mock).mockReturnValue('correlation-abc');
		(RequestContext.currentUserId as jest.Mock).mockReturnValue('user-1');

		const snapshot = buildService().snapshotOf(document, 'upload');

		expect(snapshot.correlationId).toBe('correlation-abc');
		expect(snapshot).toMatchObject({
			documentId: 'doc-1',
			tenantId: 'tenant-1',
			organizationId: 'org-1',
			reason: 'upload',
			initiatedByUserId: 'user-1'
		});
	});

	it('leaves correlationId undefined for a system-initiated run with no active request', () => {
		(RequestContext.currentCorrelationId as jest.Mock).mockReturnValue(null);
		(RequestContext.currentUserId as jest.Mock).mockReturnValue(null);

		const snapshot = buildService().snapshotOf(document, 'recovery');

		expect(snapshot.correlationId).toBeUndefined();
		expect(snapshot.initiatedByUserId).toBeUndefined();
	});

	it('does not let RequestContext throwing break the snapshot (queue-thread safety)', () => {
		(RequestContext.currentCorrelationId as jest.Mock).mockImplementation(() => {
			throw new Error('no active request context');
		});

		const snapshot = buildService().snapshotOf(document, 'reindex');

		expect(snapshot.correlationId).toBeUndefined();
		expect(snapshot.documentId).toBe('doc-1');
	});

	// The tests above only prove `snapshotOf()` stamps a correlationId onto the object it returns —
	// none of them proves that id actually reaches a QUEUED job payload, which is the only place it
	// does any good (`DocsPipelineService.baseOf()` is the id's next hop, covered by
	// `docs-pipeline.correlation-id.spec.ts`). `enqueueExtract()` is the real entry point that does
	// `snapshotOf()` + `docsQueueService.enqueue()`; drive that instead of `snapshotOf()` alone.
	it('reaches the queued docs.extract payload via enqueueExtract()', async () => {
		(RequestContext.currentCorrelationId as jest.Mock).mockReturnValue('correlation-abc');
		(RequestContext.currentUserId as jest.Mock).mockReturnValue('user-1');
		const enqueue = jest.fn().mockResolvedValue(true);

		await buildService({ enqueue }).enqueueExtract(document, 'upload');

		expect(enqueue).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ correlationId: 'correlation-abc' }),
			expect.anything()
		);
	});
});
