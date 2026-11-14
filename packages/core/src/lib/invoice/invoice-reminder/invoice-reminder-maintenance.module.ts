import { Module } from '@nestjs/common';
import { SchedulerModule } from '@gauzy/scheduler';
import { INVOICE_REMINDER_QUEUE_NAME } from './invoice-reminder.constants';
import { InvoiceReminderModule } from './invoice-reminder.module';
import { InvoiceReminderScheduler } from './invoice-reminder.scheduler';
import { InvoiceReminderWorker } from './invoice-reminder.worker';

/**
 * The hourly schedule of the payment reminder sweep and the worker that runs it.
 *
 * **It is a module of its own because of where a job provider is instantiated.** A provider a scheduler registration
 * declares lives in the scheduler's injector, so the service the worker injects travels with the registration
 * (`imports`), as for the platform's other maintenance modules.
 *
 * **Only the API imports this module** (where a queue root exists; its scheduler root is `enabled: false`, so there it
 * is the consumer only), as for the timer reminders: the API hosts the mail settings and the invoice rendering the
 * sweep uses. The worker application, which ticks the schedules, imports {@link InvoiceReminderScheduleModule}: the
 * schedule without the consumer.
 */
@Module({
	imports: [
		InvoiceReminderModule,
		SchedulerModule.forFeature({
			queues: [INVOICE_REMINDER_QUEUE_NAME],
			jobProviders: [InvoiceReminderScheduler, InvoiceReminderWorker],
			imports: [InvoiceReminderModule]
		})
	]
})
export class InvoiceReminderMaintenanceModule {}

/**
 * The schedule of the payment reminder sweep, without the sweep: for the worker application, which fires the schedules
 * (see {@link InvoiceReminderMaintenanceModule}). It registers the queue (so the schedule can enqueue onto it) and the
 * job that enqueues, and no consumer of that queue.
 */
@Module({
	imports: [
		SchedulerModule.forFeature({
			queues: [INVOICE_REMINDER_QUEUE_NAME],
			jobProviders: [InvoiceReminderScheduler]
		})
	]
})
export class InvoiceReminderScheduleModule {}
