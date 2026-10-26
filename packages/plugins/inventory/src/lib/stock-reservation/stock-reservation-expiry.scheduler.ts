import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '@gauzy/scheduler';
import {
	STOCK_RESERVATION_EXPIRY_JOB,
	STOCK_RESERVATION_EXPIRY_SCHEDULE,
	STOCK_RESERVATION_QUEUE_NAME
} from './stock-reservation-constant';

/**
 * Fires the sweep that releases holds whose expiry has passed.
 *
 * `StockReservationService.releaseExpired` was written as the body of this job and nothing anywhere
 * called it. Every hold is written with an expiry — a cart's is thirty minutes — and that column was
 * read by nothing, so a hold taken for an abandoned cart stayed `ACTIVE` for ever and its quantity
 * stayed subtracted from `availableQuantity`. The failure is quiet and cumulative in exactly the way
 * that makes it hard to see: nothing errors, the ledger and the level rows agree, the warehouse is
 * full, and after a day of abandoned carts `StockAvailabilityService` reports nothing sellable and
 * the storefront refuses every line.
 *
 * The job enqueues nothing but the request itself. The sweep is what the worker does, on whichever
 * instance picks the job up, so a deployment that runs several API instances sweeps once rather than
 * once per instance. Two passes racing would not release a hold twice — `close` refuses a hold that
 * is not `ACTIVE`, inside the transaction that would release it — but they would spend their batches
 * on each other's rows, which is what `preventOverlap` and the single queue are for.
 *
 * **The schedule is per minute.** A hold's expiry is a promise about when stock becomes sellable
 * again, and the shortest lifetime the platform configures is a thirty-minute cart; an hourly sweep
 * would make the actual promise "thirty to ninety minutes", which is long enough for a shopper to
 * watch an item stay out of stock after abandoning it themselves. The pass is bounded, so firing it
 * against a table with nothing expired costs one indexed read that matches nothing.
 */
@Injectable()
export class StockReservationExpiryScheduler {
	private readonly logger = new Logger(StockReservationExpiryScheduler.name);

	/**
	 * Asks the queue for one expiry sweep.
	 *
	 * @returns What the worker is told about the request.
	 */
	@ScheduledJob({
		name: STOCK_RESERVATION_EXPIRY_SCHEDULE,
		description: 'Releases stock reservations whose expiry has passed, so held stock becomes sellable again.',
		cron: CronExpression.EVERY_MINUTE,
		queueName: STOCK_RESERVATION_QUEUE_NAME,
		queueJobName: STOCK_RESERVATION_EXPIRY_JOB,
		preventOverlap: true
	})
	async enqueueExpiry(): Promise<{ requestedAt: string }> {
		const requestedAt = new Date().toISOString();

		this.logger.log(`Queued the stock reservation expiry sweep at ${requestedAt}`);

		return { requestedAt };
	}
}
