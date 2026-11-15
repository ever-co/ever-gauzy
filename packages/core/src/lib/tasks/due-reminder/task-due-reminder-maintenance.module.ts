import { Module } from '@nestjs/common';
import { SchedulerModule } from '@gauzy/scheduler';
import { TASK_DUE_REMINDER_QUEUE_NAME } from './task-due-reminder.constants';
import { TaskDueReminderModule } from './task-due-reminder.module';
import { TaskDueReminderScheduler } from './task-due-reminder.scheduler';
import { TaskDueReminderWorker } from './task-due-reminder.worker';

/**
 * The schedule of the task due reminder sweep and the worker that runs it, for the API (where a queue root exists), as
 * for the timer reminders (`TimerReminderMaintenanceModule`): a reminder is a notification, and what files it in the
 * Inbox and announces it to the receiver's open clients are in-process listeners the API hosts. The worker application
 * imports {@link TaskDueReminderScheduleModule}: the schedule without the consumer.
 */
@Module({
	imports: [
		TaskDueReminderModule,
		SchedulerModule.forFeature({
			queues: [TASK_DUE_REMINDER_QUEUE_NAME],
			jobProviders: [TaskDueReminderScheduler, TaskDueReminderWorker],
			imports: [TaskDueReminderModule]
		})
	]
})
export class TaskDueReminderMaintenanceModule {}

/**
 * The schedule of the task due reminder sweep, without the sweep: for the worker application, which fires the schedules
 * but does not host the listeners a reminder's notification reaches (see {@link TaskDueReminderMaintenanceModule}).
 */
@Module({
	imports: [
		SchedulerModule.forFeature({
			queues: [TASK_DUE_REMINDER_QUEUE_NAME],
			jobProviders: [TaskDueReminderScheduler]
		})
	]
})
export class TaskDueReminderScheduleModule {}
