/**
 * Recovery-scan enqueue regression tests.
 *
 * The scan is the safety net that unsticks documents whose pipeline job was lost. It only
 * ever works if its enqueues actually reach the queue: BullMQ **silently discards** an
 * `add()` whose job id already exists — including ids still retained in the completed set
 * (`removeOnComplete: 500`), which is exactly the state of a document that finished a stage
 * and then got stuck. Re-enqueueing with the plain deterministic `docs:<stage>:<id>` id
 * therefore reported success and did nothing.
 *
 * `@gauzy/scheduler` and the Nest/TypeORM seams are mocked at the module boundary; the
 * service under test is real.
 */
jest.mock('@gauzy/scheduler', () => ({ ScheduledJob: () => () => undefined }), { virtual: true });
jest.mock('../../entities/document.entity', () => ({ Document: class {} }));
jest.mock('../../repositories/type-orm-document.repository', () => ({ TypeOrmDocumentRepository: class {} }));
jest.mock('../../repositories/type-orm-document-index-state.repository', () => ({
	TypeOrmDocumentIndexStateRepository: class {}
}));
jest.mock('../ai/docs-ai.service', () => ({ DocsAiService: class {} }));
jest.mock('./docs-queue.service', () => ({ DocsQueueService: class {} }));
jest.mock('../vector-store/vector-store.registry', () => ({
	DocumentVectorStoreRegistry: { resolve: async () => null }
}));
jest.mock('../../docs.config', () => ({
	getDocsConfig: () => ({
		stuckThresholdMinutes: 30,
		aiEnabled: false,
		autoReindexOnModelChange: false,
		embeddingModel: 'text-embedding-3-small'
	})
}));

import { DocumentKindEnum, DocumentKnowledgeStatusEnum, DocumentStatusEnum } from '@gauzy/contracts';
import { DOCS_JOB_CHUNK, DOCS_JOB_EXTRACT } from './constants';
import { DocsRecoveryService } from './docs-recovery.service';

/** One recovery candidate, `ageMinutes` old. */
const candidate = (overrides: Record<string, unknown>, ageMinutes: number) => ({
	id: 'doc-1',
	tenantId: 'tenant-1',
	organizationId: 'org-1',
	kind: DocumentKindEnum.FILE,
	status: DocumentStatusEnum.READY,
	knowledgeStatus: DocumentKnowledgeStatusEnum.NONE,
	updatedAt: new Date(Date.now() - ageMinutes * 60_000),
	...overrides
});

/**
 * Builds the service with stub collaborators, returning the enqueue spy alongside it.
 */
const buildService = (candidates: any[]) => {
	const enqueue = jest.fn().mockResolvedValue(true);
	const queueService: any = {
		enqueue,
		// The real deterministic-id builder — the point of the test is what is added TO it.
		jobIdFor: (jobName: string, documentId: string) =>
			`docs:${jobName.startsWith('docs.') ? jobName.slice(5) : jobName}:${documentId}`
	};
	const documentRepository: any = { find: jest.fn().mockResolvedValue(candidates), update: jest.fn() };
	const indexStateRepository: any = {
		createQueryBuilder: () => ({
			select: () => indexStateRepository.createQueryBuilder(),
			addSelect: () => indexStateRepository.createQueryBuilder(),
			groupBy: () => indexStateRepository.createQueryBuilder(),
			getRawMany: async () => []
		})
	};
	const aiService: any = { embeddingProviderConfigured: () => false };

	const service = new DocsRecoveryService(documentRepository, indexStateRepository, queueService, aiService);
	return { service, enqueue, documentRepository };
};

describe('DocsRecoveryService — re-enqueue job ids', () => {
	it('gives a recovered EXTRACT a run-unique job id (a retained completed job must not swallow it)', async () => {
		const { service, enqueue } = buildService([candidate({ status: DocumentStatusEnum.UPLOADED }, 60)]);

		const counters = await service.runScan('reconcile');

		expect(counters['reenqueue-extract']).toBe(1);
		const [jobName, payload, options] = enqueue.mock.calls[0];
		expect(jobName).toBe(DOCS_JOB_EXTRACT);
		expect(payload).toMatchObject({ documentId: 'doc-1', reason: 'recovery' });
		// The plain deterministic id is the bug — the id must carry a run suffix.
		expect(options.jobId).not.toBe('docs:extract:doc-1');
		expect(options.jobId).toMatch(/^docs:extract:doc-1:\d+$/);
	});

	it('gives a recovered CHUNK a run-unique job id', async () => {
		const { service, enqueue } = buildService([
			candidate({ knowledgeStatus: DocumentKnowledgeStatusEnum.QUEUED }, 60)
		]);

		const counters = await service.runScan('reconcile');

		expect(counters['reenqueue-chunk']).toBe(1);
		const [jobName, , options] = enqueue.mock.calls[0];
		expect(jobName).toBe(DOCS_JOB_CHUNK);
		expect(options.jobId).not.toBe('docs:chunk:doc-1');
		expect(options.jobId).toMatch(/^docs:chunk:doc-1:\d+$/);
	});

	it('shares one run id inside a sweep but issues a fresh one on the next sweep', async () => {
		const { service, enqueue } = buildService([
			candidate({ id: 'doc-1', status: DocumentStatusEnum.UPLOADED }, 60),
			candidate({ id: 'doc-2', status: DocumentStatusEnum.UPLOADED }, 60)
		]);

		await service.runScan('startup');
		const firstSweep = enqueue.mock.calls.map((call: any[]) => String(call[2].jobId));
		expect(firstSweep).toHaveLength(2);
		// Same suffix inside one sweep — duplicates in a single scan still coalesce.
		expect(firstSweep[0].split(':')[3]).toBe(firstSweep[1].split(':')[3]);

		enqueue.mockClear();
		// A later sweep of the STILL-stuck rows must not reuse the ids BullMQ now retains.
		jest.useFakeTimers().setSystemTime(Date.now() + 600_000);
		try {
			await service.runScan('reconcile');
		} finally {
			jest.useRealTimers();
		}
		const secondSweep = enqueue.mock.calls.map((call: any[]) => String(call[2].jobId));

		expect(secondSweep).toHaveLength(2);
		expect(secondSweep[0]).not.toBe(firstSweep[0]);
		expect(secondSweep[1]).not.toBe(firstSweep[1]);
	});
});
