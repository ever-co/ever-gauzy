import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '@gauzy/scheduler';
import { ASANA_IMPORT_SWEEP_ATTEMPTS, ASANA_IMPORT_SWEEP_JOB, ASANA_IMPORT_SWEEP_RETRY_DELAY_MS, ASANA_IMPORT_SWEEP_SCHEDULE, ASANA_QUEUE_NAME } from '../asana.constants';

/** What the schedule tells the worker about the sweep it asked for. */
export interface IAsanaImportSweepJob {
	requestedAt: string;
}

/**
 * Asks the queue for one import sweep every five minutes. The job carries only the request: the sweep itself is the
 * worker's, on whichever instance picks the job up, so a deployment that runs several workers sweeps once rather than
 * once per instance. Which mappings are due is the sweep's decision (`ASANA_IMPORT_INTERVAL_MINUTES` and the
 * mapping's own last import), so an interval shorter than the five minutes behaves as five.
 */
@Injectable()
export class AsanaImportScheduler {
	private readonly logger = new Logger(AsanaImportScheduler.name);

	@ScheduledJob({
		name: ASANA_IMPORT_SWEEP_SCHEDULE,
		description: 'Imports the changes of every inbound Asana mapping whose last import is older than ASANA_IMPORT_INTERVAL_MINUTES.',
		cron: CronExpression.EVERY_5_MINUTES,
		queueName: ASANA_QUEUE_NAME,
		queueJobName: ASANA_IMPORT_SWEEP_JOB,
		// A sweep that could not run (its listing failed) is tried again by the queue, a little later each time.
		queueJobOptions: { attempts: ASANA_IMPORT_SWEEP_ATTEMPTS, backoff: { type: 'exponential', delay: ASANA_IMPORT_SWEEP_RETRY_DELAY_MS }, removeOnComplete: true, removeOnFail: 20 },
		preventOverlap: true
	})
	async enqueueSweep(): Promise<IAsanaImportSweepJob> {
		const requestedAt = new Date().toISOString();
		this.logger.debug(`Queued the Asana import sweep at ${requestedAt}`);
		return { requestedAt };
	}
}
