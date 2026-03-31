import { RegisterQueueOptions } from '@nestjs/bullmq';
import { DynamicModule, Type } from '@nestjs/common';

export type SchedulerQueueRegistration = string | RegisterQueueOptions;

export interface SchedulerFeatureOptions {
	jobProviders?: Type<unknown>[];
	queues?: SchedulerQueueRegistration[];
	imports?: DynamicModule['imports'];
}
