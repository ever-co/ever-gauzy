import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '@gauzy/scheduler';
import {
	INBOX_DELIVERY_QUEUE_NAME,
	INBOX_DELIVERY_SWEEP_ATTEMPTS,
	INBOX_DELIVERY_SWEEP_JOB,
	INBOX_DELIVERY_SWEEP_RETRY_DELAY_MS,
	INBOX_DELIVERY_SWEEP_SCHEDULE
} from './inbox-delivery.constants';

/** What the schedule tells the worker about the sweep it asked for. */
export interface IInboxDeliverySweepJob {
	requestedAt: string;
}

/**
 * Asks the queue for one delivery sweep every minute ("immediate" is within the minute). The job carries only the
 * request: the sweep itself is the worker's, on whichever instance picks the job up, so a deployment that runs
 * several workers sweeps once rather than once per instance.
 */
@Injectable()
export class InboxDeliveryScheduler {
	private readonly logger = new Logger(InboxDeliveryScheduler.name);

	@ScheduledJob({
		name: INBOX_DELIVERY_SWEEP_SCHEDULE,
		description: 'Decides and sends the Inbox notification emails (immediate and digest) that are due.',
		cron: CronExpression.EVERY_MINUTE,
		queueName: INBOX_DELIVERY_QUEUE_NAME,
		queueJobName: INBOX_DELIVERY_SWEEP_JOB,
		queueJobOptions: { attempts: INBOX_DELIVERY_SWEEP_ATTEMPTS, backoff: { type: 'exponential', delay: INBOX_DELIVERY_SWEEP_RETRY_DELAY_MS }, removeOnComplete: true, removeOnFail: 20 },
		preventOverlap: true
	})
	async enqueueSweep(): Promise<IInboxDeliverySweepJob> {
		const requestedAt = new Date().toISOString();
		this.logger.debug(`Queued the Inbox delivery sweep at ${requestedAt}`);
		return { requestedAt };
	}
}
