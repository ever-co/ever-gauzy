/**
 * Regression tests for the two-mode dispatch seam of the `docs-processing` pipeline.
 *
 * The defect these lock down: `DocsQueueService` took `SchedulerQueueService` as a REQUIRED
 * constructor dependency, but `SchedulerModule.forRoot()` — the only thing that provides it —
 * is imported by `apps/worker` alone. Registering the Documents plugin therefore made the
 * whole API fail to bootstrap (`UnknownDependenciesException`), and even if it had booted,
 * nothing would ever have processed an upload: the worker app does not load the plugin list,
 * so no `docs-processing` consumer exists anywhere.
 *
 * The fix is two-part and both parts are asserted here:
 *  1. the queue dependency is `@Optional()` — the service constructs without it;
 *  2. without it, stages are dispatched INLINE to the same pipeline handlers the BullMQ
 *     worker host calls, in the background, coalesced per stage+document.
 */
jest.mock('@gauzy/scheduler', () => ({ SchedulerQueueService: class {} }), { virtual: true });

import { DOCS_JOB_ATTEMPTS, DOCS_JOB_BACKOFF_DELAY_MS } from '../../docs.constants';
import { DOCS_JOB_CHUNK, DOCS_JOB_EXTRACT, DOCS_PROCESSING_QUEUE } from './constants';
import { IDocsJobBase } from './docs-job.types';
import { DOCS_INLINE_JOB_ATTEMPTS, DOCS_PIPELINE_RUNNER } from './docs-pipeline.types';
import { DocsQueueService } from './docs-queue.service';

/** The standard tenant/organization snapshot every job must carry unchanged. */
const PAYLOAD: IDocsJobBase = {
	documentId: 'doc-1',
	tenantId: 'tenant-1',
	organizationId: 'org-1',
	reason: 'upload',
	initiatedByUserId: 'user-1'
};

/** Lets the `setImmediate` dispatch and the awaited runner promise settle. */
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(() => setImmediate(resolve)));

/**
 * Builds the service with a stub pipeline runner reachable through `ModuleRef`.
 *
 * @param schedulerQueueService Pass a stub for queue mode, or omit for inline mode.
 * @param runStageSafely Optional custom runner implementation.
 */
const buildService = (schedulerQueueService?: any, runStageSafely?: jest.Mock) => {
	const runner = { runStageSafely: runStageSafely ?? jest.fn().mockResolvedValue(undefined) };
	const moduleRef: any = {
		get: jest.fn((token: unknown) => {
			if (token === DOCS_PIPELINE_RUNNER) {
				return runner;
			}
			throw new Error(`Unknown token ${String(token)}`);
		})
	};
	const service = new DocsQueueService(moduleRef, schedulerQueueService);
	return { service, runner, moduleRef };
};

describe('DocsQueueService — optional queue injection', () => {
	it('constructs without a SchedulerQueueService (the API has no scheduler root)', () => {
		const { service } = buildService();

		expect(service).toBeInstanceOf(DocsQueueService);
		expect(service.isQueued).toBe(false);
	});

	it('reports the active dispatch mode once, at startup', () => {
		const inline = buildService().service;
		const queued = buildService({ enqueue: jest.fn() }).service;

		const inlineLog = jest.spyOn((inline as any).logger, 'log').mockImplementation(() => undefined);
		const queuedLog = jest.spyOn((queued as any).logger, 'log').mockImplementation(() => undefined);

		inline.onModuleInit();
		queued.onModuleInit();

		expect(inlineLog).toHaveBeenCalledTimes(1);
		expect(inlineLog.mock.calls[0][0]).toContain('INLINE');
		expect(queuedLog).toHaveBeenCalledTimes(1);
		expect(queuedLog.mock.calls[0][0]).toContain('QUEUED');
	});
});

describe('DocsQueueService — queue mode', () => {
	it('enqueues with the deterministic job id and the standard retry/backoff policy', async () => {
		const enqueue = jest.fn().mockResolvedValue(undefined);
		const { service, runner } = buildService({ enqueue });

		await expect(service.enqueue(DOCS_JOB_EXTRACT, PAYLOAD)).resolves.toBe(true);
		await flush();

		expect(enqueue).toHaveBeenCalledTimes(1);
		expect(enqueue.mock.calls[0][0]).toEqual({
			queueName: DOCS_PROCESSING_QUEUE,
			jobName: DOCS_JOB_EXTRACT,
			data: PAYLOAD,
			options: {
				jobId: 'docs:extract:doc-1',
				attempts: DOCS_JOB_ATTEMPTS,
				backoff: { type: 'exponential', delay: DOCS_JOB_BACKOFF_DELAY_MS },
				removeOnComplete: 500,
				removeOnFail: 1000
			}
		});
		// Queue mode must NOT also run the stage in-process.
		expect(runner.runStageSafely).not.toHaveBeenCalled();
	});

	it('lets an explicit run-unique job id override the deterministic one', async () => {
		const enqueue = jest.fn().mockResolvedValue(undefined);
		const { service } = buildService({ enqueue });

		await service.enqueue(DOCS_JOB_CHUNK, PAYLOAD, { jobId: 'docs:chunk:doc-1:1700000000000', priority: 10 });

		expect(enqueue.mock.calls[0][0].options).toMatchObject({
			jobId: 'docs:chunk:doc-1:1700000000000',
			priority: 10
		});
	});

	it('degrades to the inline runner when the queue rejects the enqueue', async () => {
		const enqueue = jest.fn().mockRejectedValue(new Error('Queueing is disabled.'));
		const { service, runner } = buildService({ enqueue });
		jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
		jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
		jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);

		await expect(service.enqueue(DOCS_JOB_EXTRACT, PAYLOAD)).resolves.toBe(true);
		await flush();

		expect(runner.runStageSafely).toHaveBeenCalledTimes(1);
		expect(runner.runStageSafely.mock.calls[0][0]).toBe(DOCS_JOB_EXTRACT);
	});
});

