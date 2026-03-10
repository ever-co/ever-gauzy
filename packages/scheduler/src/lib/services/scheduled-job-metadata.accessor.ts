import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SCHEDULED_JOB_METADATA } from '../constants/scheduler.constants';
import { ScheduledJobOptions } from '../interfaces/scheduled-job-options.interface';

@Injectable()
export class ScheduledJobMetadataAccessor {
	constructor(private readonly reflector: Reflector) {}

	get(target: (...args: unknown[]) => unknown): ScheduledJobOptions | undefined {
		return this.reflector.get<ScheduledJobOptions>(SCHEDULED_JOB_METADATA, target);
	}
}
