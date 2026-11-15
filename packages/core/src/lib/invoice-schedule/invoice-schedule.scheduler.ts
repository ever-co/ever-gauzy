import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '@gauzy/scheduler';
import {
	INVOICE_SCHEDULE_QUEUE_NAME,
	INVOICE_SCHEDULE_SWEEP_JOB,
	INVOICE_SCHEDULE_SWEEP_SCHEDULE
} from './invoice-schedule.constants';

/** What the schedule tells the worker about the sweep it asked for. */
export interface IInvoiceScheduleSweepJob {
	requestedAt: string;
}

/**
 * Asks the queue for one sweep of the billing schedules every hour: a period's invoice is due on its run day in the
 * organization's time zone, so an hour is the most it waits past that day's midnight. The job carries only the request;
 * the sweep is the worker's, on whichever instance picks the job up, so a deployment that runs several API instances
 * sweeps once rather than once per instance (and two sweeps that overlap anyway still bill each period once: see
 * `InvoiceScheduleRunService`).
 */
@Injectable()
export class InvoiceScheduleScheduler {
	private readonly logger = new Logger(InvoiceScheduleScheduler.name);

	@ScheduledJob({
		name: INVOICE_SCHEDULE_SWEEP_SCHEDULE,
		description: 'Makes the invoices of the clients billed on a schedule, for the period just ended.',
		cron: CronExpression.EVERY_HOUR,
		queueName: INVOICE_SCHEDULE_QUEUE_NAME,
		queueJobName: INVOICE_SCHEDULE_SWEEP_JOB,
		// The next hour's sweep is the retry: a failed one is kept for a look, a done one is not kept at all.
		queueJobOptions: { removeOnComplete: true, removeOnFail: 20 },
		preventOverlap: true
	})
	async enqueueSweep(): Promise<IInvoiceScheduleSweepJob> {
		const requestedAt = new Date().toISOString();
		this.logger.debug(`Queued the invoice schedule sweep at ${requestedAt}`);
		return { requestedAt };
	}
}
