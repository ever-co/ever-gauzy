import { Module } from '@nestjs/common';
import { SchedulerModule } from '@gauzy/scheduler';
import { IdempotencyModule } from './idempotency.module';
import { IdempotencyCleanupScheduler } from './idempotency-cleanup.scheduler';
import { IdempotencyCleanupWorker } from './idempotency-cleanup.worker';
import { IDEMPOTENCY_QUEUE_NAME } from './idempotency-constant';

/**
 * The sweep that keeps the retry-key table from growing without bound.
 *
 * **It is a module of its own because of where a job provider is instantiated.** A provider a
 * scheduler registration declares lives in the scheduler's injector, not in the injector of the module
 * that owns the service the provider injects — so a worker that calls `IdempotencyService` cannot be
 * declared beside it. Handing the scheduler an import of the module that declares the worker would
 * close a cycle between two modules that exist for each other; importing the service's module instead
 * is the ordinary direction, and it is why the application imports this module as well as that one.
 *
 * **A deployment that imports this module gets a table that is swept rather than one that grows**, and
 * a deployment that does not — a worker process, a test harness — still has the whole retry-safety
 * kernel, because the sweep is maintenance and the kernel is not.
 */
@Module({
	imports: [
		IdempotencyModule,
		SchedulerModule.forFeature({
			queues: [IDEMPOTENCY_QUEUE_NAME],
			jobProviders: [IdempotencyCleanupScheduler, IdempotencyCleanupWorker],
			// The scheduler instantiates a job provider in its own injector, so the service that provider
			// injects has to travel with the registration: a module's imports are not inherited by the
			// module that imports it, and this is the same reason the platform's own token worker passes
			// its command bus through here.
			imports: [IdempotencyModule]
		})
	]
})
export class IdempotencyMaintenanceModule {}
