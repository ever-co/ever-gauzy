import {
	Inject,
	Injectable,
	Logger,
	OnApplicationBootstrap,
	OnApplicationShutdown,
	OnModuleInit
} from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import * as crypto from 'node:crypto';
import { SCHEDULER_MODULE_OPTIONS } from '../constants/scheduler.constants';
import { DiscoveredScheduledJob } from '../interfaces/discovered-scheduled-job.interface';
import { ResolvedSchedulerModuleOptions } from '../interfaces/scheduler-module-options.interface';
import { ScheduledJobMetadataAccessor } from './scheduled-job-metadata.accessor';
import { SchedulerJobRegistryService } from './scheduler-job-registry.service';
import { SchedulerJobRunnerService } from './scheduler-job-runner.service';

type RegisteredScheduleKind = 'cron' | 'interval';

@Injectable()
export class SchedulerDiscoveryService implements OnModuleInit, OnApplicationBootstrap, OnApplicationShutdown {
	private readonly logger = new Logger(SchedulerDiscoveryService.name);
	private readonly registeredScheduleKinds = new Map<string, RegisteredScheduleKind>();

	constructor(
		private readonly discoveryService: DiscoveryService,
		private readonly metadataScanner: MetadataScanner,
		private readonly metadataAccessor: ScheduledJobMetadataAccessor,
		private readonly jobRegistry: SchedulerJobRegistryService,
		private readonly jobRunner: SchedulerJobRunnerService,
		private readonly schedulerRegistry: SchedulerRegistry,
		@Inject(SCHEDULER_MODULE_OPTIONS)
		private readonly moduleOptions: ResolvedSchedulerModuleOptions
	) {}

	onModuleInit(): void {
		this.discoverJobs();
		this.registerSchedules();
	}

	async onApplicationBootstrap(): Promise<void> {
		const startupJobs = this.jobRegistry.getAll().filter((job) => job.options.enabled && job.options.runOnStart);

		for (const job of startupJobs) {
			await this.executeJob(job);
		}
	}

	onApplicationShutdown(): void {
		this.unregisterSchedules();
	}

	private discoverJobs(): void {
		const wrappers: Array<InstanceWrapper> = [
			...this.discoveryService.getProviders(),
			...this.discoveryService.getControllers()
		];

		for (const wrapper of wrappers) {
			if (typeof wrapper.isDependencyTreeStatic === 'function' && !wrapper.isDependencyTreeStatic()) {
				continue;
			}

			const instance = wrapper.instance as Record<string, unknown> | undefined;
			if (!instance) {
				continue;
			}

			const prototype = Object.getPrototypeOf(instance) as object | undefined;
			if (!prototype) {
				continue;
			}

			const providerName = this.resolveProviderName(wrapper, instance);
			const methodNames = this.metadataScanner.getAllMethodNames(prototype);

			for (const methodName of methodNames) {
				const methodCandidate = instance[methodName];
				if (typeof methodCandidate !== 'function') {
					continue;
				}

				const metadata = this.metadataAccessor.get(methodCandidate as (...args: unknown[]) => unknown);
				if (!metadata) {
					continue;
				}

				const job = this.jobRegistry.register({
					providerName,
					methodName,
					metadata,
					handler: async () => {
						return await Promise.resolve(methodCandidate.call(instance));
					}
				});

				if (this.moduleOptions.logRegisteredJobs) {
					this.logger.log(`Registered scheduled job "${job.id}" (${providerName}.${methodName}).`);
				}
			}
		}
	}

	private registerSchedules(): void {
		const jobs = this.jobRegistry.getAll();
		for (const job of jobs) {
			if (!job.options.enabled || !this.moduleOptions.enabled) {
				continue;
			}

			if (job.options.cron) {
				this.registerCronJob(job);
				continue;
			}

			if (job.options.intervalMs !== undefined) {
				this.registerIntervalJob(job);
				continue;
			}

			if (this.moduleOptions.logRegisteredJobs) {
				this.logger.log(`Job "${job.id}" is registered for manual/startup execution.`);
			}
		}
	}

	private registerCronJob(job: DiscoveredScheduledJob): void {
		const cronJob = new CronJob(
			job.options.cron as string,
			() => {
				void this.executeJobWithJitter(job);
			},
			null,
			false,
			this.moduleOptions.defaultTimezone
		);

		this.schedulerRegistry.addCronJob(job.id, cronJob);
		this.registeredScheduleKinds.set(job.id, 'cron');
		cronJob.start();
	}

	private registerIntervalJob(job: DiscoveredScheduledJob): void {
		const interval = setInterval(() => {
			void this.executeJobWithJitter(job);
		}, job.options.intervalMs as number);

		this.schedulerRegistry.addInterval(job.id, interval);
		this.registeredScheduleKinds.set(job.id, 'interval');
	}

	private async executeJobWithJitter(job: DiscoveredScheduledJob): Promise<void> {
		if (job.options.maxRandomDelayMs > 0) {
			const delayMs = randomDelay(job.options.maxRandomDelayMs);
			await delay(delayMs);
		}

		await this.executeJob(job);
	}

	private async executeJob(job: DiscoveredScheduledJob): Promise<void> {
		try {
			await this.jobRunner.execute(job);
		} catch (error) {
			const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
			this.logger.error(`Job "${job.id}" execution failed.`, message);
		}
	}

	private unregisterSchedules(): void {
		for (const [jobId, scheduleKind] of this.registeredScheduleKinds.entries()) {
			try {
				if (scheduleKind === 'cron') {
					this.schedulerRegistry.deleteCronJob(jobId);
					continue;
				}

				this.schedulerRegistry.deleteInterval(jobId);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				this.logger.warn(`Failed to remove "${jobId}" from scheduler registry: ${message}`);
			}
		}

		this.registeredScheduleKinds.clear();
	}

	private resolveProviderName(wrapper: InstanceWrapper, instance: Record<string, unknown>): string {
		if (typeof wrapper.name === 'string' && wrapper.name.trim().length > 0) {
			return wrapper.name;
		}

		const constructorName = (instance.constructor as { name?: string }).name;
		if (constructorName && constructorName.trim().length > 0) {
			return constructorName;
		}

		return 'AnonymousProvider';
	}
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function randomDelay(maxMs: number): number {
	if (maxMs <= 0) {
		return 0;
	}
	return Math.floor(crypto.randomInt(0, maxMs + 1));
}
