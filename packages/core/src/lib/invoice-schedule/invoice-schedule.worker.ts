import { Injectable, Logger } from '@nestjs/common';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { Job } from 'bullmq';
import { INVOICE_SCHEDULE_QUEUE_NAME, INVOICE_SCHEDULE_SWEEP_JOB } from './invoice-schedule.constants';
import { IInvoiceScheduleSweepJob } from './invoice-schedule.scheduler';
import { InvoiceScheduleRunService } from './invoice-schedule-run.service';

/**
 * Runs the sweep the schedule queued. A sweep that could not run at all is raised, so the queue's own failure handling
 * sees it; a run that failed is recorded on the run, and the next sweep tries it again while its period is due.
 */
@Injectable()
@QueueWorker(INVOICE_SCHEDULE_QUEUE_NAME)
export class InvoiceScheduleWorker extends QueueWorkerHost {
	private readonly logger = new Logger(InvoiceScheduleWorker.name);

	constructor(private readonly runs: InvoiceScheduleRunService) {
		super();
	}

	@QueueJobHandler(INVOICE_SCHEDULE_SWEEP_JOB)
	async handleSweep(job: Job<IInvoiceScheduleSweepJob>): Promise<void> {
		try {
			await this.runs.sweep();
		} catch (error) {
			this.logger.error(
				`The invoice schedule sweep requested at ${job.data?.requestedAt ?? 'an unrecorded moment'} failed`,
				error
			);
			throw error;
		}
	}
}
