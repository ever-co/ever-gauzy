import { Module } from '@nestjs/common';
import { SchedulerModule } from '@gauzy/scheduler';
import { CartModule } from '../cart.module';
import { CartExpiryScheduler } from './cart-expiry.scheduler';
import { CartExpiryWorker } from './cart-expiry.worker';
import { CART_QUEUE_NAME } from './cart-maintenance.constant';

/**
 * The sweeps that carry a cart through the end of its life.
 *
 * **It is a module of its own because of where a job provider is instantiated.** A provider a
 * scheduler registration declares lives in the scheduler's injector, not in the injector of the module
 * that owns the service the provider injects — so a worker that calls `CommerceCartService` cannot be
 * declared beside it, and the module that declares the worker has to hand its own imports to the
 * registration as well. That is the same shape the idempotency kernel's maintenance module has, and
 * for the same reason.
 *
 * **A deployment that imports this module gets carts that expire and carts that are abandoned**, and a
 * deployment that does not still has the whole cart capability, because these are maintenance and the
 * capability is not. The plugin imports it, so an ordinary installation gets both sweeps without any
 * wiring of its own.
 */
@Module({
	imports: [
		CartModule,
		SchedulerModule.forFeature({
			queues: [CART_QUEUE_NAME],
			jobProviders: [CartExpiryScheduler, CartExpiryWorker],
			// The scheduler instantiates a job provider in its own injector, so the service that provider
			// injects has to travel with the registration: a module's imports are not inherited by the
			// module that imports it.
			imports: [CartModule]
		})
	]
})
export class CartMaintenanceModule {}
