import { Module } from '@nestjs/common';
import { SchedulerModule } from '@gauzy/scheduler';
import { EmailHistoryModule } from '../email-history/email-history.module';
import { EmailSendModule } from './email-send.module';
import { EMAIL_RETRY_QUEUE_NAME, EmailRetryScheduler } from './email-retry.scheduler';
import { EmailRetryService } from './email-retry.service';
import { EmailRetryWorker } from './email-retry.worker';

/**
 * The automatic retry of failed emails, without what runs it: the queue's worker ({@link EmailRetryMaintenanceModule})
 * or, for an API without a queue, the in-process sweep (`EmailRetryInlineModule`). See `email-retry.policy.ts`.
 */
@Module({
	imports: [EmailSendModule, EmailHistoryModule],
	providers: [EmailRetryService],
	exports: [EmailRetryService]
})
export class EmailRetryModule {}

/**
 * The five-minute schedule of the email retry sweep and the worker that runs it.
 *
 * **It is a module of its own because of where a job provider is instantiated.** A provider a scheduler registration
 * declares lives in the scheduler's injector, so the service the worker injects travels with the registration
 * (`imports`), as for the platform's other maintenance modules.
 *
 * **Only the API imports this module** (where a queue root exists; its scheduler root is `enabled: false`, so there it
 * is the consumer only), as for the payment reminders: the API hosts the mail settings and the transports provider
 * plugins register, which the retry sends through. The worker application, which ticks the schedules, imports
 * {@link EmailRetryScheduleModule}: the schedule without the consumer.
 */
@Module({
	imports: [
		EmailRetryModule,
		SchedulerModule.forFeature({
			queues: [EMAIL_RETRY_QUEUE_NAME],
			jobProviders: [EmailRetryScheduler, EmailRetryWorker],
			imports: [EmailRetryModule]
		})
	]
})
export class EmailRetryMaintenanceModule {}

/**
 * The schedule of the email retry sweep, without the sweep: for the worker application, which fires the schedules
 * (see {@link EmailRetryMaintenanceModule}). It registers the queue (so the schedule can enqueue onto it) and the job
 * that enqueues, and no consumer of that queue.
 */
@Module({
	imports: [
		SchedulerModule.forFeature({
			queues: [EMAIL_RETRY_QUEUE_NAME],
			jobProviders: [EmailRetryScheduler]
		})
	]
})
export class EmailRetryScheduleModule {}
