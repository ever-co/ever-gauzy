import { Injectable, Logger } from '@nestjs/common';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { Job } from 'bullmq';
import { INVOICE_REMINDER_QUEUE_NAME, INVOICE_REMINDER_SWEEP_JOB } from './invoice-reminder.constants';
import { IInvoiceReminderSweepJob } from './invoice-reminder.scheduler';
import { InvoiceReminderService } from './invoice-reminder.service';

/**
 * Runs the sweep the schedule queued. A sweep that could not run at all is raised, so the queue's own failure handling
 * sees it; a reminder that could not be sent is the sweep's own count, and the next sweep sends it while it is due.
 */
@Injectable()
@QueueWorker(INVOICE_REMINDER_QUEUE_NAME)
export class InvoiceReminderWorker extends QueueWorkerHost {
	private readonly logger = new Logger(InvoiceReminderWorker.name);

	constructor(private readonly reminders: InvoiceReminderService) {
		super();
	}

	@QueueJobHandler(INVOICE_REMINDER_SWEEP_JOB)
	async handleSweep(job: Job<IInvoiceReminderSweepJob>): Promise<void> {
		try {
			await this.reminders.sweep();
		} catch (error) {
			this.logger.error(
				`The payment reminder sweep requested at ${job.data?.requestedAt ?? 'an unrecorded moment'} failed`,
				error
			);
			throw error;
		}
	}
}
