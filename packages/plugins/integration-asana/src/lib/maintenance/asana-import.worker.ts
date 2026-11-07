import { Injectable, Logger } from '@nestjs/common';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { Job } from 'bullmq';
import { ASANA_IMPORT_SWEEP_JOB, ASANA_QUEUE_NAME } from '../asana.constants';
import { AsanaImportSweepService } from './asana-import-sweep.service';
import { IAsanaImportSweepJob } from './asana-import.scheduler';

/**
 * Runs the import sweep the schedule queued. A sweep that could not run at all (its listing failed) is raised, so the
 * queue's own retry sees it; a mapping that could not be imported is the sweep's own count, reported and retried at
 * the next sweep rather than failing the job.
 */
@Injectable()
@QueueWorker(ASANA_QUEUE_NAME)
export class AsanaImportWorker extends QueueWorkerHost {
	private readonly logger = new Logger(AsanaImportWorker.name);

	constructor(private readonly sweep: AsanaImportSweepService) {
		super();
	}

	@QueueJobHandler(ASANA_IMPORT_SWEEP_JOB)
	async handleSweep(job: Job<IAsanaImportSweepJob>): Promise<void> {
		try {
			await this.sweep.run();
		} catch (error) {
			this.logger.error(`The Asana import sweep requested at ${job.data?.requestedAt ?? 'an unrecorded moment'} failed`, error);
			throw error;
		}
	}
}
