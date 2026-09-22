import { ActivityLogModule, DatabaseModule, MentionModule, TokenModule } from '@gauzy/core';
import { PluginModule } from '@gauzy/plugin';
import { SchedulerModule } from '@gauzy/scheduler';
import { Module } from '@nestjs/common';
import { WorkerJobsModule } from './worker-jobs.module';
import { WORKER_DEFAULT_QUEUE, WORKER_QUEUE_ENABLED, WORKER_SCHEDULER_ENABLED } from './worker.constants';

@Module({
	imports: [
		DatabaseModule,
		/**
		 * 🛑 Both are `@Global()` in core, and "global" means available everywhere ONCE IMPORTED —
		 * not always present. The API gets them through core's own `AppModule`; this process builds
		 * its own module graph, so it has to import them itself. Without these two lines the plugin
		 * pipelines below fail DI at BOOT — not at first job — because `DocumentService` injects
		 * `MentionService` and `DocumentActivityLogSubscriber` injects `ActivityLogService`.
		 * `MentionModule` also pulls in the `@Global()` `EntitySubscriptionModule`.
		 */
		ActivityLogModule,
		MentionModule,
		TokenModule.forRoot({
			enableScheduler: WORKER_SCHEDULER_ENABLED
		}),
		SchedulerModule.forRoot({
			enabled: WORKER_SCHEDULER_ENABLED,
			enableQueueing: WORKER_QUEUE_ENABLED,
			defaultQueueName: WORKER_DEFAULT_QUEUE,
			defaultTimezone: process.env.WORKER_TIMEZONE,
			defaultJobOptions: {
				preventOverlap: true,
				retries: 1,
				retryDelayMs: 5000
			}
		}),
		WorkerJobsModule,
		/**
		 * Instantiates every plugin listed in `src/plugins.ts` and runs its `onPluginBootstrap`.
		 *
		 * 🛑 `registerPluginConfig({ plugins })` in `main.ts` is NOT enough on its own: it only
		 * merges the plugins' entities and subscribers into the ORM configuration. It never puts a
		 * plugin's Nest module into the container, so the `docs-processing` `@Processor` host would
		 * never be constructed and this process would idle while the API kept doing the extraction,
		 * OCR and embedding work (`10-implementation-plan.md` §2.6, mitigation R7).
		 * `PluginModule.init()` reads the same registered config, which is why the plugin modules
		 * are not listed here by hand.
		 *
		 * Declared last so the BullMQ root registered by `SchedulerModule.forRoot()` above already
		 * exists when a plugin registers its own queue.
		 */
		PluginModule.init()
	]
})
export class AppModule {}
