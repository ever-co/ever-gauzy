import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '@gauzy/scheduler';
import { TRELLO_IMPORT_SWEEP_ATTEMPTS, TRELLO_IMPORT_SWEEP_JOB, TRELLO_IMPORT_SWEEP_RETRY_DELAY_MS, TRELLO_IMPORT_SWEEP_SCHEDULE, TRELLO_QUEUE_NAME } from '../trello.constants';

/** What the schedule tells the worker about the sweep it asked for. */
export interface ITrelloImportSweepJob {
	requestedAt: string;
}

/**
 * Asks the queue for one import sweep every five minutes. The job carries only the request: the sweep itself is the
 * worker's, on whichever instance picks the job up, so a deployment that runs several workers sweeps once rather than
 * once per instance. Which mappings are due is the sweep's decision (`TRELLO_IMPORT_INTERVAL_MINUTES` and the
 * mapping's own last import), so an interval shorter than the five minutes behaves as five.
 */
@Injectable()
export class TrelloImportScheduler {
	private readonly logger = new Logger(TrelloImportScheduler.name);

	@ScheduledJob({
		name: TRELLO_IMPORT_SWEEP_SCHEDULE,
		description: 'Imports the changes of every inbound Trello mapping whose last import is older than TRELLO_IMPORT_INTERVAL_MINUTES.',
		cron: CronExpression.EVERY_5_MINUTES,
		queueName: TRELLO_QUEUE_NAME,
		queueJobName: TRELLO_IMPORT_SWEEP_JOB,
		// A sweep that could not run (its listing failed) is tried again by the queue, a little later each time.
		queueJobOptions: { attempts: TRELLO_IMPORT_SWEEP_ATTEMPTS, backoff: { type: 'exponential', delay: TRELLO_IMPORT_SWEEP_RETRY_DELAY_MS }, removeOnComplete: true, removeOnFail: 20 },
		preventOverlap: true
	})
	async enqueueSweep(): Promise<ITrelloImportSweepJob> {
		const requestedAt = new Date().toISOString();
		this.logger.debug(`Queued the Trello import sweep at ${requestedAt}`);
		return { requestedAt };
	}
}
