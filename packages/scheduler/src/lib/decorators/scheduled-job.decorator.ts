import { SetMetadata } from '@nestjs/common';
import { SCHEDULED_JOB_METADATA } from '../constants/scheduler.constants';
import { ScheduledJobOptions } from '../interfaces/scheduled-job-options.interface';

export function ScheduledJob(options: ScheduledJobOptions = {}): MethodDecorator {
	return SetMetadata(SCHEDULED_JOB_METADATA, options);
}
