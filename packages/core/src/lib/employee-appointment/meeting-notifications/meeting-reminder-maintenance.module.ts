import { Module } from '@nestjs/common';
import { SchedulerModule } from '@gauzy/scheduler';
import { MEETING_REMINDER_QUEUE_NAME } from './meeting-reminder.constants';
import { MeetingReminderModule } from './meeting-reminder.module';
import { MeetingReminderScheduler } from './meeting-reminder.scheduler';
import { MeetingReminderWorker } from './meeting-reminder.worker';

/**
 * The per-minute schedule of the meeting reminder sweep and the worker that runs it.
 *
 * **It is a module of its own because of where a job provider is instantiated.** A provider a scheduler registration
 * declares lives in the scheduler's injector, so the service the worker injects travels with the registration
 * (`imports`), as for the platform's other maintenance modules.
 *
 * **Only the API imports this module** (where a queue root exists; its scheduler root is `enabled: false`, so
 * there it is the consumer only). A reminder is a notification, and what files it in the Inbox and announces it to the
 * receiver's open clients are in-process listeners of the notification event (the Inbox bridge, the real-time hints),
 * which the API hosts. The worker application, which ticks the schedules, imports {@link MeetingReminderScheduleModule}:
 * the schedule without the consumer, so every sweep is taken by a process with those listeners.
 */
@Module({
	imports: [
		MeetingReminderModule,
		SchedulerModule.forFeature({
			queues: [MEETING_REMINDER_QUEUE_NAME],
			jobProviders: [MeetingReminderScheduler, MeetingReminderWorker],
			imports: [MeetingReminderModule]
		})
	]
})
export class MeetingReminderMaintenanceModule {}

/**
 * The schedule of the meeting reminder sweep, without the sweep: for the worker application, which fires the schedules
 * but does not host the listeners a reminder's notification reaches (see {@link MeetingReminderMaintenanceModule}). It
 * registers the queue (so the schedule can enqueue onto it) and the job that enqueues, and no consumer of that queue.
 */
@Module({
	imports: [
		SchedulerModule.forFeature({
			queues: [MEETING_REMINDER_QUEUE_NAME],
			jobProviders: [MeetingReminderScheduler]
		})
	]
})
export class MeetingReminderScheduleModule {}
