import { Injectable, NotFoundException } from '@nestjs/common';
import { SchedulerJobDescriptor, SchedulerJobScheduleType } from '../interfaces/scheduler-job-descriptor.interface';
import { SchedulerQueueJobInput } from '../interfaces/scheduler-queue-job.interface';
import { SchedulerRunRecorder } from '../interfaces/scheduler-run-recorder.interface';
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

	/**
	 * Attaches the run ledger every run of every job passes through, or detaches it with `null`.
	 *
	 * This is the scheduler's whole integration surface for a ledger. The host process — the one that
	 * owns a database — injects this service, which the scheduler module exports, and hands in its
	 * recorder at boot; nothing else in this package changes, and a process that never calls this
	 * records nothing and behaves exactly as before. It lives here rather than on the runner because
	 * `SchedulerService` is the exported control surface and the runner is an implementation detail.
	 *
	 * @param recorder The ledger, or null to record nothing.
	 */
	attachRunRecorder(recorder: SchedulerRunRecorder | null): void {
		this.jobRunner.setRunRecorder(recorder);
	}

	/** Whether this process currently records its runs. */
	hasRunRecorder(): boolean {
		return this.jobRunner.hasRunRecorder();
	}

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
