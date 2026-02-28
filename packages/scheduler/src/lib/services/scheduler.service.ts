import { Injectable, NotFoundException } from '@nestjs/common';
import { SchedulerJobDescriptor, SchedulerJobScheduleType } from '../interfaces/scheduler-job-descriptor.interface';
import { SchedulerQueueJobInput } from '../interfaces/scheduler-queue-job.interface';
import { SchedulerJobRegistryService } from './scheduler-job-registry.service';
import { SchedulerJobRunnerService } from './scheduler-job-runner.service';
import { SchedulerQueueService } from './scheduler-queue.service';

@Injectable()
export class SchedulerService {
	constructor(
		private readonly jobRegistry: SchedulerJobRegistryService,
		private readonly jobRunner: SchedulerJobRunnerService,
		private readonly queueService: SchedulerQueueService
	) {}

	listJobs(): SchedulerJobDescriptor[] {
		return this.jobRegistry.getAll().map((job) => ({
			id: job.id,
			providerName: job.providerName,
			methodName: job.methodName,
			description: job.options.description,
			enabled: job.options.enabled,
			runOnStart: job.options.runOnStart,
			scheduleType: this.resolveScheduleType(job.options.cron, job.options.intervalMs),
			executionTarget: job.options.queueName ? 'queue' : 'inline',
			cron: job.options.cron,
			intervalMs: job.options.intervalMs,
			queueName: job.options.queueName,
			queueJobName: job.options.queueJobName,
			running: this.jobRunner.isRunning(job.id)
		}));
	}

	async triggerNow(jobId: string): Promise<void> {
		const job = this.jobRegistry.getById(jobId);
		if (!job) {
			throw new NotFoundException(`Scheduled job "${jobId}" not found.`);
		}

		await this.jobRunner.execute(job);
	}

	async enqueue<TData = unknown>(input: SchedulerQueueJobInput<TData>): Promise<void> {
		await this.queueService.enqueue(input);
	}

	private resolveScheduleType(cron?: string, intervalMs?: number): SchedulerJobScheduleType {
		if (cron) {
			return 'cron';
		}
		if (intervalMs !== undefined) {
			return 'interval';
		}
		return 'manual';
	}
}
