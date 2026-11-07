import { Module } from '@nestjs/common';
import { SchedulerModule } from '@gauzy/scheduler';
import { INBOX_DELIVERY_QUEUE_NAME } from './inbox-delivery.constants';
import { InboxDeliveryModule } from './inbox-delivery.module';
import { InboxDeliveryScheduler } from './inbox-delivery.scheduler';
import { InboxDeliveryWorker } from './inbox-delivery.worker';

/**
 * The schedule that asks for a sweep and the worker that runs it. A module of its own for the reason the platform's
 * other maintenance modules are: a job provider lives in the scheduler's injector, so the services it reaches travel
 * with the registration (`imports`). The plugin imports it only where a queue root exists
 * (`isSchedulerQueueRootEnabled`): the worker process. Without it the API still owns the table (the rows are read
 * and written by the worker alone).
 */
@Module({
	imports: [
		InboxDeliveryModule,
		SchedulerModule.forFeature({
			queues: [INBOX_DELIVERY_QUEUE_NAME],
			jobProviders: [InboxDeliveryScheduler, InboxDeliveryWorker],
			imports: [InboxDeliveryModule]
		})
	]
})
export class InboxDeliveryMaintenanceModule {}
