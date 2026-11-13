import { Module } from '@nestjs/common';
import { SchedulerModule } from '@gauzy/scheduler';
import { INBOX_MAINTENANCE_QUEUE_NAME } from './inbox.constants';
import { InboxModule } from './inbox.module';
import { InboxNotificationSweepScheduler } from './notifications/inbox-notification-sweep.scheduler';
import { InboxNotificationSweepWorker } from './notifications/inbox-notification-sweep.worker';

/**
 * The Inbox's own schedule: the recovery sweep of the notification filing (`InboxNotificationSweepService`) and the
 * worker that runs it. A module of its own for the reason the platform's other maintenance modules are (and the
 * delivery's, `InboxDeliveryMaintenanceModule`): a job provider lives in the scheduler's injector, so the services it
 * reaches travel with the registration (`imports`). `InboxPlugin` imports it only where a queue root exists
 * (`isSchedulerQueueRootEnabled`), and the schedule fires where the scheduler is enabled — the worker, which hosts the
 * Inbox whenever `GAUZY_INBOX_ENABLED` is on. With the Inbox off nothing of it is loaded.
 */
@Module({
	imports: [
		InboxModule,
		SchedulerModule.forFeature({
			queues: [INBOX_MAINTENANCE_QUEUE_NAME],
			jobProviders: [InboxNotificationSweepScheduler, InboxNotificationSweepWorker],
			imports: [InboxModule]
		})
	]
})
export class InboxMaintenanceModule {}
