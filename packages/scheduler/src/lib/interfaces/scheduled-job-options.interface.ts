import { JobsOptions } from 'bullmq';

export interface ScheduledJobDefaults {
	enabled?: boolean;
	preventOverlap?: boolean;
	retries?: number;
	retryDelayMs?: number;
	timeoutMs?: number;
	maxRandomDelayMs?: number;
}

export interface ScheduledJobOptions extends ScheduledJobDefaults {
	name?: string;
	description?: string;
	cron?: string;
	intervalMs?: number;
	runOnStart?: boolean;
	queueName?: string;
	queueJobName?: string;
	queueJobOptions?: JobsOptions;
}
