import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '@gauzy/scheduler';
import { IOrderTotalsAuditReport, OrderTotalsService } from './order-totals.service';

/** The scheduled entry's name, which is also the key its run is recorded under. */
export const ORDER_TOTALS_RECONCILIATION_SCHEDULE = 'order-totals-reconciliation-schedule';

/**
 * The run that turns a missed recompute from a latent defect into a measured one.
 *
 * **ADR-26 promises this job in the sentence after the one that states the obligation.** The order's
 * `paymentStatus` and `fulfillmentStatus` are materialised columns, recomputed from the ledgers by
 * one function every time a transaction, fulfilment, return, claim or exchange changes — and because
 * that half is an obligation each of five writers keeps rather than something the schema can enforce,
 * the ADR states this pass beside it: *"a scheduled reconciliation job recomputes them for orders
 * touched in the last N days and reports any disagreement as drift."* Until this file existed the
 * sentence described a job no code registered, so a writer that missed its call left a status that
 * disagreed with the ledgers **and nothing anywhere would ever notice**: the order reads back the
 * stale answer as fact, the failure is silent, and it is cumulative in exactly the way that makes it
 * hard to see. The audit it drives is on `OrderTotalsService.auditRecent`, which states what is
 * compared and why only a disagreeing order is written.
 *
 * **It runs nightly, at three, and both numbers are choices about cost.** Deriving one order from its
 * ledgers is several reads — the lines, the adjustments, the tax lines, the transaction rows, the
 * credit lines — so the pass is proportional to the orders a window touched, and running it hourly
 * would spend that on the whole window twenty-four times a day to repair drift that is by definition
 * already a day old at worst. Three in the morning rather than the measurement audit's two, because
 * both are set-based passes over the installation's own tables and staggering them keeps one from
 * reading through the other's locks. The window itself is stated by the service
 * (`ORDER_TOTALS_AUDIT_WINDOW_DAYS`), and it is what keeps the pass a sweep rather than a full-table
 * read.
 *
 * **It is scheduled inline rather than fanned out to a queue, deliberately.** The pass is a set-based
 * read over the installation's own tables, so a queue would add a registration, a queue and a worker
 * to drain for work that has nothing to hand off — and the repair is idempotent, so two passes that
 * overlapped would derive the same values and write them again rather than corrupt anything.
 * `preventOverlap` is set because two passes inside one process would derive the same orders twice
 * and write each of them twice.
 *
 * **Where it runs is the platform's decision, and it is worth stating because it is easy to get
 * wrong: `apps/worker` is the process that fires schedules.** The API registers the scheduler root
 * with `enabled: false` — it hosts the queues and skips every schedule on purpose, so no job runs
 * twice — which means a plugin hosted only by the API contributes no cron at all. That is why
 * `OrderPlugin` is listed in `apps/worker/src/plugins.ts` beside the cart, whose sweeps are there for
 * the same reason, and it is the whole reason these two entries run anywhere.
 *
 * A failure inside the run is caught and logged rather than allowed out, so a database that was
 * briefly unreachable at three in the morning does not also mark the job broken — the next night's
 * run is the retry. The report is returned as well as logged, so a test observes what a run did
 * instead of reading the log for it.
 */
@Injectable()
export class OrderTotalsReconciliationScheduler {
	private readonly logger = new Logger(OrderTotalsReconciliationScheduler.name);

	constructor(private readonly totals: OrderTotalsService) {}

	/**
	 * Runs one reconciliation pass over the window's orders.
	 *
	 * @returns What the pass examined, found and repaired, or `undefined` when it could not run.
	 */
	@ScheduledJob({
		name: ORDER_TOTALS_RECONCILIATION_SCHEDULE,
		description:
			'Recomputes the derived columns of recently touched orders from their ledgers, reports every disagreement as drift and repairs it.',
		cron: CronExpression.EVERY_DAY_AT_3AM,
		preventOverlap: true
	})
	async reconcileOrderTotals(): Promise<IOrderTotalsAuditReport | undefined> {
		try {
			const report = await this.totals.auditRecent();

			this.reportDrift(report);

			return report;
		} catch (error) {
			this.logger.error(`The order totals reconciliation could not run: ${describe(error)}`);

			return undefined;
		}
	}

	/**
	 * Writes what one pass found.
	 *
	 * **A disagreement is one warning line per order, carrying both values.** Drift is the fact this
	 * job exists to produce, and a reader has to be able to tell a sweep that repaired twelve orders
	 * from a sweep that read nothing: the summary line always states the window and how many orders
	 * were examined, and each drift states which order, which columns, and what the row held against
	 * what the ledgers derive — because the first question anyone asks of a drift report is whether
	 * the sweep's arithmetic or the writer that missed is the one at fault.
	 *
	 * @param report What the pass examined, found and repaired.
	 */
	private reportDrift(report: IOrderTotalsAuditReport): void {
		const examined = `${report.examined} order(s) touched in the last ${report.windowDays} day(s)`;

		if (report.drifted.length === 0) {
			this.logger.log(`Order totals reconciliation examined ${examined}; no drift.`);

			return;
		}

		this.logger.warn(
			`Order totals reconciliation examined ${examined} and found ${report.drifted.length} order(s) whose ` +
				`derived columns disagree with their ledgers; repaired ${report.repaired.length}.`
		);

		for (const drift of report.drifted) {
			const columns = drift.columns
				.map((column) => `${column}: stored ${drift.stored[column]}, derived ${drift.derived[column]}`)
				.join('; ');

			this.logger.warn(`Order ${drift.orderId} drifted — ${columns}.`);
		}

		for (const failure of report.failed) {
			this.logger.error(`Order ${failure.orderId} could not be examined: ${failure.message}`);
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
