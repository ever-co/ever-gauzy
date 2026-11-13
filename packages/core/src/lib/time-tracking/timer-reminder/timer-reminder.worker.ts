import { Injectable, Logger } from '@nestjs/common';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { Job } from 'bullmq';
import { TIMER_REMINDER_QUEUE_NAME, TIMER_REMINDER_SWEEP_JOB } from './timer-reminder.constants';
import { ITimerReminderSweepJob } from './timer-reminder.scheduler';
import { TimerReminderService } from './timer-reminder.service';

/**
 * Runs the sweep the schedule queued. A sweep that could not run at all is raised, so the queue's own failure handling
 * sees it; a reminder that could not be filed is the sweep's own count, and the next sweep files it.
 */
@Injectable()
@QueueWorker(TIMER_REMINDER_QUEUE_NAME)
export class TimerReminderWorker extends QueueWorkerHost {
	private readonly logger = new Logger(TimerReminderWorker.name);

	constructor(private readonly reminders: TimerReminderService) {
		super();
	}

	@QueueJobHandler(TIMER_REMINDER_SWEEP_JOB)
	async handleSweep(job: Job<ITimerReminderSweepJob>): Promise<void> {
		try {
			await this.reminders.sweep();
		} catch (error) {
			this.logger.error(
				`The timer reminder sweep requested at ${job.data?.requestedAt ?? 'an unrecorded moment'} failed`,
				error
			);
			throw error;
		}
	}
}
