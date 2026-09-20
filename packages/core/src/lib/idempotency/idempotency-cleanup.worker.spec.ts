/**
 * The idempotency key sweep: the schedule that asks for it and the worker that runs it.
 *
 * The lookup already refuses an expired row, so a stored key never replays a response the platform
 * promised not to keep. This pair is the other half of that promise — the row must also stop occupying
 * storage and, more importantly, the unique tuple, because a table that is never swept is a table whose
 * keys can never be reused even long after their window closed. The suite pins the four things neither
 * half may get wrong:
 *
 * - **the sweep is bounded and the bound is stated**, with the size the kernel's constant declares
 *   rather than left to the store's own default — the two agree today, which is exactly why an
 *   assertion on the value alone would not be enough;
 * - **the count the store answered is the count the worker reports**, so a sweep that removed rows is
 *   not reported as one that found none;
 * - **a failing sweep is raised, not swallowed**, so the queue's own retry and dead-letter handling
 *   sees it. This is the assertion that matters: a worker that caught its own failure would leave the
 *   queue reporting a clean sweep while the table grew — the failure this job exists to prevent,
 *   reported as health;
 * - **the schedule names the queue and the queue job the worker consumes**, and the worker answers that
 *   job by that name. A schedule that enqueues a job name no worker declares is a job that never runs,
 *   and nothing anywhere reports it: the schedule fires on time and the queue accepts the job.
 *
 * The service is doubled and the queue is not stood up, so the worker is the only thing under test.
 */

