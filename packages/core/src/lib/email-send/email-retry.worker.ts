import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { EMAIL_RETRY_QUEUE_NAME, EMAIL_RETRY_SWEEP_JOB, IEmailRetrySweepJob } from './email-retry.scheduler';
import { EmailRetryService } from './email-retry.service';

/**
 * Runs the sweep the schedule queued. A sweep that could not read the due emails is raised, so the queue's own failure
 * handling sees it; an email that could not be sent is the sweep's own business (rescheduled or given up).
 */
@Injectable()
@QueueWorker(EMAIL_RETRY_QUEUE_NAME)
export class EmailRetryWorker extends QueueWorkerHost {
	private readonly logger = new Logger(EmailRetryWorker.name);

	constructor(private readonly retries: EmailRetryService) {
		super();
	}

	@QueueJobHandler(EMAIL_RETRY_SWEEP_JOB)
	async handleSweep(job: Job<IEmailRetrySweepJob>): Promise<void> {
		try {
			await this.retries.sweep();
		} catch (error) {
			this.logger.error(
				`The email retry sweep requested at ${job.data?.requestedAt ?? 'an unrecorded moment'} failed`,
				error
			);
			throw error;
		}
	}
}
