import { Injectable, Logger } from '@nestjs/common';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { Job } from 'bullmq';
import {
	IDEMPOTENCY_CLEANUP_BATCH_SIZE,
	IDEMPOTENCY_CLEANUP_JOB,
	IDEMPOTENCY_CLEANUP_MAX_BATCHES,
	IDEMPOTENCY_CLEANUP_TIME_BUDGET_MS,
	IDEMPOTENCY_QUEUE_NAME
} from './idempotency-constant';
import { IdempotencyService } from './idempotency.service';

/** What the scheduler tells the worker about the sweep it asked for. */
export interface IIdempotencyCleanupJob {
	requestedAt: string;
}

/**
 * Runs the sweep the scheduler queued.
 *
 * Two rows are eligible and the service decides which, not this worker: a row whose response is
 * inside its window is never deleted, and an `IN_PROGRESS` row is deleted only once its lease has
 * gone stale. The second rule is the one that matters — deleting a live lease would let a retry
 * start a second run of work that is still executing, which is the single outcome the key exists to
 * prevent — and keeping the decision in the service is what stops a second caller of `purgeExpired`
 * from having to remember it.
 *
 * A failed sweep is raised rather than swallowed, so the queue's own retry and dead-letter handling
 * sees it. A sweep that could not run is not a sweep that ran and found nothing.
 */
@Injectable()
@QueueWorker(IDEMPOTENCY_QUEUE_NAME)
export class IdempotencyCleanupWorker extends QueueWorkerHost {
	private readonly logger = new Logger(IdempotencyCleanupWorker.name);

	constructor(private readonly idempotencyService: IdempotencyService) {
		super();
	}

	/**
	 * Deletes expired keys in bounded batches until the backlog is drained or the pass's budget is spent.
	 *
	 * One batch a pass removed at most 12,000 rows a day, below what a busy installation writes, so the
	 * table grew without bound (R1-09 of the #10254 review). A full batch means more is waiting, so the
	 * pass takes another; a short one means the backlog is gone. Each batch stays bounded — the reason
	 * the sweep was batched at all — and the pass stops at `IDEMPOTENCY_CLEANUP_MAX_BATCHES` or after
	 * `IDEMPOTENCY_CLEANUP_TIME_BUDGET_MS`, whichever comes first; the next hourly pass carries on.
	 *
	 * @param job The queued request.
	 */
	@QueueJobHandler(IDEMPOTENCY_CLEANUP_JOB)
	public async handleCleanup(job: Job<IIdempotencyCleanupJob>): Promise<void> {
		this.logger.log(`Sweeping expired idempotency keys, requested at ${job.data?.requestedAt ?? 'an unrecorded moment'}`);

		try {
			const startedAt = Date.now();
			let deleted = 0;

			for (let batch = 0; batch < IDEMPOTENCY_CLEANUP_MAX_BATCHES; batch++) {
				const removed = await this.idempotencyService.purgeExpired(IDEMPOTENCY_CLEANUP_BATCH_SIZE);

				deleted += removed;

				const drained = removed < IDEMPOTENCY_CLEANUP_BATCH_SIZE;
				const outOfTime = Date.now() - startedAt >= IDEMPOTENCY_CLEANUP_TIME_BUDGET_MS;

				if (drained || outOfTime) {
					break;
				}
			}

			this.logger.log(`Deleted ${deleted} expired idempotency key(s)`);
		} catch (error) {
			this.logger.error('The idempotency key sweep failed', error);

			throw error;
		}
	}
}
