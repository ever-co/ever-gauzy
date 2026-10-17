import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '@gauzy/scheduler';
import {
	IDEMPOTENCY_CLEANUP_JOB,
	IDEMPOTENCY_CLEANUP_SCHEDULE,
	IDEMPOTENCY_QUEUE_NAME
} from './idempotency-constant';

/**
 * Fires the sweep that removes idempotency keys past their retention window.
 *
 * The lookup already refuses an expired row — `IdempotencyService.claim` clears one the moment it
 * meets it, so an expired key never replays a response the platform promised not to keep. This job
 * is the other half of that promise: the row must also stop occupying storage and, more importantly,
 * must stop occupying the unique tuple, because a table that is never swept is a table whose keys
 * can never be reused even long after their window closed.
 *
 * The job enqueues nothing but the request itself. The sweep is what the worker does, on whichever
 * instance picks the job up, so a deployment that runs several API instances sweeps once rather than
 * once per instance — which matters because the sweep deletes rows and two sweeps racing would spend
 * their batches on rows the other had already removed.
 *
 * The schedule is hourly and the sweeps are bounded, which is the shape that fits a table whose rows
 * live for a day at most: the work per sweep is small, and a backlog is cleared over a few hours
 * rather than in one long transaction.
 */
@Injectable()
export class IdempotencyCleanupScheduler {
	private readonly logger = new Logger(IdempotencyCleanupScheduler.name);

	/**
	 * Asks the queue for one sweep.
	 *
	 * @returns What the worker is told about the request.
	 */
	@ScheduledJob({
		name: IDEMPOTENCY_CLEANUP_SCHEDULE,
		description: 'Removes idempotency keys whose retention window has closed.',
		cron: CronExpression.EVERY_HOUR,
		queueName: IDEMPOTENCY_QUEUE_NAME,
		queueJobName: IDEMPOTENCY_CLEANUP_JOB,
		preventOverlap: true
	})
	async enqueueCleanup(): Promise<{ requestedAt: string }> {
		const requestedAt = new Date().toISOString();

		this.logger.log(`Queued the idempotency key cleanup at ${requestedAt}`);

		return { requestedAt };
	}
}
