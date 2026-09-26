import {
	ActivityLogModule,
	DatabaseModule,
	EventOutboxMaintenanceModule,
	IdempotencyMaintenanceModule,
	JobExecutionModule,
	MentionModule,
	TokenModule,
	WebhookMaintenanceModule
} from '@gauzy/core';
import { PluginModule } from '@gauzy/plugin';
import { SchedulerModule } from '@gauzy/scheduler';
import { Module } from '@nestjs/common';
import { WorkerJobsModule } from './worker-jobs.module';
import { SchedulerLedgerBootstrap } from './scheduler-ledger.bootstrap';
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
		 * The two platform schedules, registered in the process that actually ticks them.
		 *
		 * 🛑 **A `@ScheduledJob` only registers where `SchedulerModule.forRoot({ enabled: true })`.**
		 * `SchedulerDiscoveryService` skips every job when the module option is false
		 * (`scheduler-discovery.service.ts`), and core's own `AppModule` registers the root with
		 * `enabled: false` on purpose — the API hosts the queue and the workers that consume it, and
		 * this process is the one that fires the schedules. So a maintenance module imported only by
		 * core's `AppModule` contributes its worker and never its cron: nothing is ever enqueued, the
		 * worker idles, and every piece looks healthy.
		 *
		 * That is what had happened to the retry-key sweep — `IdempotencyMaintenanceModule` was
		 * registered in exactly one place, under `enabled: false`, so the hourly sweep had never once
		 * fired and `idempotency_key` could only grow. The outbox dispatch pass would have inherited
		 * the same silence, and with far worse consequences: nothing would hand appended events to
		 * their consumers, so GraphQL subscriptions, the search index, every entitlement grant and
		 * every outbound webhook stay quiet while `event_outbox` grows, and no writer anywhere sees an
		 * error.
		 *
		 * Both are imported behind `WORKER_QUEUE_ENABLED` for the same reason core gates them behind
		 * `isSchedulerQueueRootEnabled()`: the jobs travel on a queue, a queue needs a root, and
		 * registering a worker where there is no root is not a degraded schedule — it is a boot that
		 * fails on `Worker requires a connection`.
		 */
		...(WORKER_QUEUE_ENABLED
			? [IdempotencyMaintenanceModule, EventOutboxMaintenanceModule, WebhookMaintenanceModule]
			: []),
		/**
		 * The ledger a scheduled pass is recorded in.
		 *
		 * This process is the one that ticks the schedules, so it is the one that has something to
		 * record; `SchedulerLedgerBootstrap` below attaches the recorder to the scheduler's single run
		 * funnel once the graph is up. An installation that does not want the rows simply does not
		 * import this module — the recorder is optional and off by default on the scheduler's side.
		 */
		JobExecutionModule,
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
	],
	providers: [SchedulerLedgerBootstrap]
})
export class AppModule {}
