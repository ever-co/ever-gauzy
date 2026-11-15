import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '@gauzy/scheduler';
import {
	INVOICE_REMINDER_QUEUE_NAME,
	INVOICE_REMINDER_SWEEP_JOB,
	INVOICE_REMINDER_SWEEP_SCHEDULE
} from './invoice-reminder.constants';

/** What the schedule tells the worker about the sweep it asked for. */
export interface IInvoiceReminderSweepJob {
	requestedAt: string;
}

/**
 * Asks the queue for one payment reminder sweep every hour: a reminder is due on a day, and stays due for two, so an
 * hour is the most it waits. The job carries only the request; the sweep is the worker's, on whichever instance picks
 * the job up, so a deployment that runs several API instances sweeps once rather than once per instance (and two
 * sweeps that overlap anyway still send each reminder once: see `InvoiceReminderService`).
 */
@Injectable()
export class InvoiceReminderScheduler {
	private readonly logger = new Logger(InvoiceReminderScheduler.name);

	@ScheduledJob({
		name: INVOICE_REMINDER_SWEEP_SCHEDULE,
		description: 'Emails the client of an unpaid invoice a payment reminder before and after its due date.',
		cron: CronExpression.EVERY_HOUR,
		queueName: INVOICE_REMINDER_QUEUE_NAME,
		queueJobName: INVOICE_REMINDER_SWEEP_JOB,
		// The next hour's sweep is the retry: a failed one is kept for a look, a done one is not kept at all.
		queueJobOptions: { removeOnComplete: true, removeOnFail: 20 },
		preventOverlap: true
	})
	async enqueueSweep(): Promise<IInvoiceReminderSweepJob> {
		const requestedAt = new Date().toISOString();
		this.logger.debug(`Queued the payment reminder sweep at ${requestedAt}`);
		return { requestedAt };
	}
}
