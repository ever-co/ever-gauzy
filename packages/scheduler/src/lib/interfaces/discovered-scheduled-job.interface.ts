import { ScheduledJobOptions } from './scheduled-job-options.interface';
import { JobsOptions } from 'bullmq';

export interface ResolvedScheduledJobOptions {
	enabled: boolean;
	description?: string;
	cron?: string;
	intervalMs?: number;
	runOnStart: boolean;
	preventOverlap: boolean;
	retries: number;
	retryDelayMs: number;
	timeoutMs?: number;
	maxRandomDelayMs: number;
	queueName?: string;
	queueJobName?: string;
	queueJobOptions?: JobsOptions;
	/**
	 * Set when the job is well-formed but cannot be scheduled in THIS process — today only when it
	 * fans out to a queue and this process has no queueing. The job is still registered (so it
	 * remains introspectable and manually runnable); `registerSchedules()` skips it and warns.
	 *
	 * This exists so one plugin's optional scheduled fan-out cannot stop a whole process from
	 * booting. It used to `throw` here, which meant `apps/worker` could not start at all whenever
	 * `REDIS_ENABLED` was not `true`.
	 */
	unschedulableReason?: string;
}

export interface DiscoveredScheduledJob {
	id: string;
	providerName: string;
	methodName: string;
	options: ResolvedScheduledJobOptions;
	handler: () => Promise<unknown>;
}

export interface RegisterScheduledJobInput {
	providerName: string;
	methodName: string;
	metadata: ScheduledJobOptions;
	handler: () => Promise<unknown>;
}
