import { ConnectionOptions } from 'bullmq';
import { RegisterQueueOptions } from '@nestjs/bullmq';
import { ScheduledJobDefaults } from './scheduled-job-options.interface';
import { SchedulerQueueRegistration } from './scheduler-feature-options.interface';

export interface SchedulerModuleOptions {
	enabled?: boolean;
	defaultTimezone?: string;
	logRegisteredJobs?: boolean;
	defaultJobOptions?: ScheduledJobDefaults;
	enableQueueing?: boolean;
	queueConnection?: ConnectionOptions;
	queues?: SchedulerQueueRegistration[];
	defaultQueueName?: string;
}

export interface ResolvedScheduledJobDefaults {
	enabled: boolean;
	preventOverlap: boolean;
	retries: number;
	retryDelayMs: number;
	timeoutMs?: number;
	maxRandomDelayMs: number;
}

export interface ResolvedSchedulerModuleOptions {
	enabled: boolean;
	defaultTimezone?: string;
	logRegisteredJobs: boolean;
	defaultJobOptions: ResolvedScheduledJobDefaults;
	enableQueueing: boolean;
	queueConnection: ConnectionOptions;
	queues: RegisterQueueOptions[];
	defaultQueueName: string;
}
