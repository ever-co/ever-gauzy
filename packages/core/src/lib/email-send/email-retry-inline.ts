import { AsyncResource } from 'node:async_hooks';
import { Injectable, Logger, Module, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { EMAIL_RETRY_SWEEP_MS } from './email-retry.policy';
import { EmailRetryModule } from './email-retry.module';
import { EmailRetryService } from './email-retry.service';

/**
 * Sweeps the email retries in-process, for an API without a queue (a single container, a development setup): every
 * five minutes, the queue's period, one pass at a time, from the async context the provider was built in (no
 * request's). There is no sweep at start-up, so an API restarted in a loop sends nothing more than one that is not.
 *
 * Several such APIs sweeping at once still send each email once (the sweep claims a row before it sends it), and the
 * cap of one batch per period is the installation's, not each API's: the sweeps count every process's recent claims
 * in the database before each claim (see `EmailRetryService`).
 */
@Injectable()
export class EmailRetryInlineSweep implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = new Logger(EmailRetryInlineSweep.name);
	private readonly root = new AsyncResource('EmailRetryInlineSweep');
	private timer?: ReturnType<typeof setInterval>;
	private running?: Promise<void>;

	constructor(private readonly retries: EmailRetryService) {}

	/** Starts the sweep once the application is up. */
	onApplicationBootstrap(): void {
		this.root.runInAsyncScope(() => {
			this.timer = setInterval(() => void this.sweep(), EMAIL_RETRY_SWEEP_MS);
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
		this.running = this.retries
			.sweep()
			.then(() => undefined)
			.catch((error) =>
				// The next tick tries again.
				this.logger.warn(`The in-process email retry sweep stopped: ${(error as Error)?.message ?? error}`)
			)
			.finally(() => {
				this.running = undefined;
			});
		return this.running;
	}
}

/**
 * The email retries for an API without a queue: the same sweep the queue's worker runs, asked by an in-process timer.
 * Imported by the API's root module only when there is no queue root.
 */
@Module({
	imports: [EmailRetryModule],
	providers: [EmailRetryInlineSweep]
})
export class EmailRetryInlineModule {}
