import { Injectable, Logger } from '@nestjs/common';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { Job } from 'bullmq';
import { INBOX_DELIVERY_QUEUE_NAME, INBOX_DELIVERY_SWEEP_JOB } from './inbox-delivery.constants';
import { InboxDeliveryService } from './inbox-delivery.service';
import { IInboxDeliverySweepJob } from './inbox-delivery.scheduler';

/**
 * Runs the sweep the schedule queued. A sweep that could not run at all is raised, so the queue's own retry sees it;
 * a delivery that failed is the sweep's own count, recorded on its row and tried again later.
 */
@Injectable()
@QueueWorker(INBOX_DELIVERY_QUEUE_NAME)
export class InboxDeliveryWorker extends QueueWorkerHost {
	private readonly logger = new Logger(InboxDeliveryWorker.name);

	constructor(private readonly delivery: InboxDeliveryService) {
		super();
	}

	@QueueJobHandler(INBOX_DELIVERY_SWEEP_JOB)
	async handleSweep(job: Job<IInboxDeliverySweepJob>): Promise<void> {
		try {
			await this.delivery.sweep();
		} catch (error) {
			this.logger.error(`The Inbox delivery sweep requested at ${job.data?.requestedAt ?? 'an unrecorded moment'} failed`, error);
			throw error;
		}
	}
}
