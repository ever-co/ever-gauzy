import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '@gauzy/scheduler';
import {
	INBOX_MAINTENANCE_QUEUE_NAME,
	INBOX_NOTIFICATION_SWEEP_ATTEMPTS,
	INBOX_NOTIFICATION_SWEEP_JOB,
	INBOX_NOTIFICATION_SWEEP_RETRY_DELAY_MS,
	INBOX_NOTIFICATION_SWEEP_SCHEDULE
} from '../inbox.constants';

/** What the schedule tells the worker about the sweep it asked for. */
export interface IInboxNotificationSweepJob {
	requestedAt: string;
}

/**
 * Asks the queue for one recovery sweep of the notification filing every five minutes (a lost entry appears within
 * the grace period and five minutes). The job carries only the request: the sweep itself is the worker's, on
 * whichever instance picks the job up, so a deployment that runs several workers sweeps once rather than once per
 * instance — the same arrangement as the delivery sweep (`InboxDeliveryScheduler`).
 */
@Injectable()
export class InboxNotificationSweepScheduler {
	private readonly logger = new Logger(InboxNotificationSweepScheduler.name);

	@ScheduledJob({
		name: INBOX_NOTIFICATION_SWEEP_SCHEDULE,
		description:
			'Files in the Inbox the platform notifications that have no entry yet (a filing the process did not live to make).',
		cron: CronExpression.EVERY_5_MINUTES,
		queueName: INBOX_MAINTENANCE_QUEUE_NAME,
		queueJobName: INBOX_NOTIFICATION_SWEEP_JOB,
		queueJobOptions: {
			attempts: INBOX_NOTIFICATION_SWEEP_ATTEMPTS,
			backoff: { type: 'exponential', delay: INBOX_NOTIFICATION_SWEEP_RETRY_DELAY_MS },
			removeOnComplete: true,
			removeOnFail: 20
		},
		preventOverlap: true
	})
	async enqueueSweep(): Promise<IInboxNotificationSweepJob> {
		const requestedAt = new Date().toISOString();
		this.logger.debug(`Queued the Inbox notification sweep at ${requestedAt}`);
		return { requestedAt };
	}
}
