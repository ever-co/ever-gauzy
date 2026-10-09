/**
 * Per-tenant fairness of the AI-heavy pipeline stages (`07-ai-knowledge.md` §3.1/§15).
 *
 * The defect these lock down: the worker had a single flat `concurrency` and the queue service
 * set no `priority`, so nothing in the pipeline knew *who* queued the work. `DocsQueueService`'s
 * `inFlight` set is per-**document** dedupe, not fairness — two documents of the same tenant were
 * never coalesced. One tenant's bulk import therefore filled every slot on every worker, and
 * every other tenant's classification and embedding waited behind it while it monopolized the
 * shared provider rate limit.
 *
 * Both halves of the fix are asserted here:
 *  1. `DocsProcessingWorker` holds a per-tenant in-flight counter around `classify`/`embed` and
 *     hands a job back to the delayed set (`moveToDelayed` + `DelayedError`) when its tenant is
 *     at the cap — never failing it, never dropping it, never blocking the slot;
 *  2. `DocsQueueService` enqueues bulk-import work (`reason: 'import'`) at a lower BullMQ
 *     priority, so it sinks below the interactive uploads and saves already in the queue.
 *
 * `handleExtract` — deliberately NOT serialized — is driven through the same harness as a
 * known-dirty control: it reproduces the starvation the cap removes.
 */
jest.mock(
	'@gauzy/scheduler',
	() => ({
		QueueWorker: () => () => undefined,
		QueueJobHandler: () => () => undefined,
		QueueWorkerHost: class {},
		SchedulerQueueService: class {}
	}),
	{ virtual: true }
);
jest.mock('./docs-pipeline.service', () => ({ DocsPipelineService: class {} }));
jest.mock('../../docs.config', () => ({ getDocsConfig: () => ({ queueConcurrency: 2 }) }));

import {
	DOCS_BULK_IMPORT_JOB_PRIORITY,
	DOCS_TENANT_AI_CONCURRENCY,
	DOCS_TENANT_BUSY_DEFER_DELAY_MS
} from '../../docs.constants';
import { DOCS_JOB_CLASSIFY, DOCS_JOB_EMBED, DOCS_JOB_EXTRACT } from './constants';
import { DocsJobReason, IDocsJobBase } from './docs-job.types';
import { DocsProcessingWorker } from './docs-processing.worker';
import { DocsQueueService } from './docs-queue.service';

/** The lock token BullMQ hands every handler; `moveToDelayed` is refused without one. */
const TOKEN = 'lock-token';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

/** A minimal BullMQ job stand-in that records its `moveToDelayed` calls. */
const jobOf = (name: string, tenantId: string, documentId: string, reason: DocsJobReason = 'import') => {
	const job: any = {
		id: `${name}:${documentId}`,
		name,
		attemptsMade: 0,
		opts: { attempts: 3 },
		data: { documentId, tenantId, organizationId: `org-${tenantId}`, reason },
		deferrals: [] as { timestamp: number; token?: string }[]
	};
	job.moveToDelayed = jest.fn(async (timestamp: number, token?: string) => {
		job.deferrals.push({ timestamp, token });
	});
	return job;
};

/**
 * A pipeline stub that measures, per tenant, how many stage bodies are running at once and in
 * what order they started. Every body yields to the event loop, so the driver's other slot really
 * does overlap with it — a synchronous stub could never observe a concurrency violation.
 */
const buildPipeline = () => {
	const running = new Map<string, number>();
	const peak = new Map<string, number>();
	/** The tenant of every stage body that actually RAN, in start order. */
	const order: string[] = [];

	const stage = jest.fn(async (stageJob: any) => {
		const tenantId = stageJob.data.tenantId as string;
		order.push(tenantId);
		const now = (running.get(tenantId) ?? 0) + 1;
		running.set(tenantId, now);
		peak.set(tenantId, Math.max(peak.get(tenantId) ?? 0, now));
		await new Promise((resolve) => setImmediate(resolve));
		running.set(tenantId, (running.get(tenantId) ?? 1) - 1);
	});

	const pipeline: any = { handleClassify: stage, handleEmbed: stage, handleExtract: stage };
	return { pipeline, peak, order, stage };
};

/**
 * Drives a worker over a wait list the way a BullMQ worker does.
 *
 * Each slot takes the head of the wait list and runs the handler. A `DelayedError` means the
 * handler already re-homed the job, so it goes to the **delayed set** — not back to the head of
 * the wait list — and only returns once nothing is running, which is what a 5 s delay against a
 * sub-second stage amounts to. (Re-queuing a deferral straight into the wait list would model
 * BullMQ wrongly *and* let one slot spin on microtasks for ever.)
 *
 * @param handler The worker method under test, already bound.
 * @param queue The wait list, head first.
 * @param concurrency How many slots the worker runs.
 * @returns The jobs that were deferred at least once.
 */
