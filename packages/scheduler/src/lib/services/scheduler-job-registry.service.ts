import { Inject, Injectable } from '@nestjs/common';
import { SCHEDULER_MODULE_OPTIONS } from '../constants/scheduler.constants';
import {
	DiscoveredScheduledJob,
	RegisterScheduledJobInput,
	ResolvedScheduledJobOptions
} from '../interfaces/discovered-scheduled-job.interface';
import { ResolvedSchedulerModuleOptions } from '../interfaces/scheduler-module-options.interface';
import { ScheduledJobOptions } from '../interfaces/scheduled-job-options.interface';

@Injectable()
export class SchedulerJobRegistryService {
	private readonly jobs = new Map<string, DiscoveredScheduledJob>();

	constructor(
		@Inject(SCHEDULER_MODULE_OPTIONS)
		private readonly moduleOptions: ResolvedSchedulerModuleOptions
	) {}

	register(input: RegisterScheduledJobInput): DiscoveredScheduledJob {
		const id = this.resolveJobId(input.providerName, input.methodName, input.metadata.name);

		if (this.jobs.has(id)) {
			throw new Error(`Duplicate scheduled job id "${id}".`);
		}

		const options = this.resolveJobOptions(input.metadata, id);
		const job: DiscoveredScheduledJob = {
			id,
			providerName: input.providerName,
			methodName: input.methodName,
			options,
			handler: input.handler
		};

		this.jobs.set(id, job);
		return job;
	}

	getAll(): DiscoveredScheduledJob[] {
		return Array.from(this.jobs.values());
	}

	getById(id: string): DiscoveredScheduledJob | undefined {
		return this.jobs.get(id);
	}

	private resolveJobId(providerName: string, methodName: string, customName?: string): string {
		const defaultId = `${providerName}.${methodName}`;
		const name = customName?.trim();
		return name && name.length > 0 ? name : defaultId;
	}

	private resolveJobOptions(metadata: ScheduledJobOptions, jobId: string): ResolvedScheduledJobOptions {
		const cron = metadata.cron?.trim();
		const intervalMs = metadata.intervalMs;
		const queueNameInput = metadata.queueName?.trim();
		const queueJobName = metadata.queueJobName?.trim();
		const queueName =
			queueNameInput && queueNameInput.length > 0
				? queueNameInput
				: queueJobName || metadata.queueJobOptions
					? this.moduleOptions.defaultQueueName
					: undefined;
		const enabled = metadata.enabled ?? this.moduleOptions.defaultJobOptions.enabled;

		if (cron && intervalMs !== undefined) {
			throw new Error(`Job "${jobId}" cannot define both "cron" and "intervalMs".`);
		}

		if (intervalMs !== undefined && (!Number.isFinite(intervalMs) || intervalMs <= 0)) {
			throw new Error(`Job "${jobId}" has invalid "intervalMs" value "${intervalMs}".`);
		}

		/**
		 * A job that fans out to a queue in a process that has no queueing is a real problem, but
		 * it is NOT a reason to abort the whole bootstrap — which is what throwing here did.
		 *
		 * `@ScheduledJob({ queueName })` is discovered in EVERY process that has a scheduler root,
		 * including ones that legitimately have no Redis. `DocsRecoveryService` is the case that
		 * exposed it: it is registered unconditionally (correctly — it also owns a startup recovery
		 * scan that needs no queue), so `apps/worker` could not boot at all whenever `REDIS_ENABLED`
		 * was not `true`. It threw even when `moduleOptions.enabled` was false and the job provably
		 * could never fire.
		 *
		 * Marking it unschedulable instead keeps the guarantee that mattered — the job never fires
		 * and then dies at enqueue — while letting the process start. `registerSchedules()` skips it
		 * with a warning naming the job and queue, so it is loud, not silent.
		 */
		const unschedulableReason =
			enabled && queueName && !this.moduleOptions.enableQueueing
				? `targets queue "${queueName}" but queueing is disabled in this process`
				: undefined;

		const retries = this.toNonNegativeInteger(metadata.retries ?? this.moduleOptions.defaultJobOptions.retries, 'retries', jobId);
		const retryDelayMs = this.toNonNegativeInteger(
			metadata.retryDelayMs ?? this.moduleOptions.defaultJobOptions.retryDelayMs,
			'retryDelayMs',
			jobId
		);
		const maxRandomDelayMs = this.toNonNegativeInteger(
			metadata.maxRandomDelayMs ?? this.moduleOptions.defaultJobOptions.maxRandomDelayMs,
			'maxRandomDelayMs',
			jobId
		);
		const timeoutMs =
			metadata.timeoutMs !== undefined
				? this.toPositiveInteger(metadata.timeoutMs, 'timeoutMs', jobId)
				: this.moduleOptions.defaultJobOptions.timeoutMs;

		return {
			enabled,
			description: metadata.description,
			cron: cron && cron.length > 0 ? cron : undefined,
			intervalMs,
			runOnStart: metadata.runOnStart ?? false,
			preventOverlap: metadata.preventOverlap ?? this.moduleOptions.defaultJobOptions.preventOverlap,
			retries,
			retryDelayMs,
			timeoutMs,
			maxRandomDelayMs,
			queueName,
			queueJobName: queueJobName && queueJobName.length > 0 ? queueJobName : undefined,
			queueJobOptions: metadata.queueJobOptions,
			unschedulableReason
		};
	}

	private toNonNegativeInteger(value: number, fieldName: string, jobId: string): number {
		if (!Number.isFinite(value) || value < 0) {
			throw new Error(`Job "${jobId}" has invalid "${fieldName}" value "${value}".`);
		}
		return Math.floor(value);
	}

	private toPositiveInteger(value: number, fieldName: string, jobId: string): number {
		if (!Number.isFinite(value) || value <= 0) {
			throw new Error(`Job "${jobId}" has invalid "${fieldName}" value "${value}".`);
		}
		return Math.floor(value);
	}
}
