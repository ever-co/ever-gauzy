import { Injectable, Logger } from '@nestjs/common';
import { JobsOptions } from 'bullmq';
import { SchedulerQueueService } from '@gauzy/scheduler';
import {
	DOCS_JOB_ATTEMPTS,
	DOCS_JOB_BACKOFF_DELAY_MS,
	DOCS_JOB_REMOVE_ON_COMPLETE,
	DOCS_JOB_REMOVE_ON_FAIL
} from '../../docs.constants';
import { DOCS_PROCESSING_QUEUE } from './constants';
import { IDocsJobBase } from './docs-job.types';

/**
 * The single enqueue seam of the `docs-processing` pipeline.
 *
 * Every job carries the standard retry policy (`attempts: 3`, exponential backoff from a
 * 120 s base, `removeOnComplete: 500` / `removeOnFail: 1000`) and a deterministic BullMQ
 * job id of the form `docs:<stage>:<documentId>` so duplicate enqueues (double-click,
 * retry races, recovery scans overlapping a live job) coalesce in Redis instead of
 * running twice.
 *
 * Enqueue is best-effort by contract: when queueing is disabled (no Redis) the failure is
 * logged and the DB row remains the source of truth — the recovery scan re-enqueues once
 * the queue returns.
 */
@Injectable()
export class DocsQueueService {
	private readonly logger = new Logger(DocsQueueService.name);

	constructor(private readonly schedulerQueueService: SchedulerQueueService) {}

	/**
	 * Enqueues one pipeline job with the standard options and a deterministic job id.
	 *
	 * @param jobName A `DOCS_JOB_*` constant (e.g. `docs.extract`).
	 * @param payload The job payload carrying the tenant/organization snapshot.
	 * @param options Optional BullMQ option overrides (e.g. `priority` for sweeps).
	 * @returns True when the job was handed to the queue.
	 */
	async enqueue<T extends IDocsJobBase>(jobName: string, payload: T, options: JobsOptions = {}): Promise<boolean> {
		const jobId = this.jobIdFor(jobName, payload.documentId);
		try {
			await this.schedulerQueueService.enqueue({
				queueName: DOCS_PROCESSING_QUEUE,
				jobName,
				data: payload,
				options: {
					jobId,
					attempts: DOCS_JOB_ATTEMPTS,
					backoff: { type: 'exponential', delay: DOCS_JOB_BACKOFF_DELAY_MS },
					removeOnComplete: DOCS_JOB_REMOVE_ON_COMPLETE,
					removeOnFail: DOCS_JOB_REMOVE_ON_FAIL,
					...options
				}
			});
			this.logger.log(
				`Enqueued ${jobName} for document ${payload.documentId} (tenant ${payload.tenantId}, reason ${payload.reason})`
			);
			return true;
		} catch (error) {
			// The DB row is the source of truth; the recovery scan re-enqueues when the queue returns.
			this.logger.error(
				`Failed to enqueue ${jobName} for document ${payload.documentId}: ${(error as Error).message}`
			);
			return false;
		}
	}

	/**
	 * Builds the deterministic BullMQ job id for a pipeline stage + document.
	 * (`docs:<stage>:<documentId>` — an already-enqueued stage is skipped.)
	 */
	public jobIdFor(jobName: string, documentId: string): string {
		const stage = jobName.startsWith('docs.') ? jobName.slice('docs.'.length) : jobName;
		return `docs:${stage}:${documentId}`;
	}
}
