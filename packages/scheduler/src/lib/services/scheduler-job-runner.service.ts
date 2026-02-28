import { Inject, Injectable, Logger } from '@nestjs/common';
import { SCHEDULER_MODULE_OPTIONS } from '../constants/scheduler.constants';
import { DiscoveredScheduledJob } from '../interfaces/discovered-scheduled-job.interface';
import { ResolvedSchedulerModuleOptions } from '../interfaces/scheduler-module-options.interface';
import { SchedulerQueueService } from './scheduler-queue.service';

@Injectable()
export class SchedulerJobRunnerService {
	private readonly logger = new Logger(SchedulerJobRunnerService.name);
	private readonly runningJobs = new Set<string>();

	constructor(
		@Inject(SCHEDULER_MODULE_OPTIONS)
		private readonly moduleOptions: ResolvedSchedulerModuleOptions,
		private readonly queueService: SchedulerQueueService
	) {}

	isRunning(jobId: string): boolean {
		return this.runningJobs.has(jobId);
	}

	async execute(job: DiscoveredScheduledJob): Promise<void> {
		if (!this.moduleOptions.enabled || !job.options.enabled) {
			return;
		}

		if (job.options.preventOverlap && this.runningJobs.has(job.id)) {
			this.logger.warn(`Skipping "${job.id}" because the previous run is still in progress.`);
			return;
		}

		const startedAt = Date.now();
		this.runningJobs.add(job.id);

		try {
			await this.executeWithRetry(job);
			this.logger.debug(`Finished "${job.id}" in ${Date.now() - startedAt}ms`);
		} catch (error) {
			const message = error instanceof Error ? error.stack ?? error.message : String(error);
			this.logger.error(`Scheduled job "${job.id}" failed.`, message);
			throw error;
		} finally {
			this.runningJobs.delete(job.id);
		}
	}

	private async executeWithRetry(job: DiscoveredScheduledJob): Promise<void> {
		const attempts = job.options.retries + 1;
		let attempt = 1;
		let lastError: unknown;

		while (attempt <= attempts) {
			try {
				await this.executeSingleAttempt(job);
				return;
			} catch (error) {
				lastError = error;
				const hasNextAttempt = attempt < attempts;
				if (!hasNextAttempt) {
					break;
				}

				this.logger.warn(
					`"${job.id}" failed on attempt ${attempt}/${attempts}. Retrying in ${job.options.retryDelayMs}ms.`
				);
				await sleep(job.options.retryDelayMs);
				attempt += 1;
			}
		}

		throw lastError;
	}

	private async executeSingleAttempt(job: DiscoveredScheduledJob): Promise<void> {
		const execution = this.executeJobHandler(job);
		if (job.options.timeoutMs === undefined) {
			await execution;
			return;
		}

		const ac = new AbortController();
		try {
			await Promise.race([execution, timeout(job.options.timeoutMs, job.id, ac.signal)]);
		} finally {
			ac.abort(); // Cancel the timeout timer if the job finished first
		}
	}

	private async executeJobHandler(job: DiscoveredScheduledJob): Promise<void> {
		const data = await Promise.resolve(job.handler());

		if (!job.options.queueName) {
			return;
		}

		await this.queueService.enqueue({
			queueName: job.options.queueName,
			jobName: job.options.queueJobName ?? job.id,
			data,
			options: job.options.queueJobOptions
		});
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function timeout(ms: number, jobId: string, signal?: AbortSignal): Promise<never> {
	return new Promise((_, reject) => {
		const timer = setTimeout(() => {
			reject(new Error(`Scheduled job "${jobId}" timed out after ${ms}ms.`));
		}, ms);

		// If the signal is already aborted, clear immediately
		if (signal?.aborted) {
			clearTimeout(timer);
			return;
		}

		// Listen for abort to clear the timer
		signal?.addEventListener('abort', () => {
			clearTimeout(timer);
		}, { once: true });
	});
}
