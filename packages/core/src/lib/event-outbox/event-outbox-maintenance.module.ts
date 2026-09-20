import { Module } from '@nestjs/common';
import { SchedulerModule } from '@gauzy/scheduler';
import { EventOutboxModule } from './event-outbox.module';
import { EventOutboxDispatchScheduler } from './event-outbox-dispatch.scheduler';
import { EventOutboxDispatchWorker } from './event-outbox-dispatch.worker';
import { EVENT_OUTBOX_QUEUE_NAME } from './event-outbox-constant';

/**
 * The pass that drains the transactional outbox.
 *
 * **It is a module of its own because of where a job provider is instantiated.** A provider a
 * scheduler registration declares lives in the scheduler's injector, not in the injector of the module
 * that owns the services the provider injects — so a worker that calls `EventOutboxService` and
 * `EventConsumerRegistry` cannot be declared beside them. Handing the scheduler an import of the
 * module that declares the worker would close a cycle between two modules that exist for each other;
 * importing the services' module instead is the ordinary direction, and it is why the application
 * imports this module as well as that one.
 *
 * **The registry the worker reaches through this import is the one the consumers registered with.**
 * `EventOutboxModule` is a static module, so Nest instantiates it once for the whole application and
 * every importer — this one, `GraphqlSubscriptionModule`, `WebhookModule`, a plugin — resolves the
 * same `EventConsumerRegistry`. A second instance would be a dispatcher that consults an empty
 * registry and publishes every row as unconsumed, which is the failure this module exists to end,
 * reported as success.
 *
 * **A deployment that imports this module gets an outbox that drains rather than one that grows**, and
 * a deployment that does not — a test harness, a process with no queue connection — still has the
 * whole outbox kernel, because appending is the kernel and dispatching is maintenance. That split is
 * what keeps `append` honest: it never published anything of its own, and nothing about it changes
 * depending on whether this module is present.
 */
@Module({
	imports: [
		EventOutboxModule,
		SchedulerModule.forFeature({
			queues: [EVENT_OUTBOX_QUEUE_NAME],
			jobProviders: [EventOutboxDispatchScheduler, EventOutboxDispatchWorker],
			// The scheduler instantiates a job provider in its own injector, so the services that provider
			// injects have to travel with the registration: a module's imports are not inherited by the
			// module that imports it, and this is the same reason the retry-key sweep passes its own
			// service through here.
			imports: [EventOutboxModule]
		})
	]
})
export class EventOutboxMaintenanceModule {}
