import { getQueueToken } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Queue } from 'bullmq';
import { SCHEDULER_MODULE_OPTIONS } from '../constants/scheduler.constants';
import { SchedulerQueueJobInput } from '../interfaces/scheduler-queue-job.interface';
import { ResolvedSchedulerModuleOptions } from '../interfaces/scheduler-module-options.interface';

@Injectable()
export class SchedulerQueueService {
	constructor(
		private readonly moduleRef: ModuleRef,
		@Inject(SCHEDULER_MODULE_OPTIONS)
		private readonly moduleOptions: ResolvedSchedulerModuleOptions
	) {}

	async enqueue<TData = unknown>(input: SchedulerQueueJobInput<TData>): Promise<void> {
		if (!this.moduleOptions.enableQueueing) {
			throw new Error(
				`Queueing is disabled. Cannot enqueue job "${input.jobName}" for queue "${input.queueName}".`
			);
		}

		const queue = this.getQueue(input.queueName);
		await queue.add(input.jobName, input.data, input.options);
	}

	private getQueue(queueName: string): Queue {
		const token = getQueueToken(queueName);
		let queue: Queue | undefined;
		try {
			queue = this.moduleRef.get<Queue>(token, { strict: false });
		} catch {
			queue = undefined;
		}

		if (!queue) {
			throw new Error(
				`Queue "${queueName}" is not registered. Add it via SchedulerModule.forFeature({ queues: [...] }).`
			);
		}

		return queue;
	}
}