const drain = async (handler: (job: any) => Promise<void>, queue: any[], concurrency: number) => {
	const wait = [...queue];
	const delayed: any[] = [];
	const deferred = new Set<any>();
	let active = 0;
	/** Spin guard — the fair path should never come close to it. */
	let budget = queue.length * 100;

	const slot = async (): Promise<void> => {
		for (;;) {
			if (budget-- <= 0) {
				throw new Error('The worker driver spun without making progress — a deferral loop.');
			}
			if (!wait.length) {
				if (active > 0) {
					await new Promise((resolve) => setImmediate(resolve)); // let the other slot finish
					continue;
				}
				if (!delayed.length) {
					return; // nothing waiting, nothing delayed, nothing running
				}
				wait.push(...delayed.splice(0)); // the delay elapsed
				continue;
			}

			const job = wait.shift();
			active++;
			try {
				await handler(job);
			} catch (error) {
				if ((error as Error).name !== 'DelayedError') {
					throw error;
				}
				deferred.add(job);
				delayed.push(job);
			} finally {
				active--;
			}
		}
	};

	await Promise.all(Array.from({ length: concurrency }, () => slot()));
	return deferred;
};

/** Tenant A's 20-document import queued ahead of tenant B's 20-document import. */
const interleavedImports = (jobName: string) => [
	...Array.from({ length: 20 }, (_, i) => jobOf(jobName, TENANT_A, `a-${i}`)),
	...Array.from({ length: 20 }, (_, i) => jobOf(jobName, TENANT_B, `b-${i}`))
];

describe('DocsProcessingWorker — per-tenant serialization of classify/embed', () => {
	it('never runs more than the cap for one tenant, and lets the other tenant in immediately', async () => {
		const { pipeline, peak, order } = buildPipeline();
		const worker = new DocsProcessingWorker(pipeline);
		jest.spyOn((worker as any).logger, 'log').mockImplementation(() => undefined);

		const deferred = await drain(
			(job) => worker.handleClassify(job, TOKEN),
			interleavedImports(DOCS_JOB_CLASSIFY),
			2
		);

		// (1) serialization — neither tenant ever exceeds its own cap.
		expect(peak.get(TENANT_A)).toBe(DOCS_TENANT_AI_CONCURRENCY);
		expect(peak.get(TENANT_B)).toBe(DOCS_TENANT_AI_CONCURRENCY);
		// (2) no starvation — B is served while A's 20-document import is still going.
		expect(order.indexOf(TENANT_B)).toBeLessThan(order.lastIndexOf(TENANT_A));
		expect(order.indexOf(TENANT_B)).toBeLessThanOrEqual(2);
		// (3) nothing is lost — every one of the 40 documents still ran exactly once.
		expect(order).toHaveLength(40);
		expect(order.filter((tenantId) => tenantId === TENANT_A)).toHaveLength(20);
		expect(order.filter((tenantId) => tenantId === TENANT_B)).toHaveLength(20);
		// (4) the fairness valve was actually exercised.
		expect(deferred.size).toBeGreaterThan(0);
	});

	/**
	 * The control. `docs.extract` runs through the same driver without the cap, so it must
	 * reproduce exactly the behaviour the fix removes — otherwise the assertions above would
	 * pass against a harness that cannot see starvation in the first place.
	 */
	it('CONTROL — an unserialized stage does starve the second tenant', async () => {
		const { pipeline, peak, order } = buildPipeline();
		const worker = new DocsProcessingWorker(pipeline);

		await drain((job) => worker.handleExtract(job), interleavedImports(DOCS_JOB_EXTRACT), 2);

		expect(peak.get(TENANT_A)).toBe(2); // both slots on the same tenant
		expect(order.indexOf(TENANT_B)).toBe(20); // B waits for all 20 of A's documents
	});

	it('defers with the configured delay and the lock token, and fails nothing', async () => {
		const { pipeline } = buildPipeline();
		const worker = new DocsProcessingWorker(pipeline);
		jest.spyOn((worker as any).logger, 'log').mockImplementation(() => undefined);
		const first = jobOf(DOCS_JOB_CLASSIFY, TENANT_A, 'a-1');
		const second = jobOf(DOCS_JOB_CLASSIFY, TENANT_A, 'a-2');

		// Hold the tenant's only slot with an unfinished stage, then offer a second job.
		const held = worker.handleClassify(first, TOKEN);
		const before = Date.now();
		await expect(worker.handleClassify(second, TOKEN)).rejects.toMatchObject({ name: 'DelayedError' });
		await held;

		expect(second.moveToDelayed).toHaveBeenCalledTimes(1);
		const [{ timestamp, token }] = second.deferrals;
		expect(token).toBe(TOKEN);
		expect(timestamp).toBeGreaterThanOrEqual(before + DOCS_TENANT_BUSY_DEFER_DELAY_MS);
		// The job that held the slot was never touched — only the one that could not get one.
		expect(first.moveToDelayed).not.toHaveBeenCalled();
	});

	it('shares one budget between classify and embed — both are AI-heavy stages', async () => {
		const { pipeline } = buildPipeline();
		const worker = new DocsProcessingWorker(pipeline);
		jest.spyOn((worker as any).logger, 'log').mockImplementation(() => undefined);

		const held = worker.handleClassify(jobOf(DOCS_JOB_CLASSIFY, TENANT_A, 'a-1'), TOKEN);
		await expect(worker.handleEmbed(jobOf(DOCS_JOB_EMBED, TENANT_A, 'a-2'), TOKEN)).rejects.toMatchObject({
			name: 'DelayedError'
		});
		await held;

		// …and the slot is free again the moment the classify finishes.
		await expect(worker.handleEmbed(jobOf(DOCS_JOB_EMBED, TENANT_A, 'a-3'), TOKEN)).resolves.toBeUndefined();
	});

	it('leaves another tenant unaffected while one tenant is at the cap', async () => {
		const { pipeline, order } = buildPipeline();
		const worker = new DocsProcessingWorker(pipeline);
		jest.spyOn((worker as any).logger, 'log').mockImplementation(() => undefined);

		const held = worker.handleClassify(jobOf(DOCS_JOB_CLASSIFY, TENANT_A, 'a-1'), TOKEN);
		const other = jobOf(DOCS_JOB_CLASSIFY, TENANT_B, 'b-1');

		await expect(worker.handleClassify(other, TOKEN)).resolves.toBeUndefined();
		await held;

		expect(other.moveToDelayed).not.toHaveBeenCalled();
		expect(order).toEqual([TENANT_A, TENANT_B]);
	});

	it('releases the slot when the stage throws — a failure must not wedge the tenant', async () => {
		const { pipeline } = buildPipeline();
		pipeline.handleClassify = jest.fn().mockRejectedValue(new Error('provider exploded'));
		const worker = new DocsProcessingWorker(pipeline);

		await expect(worker.handleClassify(jobOf(DOCS_JOB_CLASSIFY, TENANT_A, 'a-1'), TOKEN)).rejects.toThrow(
			'provider exploded'
		);

		// The counter is back to zero, so the next job runs instead of deferring for ever.
		pipeline.handleClassify = jest.fn().mockResolvedValue(undefined);
		await expect(worker.handleClassify(jobOf(DOCS_JOB_CLASSIFY, TENANT_A, 'a-2'), TOKEN)).resolves.toBeUndefined();
	});

	it('runs the stage rather than losing it when BullMQ hands over no lock token', async () => {
		const { pipeline, order } = buildPipeline();
		const worker = new DocsProcessingWorker(pipeline);
		const first = jobOf(DOCS_JOB_CLASSIFY, TENANT_A, 'a-1');
		const second = jobOf(DOCS_JOB_CLASSIFY, TENANT_A, 'a-2');

		// `moveToDelayed` throws without a token, so a tokenless job must never be deferred.
		await Promise.all([worker.handleClassify(first), worker.handleClassify(second)]);

		expect(order).toEqual([TENANT_A, TENANT_A]);
		expect(first.moveToDelayed).not.toHaveBeenCalled();
		expect(second.moveToDelayed).not.toHaveBeenCalled();
	});
});

