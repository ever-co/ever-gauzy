import { Injectable, Logger } from '@nestjs/common';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { Job } from 'bullmq';
import { TASK_DUE_REMINDER_QUEUE_NAME, TASK_DUE_REMINDER_SWEEP_JOB } from './task-due-reminder.constants';
import { ITaskDueReminderSweepJob } from './task-due-reminder.scheduler';
import { TaskDueReminderService } from './task-due-reminder.service';

/**
 * Runs the sweep the schedule queued. A sweep that could not run at all is raised, so the queue's own failure handling
 * sees it; a reminder that could not be filed is the sweep's own count, and the next sweep files it.
 */
@Injectable()
@QueueWorker(TASK_DUE_REMINDER_QUEUE_NAME)
export class TaskDueReminderWorker extends QueueWorkerHost {
	private readonly logger = new Logger(TaskDueReminderWorker.name);

	constructor(private readonly reminders: TaskDueReminderService) {
		super();
	}

	@QueueJobHandler(TASK_DUE_REMINDER_SWEEP_JOB)
	async handleSweep(job: Job<ITaskDueReminderSweepJob>): Promise<void> {
		try {
			await this.reminders.sweep();
		} catch (error) {
			this.logger.error(
				`The task due reminder sweep requested at ${job.data?.requestedAt ?? 'an unrecorded moment'} failed`,
				error
			);
			throw error;
		}
	}
}
