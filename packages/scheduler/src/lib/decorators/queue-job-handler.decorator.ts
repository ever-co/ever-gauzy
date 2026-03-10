import { SetMetadata } from '@nestjs/common';
import { QUEUE_JOB_HANDLER_METADATA } from '../constants/scheduler.constants';

export function QueueJobHandler(jobName: string): MethodDecorator {
	const normalizedJobName = jobName?.trim();
	if (!normalizedJobName) {
		throw new Error('Queue job handler name cannot be empty.');
	}

	return SetMetadata(QUEUE_JOB_HANDLER_METADATA, normalizedJobName);
}
