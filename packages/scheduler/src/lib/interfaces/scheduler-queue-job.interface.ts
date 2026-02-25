import { JobsOptions } from 'bullmq';

export interface SchedulerQueueJobInput<TData = unknown> {
	queueName: string;
	jobName: string;
	data?: TData;
	options?: JobsOptions;
}
