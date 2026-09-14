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
	function buildService(): DocumentProcessingService {
		// snapshotOf() touches none of these five collaborators.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		return new DocumentProcessingService({} as any, {} as any, {} as any, {} as any, {} as any);
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
});
