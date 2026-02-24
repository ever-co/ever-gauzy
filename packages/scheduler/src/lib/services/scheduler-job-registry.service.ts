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

		if (enabled && queueName && !this.moduleOptions.enableQueueing) {
			throw new Error(`Job "${jobId}" targets queue "${queueName}" but queueing is disabled.`);
		}

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
			queueJobOptions: metadata.queueJobOptions
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
