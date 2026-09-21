import { Injectable, Logger } from '@nestjs/common';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { Job } from 'bullmq';
import { CommerceCartService } from '../commerce-cart/commerce-cart.service';
import {
	CART_ABANDON_JOB,
	CART_EXPIRY_JOB,
	CART_QUEUE_NAME,
	CART_SWEEP_BATCH_SIZE
} from './cart-maintenance.constant';

/** What the scheduler tells the worker about the sweep it asked for. */
export interface ICartSweepJob {
	requestedAt: string;
}

/**
 * Runs the sweeps the scheduler queued.
 *
 * Which carts are eligible is the service's decision and not this worker's: the expiry sweep reads
 * carts that are still mutable and past their `expiresAt`, and the abandonment sweep reads active
 * carts nobody has touched inside the window. Keeping both decisions in the service is what stops a
 * second caller of either method from having to remember the rule — and both are bounded there, in
 * the query rather than in a loop, so a large backlog costs several small runs instead of one that
 * materialises every cart a tenant owns.
 *
 * **Neither sweep is scoped to a tenant, and that is deliberate.** A scheduled job has no caller and
 * therefore no tenant in context; a sweep that scoped itself to an absent tenant would sweep nothing
 * at all. Every write it makes is still a conditional one, predicated on the version the row holds, so
 * a cart a buyer touched between the scan and the write is refused rather than expired underneath
 * them.
 *
 * A failed sweep is raised rather than swallowed, so the queue's own retry and dead-letter handling
 * sees it. A sweep that could not run is not a sweep that ran and found nothing.
 */
@Injectable()
@QueueWorker(CART_QUEUE_NAME)
export class CartExpiryWorker extends QueueWorkerHost {
	private readonly logger = new Logger(CartExpiryWorker.name);

	constructor(private readonly commerceCartService: CommerceCartService) {
		super();
	}

	/**
	 * Expires one bounded batch of carts that are past their expiry instant.
	 *
	 * @param job The queued request.
	 */
	@QueueJobHandler(CART_EXPIRY_JOB)
	public async handleExpiry(job: Job<ICartSweepJob>): Promise<void> {
		this.logger.log(
			`Sweeping expired carts, requested at ${job.data?.requestedAt ?? 'an unrecorded moment'}`
		);

		try {
			const expired = await this.commerceCartService.expireDueCarts(CART_SWEEP_BATCH_SIZE);

			this.logger.log(`Expired ${expired.length} cart(s)`);
		} catch (error) {
			this.logger.error('The cart expiry sweep failed', error);

			throw error;
		}
	}

	/**
	 * Abandons one bounded batch of carts nobody has touched within the window.
	 *
	 * @param job The queued request.
	 */
	@QueueJobHandler(CART_ABANDON_JOB)
	public async handleAbandonment(job: Job<ICartSweepJob>): Promise<void> {
		this.logger.log(
			`Sweeping idle carts, requested at ${job.data?.requestedAt ?? 'an unrecorded moment'}`
		);

		try {
			const abandoned = await this.commerceCartService.abandonDueCarts(undefined, CART_SWEEP_BATCH_SIZE);

			this.logger.log(`Abandoned ${abandoned.length} cart(s)`);
		} catch (error) {
			this.logger.error('The cart abandonment sweep failed', error);

			throw error;
		}
	}
}
