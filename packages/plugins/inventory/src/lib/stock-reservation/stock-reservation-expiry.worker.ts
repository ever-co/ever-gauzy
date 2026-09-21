import { Injectable, Logger } from '@nestjs/common';
import { QueueJobHandler, QueueWorker, QueueWorkerHost } from '@gauzy/scheduler';
import { Job } from 'bullmq';
import {
	STOCK_RESERVATION_EXPIRY_BATCH_SIZE,
	STOCK_RESERVATION_EXPIRY_JOB,
	STOCK_RESERVATION_EXPIRY_MAX_BATCHES,
	STOCK_RESERVATION_QUEUE_NAME
} from './stock-reservation-constant';
import { StockReservationService } from './stock-reservation.service';

/** What the scheduler tells the worker about the sweep it asked for. */
export interface IStockReservationExpiryJob {
	requestedAt: string;
}

/**
 * Runs the expiry sweep the scheduler queued.
 *
 * Which holds are eligible is the service's decision and not this worker's: a hold whose expiry has
 * not passed is never touched, and a hold that is no longer `ACTIVE` is refused by the state guard
 * inside the transaction that would release it. Keeping that decision in the service is what stops a
 * second caller of `releaseExpired` — the operator-triggered route — from having to remember it.
 *
 * The sweep runs with **no request context**, which is deliberate: `releaseExpired` narrows its read
 * to the tenant the request runs in when there is one, and a scheduled pass has none, so it sweeps
 * every tenant. A pass that ran inside one tenant's context would release that tenant's holds and
 * leave every other tenant's carts holding stock for ever, which is the failure this job exists to
 * end, reported as success.
 *
 * A failed sweep is raised rather than swallowed, so the queue's own retry and dead-letter handling
 * sees it. A sweep that could not run is not a sweep that ran and found nothing.
 */
@Injectable()
@QueueWorker(STOCK_RESERVATION_QUEUE_NAME)
export class StockReservationExpiryWorker extends QueueWorkerHost {
	private readonly logger = new Logger(StockReservationExpiryWorker.name);

	constructor(private readonly stockReservationService: StockReservationService) {
		super();
	}

	/**
	 * Releases one bounded run of expired holds.
	 *
	 * @param job The queued request.
	 */
	@QueueJobHandler(STOCK_RESERVATION_EXPIRY_JOB)
	public async handleExpiry(job: Job<IStockReservationExpiryJob>): Promise<void> {
		this.logger.log(
			`Sweeping expired stock reservations, requested at ${job.data?.requestedAt ?? 'an unrecorded moment'}`
		);

		try {
			const { released, batches } = await this.stockReservationService.releaseExpired(
				STOCK_RESERVATION_EXPIRY_BATCH_SIZE,
				STOCK_RESERVATION_EXPIRY_MAX_BATCHES
			);

			this.logger.log(`Released ${released} expired stock reservation(s) over ${batches} batch(es)`);
		} catch (error) {
			this.logger.error('The stock reservation expiry sweep failed', error);

			throw error;
		}
	}
}
