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
