import { Module } from '@nestjs/common';
import { SchedulerModule } from '@gauzy/scheduler';
import { WebhookModule } from './webhook.module';
import { WebhookRetryScheduler } from './webhook-retry.scheduler';
import { WebhookRetryWorker } from './webhook-retry.worker';
import { WEBHOOK_QUEUE_NAME } from './webhook-constant';

/**
 * The pass that re-attempts outbound deliveries whose next attempt has come due.
 *
 * **It is a module of its own because of where a job provider is instantiated.** A provider a
 * scheduler registration declares lives in the scheduler's injector, not in the injector of the module
 * that owns the service the provider injects — so a worker that calls `WebhookDeliveryService` cannot
 * be declared beside it. Handing the scheduler an import of the module that declares the worker would
 * close a cycle between two modules that exist for each other; importing the service's module instead
 * is the ordinary direction, and it is why the application imports this module as well as that one.
 *
 * **What its absence meant.** The delivery service writes a seven-rung ladder onto every delivery and
 * records the instant of the next attempt after each refusal, and `findDue` reads exactly those rows.
 * Nothing called it. So the second attempt never happened: an endpoint that was unreachable for the
 * one moment a fan-out reached it never heard about that event again, the row sat `FAILED` with an
 * attempt due in the past, and the operator's redelivery through `requeue` only moved the row back to
 * `PENDING` for a job that did not exist. Every individual piece of the mechanism worked, which is why
 * nothing reported it.
 *
 * **A deployment that imports this module gets deliveries that are retried rather than abandoned**,
 * and a deployment that does not — a test harness, a process with no queue connection — still has the
 * whole webhook kernel, because making the first attempt is the kernel and re-attempting is
 * maintenance.
 */
@Module({
	imports: [
		WebhookModule,
		SchedulerModule.forFeature({
			queues: [WEBHOOK_QUEUE_NAME],
			jobProviders: [WebhookRetryScheduler, WebhookRetryWorker],
			// The scheduler instantiates a job provider in its own injector, so the service that provider
			// injects has to travel with the registration: a module's imports are not inherited by the
			// module that imports it, and this is the same reason the retry-key sweep and the outbox
			// dispatch pass pass their own services through here.
			imports: [WebhookModule]
		})
	]
})
export class WebhookMaintenanceModule {}
