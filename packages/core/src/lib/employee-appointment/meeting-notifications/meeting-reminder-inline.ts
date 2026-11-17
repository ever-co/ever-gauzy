import { AsyncResource } from 'node:async_hooks';
import { Injectable, Logger, Module, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { MEETING_REMINDER_INLINE_SWEEP_MS } from './meeting-reminder.constants';
import { MeetingReminderModule } from './meeting-reminder.module';
import { MeetingReminderService } from './meeting-reminder.service';

/**
 * Sweeps the meeting reminders in-process, for an API without a queue (a single container, a development setup), on the
 * period of the queue's schedule, one pass at a time, from the async context the provider was built in (no request's).
 * Several such APIs sweeping at once still file each reminder once: the sweep claims a reminder before it files it.
 */
@Injectable()
export class MeetingReminderInlineSweep implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = new Logger(MeetingReminderInlineSweep.name);
	private readonly root = new AsyncResource('MeetingReminderInlineSweep');
	private timer?: ReturnType<typeof setInterval>;
	private running?: Promise<void>;

	constructor(private readonly reminders: MeetingReminderService) {}

	/** Starts the sweep once the application is up. */
	onApplicationBootstrap(): void {
		this.root.runInAsyncScope(() => {
			this.timer = setInterval(() => void this.sweep(), MEETING_REMINDER_INLINE_SWEEP_MS);
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
				this.logger.warn(`The in-process meeting reminder sweep stopped: ${(error as Error)?.message ?? error}`)
			)
			.finally(() => {
				this.running = undefined;
			});
		return this.running;
	}
}

/**
 * The meeting reminders for an API without a queue: the same sweep the queue's worker runs, asked by an in-process timer.
 * Imported by the API's root module only when there is no queue root.
 */
@Module({
	imports: [MeetingReminderModule],
	providers: [MeetingReminderInlineSweep]
})
export class MeetingReminderInlineModule {}
