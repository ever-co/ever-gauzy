import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '@gauzy/scheduler';
import {
	TIMER_REMINDER_QUEUE_NAME,
	TIMER_REMINDER_SWEEP_JOB,
	TIMER_REMINDER_SWEEP_SCHEDULE
} from './timer-reminder.constants';

/** What the schedule tells the worker about the sweep it asked for. */
export interface ITimerReminderSweepJob {
	requestedAt: string;
}

/**
 * Asks the queue for one timer reminder sweep every minute: a reminder is due at an hour that is the employee's, so a
 * minute is the most it waits. The job carries only the request; the sweep is the worker's, on whichever instance
 * picks the job up, so a deployment that runs several API instances sweeps once rather than once per instance (and two
 * sweeps that overlap anyway still file each reminder once: see `TimerReminderService`).
 */
@Injectable()
export class TimerReminderScheduler {
	private readonly logger = new Logger(TimerReminderScheduler.name);

	@ScheduledJob({
		name: TIMER_REMINDER_SWEEP_SCHEDULE,
		description: 'Reminds employees of a timer left running past their threshold, and at twice it.',
		cron: CronExpression.EVERY_MINUTE,
		queueName: TIMER_REMINDER_QUEUE_NAME,
		queueJobName: TIMER_REMINDER_SWEEP_JOB,
		// The next minute's sweep is the retry: a failed one is kept for a look, a done one is not kept at all.
		queueJobOptions: { removeOnComplete: true, removeOnFail: 20 },
		preventOverlap: true
	})
	async enqueueSweep(): Promise<ITimerReminderSweepJob> {
		const requestedAt = new Date().toISOString();
		this.logger.debug(`Queued the timer reminder sweep at ${requestedAt}`);
		return { requestedAt };
	}
}
