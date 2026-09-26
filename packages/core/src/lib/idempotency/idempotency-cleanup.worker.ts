import { Injectable, Logger } from '@nestjs/common';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { Job } from 'bullmq';
import { IDEMPOTENCY_CLEANUP_BATCH_SIZE, IDEMPOTENCY_CLEANUP_JOB, IDEMPOTENCY_QUEUE_NAME } from './idempotency-constant';
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
	 * Deletes one bounded batch of expired keys.
	 *
	 * @param job The queued request.
	 */
	@QueueJobHandler(IDEMPOTENCY_CLEANUP_JOB)
	public async handleCleanup(job: Job<IIdempotencyCleanupJob>): Promise<void> {
		this.logger.log(`Sweeping expired idempotency keys, requested at ${job.data?.requestedAt ?? 'an unrecorded moment'}`);

		try {
			const deleted = await this.idempotencyService.purgeExpired(IDEMPOTENCY_CLEANUP_BATCH_SIZE);

			this.logger.log(`Deleted ${deleted} expired idempotency key(s)`);
		} catch (error) {
			this.logger.error('The idempotency key sweep failed', error);

			throw error;
		}
	}
}
