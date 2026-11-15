import { Module } from '@nestjs/common';
import { SchedulerModule } from '@gauzy/scheduler';
import { INVOICE_SCHEDULE_QUEUE_NAME } from './invoice-schedule.constants';
import { InvoiceScheduleRunModule } from './invoice-schedule-run.module';
import { InvoiceScheduleScheduler } from './invoice-schedule.scheduler';
import { InvoiceScheduleWorker } from './invoice-schedule.worker';

/**
 * The hourly schedule of the billing schedules' sweep and the worker that runs it.
 *
 * **It is a module of its own because of where a job provider is instantiated.** A provider a scheduler registration
 * declares lives in the scheduler's injector, so the service the worker injects travels with the registration
 * (`imports`), as for the platform's other maintenance modules.
 *
 * **Only the API imports this module** (where a queue root exists; its scheduler root is `enabled: false`, so there it
 * is the consumer only), as for the payment reminders: the API hosts the mail settings and the invoice rendering the
 * sweep uses. The worker application, which ticks the schedules, imports {@link InvoiceScheduleScheduleModule}: the
 * schedule without the consumer.
 */
@Module({
	imports: [
		InvoiceScheduleRunModule,
		SchedulerModule.forFeature({
			queues: [INVOICE_SCHEDULE_QUEUE_NAME],
			jobProviders: [InvoiceScheduleScheduler, InvoiceScheduleWorker],
			imports: [InvoiceScheduleRunModule]
		})
	]
})
export class InvoiceScheduleMaintenanceModule {}

/**
 * The schedule of the billing schedules' sweep, without the sweep: for the worker application, which fires the
 * schedules (see {@link InvoiceScheduleMaintenanceModule}). It registers the queue (so the schedule can enqueue onto
 * it) and the job that enqueues, and no consumer of that queue.
 */
@Module({
	imports: [
		SchedulerModule.forFeature({
			queues: [INVOICE_SCHEDULE_QUEUE_NAME],
			jobProviders: [InvoiceScheduleScheduler]
		})
	]
})
export class InvoiceScheduleScheduleModule {}
