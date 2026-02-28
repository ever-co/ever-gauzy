import { BullModule, BullRootModuleOptions } from '@nestjs/bullmq';
import { DynamicModule, Module, Type } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { SCHEDULER_MODULE_OPTIONS } from './constants/scheduler.constants';
import { SchedulerFeatureOptions } from './interfaces/scheduler-feature-options.interface';
import { SchedulerModuleOptions } from './interfaces/scheduler-module-options.interface';
import { ScheduledJobMetadataAccessor } from './services/scheduled-job-metadata.accessor';
import { SchedulerDiscoveryService } from './services/scheduler-discovery.service';
import { SchedulerJobRegistryService } from './services/scheduler-job-registry.service';
import { SchedulerJobRunnerService } from './services/scheduler-job-runner.service';
import { SchedulerQueueService } from './services/scheduler-queue.service';
import { SchedulerService } from './services/scheduler.service';
import { normalizeQueueRegistrations } from './utils/normalize-queue-registrations';
import { normalizeSchedulerModuleOptions } from './utils/normalize-scheduler-options';

@Module({})
export class SchedulerModule {
	static forRoot(options: SchedulerModuleOptions = {}): DynamicModule {
		const normalizedOptions = normalizeSchedulerModuleOptions(options);
		const imports: DynamicModule['imports'] = [DiscoveryModule, ScheduleModule.forRoot()];

		if (normalizedOptions.enableQueueing) {
			const rootOptions: BullRootModuleOptions = {
				connection: normalizedOptions.queueConnection
			};
			imports.push(BullModule.forRoot(rootOptions));

			if (normalizedOptions.queues.length > 0) {
				imports.push(BullModule.registerQueue(...normalizedOptions.queues));
			}
		}

		return {
			module: SchedulerModule,
			global: true,
			imports,
			providers: [
				{
					provide: SCHEDULER_MODULE_OPTIONS,
					useValue: normalizedOptions
				},
				ScheduledJobMetadataAccessor,
				SchedulerJobRegistryService,
				SchedulerJobRunnerService,
				SchedulerQueueService,
				SchedulerDiscoveryService,
				SchedulerService
			],
			exports: [SchedulerService, SchedulerQueueService]
		};
	}

	static forFeature(optionsOrProviders: SchedulerFeatureOptions | Type<unknown>[] = []): DynamicModule {
		const options = Array.isArray(optionsOrProviders)
			? { jobProviders: optionsOrProviders }
			: optionsOrProviders;
		const queueOptions = normalizeQueueRegistrations(options.queues ?? []);
		const imports = queueOptions.length > 0 ? [BullModule.registerQueue(...queueOptions)] : [];
		const jobProviders = options.jobProviders ?? [];

		return {
			module: SchedulerModule,
			imports,
			providers: [...jobProviders],
			exports: [...jobProviders]
		};
	}
}
