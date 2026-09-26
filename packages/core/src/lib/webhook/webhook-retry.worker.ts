import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import type { ID } from '@gauzy/contracts';
import { WEBHOOK_QUEUE_NAME, WEBHOOK_RETRY_BATCH_SIZE, WEBHOOK_RETRY_JOB } from './webhook-constant';
import { WebhookDeliveryService } from './webhook-delivery.service';

/** What the scheduler tells the worker about the pass it asked for. */
export interface IWebhookRetryJob {
	requestedAt: string;
}

/**
 * Re-attempts the deliveries the ladder says are due.
 *
 * Everything this worker knows is which rows to ask for and in what order to stop.
 * `WebhookDeliveryService` owns the rest: `findDue` decides what is due, `deliver` makes the attempt,
 * writes its outcome, moves the row onto the next rung or dead-letters it once the budget is spent,
 * and moves the endpoint's own consecutive-failure counter. A worker that re-derived any of that
 * would be a second opinion about a row only one writer may move.
 *
 * **One attempt's failure never stops the pass.** `deliver` records a refusal on the row rather than
 * raising, so reaching the catch here means the *write* failed — the store refused it, or the row
 * disappeared between the read and the attempt. That row keeps the `nextAttemptAt` it already had, so
 * the next pass meets it again, and stopping the batch for it would let one unreachable endpoint hold
 * up every other tenant's deliveries.
 *
 * **Attempts are made one after another.** Each carries a ten-second budget from connect to last
 * byte, so a batch of fifty is bounded at well under the pass's own period in the ordinary case; the
 * alternative — firing them together — would let one tenant's fan-out open fifty sockets at once
 * against somebody else's system, which is a retry storm rather than a retry.
 *
 * A pass that could not read the due rows at all is raised, so the queue's own retry and dead-letter
 * handling sees it. A pass that read nothing is not a failure: it is an outbound surface with nothing
 * outstanding, which is the state it should usually be in.
 */
@Injectable()
@QueueWorker(WEBHOOK_QUEUE_NAME)
export class WebhookRetryWorker extends QueueWorkerHost {
	private readonly logger = new Logger(WebhookRetryWorker.name);

	constructor(private readonly webhookDeliveryService: WebhookDeliveryService) {
		super();
	}

	/**
	 * Attempts one bounded batch of due deliveries.
	 *
	 * @param job The queued request.
	 */
	@QueueJobHandler(WEBHOOK_RETRY_JOB)
	public async handleRetry(job: Job<IWebhookRetryJob>): Promise<void> {
		this.logger.log(
			`Re-attempting due webhook deliveries, requested at ${job.data?.requestedAt ?? 'an unrecorded moment'}`
		);

		let due = [];

		try {
			due = await this.webhookDeliveryService.findDue(WEBHOOK_RETRY_BATCH_SIZE);
		} catch (error) {
			// Nothing was read, so nothing is owed an attempt: the failure is the queue's to retry, and
			// a pass that swallowed it would report an empty outbound queue while deliveries aged.
			this.logger.error('The webhook retry pass could not read the due deliveries', error);

			throw error;
		}

		if (due.length === 0) {
			this.logger.log('No webhook delivery was due');

			return;
		}

		let attempted = 0;

		for (const delivery of due) {
			try {
				await this.webhookDeliveryService.deliver(delivery.id as ID);
				attempted += 1;
			} catch (error) {
				// `deliver` records a refusal rather than raising, so this is a failure to *write* the
				// attempt. The row keeps the `nextAttemptAt` it already had and the next pass meets it
				// again; one row must not cost the batch.
				this.logger.error(`The webhook delivery "${String(delivery.id)}" could not be attempted`, error);
			}
		}

		this.logger.log(`Attempted ${attempted} of ${due.length} due webhook delivery(ies)`);
	}
}
