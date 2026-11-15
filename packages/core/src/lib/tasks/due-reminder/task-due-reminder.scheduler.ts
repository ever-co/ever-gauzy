import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '@gauzy/scheduler';
import {
	TASK_DUE_REMINDER_QUEUE_NAME,
	TASK_DUE_REMINDER_SWEEP_JOB,
	TASK_DUE_REMINDER_SWEEP_SCHEDULE
} from './task-due-reminder.constants';

/** What the schedule tells the worker about the sweep it asked for. */
export interface ITaskDueReminderSweepJob {
	requestedAt: string;
}

/**
 * Asks the queue for one task due reminder sweep every five minutes: a threshold is counted in hours, so a reminder is
 * at most a few minutes late. The job carries only the request; the sweep is the worker's, on whichever instance picks
 * the job up, so a deployment that runs several API instances sweeps once rather than once per instance (and two sweeps
 * that overlap anyway still file each reminder once: see `TaskDueReminderService`).
 */
@Injectable()
export class TaskDueReminderScheduler {
	private readonly logger = new Logger(TaskDueReminderScheduler.name);

	@ScheduledJob({
		name: TASK_DUE_REMINDER_SWEEP_SCHEDULE,
		description: 'Reminds the assignees of a task that its due date is near.',
		cron: CronExpression.EVERY_5_MINUTES,
		queueName: TASK_DUE_REMINDER_QUEUE_NAME,
		queueJobName: TASK_DUE_REMINDER_SWEEP_JOB,
		// The next sweep is the retry: a failed one is kept for a look, a done one is not kept at all.
		queueJobOptions: { removeOnComplete: true, removeOnFail: 20 },
		preventOverlap: true
	})
	async enqueueSweep(): Promise<ITaskDueReminderSweepJob> {
		const requestedAt = new Date().toISOString();
		this.logger.debug(`Queued the task due reminder sweep at ${requestedAt}`);
		return { requestedAt };
	}
}
