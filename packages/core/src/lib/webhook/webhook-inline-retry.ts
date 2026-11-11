import { AsyncResource } from 'node:async_hooks';
import { Injectable, Logger, Module, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import type { Job } from 'bullmq';
import { IWebhookRetryJob, WebhookRetryWorker } from './webhook-retry.worker';
import { WebhookModule } from './webhook.module';

/** How often an API without a queue re-attempts the webhook deliveries that are due: the queue's schedule is per minute. */
export const WEBHOOK_INLINE_RETRY_MS = 60_000;

/**
 * Re-attempts due webhook deliveries in-process, for an API without a queue.
 *
 * Without a queue nothing delivered outbound webhooks at all; the outbox now runs in-process there
 * (`EventOutboxInlineDispatchModule`), so each event gets its first attempt. An attempt that failed is settled for the
 * outbox and written onto the delivery's retry ladder, and only `WebhookRetryWorker` reads that ladder — which, with
 * a queue, a per-minute job asks for. This sweep asks the same worker on the same period, from the async context the
 * provider was built in, one pass at a time.
 */
@Injectable()
export class WebhookInlineRetrySweep implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly logger = new Logger(WebhookInlineRetrySweep.name);
	private readonly root = new AsyncResource('WebhookInlineRetrySweep');
	private timer?: ReturnType<typeof setInterval>;
	private running?: Promise<void>;

	/**
	 * @param worker The retry worker this module runs in-process.
	 */
	constructor(private readonly worker: WebhookRetryWorker) {}

	/** Starts the sweep once the application is up. */
	onApplicationBootstrap(): void {
		this.root.runInAsyncScope(() => {
			this.timer = setInterval(() => void this.retry(), WEBHOOK_INLINE_RETRY_MS);
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
	 * Runs one retry pass, unless one is still running.
	 *
	 * @returns When the pass is over.
	 */
	retry(): Promise<void> {
		if (this.running) {
			return this.running;
		}

		const job = { data: { requestedAt: new Date().toISOString() } } as Job<IWebhookRetryJob>;
		this.running = this.worker
			.handleRetry(job)
			.catch((error) =>
				// The pass logged the failure; the next tick tries again.
				this.logger.debug(`The in-process webhook retry pass stopped: ${(error as Error)?.message ?? error}`)
			)
			.finally(() => {
				this.running = undefined;
			});

		return this.running;
	}
}

/**
 * The webhook retries for an API without a queue: the same worker the queue runs, asked by a sweep. Imported by the
 * API's root module only when there is no queue root, beside `EventOutboxInlineDispatchModule`.
 */
@Module({
	imports: [WebhookModule],
	providers: [WebhookRetryWorker, WebhookInlineRetrySweep]
})
export class WebhookInlineRetryModule {}
