import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '@gauzy/scheduler';

/** The schedule the retry sweep is fired on. */
export const EMAIL_RETRY_SWEEP_SCHEDULE = 'email-retry.sweep.schedule';

/** The queue job the schedule produces and the worker consumes. */
export const EMAIL_RETRY_SWEEP_JOB = 'email-retry.sweep';

/** The queue the sweep travels on. */
export const EMAIL_RETRY_QUEUE_NAME = 'email-retry';

/** What the schedule tells the worker about the sweep it asked for. */
export interface IEmailRetrySweepJob {
	requestedAt: string;
}

/**
 * Asks the queue for one email retry sweep every five minutes (`EMAIL_RETRY_SWEEP_MS`). The job carries only the
 * request; the sweep is the worker's, on whichever API instance picks the job up, and the queue holds at most one job
 * of this schedule at a time (a tick adds nothing while one waits or runs), so the whole installation sweeps once per
 * period rather than once per instance. Two sweeps that overlap anyway still send each email once: see
 * `EmailRetryService`.
 */
@Injectable()
export class EmailRetryScheduler {
	private readonly logger = new Logger(EmailRetryScheduler.name);

	@ScheduledJob({
		name: EMAIL_RETRY_SWEEP_SCHEDULE,
		description: 'Sends again, at most twice, the failed emails whose send never reached the mail server.',
		cron: CronExpression.EVERY_5_MINUTES,
		queueName: EMAIL_RETRY_QUEUE_NAME,
		queueJobName: EMAIL_RETRY_SWEEP_JOB,
		// The next sweep is the retry: a failed one is kept for a look, a done one is not kept at all.
		queueJobOptions: { removeOnComplete: true, removeOnFail: 20 },
		preventOverlap: true
	})
	async enqueueSweep(): Promise<IEmailRetrySweepJob> {
		const requestedAt = new Date().toISOString();
		this.logger.debug(`Queued the email retry sweep at ${requestedAt}`);
		return { requestedAt };
	}
}
