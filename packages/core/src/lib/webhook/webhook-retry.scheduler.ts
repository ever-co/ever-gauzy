import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '@gauzy/scheduler';
import { WEBHOOK_QUEUE_NAME, WEBHOOK_RETRY_JOB, WEBHOOK_RETRY_SCHEDULE } from './webhook-constant';

/**
 * Fires the pass that re-attempts the deliveries whose next attempt has come due.
 *
 * **Without this, the retry ladder is data and nothing else.** `WebhookDeliveryService` writes seven
 * rungs onto every delivery — immediate, 5 s, 30 s, 2 min, 10 min, 1 h, 6 h — and records
 * `nextAttemptAt` after each refusal, and `findDue` reads exactly those rows. Nothing called it. So
 * an endpoint that was down for the one second a fan-out reached it never heard about that event
 * again: the delivery sat `FAILED` with an attempt due in the past, forever, and the operator's own
 * redelivery through `requeue` was equally inert, because its docstring's "the platform's retry job
 * is what calls the endpoint" described a job that did not exist.
 *
 * The job enqueues nothing but the request. The attempts are what the worker makes, on whichever
 * instance picks the job up, so a deployment running several API instances re-attempts a delivery
 * once rather than once per instance — which matters more here than for a sweep, because a duplicate
 * attempt is a duplicate POST to somebody else's system.
 *
 * Every minute, because the ladder's first rung is five seconds and its second is thirty: a longer
 * period would make the early rungs meaningless, and the pass costs nothing when nothing is due.
 */
@Injectable()
export class WebhookRetryScheduler {
	private readonly logger = new Logger(WebhookRetryScheduler.name);

	/**
	 * Asks the queue for one retry pass.
	 *
	 * @returns What the worker is told about the request.
	 */
	@ScheduledJob({
		name: WEBHOOK_RETRY_SCHEDULE,
		description: 'Re-attempts the outbound webhook deliveries whose next attempt has come due.',
		cron: CronExpression.EVERY_MINUTE,
		queueName: WEBHOOK_QUEUE_NAME,
		queueJobName: WEBHOOK_RETRY_JOB,
		preventOverlap: true
	})
	async enqueueRetry(): Promise<{ requestedAt: string }> {
		const requestedAt = new Date().toISOString();

		this.logger.log(`Queued the webhook delivery retry pass at ${requestedAt}`);

		return { requestedAt };
	}
}
