import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '@gauzy/scheduler';
import { JIRA_IMPORT_SWEEP_ATTEMPTS, JIRA_IMPORT_SWEEP_JOB, JIRA_IMPORT_SWEEP_RETRY_DELAY_MS, JIRA_IMPORT_SWEEP_SCHEDULE, JIRA_QUEUE_NAME } from '../jira.constants';

/** What the schedule tells the worker about the sweep it asked for. */
export interface IJiraImportSweepJob {
	requestedAt: string;
}

/**
 * Asks the queue for one import sweep every five minutes. The job carries only the request: the sweep itself is the
 * worker's, on whichever instance picks the job up, so a deployment that runs several workers sweeps once rather than
 * once per instance. Which mappings are due is the sweep's decision (`JIRA_IMPORT_INTERVAL_MINUTES` and the
 * mapping's own last import), so an interval shorter than the five minutes behaves as five.
 */
@Injectable()
export class JiraImportScheduler {
	private readonly logger = new Logger(JiraImportScheduler.name);

	@ScheduledJob({
		name: JIRA_IMPORT_SWEEP_SCHEDULE,
		description: 'Imports the changes of every inbound Jira mapping whose last import is older than JIRA_IMPORT_INTERVAL_MINUTES.',
		cron: CronExpression.EVERY_5_MINUTES,
		queueName: JIRA_QUEUE_NAME,
		queueJobName: JIRA_IMPORT_SWEEP_JOB,
		// A sweep that could not run (its listing failed) is tried again by the queue, a little later each time.
		queueJobOptions: { attempts: JIRA_IMPORT_SWEEP_ATTEMPTS, backoff: { type: 'exponential', delay: JIRA_IMPORT_SWEEP_RETRY_DELAY_MS }, removeOnComplete: true, removeOnFail: 20 },
		preventOverlap: true
	})
	async enqueueSweep(): Promise<IJiraImportSweepJob> {
		const requestedAt = new Date().toISOString();
		this.logger.debug(`Queued the Jira import sweep at ${requestedAt}`);
		return { requestedAt };
	}
}