/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — see
 * `../channel/channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined
 * when the entity applies it if the graph is entered through the validators rather than the entities.
 * The worker's constructor reaches `IdempotencyService`, which reaches the crud layer.
 */
import '../core/entities/internal';

import { Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import type { Job } from 'bullmq';
import {
	IDEMPOTENCY_CLEANUP_BATCH_SIZE,
	IDEMPOTENCY_CLEANUP_JOB,
	IDEMPOTENCY_CLEANUP_SCHEDULE,
	IDEMPOTENCY_QUEUE_NAME
} from './idempotency-constant';
import { IdempotencyCleanupScheduler } from './idempotency-cleanup.scheduler';
import { IdempotencyCleanupWorker } from './idempotency-cleanup.worker';
import type { IIdempotencyCleanupJob } from './idempotency-cleanup.worker';
import type { IdempotencyService } from './idempotency.service';

/**
 * The metadata keys the declarations under test are written under.
 *
 * `SCHEDULED_JOB_METADATA` and `QUEUE_JOB_HANDLER_METADATA` live in the scheduler package's own
 * `constants/scheduler.constants.ts`, which its barrel does not re-export, so they are stated as text
 * here. Reading the metadata rather than the decorator's arguments is the point — the decorator is
 * applied at load and only what it wrote is what a discovery pass would read — and a wrong key
 * surfaces as `undefined` at the assertion below rather than as a pass.
 */
const SCHEDULED_JOB_METADATA = 'gauzy:scheduler:job';
const QUEUE_JOB_HANDLER_METADATA = 'gauzy:scheduler:queue-job-handler';

/** The key `@nestjs/bullmq`'s `Processor` — which the scheduler's `QueueWorker` is — writes the queue under. */
const PROCESSOR_METADATA = 'bullmq:processor_metadata';

/** The lines the worker wrote, which is where one sweep's outcome is reported. */
let log: jest.SpyInstance;
/** The lines the worker wrote about a sweep that failed. */
let failure: jest.SpyInstance;

beforeEach(() => {
	log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	failure = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
	jest.restoreAllMocks();
});

/** The lines the worker logged, in the order it logged them. */
function logged(): string[] {
	return log.mock.calls.map((call) => String(call[0]));
}

/**
 * The queued request, named as the kernel names it.
 *
 * The name is the constant rather than a string, so the dispatch case below asserts the schedule's job
 * name and the worker's declared handler against the same value the queue carries.
 */
function queued(requestedAt = '2026-03-01T10:00:00.000Z'): Job<IIdempotencyCleanupJob> {
	return { name: IDEMPOTENCY_CLEANUP_JOB, data: { requestedAt } } as Job<IIdempotencyCleanupJob>;
}

/**
 * The worker over a scripted service.
 *
 * The sweep is one call and the count is the store's own answer, so the double states only what the
 * worker is allowed to ask for and what it is told back.
 */
function sweep(purgeExpired: jest.Mock = jest.fn().mockResolvedValue(0)) {
	const idempotencyService = { purgeExpired };

	return {
		purgeExpired,
		worker: new IdempotencyCleanupWorker(idempotencyService as unknown as IdempotencyService)
	};
}

/** The schedule's own declaration, as the discovery pass reads it. */
function scheduleOf(handler: string) {
	const declared = IdempotencyCleanupScheduler.prototype as unknown as Record<string, object>;

	return Reflect.getMetadata(SCHEDULED_JOB_METADATA, declared[handler]);
}

describe('IdempotencyCleanupWorker — one bounded sweep', () => {
	it('asks the store for one batch, bounded by the size the kernel declares', async () => {
		const { worker, purgeExpired } = sweep();

		await worker.handleCleanup(queued());

		expect(purgeExpired).toHaveBeenCalledWith(IDEMPOTENCY_CLEANUP_BATCH_SIZE);
		// Control: the kernel's constant and the service's own default are the same number, so an
		// assertion on the value alone would also pass against a worker that stated no bound at all and
		// let the store's default decide. The argument is asserted **present** rather than merely equal,
		// and it is the only one — the sweep states no retention or stale-lock policy of its own.
		expect(purgeExpired.mock.calls[0]).toHaveLength(1);
	});

	it('reports the count the store answered, so a sweep that removed rows is not reported as one that found none', async () => {
		const { worker, purgeExpired } = sweep(jest.fn().mockResolvedValue(7));

		const answer = await worker.handleCleanup(queued());

		// The count is the store's number and never one the worker computed: a worker that reported its
		// own figure would report a batch it never saw, and one that did not await the call would report a
		// pending promise where the number belongs.
		expect(logged()).toContain('Deleted 7 expired idempotency key(s)');
		expect(purgeExpired).toHaveBeenCalledTimes(1);
		// Control: the count is reported to the log and nothing is answered to the queue. The handler's
		// declared answer is `void`, so what the job's result carries is `undefined` — an assertion that
		// read only the log would also pass against a handler that returned the count, which is a
		// different contract from the delivered one and is pinned here as it stands.
		expect(answer).toBeUndefined();
	});

	it('distinguishes a sweep that removed rows from one that found none', async () => {
		// Control for the case above: a worker that logged a fixed line, or the batch size it asked for
		// rather than the count it was answered, would read the same either way.
		const { worker } = sweep(jest.fn().mockResolvedValue(0));

		await worker.handleCleanup(queued());

		expect(logged()).toContain('Deleted 0 expired idempotency key(s)');
	});

	it('raises a failing sweep rather than reporting a clean one', async () => {
		const refusal = new Error('connection terminated unexpectedly');
		const { worker } = sweep(jest.fn().mockRejectedValue(refusal));

		const error = await worker.handleCleanup(queued()).catch((thrown) => thrown);

		// The queue's own retry and dead-letter handling is what sees a raised failure, and the rejection
		// is the store's own error rather than a message wrapped around it — a classifier branches on the
		// code the driver set, which a wrapper would have dropped.
		expect(error).toBe(refusal);
		// Control: "nothing was deleted" and "the sweep did not run" are different facts, and a worker
		// that caught its own failure would state the first when the second is true — a clean sweep
		// reported while the table grows.
		expect(logged().join('\n')).not.toContain('Deleted');
		// The failure is recorded before it is raised, so an operator reading the log sees the reason the
		// queue is about to retry the job.
		expect(failure).toHaveBeenCalled();
	});

	it('lets the failure reach the queue through the worker’s own dispatch', async () => {
		const refusal = new Error('connection terminated unexpectedly');
		const { worker } = sweep(jest.fn().mockRejectedValue(refusal));

		// `process` is what the queue calls, and the handler is reached through the job name it declares:
		// a failure that stopped at the handler would leave the queue's retry and dead-letter handling
		// with nothing to act on.
		await expect(worker.process(queued())).rejects.toBe(refusal);
	});
});

describe('IdempotencyCleanupWorker — the job name it answers is the schedule’s', () => {
	it('declares the queue and the queue job the worker consumes, as the kernel’s constants state them', () => {
		// The two names are different things on purpose: the first is what the scheduler fires, the
		// second is what a worker consumes and what a queue dashboard shows. Both are read against the
		// imported constants rather than against a copy of the same text written out here, because a
		// drifted name is a job that never runs with nothing red anywhere.
		expect(scheduleOf('enqueueCleanup')).toMatchObject({
			name: IDEMPOTENCY_CLEANUP_SCHEDULE,
			queueName: IDEMPOTENCY_QUEUE_NAME,
			queueJobName: IDEMPOTENCY_CLEANUP_JOB
		});
	});

	it('declares that job name on the handler that runs the sweep', () => {
		// The other half of the same claim: the name the schedule enqueues is a name this worker answers.
		expect(
			Reflect.getMetadata(QUEUE_JOB_HANDLER_METADATA, IdempotencyCleanupWorker.prototype.handleCleanup)
		).toBe(IDEMPOTENCY_CLEANUP_JOB);
	});

	it('registers the worker on the queue the schedule enqueues into', () => {
		// A worker listening on another queue would never be handed the job, which is the same silent
		// failure as a drifted job name and is caught the same way.
		expect(Reflect.getMetadata(PROCESSOR_METADATA, IdempotencyCleanupWorker)).toEqual({
			name: IDEMPOTENCY_QUEUE_NAME
		});
	});

	it('routes the queued job to the sweep through the worker’s own dispatch', async () => {
		const { worker, purgeExpired } = sweep();

		await worker.process(queued());

		// `QueueWorkerHost` builds its handler map from what each method declares, so this is the
		// schedule's job name reaching the sweep rather than a second reading of the same string.
		expect(purgeExpired).toHaveBeenCalledWith(IDEMPOTENCY_CLEANUP_BATCH_SIZE);
		// Control: the dispatch answers the name the worker declared and no other — without this, the
		// assertion above would also pass against a worker that ran the sweep for every job it was
		// handed, whatever the queue called it.
		await expect(worker.process({ name: 'idempotency.cleanup.other' } as Job)).rejects.toThrow(
			/No handler found/
		);
	});

	it('fires hourly and refuses to overlap, so two sweeps do not spend their batches on each other’s rows', () => {
		// The sweep deletes rows, so two instances racing would each spend their bound on rows the other
		// had already removed — and on a first sweep of a long-lived table that is the difference between
		// a backlog cleared in a few hours and one that never clears.
		expect(scheduleOf('enqueueCleanup')).toMatchObject({
			cron: CronExpression.EVERY_HOUR,
			preventOverlap: true
		});
	});
});
