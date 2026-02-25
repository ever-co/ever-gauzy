import { Type } from '@nestjs/common';
import { RegisterQueueOptions } from '@nestjs/bullmq';

export type SchedulerQueueRegistration = string | RegisterQueueOptions;

export interface SchedulerFeatureOptions {
	jobProviders?: Type<unknown>[];
	queues?: SchedulerQueueRegistration[];
}
