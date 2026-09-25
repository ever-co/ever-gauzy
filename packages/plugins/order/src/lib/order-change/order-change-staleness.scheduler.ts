import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '@gauzy/scheduler';
import { ID } from '@gauzy/contracts';
import { ORDER_CHANGE_STALE_HOURS } from '../order.types';
import { OrderChangeService } from './order-change.service';

/** The scheduled entry's name, which is also the key its run is recorded under. */
export const ORDER_CHANGE_STALENESS_SCHEDULE = 'order-change-staleness-schedule';

/**
 * The run that gives an order's exclusivity slot back.
 *
 * **`OrderChangeService.cancelStaleChanges` was written as the body of this job and nothing anywhere
 * called it.** The method is public, documented with the window it takes and covered by a suite whose
 * own comment reads *"past the 24-hour window the job sweeps at"* — so the job was assumed, and the
 * assumption was never cashed. The consequence is not cosmetic: an open change occupies an order's
 * exclusivity slot, `create` refuses a second one with `ORDER_CHANGE_IN_PROGRESS`, and the blocking
 * row is a `PENDING`/`REQUESTED` change that nothing else in the platform ever closes. **A change
 * request an operator opened and walked away from therefore blocked every further change to that
 * order for ever** — quietly, because the refusal is a correct answer to a question nobody was
 * asking again.
 *
 * **It runs hourly because that is what the slot is worth.** The window is a day, so a change becomes
 * stale once and this pass is what notices; hourly bounds how long an order stays locked afterwards
 * to less than the hour, and the pass costs a bounded read of the changes that are actually stale — a
 * page at a time, at most `ORDER_CHANGE_SWEEP_LIMIT` of them per run — plus a write per change it
 * cancels. A daily pass would leave an order locked for up to a day after its request went
 * stale, which is a day in which the shop can sell nothing else on it.
 *
 * **Inline rather than queued, and hosted by the worker like every other schedule.** The sweep is one
 * bounded read of the stale changes plus a write per change it cancels, so there is nothing to hand off
 * to a queue; and the process that fires it is `apps/worker`, because the API registers the
 * scheduler root disabled on purpose so that no schedule runs twice. `OrderPlugin` is listed in
 * `apps/worker/src/plugins.ts` for exactly this entry and the totals reconciliation beside it —
 * **without that listing this sweep would never run, and the order it fails to release would look
 * exactly like an order nobody has changed.** `preventOverlap` is set so one process does not sweep
 * twice concurrently.
 */
@Injectable()
export class OrderChangeStalenessScheduler {
	private readonly logger = new Logger(OrderChangeStalenessScheduler.name);

	constructor(private readonly changes: OrderChangeService) {}

	/**
	 * Cancels every change that has sat unapplied for longer than the window.
	 *
	 * @returns The ids of the changes that were cancelled, so a test observes the sweep as well as
	 * the log does.
	 */
	@ScheduledJob({
		name: ORDER_CHANGE_STALENESS_SCHEDULE,
		description: 'Cancels order changes that have sat unapplied past their window, releasing the order they hold.',
		cron: CronExpression.EVERY_HOUR,
		preventOverlap: true
	})
	async cancelStaleOrderChanges(): Promise<ID[] | undefined> {
		try {
			const cancelled = await this.changes.cancelStaleChanges(ORDER_CHANGE_STALE_HOURS);

			if (cancelled.length > 0) {
				this.logger.warn(
					`Released ${cancelled.length} order(s) held by a stale change: ${cancelled.join(', ')}.`
				);
			}

			return cancelled;
		} catch (error) {
			this.logger.error(`The stale change sweep could not run: ${describe(error)}`);

			return undefined;
		}
	}
}

/**
 * @param error The failure.
 * @returns The failure as one line.
 */
function describe(error: unknown): string {
	return error instanceof Error ? (error.message.split('\n')[0] ?? error.message) : String(error);
}
