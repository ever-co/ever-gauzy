import { AsyncResource } from 'node:async_hooks';
import { Injectable, Logger, Module, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { INVOICE_SCHEDULE_INLINE_FIRST_SWEEP_MS, INVOICE_SCHEDULE_INLINE_SWEEP_MS } from './invoice-schedule.constants';
import { InvoiceScheduleRunModule } from './invoice-schedule-run.module';
import { InvoiceScheduleRunService } from './invoice-schedule-run.service';

/**
 * Sweeps the billing schedules in-process, for an API without a queue (a single container, a development setup): a
 * couple of minutes after the application is up, then on the period of the queue's schedule, one pass at a time, from
 * the async context the provider was built in (no request's). Several such APIs sweeping at once still bill each period
 * once: the sweep claims a period's run before it builds its invoice.
 */
@Injectable()
export class InvoiceScheduleInlineSweep implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = new Logger(InvoiceScheduleInlineSweep.name);
	private readonly root = new AsyncResource('InvoiceScheduleInlineSweep');
	private first?: ReturnType<typeof setTimeout>;
	private timer?: ReturnType<typeof setInterval>;
	private running?: Promise<void>;

	constructor(private readonly runs: InvoiceScheduleRunService) {}

	/** Starts the sweep once the application is up: an API restarted more often than hourly still sweeps. */
	onApplicationBootstrap(): void {
		this.root.runInAsyncScope(() => {
			this.first = setTimeout(() => void this.sweep(), INVOICE_SCHEDULE_INLINE_FIRST_SWEEP_MS);
			this.timer = setInterval(() => void this.sweep(), INVOICE_SCHEDULE_INLINE_SWEEP_MS);
			(this.first as { unref?: () => void }).unref?.();
			(this.timer as { unref?: () => void }).unref?.();
		});
	}

	/** Stops the sweep, and waits for a pass in progress. */
	async onModuleDestroy(): Promise<void> {
		clearTimeout(this.first);
		clearInterval(this.timer);
		this.first = undefined;
		this.timer = undefined;
		await this.running;
	}

	/**
	 * Runs one pass, unless one is still running.
	 *
	 * @returns When the pass is over.
	 */
	sweep(): Promise<void> {
		if (this.running) {
			return this.running;
		}
		this.running = this.runs
			.sweep()
			.then(() => undefined)
			.catch((error) =>
				// The next tick tries again.
				this.logger.warn(`The in-process invoice schedule sweep stopped: ${(error as Error)?.message ?? error}`)
			)
			.finally(() => {
				this.running = undefined;
			});
		return this.running;
	}
}

/**
 * The billing schedules for an API without a queue: the same sweep the queue's worker runs, asked by an in-process
 * timer. Imported by the API's root module only when there is no queue root.
 */
@Module({
	imports: [InvoiceScheduleRunModule],
	providers: [InvoiceScheduleInlineSweep]
})
export class InvoiceScheduleInlineModule {}
