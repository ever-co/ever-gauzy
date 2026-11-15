import { Injectable, Logger } from '@nestjs/common';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { Job } from 'bullmq';
import { MEETING_REMINDER_QUEUE_NAME, MEETING_REMINDER_SWEEP_JOB } from './meeting-reminder.constants';
import { IMeetingReminderSweepJob } from './meeting-reminder.scheduler';
import { MeetingReminderService } from './meeting-reminder.service';

/**
 * Runs the sweep the schedule queued. A sweep that could not run at all is raised, so the queue's own failure handling
 * sees it; a reminder that could not be filed is the sweep's own count, and the next sweep files it.
 */
@Injectable()
@QueueWorker(MEETING_REMINDER_QUEUE_NAME)
export class MeetingReminderWorker extends QueueWorkerHost {
	private readonly logger = new Logger(MeetingReminderWorker.name);

	constructor(private readonly reminders: MeetingReminderService) {
		super();
	}

	@QueueJobHandler(MEETING_REMINDER_SWEEP_JOB)
	async handleSweep(job: Job<IMeetingReminderSweepJob>): Promise<void> {
		try {
			await this.reminders.sweep();
		} catch (error) {
			this.logger.error(
				`The meeting reminder sweep requested at ${job.data?.requestedAt ?? 'an unrecorded moment'} failed`,
				error
			);
			throw error;
		}
	}
}
