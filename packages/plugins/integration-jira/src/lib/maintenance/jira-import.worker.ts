import { Injectable, Logger } from '@nestjs/common';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { Job } from 'bullmq';
import { JIRA_IMPORT_SWEEP_JOB, JIRA_QUEUE_NAME } from '../jira.constants';
import { JiraImportSweepService } from './jira-import-sweep.service';
import { IJiraImportSweepJob } from './jira-import.scheduler';

/**
 * Runs the import sweep the schedule queued. A sweep that could not run at all (its listing failed) is raised, so the
 * queue's own retry sees it; a mapping that could not be imported is the sweep's own count, reported and retried at
 * the next sweep rather than failing the job.
 */
@Injectable()
@QueueWorker(JIRA_QUEUE_NAME)
export class JiraImportWorker extends QueueWorkerHost {
	private readonly logger = new Logger(JiraImportWorker.name);

	constructor(private readonly sweep: JiraImportSweepService) {
		super();
	}

	@QueueJobHandler(JIRA_IMPORT_SWEEP_JOB)
	async handleSweep(job: Job<IJiraImportSweepJob>): Promise<void> {
		try {
			await this.sweep.run();
		} catch (error) {
			this.logger.error(`The Jira import sweep requested at ${job.data?.requestedAt ?? 'an unrecorded moment'} failed`, error);
			throw error;
		}
	}
}
