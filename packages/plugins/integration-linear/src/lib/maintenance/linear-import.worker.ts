import { Injectable, Logger } from '@nestjs/common';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { Job } from 'bullmq';
import { LINEAR_IMPORT_SWEEP_JOB, LINEAR_QUEUE_NAME } from '../linear.constants';
import { LinearImportSweepService } from './linear-import-sweep.service';
import { ILinearImportSweepJob } from './linear-import.scheduler';

/**
 * Runs the import sweep the schedule queued. A sweep that could not run at all (its listing failed) is raised, so the
 * queue's own retry sees it; a mapping that could not be imported is the sweep's own count, reported and retried at
 * the next sweep rather than failing the job.
 */
@Injectable()
@QueueWorker(LINEAR_QUEUE_NAME)
export class LinearImportWorker extends QueueWorkerHost {
	private readonly logger = new Logger(LinearImportWorker.name);

	constructor(private readonly sweep: LinearImportSweepService) {
		super();
	}

	@QueueJobHandler(LINEAR_IMPORT_SWEEP_JOB)
	async handleSweep(job: Job<ILinearImportSweepJob>): Promise<void> {
		try {
			await this.sweep.run();
		} catch (error) {
			this.logger.error(`The Linear import sweep requested at ${job.data?.requestedAt ?? 'an unrecorded moment'} failed`, error);
			throw error;
		}
	}
}
