import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '@gauzy/scheduler';
import {
	MEETING_REMINDER_QUEUE_NAME,
	MEETING_REMINDER_SWEEP_JOB,
	MEETING_REMINDER_SWEEP_SCHEDULE
} from './meeting-reminder.constants';

/** What the schedule tells the worker about the sweep it asked for. */
export interface IMeetingReminderSweepJob {
	requestedAt: string;
}

/**
 * Asks the queue for one meeting reminder sweep every minute: a reminder is due a minute before a meeting starts, so a
 * minute is the most it may wait. The job carries only the request; the sweep is the worker's, on whichever instance
 * picks the job up, so a deployment that runs several API instances sweeps once rather than once per instance (and two
 * sweeps that overlap anyway still file each reminder once: see `MeetingReminderService`).
 */
@Injectable()
export class MeetingReminderScheduler {
	private readonly logger = new Logger(MeetingReminderScheduler.name);

	@ScheduledJob({
		name: MEETING_REMINDER_SWEEP_SCHEDULE,
		description: 'Reminds the host and invitees of a meeting before it starts, and when it is about to.',
		cron: CronExpression.EVERY_MINUTE,
		queueName: MEETING_REMINDER_QUEUE_NAME,
		queueJobName: MEETING_REMINDER_SWEEP_JOB,
		// The next minute's sweep is the retry: a failed one is kept for a look, a done one is not kept at all.
		queueJobOptions: { removeOnComplete: true, removeOnFail: 20 },
		preventOverlap: true
	})
	async enqueueSweep(): Promise<IMeetingReminderSweepJob> {
		const requestedAt = new Date().toISOString();
		this.logger.debug(`Queued the meeting reminder sweep at ${requestedAt}`);
		return { requestedAt };
	}
}
