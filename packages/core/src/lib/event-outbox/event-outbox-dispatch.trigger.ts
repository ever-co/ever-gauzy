import { AsyncResource } from 'node:async_hooks';
import {
	Injectable,
	Logger,
	Module,
	OnApplicationBootstrap,
	OnModuleDestroy,
	OnModuleInit,
	Optional
} from '@nestjs/common';
import { SchedulerQueueService } from '@gauzy/scheduler';
import {
	EVENT_OUTBOX_APPEND_DEBOUNCE_MS,
	EVENT_OUTBOX_APPEND_FOLLOW_UP_MS,
	EVENT_OUTBOX_DISPATCH_JOB,
	EVENT_OUTBOX_INLINE_SWEEP_MS,
	EVENT_OUTBOX_QUEUE_NAME
} from './event-outbox-constant';
import { EventOutboxAppendSignal } from './event-outbox-append.signal';
import type { IEventOutboxDispatchJob } from './event-outbox-dispatch.worker';
import { EventOutboxDispatcher } from './event-outbox-dispatcher';
import { EventOutboxModule } from './event-outbox.module';

/**
 * Whether the API drains the outbox in-process when it has no queue.
 *
 * On unless `EVENT_OUTBOX_INLINE_DISPATCH` is exactly `false`. Without it a deployment with no Redis
 * appends every event and delivers none: subscriptions stay silent, the search index stays stale and
 * no outbound webhook is ever called, while `event_outbox` grows and nothing reports an error.
 */
export function isEventOutboxInlineDispatchEnabled(): boolean {
	return process.env['EVENT_OUTBOX_INLINE_DISPATCH'] !== 'false';
}

/**
 * Turns appends into a prompt pass: waits a moment for the caller's commit and for the rest of a
 * burst, asks for one pass, and asks once more a second later in case the first one ran before the
 * commit. The two modes differ only in how a pass is asked for.
 *
 * **Every timer starts from a root async context taken when the provider is built, at boot.** An
 * append happens inside a request and, usually, inside its transaction; a timer armed there would
 * carry that request's async-local state into the pass — its user, tenant and organization for every
 * consumer of every event in the batch, and on SQLite the writer's open transaction, which the claim
 * would join instead of waiting for the commit. A pass must run as the platform, the way a queue
 * worker runs it.
 */
abstract class AppendDrivenDispatch implements OnModuleInit, OnModuleDestroy {
	protected abstract readonly mode: 'inline' | 'queue';
	protected readonly logger = new Logger(this.constructor.name);
	/** The async context timers start from: the one this provider was built in, outside any request. */
	protected readonly root = new AsyncResource('EventOutboxAppendDrivenDispatch');

	private unlisten?: () => void;
	private debounceTimer?: ReturnType<typeof setTimeout>;
	private followUpTimer?: ReturnType<typeof setTimeout>;
	protected stopped = false;

	constructor(protected readonly signal: EventOutboxAppendSignal) {}

	/** Starts listening to appends, and reports this process's delivery mode through the signal. */
	onModuleInit(): void {
		this.unlisten = this.signal.listen(() => this.request(), this.mode);
	}

	/** Stops listening and cancels the timers that are armed. */
	onModuleDestroy(): void {
		this.stopped = true;
		this.unlisten?.();
		clearTimeout(this.debounceTimer);
		clearTimeout(this.followUpTimer);
		this.debounceTimer = undefined;
		this.followUpTimer = undefined;
	}

	/**
	 * Called on every append: arms the debounced request and the follow-up, once each.
	 */
	request(): void {
		if (this.stopped) {
			return;
		}

		if (!this.debounceTimer) {
			this.debounceTimer = this.root.runInAsyncScope(() =>
				unref(
					setTimeout(() => {
						this.debounceTimer = undefined;
						this.fire(false);
					}, EVENT_OUTBOX_APPEND_DEBOUNCE_MS)
				)
			);
		}

		if (!this.followUpTimer) {
			this.followUpTimer = this.root.runInAsyncScope(() =>
				unref(
					setTimeout(() => {
						this.followUpTimer = undefined;
						this.fire(true);
					}, EVENT_OUTBOX_APPEND_FOLLOW_UP_MS)
				)
			);
		}
	}

	/**
	 * Asks for one drain, logging (never throwing) a failure to ask.
	 *
	 * @param followUp Whether this is the second ask, a second after the first.
	 */
	private fire(followUp: boolean): void {
		if (this.stopped) {
			return;
		}

		Promise.resolve()
			.then(() => this.dispatch(followUp))
			.catch((error) => this.logger.warn(`Could not ask for an outbox pass: ${describeError(error)}`));
	}

