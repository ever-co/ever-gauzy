import { Injectable, Logger } from '@nestjs/common';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { Job } from 'bullmq';
import { INBOX_MAINTENANCE_QUEUE_NAME, INBOX_NOTIFICATION_SWEEP_JOB } from '../inbox.constants';
import { IInboxNotificationSweepJob } from './inbox-notification-sweep.scheduler';
import { InboxNotificationSweepService } from './inbox-notification-sweep.service';

/**
 * Runs the sweep the schedule queued. A sweep that could not run at all is raised, so the queue's own retry sees it;
 * a notification that could not be filed is the sweep's own business (it holds its place and tries again).
 */
@Injectable()
@QueueWorker(INBOX_MAINTENANCE_QUEUE_NAME)
export class InboxNotificationSweepWorker extends QueueWorkerHost {
	private readonly logger = new Logger(InboxNotificationSweepWorker.name);

	constructor(private readonly sweeps: InboxNotificationSweepService) {
		super();
	}

	@QueueJobHandler(INBOX_NOTIFICATION_SWEEP_JOB)
	async handleSweep(job: Job<IInboxNotificationSweepJob>): Promise<void> {
		try {
			await this.sweeps.sweep();
		} catch (error) {
			this.logger.error(
				`The Inbox notification sweep requested at ${job.data?.requestedAt ?? 'an unrecorded moment'} failed`,
				error
			);
			throw error;
		}
	}
}
