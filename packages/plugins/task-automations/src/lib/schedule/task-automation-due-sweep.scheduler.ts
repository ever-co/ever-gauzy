import { Injectable, Logger } from '@nestjs/common';
import { ScheduledJob } from '@gauzy/scheduler';
import {
	TASK_AUTOMATION_DUE_SWEEP_ATTEMPTS,
	TASK_AUTOMATION_DUE_SWEEP_JOB,
	TASK_AUTOMATION_DUE_SWEEP_RETRY_DELAY_MS,
	TASK_AUTOMATION_DUE_SWEEP_SCHEDULE,
	TASK_AUTOMATION_MAINTENANCE_QUEUE_NAME
} from '../task-automation.constants';

/** What the schedule tells the worker about the sweep it asked for. */
export interface ITaskAutomationDueSweepJob {
	requestedAt: string;
}

/**
 * Asks the queue for one due-date sweep every 15 minutes. A `@ScheduledJob` fires only where the scheduler root is
 * enabled — the worker process — so this provider is what the worker hosts (`TaskAutomationsSchedulePlugin`); the job
 * carries only the request, and the sweep runs in the process that consumes the queue (the API, which hosts the
 * task services the actions write through), once per request whichever API instance picks it up.
 */
@Injectable()
export class TaskAutomationDueSweepScheduler {
	private readonly logger = new Logger(TaskAutomationDueSweepScheduler.name);

	@ScheduledJob({
		name: TASK_AUTOMATION_DUE_SWEEP_SCHEDULE,
		description: 'Runs the task automations whose trigger is a passed due date (once per rule, task and due date).',
		cron: '0 */15 * * * *',
		queueName: TASK_AUTOMATION_MAINTENANCE_QUEUE_NAME,
		queueJobName: TASK_AUTOMATION_DUE_SWEEP_JOB,
		queueJobOptions: {
			attempts: TASK_AUTOMATION_DUE_SWEEP_ATTEMPTS,
			backoff: { type: 'exponential', delay: TASK_AUTOMATION_DUE_SWEEP_RETRY_DELAY_MS },
			removeOnComplete: true,
			removeOnFail: 20
		},
		preventOverlap: true
	})
	async enqueueSweep(): Promise<ITaskAutomationDueSweepJob> {
		const requestedAt = new Date().toISOString();
		this.logger.debug(`Queued the task automation due-date sweep at ${requestedAt}`);
		return { requestedAt };
	}
}