	/**
	 * Asks for one drain.
	 *
	 * @param followUp Whether this is the second ask, a second after the first.
	 */
	protected abstract dispatch(followUp: boolean): Promise<void>;
}

/**
 * Asks the queue for a drain right after an append — for the API when it has a queue.
 *
 * The per-minute schedule stays the safety net; this is what makes delivery prompt. The request is
 * a queue job like the tick's, so a process hosting every consumer takes it (the API), and requests
 * made within the same quarter-second share one job id, so a burst enqueues one job and not one per
 * event.
 */
@Injectable()
export class EventOutboxQueueDispatchTrigger extends AppendDrivenDispatch {
	protected readonly mode = 'queue' as const;

	constructor(
		signal: EventOutboxAppendSignal,
		@Optional() private readonly queue?: SchedulerQueueService
	) {
		super(signal);
	}

	/** Listens to appends only where there is a queue service to ask. */
	override onModuleInit(): void {
		// Without a queue service there is nothing to ask, and claiming the `queue` mode would report a
		// prompt delivery this process cannot make.
		if (this.queue) {
			super.onModuleInit();
		}
	}

	/**
	 * Enqueues one draining pass on the outbox queue, under a job id shared by every request in the same quarter
	 * second.
	 *
	 * @param followUp Whether this is the second ask, a second after the first.
	 */
	protected async dispatch(followUp: boolean): Promise<void> {
		if (!this.queue) {
			return;
		}

		const now = Date.now();
		const data: IEventOutboxDispatchJob = { requestedAt: new Date(now).toISOString(), drain: true };

		await this.queue.enqueue({
			queueName: EVENT_OUTBOX_QUEUE_NAME,
			jobName: EVENT_OUTBOX_DISPATCH_JOB,
			data,
			options: {
				jobId: `append-${followUp ? 'late-' : ''}${Math.floor(now / 250)}`,
				removeOnComplete: true,
				removeOnFail: 100
			}
		});
	}
}

/**
 * Drains the outbox in this process — for the API when it has no queue.
 *
 * Right after an append (debounced), once more a second later, and every fifteen seconds as a sweep
 * for what nobody asked about: a retry that came due, a lease that expired, a row another process
 * appended. One drain runs at a time; a request that arrives during one runs another right after.
 *
 * It is imported by the API's root module only when there is no queue root, so a process never runs
 * both this and the queue worker, and never in the worker app, whose consumer registry is incomplete.
 */
@Injectable()
export class EventOutboxInlineDispatch extends AppendDrivenDispatch implements OnApplicationBootstrap {
	protected readonly mode = 'inline' as const;

	private sweepTimer?: ReturnType<typeof setInterval>;
	private running?: Promise<void>;
	private again = false;

	constructor(
		signal: EventOutboxAppendSignal,
		private readonly dispatcher: EventOutboxDispatcher
	) {
		super(signal);
	}

	/** Starts the sweep once the application is up, from the root async context. */
	onApplicationBootstrap(): void {
		this.sweepTimer = this.root.runInAsyncScope(() =>
			unref(setInterval(() => void this.dispatch(), EVENT_OUTBOX_INLINE_SWEEP_MS))
		);
	}

	/** Stops listening, cancels the timers and the sweep. */
	override onModuleDestroy(): void {
		super.onModuleDestroy();
		clearInterval(this.sweepTimer);
		this.sweepTimer = undefined;
	}

	/**
	 * Runs one drain now, or right after the one in progress.
	 *
	 * @returns When this request's drain (or the one it joined) is over.
	 */
	protected dispatch(): Promise<void> {
		if (this.stopped) {
			return Promise.resolve();
		}

		if (this.running) {
			this.again = true;
			return this.running;
		}

		this.running = (async () => {
			do {
				this.again = false;
				try {
					await this.dispatcher.drain({ requestedAt: new Date().toISOString(), quiet: true });
				} catch (error) {
					// The pass already logged the claim failure; the next request or sweep tries again.
					this.logger.debug(`The in-process outbox drain stopped: ${describeError(error)}`);
				}
			} while (this.again && !this.stopped);
		})().finally(() => {
			this.running = undefined;
		});

		return this.running;
	}
}

/**
 * The API's in-process outbox drain, for a deployment without a queue.
 *
 * Imports the outbox kernel for the service, the consumer registry and the append signal, which are
 * the same instances every other importer of `EventOutboxModule` sees.
 */
@Module({
	imports: [EventOutboxModule],
	providers: [EventOutboxDispatcher, EventOutboxInlineDispatch],
	exports: [EventOutboxInlineDispatch]
})
export class EventOutboxInlineDispatchModule {}

function unref<T>(timer: T): T {
	(timer as { unref?: () => void })?.unref?.();
	return timer;
}

function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
