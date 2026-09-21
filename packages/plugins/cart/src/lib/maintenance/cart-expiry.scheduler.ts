import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '@gauzy/scheduler';
import {
	CART_ABANDON_JOB,
	CART_ABANDON_SCHEDULE,
	CART_EXPIRY_JOB,
	CART_EXPIRY_SCHEDULE,
	CART_QUEUE_NAME
} from './cart-maintenance.constant';

/**
 * Fires the two sweeps that move a cart through the end of its life.
 *
 * **`expiresAt` was written and never acted on.** Every recalculation refreshed the instant a cart
 * expires, the checkout ladder refused a cart past it, and nothing in the platform ever moved one into
 * `EXPIRED`: the only code that could — `CommerceCartService.expireDueCarts` — was declared and called
 * by no cron, no route, no resolver and no job. A cart therefore stayed `ACTIVE` for ever and the only
 * thing that noticed its expiry was a buyer trying to check out with it. `cart.abandonedAfterHours`
 * was in the same state, one step earlier: declared as a tenant setting, described as the point at
 * which a cart "becomes a notification target", and read by nothing at all.
 *
 * The jobs enqueue nothing but the request. The sweep itself is the worker's, on whichever instance
 * picks the job up, so a deployment running several API instances sweeps once rather than once per
 * instance — which matters here because both sweeps write to the carts they find, and two sweeps
 * racing would spend their batches refusing each other's conditional writes.
 *
 * Both run hourly and both are bounded. An hour is the right granularity for windows measured in days
 * — the shortest of them, the abandonment window, defaults to a day — and it keeps the work per run
 * small enough that a backlog is cleared over a few runs rather than in one long pass.
 */
@Injectable()
export class CartExpiryScheduler {
	private readonly logger = new Logger(CartExpiryScheduler.name);

	/**
	 * Asks the queue for one expiry sweep.
	 *
	 * @returns What the worker is told about the request.
	 */
	@ScheduledJob({
		name: CART_EXPIRY_SCHEDULE,
		description: 'Moves carts past their expiry instant into EXPIRED.',
		cron: CronExpression.EVERY_HOUR,
		queueName: CART_QUEUE_NAME,
		queueJobName: CART_EXPIRY_JOB,
		preventOverlap: true
	})
	async enqueueExpiry(): Promise<{ requestedAt: string }> {
		const requestedAt = new Date().toISOString();

		this.logger.log(`Queued the cart expiry sweep at ${requestedAt}`);

		return { requestedAt };
	}

	/**
	 * Asks the queue for one abandonment sweep.
	 *
	 * @returns What the worker is told about the request.
	 */
	@ScheduledJob({
		name: CART_ABANDON_SCHEDULE,
		description: 'Marks carts nobody has touched within the configured window as ABANDONED.',
		cron: CronExpression.EVERY_HOUR,
		queueName: CART_QUEUE_NAME,
		queueJobName: CART_ABANDON_JOB,
		preventOverlap: true
	})
	async enqueueAbandonment(): Promise<{ requestedAt: string }> {
		const requestedAt = new Date().toISOString();

		this.logger.log(`Queued the cart abandonment sweep at ${requestedAt}`);

		return { requestedAt };
	}
}
