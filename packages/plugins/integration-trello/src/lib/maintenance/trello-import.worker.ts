import { Injectable, Logger } from '@nestjs/common';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { Job } from 'bullmq';
import { TRELLO_IMPORT_SWEEP_JOB, TRELLO_QUEUE_NAME } from '../trello.constants';
import { TrelloImportSweepService } from './trello-import-sweep.service';
import { ITrelloImportSweepJob } from './trello-import.scheduler';

/**
 * Runs the import sweep the schedule queued. A sweep that could not run at all (its listing failed) is raised, so the
 * queue's own retry sees it; a mapping that could not be imported is the sweep's own count, reported and retried at
 * the next sweep rather than failing the job.
 */
@Injectable()
@QueueWorker(TRELLO_QUEUE_NAME)
export class TrelloImportWorker extends QueueWorkerHost {
	private readonly logger = new Logger(TrelloImportWorker.name);

	constructor(private readonly sweep: TrelloImportSweepService) {
		super();
	}

	@QueueJobHandler(TRELLO_IMPORT_SWEEP_JOB)
	async handleSweep(job: Job<ITrelloImportSweepJob>): Promise<void> {
		try {
			await this.sweep.run();
		} catch (error) {
			this.logger.error(`The Trello import sweep requested at ${job.data?.requestedAt ?? 'an unrecorded moment'} failed`, error);
			throw error;
		}
	}
}
