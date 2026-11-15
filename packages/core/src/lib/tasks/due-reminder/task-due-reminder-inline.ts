import { AsyncResource } from 'node:async_hooks';
import { Injectable, Logger, Module, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { TASK_DUE_REMINDER_INLINE_SWEEP_MS } from './task-due-reminder.constants';
import { TaskDueReminderModule } from './task-due-reminder.module';
import { TaskDueReminderService } from './task-due-reminder.service';

/**
 * Sweeps the task due reminders in-process, for an API without a queue (a single container, a development setup), on
 * the period of the queue's schedule, one pass at a time, from the async context the provider was built in (no
 * request's). Several such APIs sweeping at once still file each reminder once: the sweep claims a reminder first.
 */
@Injectable()
export class TaskDueReminderInlineSweep implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = new Logger(TaskDueReminderInlineSweep.name);
	private readonly root = new AsyncResource('TaskDueReminderInlineSweep');
	private timer?: ReturnType<typeof setInterval>;
	private running?: Promise<void>;

	constructor(private readonly reminders: TaskDueReminderService) {}

	/** Starts the sweep once the application is up. */
	onApplicationBootstrap(): void {
		this.root.runInAsyncScope(() => {
			this.timer = setInterval(() => void this.sweep(), TASK_DUE_REMINDER_INLINE_SWEEP_MS);
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
				this.logger.warn(
					`The in-process task due reminder sweep stopped: ${(error as Error)?.message ?? error}`
				)
			)
			.finally(() => {
				this.running = undefined;
			});
		return this.running;
	}
}

/**
 * The task due reminders for an API without a queue: the same sweep the queue's worker runs, asked by an in-process
 * timer. Imported by the API's root module only when there is no queue root.
 */
@Module({
	imports: [TaskDueReminderModule],
	providers: [TaskDueReminderInlineSweep]
})
export class TaskDueReminderInlineModule {}
