import { Module } from '@nestjs/common';
import { SchedulerModule } from '@gauzy/scheduler';
import { StockReservationModule } from './stock-reservation/stock-reservation.module';
import { StockReservationExpiryScheduler } from './stock-reservation/stock-reservation-expiry.scheduler';
import { StockReservationExpiryWorker } from './stock-reservation/stock-reservation-expiry.worker';
import { STOCK_RESERVATION_QUEUE_NAME } from './stock-reservation/stock-reservation-constant';

/**
 * The sweep that gives expired holds back to availability.
 *
 * **It is a module of its own because of where a job provider is instantiated.** A provider a
 * scheduler registration declares lives in the scheduler's injector, not in the injector of the
 * module that owns the service the provider injects — so a worker that calls
 * `StockReservationService` cannot be declared beside it. Handing the scheduler an import of the
 * module that declares the worker would close a cycle between two modules that exist for each other;
 * importing the service's module instead is the ordinary direction, and it is why the plugin imports
 * this module as well as `InventoryModule`.
 *
 * **A deployment that imports this module gets holds that expire rather than holds that accumulate**,
 * and a deployment that does not — a test harness, a process with no queue connection — still has
 * the whole reservation kernel, because taking and releasing a hold is the kernel and the sweep is
 * maintenance. That split is what keeps `reserve` honest: it has never published or scheduled
 * anything of its own, and nothing about it changes depending on whether this module is present.
 *
 * `InventoryPlugin` imports it behind `isSchedulerQueueRootEnabled()`, which is the one predicate
 * every process that hosts plugins evaluates. The jobs travel on a queue, a queue needs a BullMQ
 * root, and registering a worker where there is no root is not a degraded sweep — it is a boot that
 * fails on `Worker requires a connection`, which is what a single-container development setup would
 * meet. The cron fires only where the root was registered with `enabled: true`, which on this
 * platform is the worker process; the API registers the same queue as a producer, so an
 * operator-triggered run still reaches a consumer.
 */
@Module({
	imports: [
		StockReservationModule,
		SchedulerModule.forFeature({
			queues: [STOCK_RESERVATION_QUEUE_NAME],
			jobProviders: [StockReservationExpiryScheduler, StockReservationExpiryWorker],
			// The scheduler instantiates a job provider in its own injector, so the service that provider
			// injects has to travel with the registration: a module's imports are not inherited by the
			// module that imports it, and this is the same reason the platform's own retry-key sweep and
			// outbox dispatch pass each pass their own module through here.
			imports: [StockReservationModule]
		})
	]
})
export class InventoryMaintenanceModule {}
