import { AsyncResource } from 'node:async_hooks';
import { Injectable, Logger, Module, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { TIMER_REMINDER_INLINE_SWEEP_MS } from './timer-reminder.constants';
import { TimerReminderModule } from './timer-reminder.module';
import { TimerReminderService } from './timer-reminder.service';

/**
 * Sweeps the timer reminders in-process, for an API without a queue (a single container, a development setup), on the
 * period of the queue's schedule, one pass at a time, from the async context the provider was built in (no request's).
 * Several such APIs sweeping at once still file each reminder once: the sweep claims a reminder before it files it.
 */
@Injectable()
export class TimerReminderInlineSweep implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = new Logger(TimerReminderInlineSweep.name);
	private readonly root = new AsyncResource('TimerReminderInlineSweep');
	private timer?: ReturnType<typeof setInterval>;
	private running?: Promise<void>;

	constructor(private readonly reminders: TimerReminderService) {}

	/** Starts the sweep once the application is up. */
	onApplicationBootstrap(): void {
		this.root.runInAsyncScope(() => {
			this.timer = setInterval(() => void this.sweep(), TIMER_REMINDER_INLINE_SWEEP_MS);
			(this.timer as { unref?: () => void }).unref?.();
		});
	}

	/** Stops the sweep, and waits for a pass in progress. */
	async onModuleDestroy(): Promise<void> {
		clearInterval(this.timer);
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
				this.logger.warn(`The in-process timer reminder sweep stopped: ${(error as Error)?.message ?? error}`)
			)
			.finally(() => {
				this.running = undefined;
			});
		return this.running;
	}
}

/**
 * The timer reminders for an API without a queue: the same sweep the queue's worker runs, asked by an in-process timer.
 * Imported by the API's root module only when there is no queue root.
 */
@Module({
	imports: [TimerReminderModule],
	providers: [TimerReminderInlineSweep]
})
export class TimerReminderInlineModule {}
