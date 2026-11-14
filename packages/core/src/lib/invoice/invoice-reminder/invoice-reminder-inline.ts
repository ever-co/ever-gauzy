import { AsyncResource } from 'node:async_hooks';
import { Injectable, Logger, Module, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { INVOICE_REMINDER_INLINE_FIRST_SWEEP_MS, INVOICE_REMINDER_INLINE_SWEEP_MS } from './invoice-reminder.constants';
import { InvoiceReminderModule } from './invoice-reminder.module';
import { InvoiceReminderService } from './invoice-reminder.service';

/**
 * Sweeps the payment reminders in-process, for an API without a queue (a single container, a development setup): a
 * minute after the application is up, then on the period of the queue's schedule, one pass at a time, from the async
 * context the provider was built in (no request's). Several such APIs sweeping at once still send each reminder once:
 * the sweep claims a reminder before it sends it.
 */
@Injectable()
export class InvoiceReminderInlineSweep implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = new Logger(InvoiceReminderInlineSweep.name);
	private readonly root = new AsyncResource('InvoiceReminderInlineSweep');
	private first?: ReturnType<typeof setTimeout>;
	private timer?: ReturnType<typeof setInterval>;
	private running?: Promise<void>;

	constructor(private readonly reminders: InvoiceReminderService) {}

	/** Starts the sweep once the application is up: an API restarted more often than hourly still sweeps. */
	onApplicationBootstrap(): void {
		this.root.runInAsyncScope(() => {
			this.first = setTimeout(() => void this.sweep(), INVOICE_REMINDER_INLINE_FIRST_SWEEP_MS);
			this.timer = setInterval(() => void this.sweep(), INVOICE_REMINDER_INLINE_SWEEP_MS);
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
		this.running = this.reminders
			.sweep()
			.then(() => undefined)
			.catch((error) =>
				// The next tick tries again.
				this.logger.warn(`The in-process payment reminder sweep stopped: ${(error as Error)?.message ?? error}`)
			)
			.finally(() => {
				this.running = undefined;
			});
		return this.running;
	}
}

/**
 * The payment reminders for an API without a queue: the same sweep the queue's worker runs, asked by an in-process
 * timer. Imported by the API's root module only when there is no queue root.
 */
@Module({
	imports: [InvoiceReminderModule],
	providers: [InvoiceReminderInlineSweep]
})
export class InvoiceReminderInlineModule {}