describe('DocsQueueService — bulk imports are queued below interactive work', () => {
	const buildService = () => {
		const enqueue = jest.fn().mockResolvedValue(undefined);
		const moduleRef: any = { get: jest.fn(() => ({ runStageSafely: jest.fn() })) };
		const service = new DocsQueueService(moduleRef, { enqueue } as any);
		jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);
		return { service, enqueue };
	};

	const payload = (reason: DocsJobReason): IDocsJobBase => ({
		documentId: 'doc-1',
		tenantId: TENANT_A,
		organizationId: 'org-1',
		reason
	});

	it('lowers the priority of bulk-import work', async () => {
		const { service, enqueue } = buildService();

		await service.enqueue(DOCS_JOB_CLASSIFY, payload('import'));

		expect(enqueue.mock.calls[0][0].options).toMatchObject({ priority: DOCS_BULK_IMPORT_JOB_PRIORITY });
	});

	it.each<DocsJobReason>(['upload', 'replace', 'reindex', 'content-changed'])(
		'leaves %s work unprioritized — BullMQ serves it first',
		async (reason) => {
			const { service, enqueue } = buildService();

			await service.enqueue(DOCS_JOB_CLASSIFY, payload(reason));

			expect(enqueue.mock.calls[0][0].options).not.toHaveProperty('priority');
		}
	);

	it('still lets an explicit caller priority win (the model-drift sweep sets its own)', async () => {
		const { service, enqueue } = buildService();

		await service.enqueue(DOCS_JOB_CLASSIFY, payload('import'), { priority: 3 });

		expect(enqueue.mock.calls[0][0].options).toMatchObject({ priority: 3 });
	});
});