describe('DocsQueueService — inline mode', () => {
	it('dispatches the stage to the pipeline runner in the background, snapshot intact', async () => {
		const { service, runner } = buildService();
		jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);

		// Resolves before the stage has run — the HTTP request is never blocked.
		await expect(service.enqueue(DOCS_JOB_EXTRACT, PAYLOAD)).resolves.toBe(true);
		expect(runner.runStageSafely).not.toHaveBeenCalled();

		await flush();

		expect(runner.runStageSafely).toHaveBeenCalledTimes(1);
		const [jobName, stageJob] = runner.runStageSafely.mock.calls[0];
		expect(jobName).toBe(DOCS_JOB_EXTRACT);
		expect(stageJob.data).toEqual(PAYLOAD);
		expect(stageJob.id).toBe('docs:extract:doc-1');
		// Inline mode is a single immediate attempt — see DOCS_INLINE_JOB_ATTEMPTS.
		expect(stageJob.attempts).toBe(DOCS_INLINE_JOB_ATTEMPTS);
		expect(stageJob.attemptsMade).toBe(0);
		expect(stageJob.discard()).toBeUndefined();
	});

	it('coalesces a duplicate trigger while the same stage is still running', async () => {
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const runStageSafely = jest.fn().mockReturnValue(gate);
		const { service, runner } = buildService(undefined, runStageSafely);
		jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);

		await service.enqueue(DOCS_JOB_EXTRACT, PAYLOAD);
		await flush();
		expect(runner.runStageSafely).toHaveBeenCalledTimes(1);

		// Second trigger for the SAME stage + document while the first is in flight.
		await expect(service.enqueue(DOCS_JOB_EXTRACT, PAYLOAD)).resolves.toBe(true);
		await flush();
		expect(runner.runStageSafely).toHaveBeenCalledTimes(1);

		// A different stage for the same document is NOT coalesced — the chain must flow.
		await service.enqueue(DOCS_JOB_CHUNK, PAYLOAD);
		await flush();
		expect(runner.runStageSafely).toHaveBeenCalledTimes(2);

		// Once the first run finishes the guard is released and the stage can run again.
		release();
		await flush();
		await service.enqueue(DOCS_JOB_EXTRACT, PAYLOAD);
		await flush();
		expect(runner.runStageSafely).toHaveBeenCalledTimes(3);
	});

	it('releases the in-flight guard even when the runner rejects, and never rejects itself', async () => {
		const runStageSafely = jest.fn().mockRejectedValue(new Error('pipeline exploded'));
		const { service, runner } = buildService(undefined, runStageSafely);
		const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
		jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);

		const unhandled = jest.fn();
		process.on('unhandledRejection', unhandled);
		try {
			await expect(service.enqueue(DOCS_JOB_EXTRACT, PAYLOAD)).resolves.toBe(true);
			await flush();
			await flush();
		} finally {
			process.off('unhandledRejection', unhandled);
		}

		expect(unhandled).not.toHaveBeenCalled();
		expect(errorSpy).toHaveBeenCalled();

		// Guard released: the next trigger runs.
		await service.enqueue(DOCS_JOB_EXTRACT, PAYLOAD);
		await flush();
		expect(runner.runStageSafely).toHaveBeenCalledTimes(2);
	});

	it('logs instead of throwing when no pipeline runner is registered', async () => {
		const moduleRef: any = {
			get: jest.fn(() => {
				throw new Error('Nest could not find DOCS_PIPELINE_RUNNER');
			})
		};
		const service = new DocsQueueService(moduleRef);
		const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
		jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);

		await expect(service.enqueue(DOCS_JOB_EXTRACT, PAYLOAD)).resolves.toBe(true);
		await flush();

		expect(errorSpy).toHaveBeenCalledTimes(1);
		expect(errorSpy.mock.calls[0][0]).toContain(DOCS_PIPELINE_RUNNER);
		// Resolution is cached as "unavailable" — no repeated ModuleRef lookups per job.
		await service.enqueue(DOCS_JOB_CHUNK, PAYLOAD);
		await flush();
		expect(moduleRef.get).toHaveBeenCalledTimes(1);
	});
});
