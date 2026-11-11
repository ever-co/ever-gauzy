import { AsyncResource } from 'node:async_hooks';
import { Injectable, Module, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { isSchedulerQueueRootEnabled } from '@gauzy/scheduler';
import { EVENT_OUTBOX_DISPATCH_ON_COMMIT_ENV, EVENT_OUTBOX_INLINE_SWEEP_MS } from './event-outbox-constant';
import { EventOutboxDispatchWorker } from './event-outbox-dispatch.worker';
import { EventOutboxModule } from './event-outbox.module';

/**
 * Whether an API without a queue dispatches the outbox in-process.
 *
 * On unless `EVENT_OUTBOX_INLINE_DISPATCH` is exactly `false`. Without it such a deployment appends every event and
 * delivers none: subscriptions stay silent, the search index stays stale and no outbound webhook is ever called,
 * while `event_outbox` grows and nothing reports an error.
 */
export function isEventOutboxInlineDispatchEnabled(): boolean {
	return process.env['EVENT_OUTBOX_INLINE_DISPATCH'] !== 'false';
}

/**
 * How the API hands an appended event to its consumers, from the settings the modules are wired by.
 *
 * - `queue`: there is a queue; the API's queue worker is woken by the commit (the per-minute tick is the net).
 * - `inline`: no queue; the API runs the same worker in-process, woken by the commit and by a short sweep.
 * - `none`: nothing is woken by a commit (`GAUZY_EVENT_OUTBOX_DISPATCH_ON_COMMIT=false`, or no queue and the
 *   in-process mode switched off): events wait for a schedule, or are not delivered at all.
 */
export function eventOutboxDispatchMode(): 'inline' | 'queue' | 'none' {
	if (process.env[EVENT_OUTBOX_DISPATCH_ON_COMMIT_ENV]?.trim().toLowerCase() === 'false') {
		return 'none';
	}
	if (isSchedulerQueueRootEnabled()) {
		return 'queue';
	}
	return isEventOutboxInlineDispatchEnabled() ? 'inline' : 'none';
}

/**
 * The dispatch worker of an API without a queue: the same passes, run in this process.
 *
 * Without a queue root nothing consumed the outbox queue, so the worker's after-commit wake did nothing and no event
 * was ever delivered: subscriptions silent, the search index stale, no outbound webhook called. This worker counts
 * as consuming, so a commit that appended wakes its passes here, from the worker's own async context.
 */
@Injectable()
export class EventOutboxInlineDispatchWorker extends EventOutboxDispatchWorker {
	/** Always: this process is the one that dispatches. */
	protected override consumesQueue(): boolean {
		return true;
	}
}

/**
 * Wakes the in-process worker on a timer, for what no commit announces in this process: a retry that came due, a
 * lease that expired, a row appended by another process. Where there is a queue, the per-minute schedule does it.
 *
 * The timer is armed from the async context this provider was built in, outside any request, as the worker's own
 * wake is.
 */
@Injectable()
export class EventOutboxInlineSweep implements OnApplicationBootstrap, OnModuleDestroy {
	private readonly root = new AsyncResource('EventOutboxInlineSweep');
	private timer?: ReturnType<typeof setInterval>;

	/**
	 * @param worker The dispatch worker this module runs in-process.
	 */
	constructor(private readonly worker: EventOutboxInlineDispatchWorker) {}

	/** Starts the sweep once the application is up, and sweeps once right away for what is already waiting. */
	onApplicationBootstrap(): void {
		this.root.runInAsyncScope(() => {
			this.timer = setInterval(() => this.worker.wake(), EVENT_OUTBOX_INLINE_SWEEP_MS);
			(this.timer as { unref?: () => void }).unref?.();
			this.worker.wake();
		});
	}

	/** Stops the sweep. */
	onModuleDestroy(): void {
		clearInterval(this.timer);
		this.timer = undefined;
	}
}

/**
 * The outbox dispatch for an API without a queue.
 *
 * It provides `EventOutboxInlineDispatchWorker`, the queue's dispatch worker run in-process, so its after-commit
 * wake runs the passes here, plus the sweep. The API's root module imports it only when there is no queue root,
 * so a process never runs it beside the queue worker, and the worker app never imports it (its consumer registry
 * is incomplete).
 */
@Module({
	imports: [EventOutboxModule],
	providers: [EventOutboxInlineDispatchWorker, EventOutboxInlineSweep],
	exports: [EventOutboxInlineDispatchWorker]
})
export class EventOutboxInlineDispatchModule {}
