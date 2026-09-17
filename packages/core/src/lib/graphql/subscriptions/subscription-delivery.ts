import { SubscriptionEventLike } from './subscription-scope';
import { SubscriptionLimitError, SubscriptionLimits, DEFAULT_SUBSCRIPTION_LIMITS } from './subscription-limits';

/**
 * One message on its way to a client.
 */
export interface SubscriptionMessage {
	/** The event name the message reports. */
	readonly eventName: string;
	/**
	 * The envelopes. One entry for an ordinary message; several when a burst was merged into one.
	 * The client reads them in order and treats the last as the current state.
	 */
	readonly payloads: readonly unknown[];
	/** Whether the message merged more than one event. */
	readonly coalesced: boolean;
	/** Set when the events were withheld because the message would have been too large. */
	readonly oversized?: boolean;
}

/**
 * What happened to one offered event.
 */
export type DeliveryOutcome =
	/** Accepted and waiting for its window to close. */
	| 'QUEUED'
	/** The authorisation check refused it. */
	| 'REFUSED'
	/** The subscription is closed, so nothing will be delivered. */
	| 'CLOSED';

/**
 * The time source the coalescing window runs on, injected so the window can be asserted exactly
 * rather than with a sleep.
 */
export interface SubscriptionClock {
	/** Milliseconds since the epoch. */
	now(): number;
	/**
	 * Runs a callback after a delay.
	 *
	 * @param flush The callback.
	 * @param delayMs The delay.
	 * @returns A function that cancels the callback.
	 */
	schedule(flush: () => void, delayMs: number): () => void;
}

/**
 * The clock a running server uses.
 */
export const systemSubscriptionClock: SubscriptionClock = {
	now: () => Date.now(),
	schedule: (flush, delayMs) => {
		const timer = setTimeout(flush, delayMs);
		return () => clearTimeout(timer);
	}
};

/**
 * What a subscription has done.
 */
export interface SubscriptionDeliveryStats {
	/** Events that were authorised and queued. */
	readonly queued: number;
	/** Messages handed to the sink. */
	readonly delivered: number;
	/** Events that shared a message with an earlier one. */
	readonly merged: number;
	/** Events refused by the authorisation check. */
	readonly refused: number;
	/** Messages withheld because they were too large. */
	readonly oversized: number;
	/** Whether the subscription has been closed. */
	readonly closed: boolean;
	/** The code the subscription was closed with, when it was closed by a limit. */
	readonly closeCode?: string;
}

/**
 * One subscription's outbound path.
 *
 * This is where the two behaviours a client feels are implemented:
 *
 * - **coalescing.** At most one message per event name per window. A burst is merged rather than
 *   dropped and rather than forwarded one message per event, because a client that must re-read the
 *   resource anyway does not need the two hundred intermediate values — but it does need to know that
 *   something happened and what the value is now.
 * - **a bounded queue.** A connection whose writes are not being consumed is closed instead of
 *   buffered without bound, so one dead client cannot grow the process without limit.
 *
 * The class has no transport and no container behind it: the sink is a callback, so the same code
 * serves the WebSocket writer, a test and a diagnostic replay.
 */
export class SubscriptionDelivery {
	private readonly buffers = new Map<string, unknown[]>();
	private readonly cancels = new Map<string, () => void>();
	private readonly inFlight = new Set<Promise<void>>();

	private closed = false;
	private closeError?: SubscriptionLimitError;
	private queued = 0;
	private deliveredCount = 0;
	private mergedCount = 0;
	private refusedCount = 0;
	private oversizedCount = 0;

	/**
	 * @param options Who the subscription belongs to, the limits, and where messages go.
	 */
	constructor(
		private readonly options: {
			readonly subscriberId: string;
			readonly limits?: SubscriptionLimits;
			readonly sink: (message: SubscriptionMessage) => void | Promise<void>;
			readonly clock?: SubscriptionClock;
			readonly onClose?: (error?: SubscriptionLimitError) => void;
		}
	) {}

	/**
	 * The limits in force.
	 */
	private get limits(): SubscriptionLimits {
		return this.options.limits ?? DEFAULT_SUBSCRIPTION_LIMITS;
	}

	/**
	 * The clock in force.
	 */
	private get clock(): SubscriptionClock {
		return this.options.clock ?? systemSubscriptionClock;
	}

	/**
	 * Accepts one event, after asking whether it may be delivered at all.
	 *
	 * The authorisation callback is invoked here rather than at subscribe time on purpose: a
	 * permission revoked while the connection is open has to stop the next event, not the next
	 * connection.
	 *
	 * @param event The event.
	 * @param authorize Whether this event may be delivered to this subscription.
	 * @returns What happened to the event.
	 */
	async offer(event: SubscriptionEventLike, authorize: () => Promise<boolean>): Promise<DeliveryOutcome> {
		if (this.closed) {
			return 'CLOSED';
		}

		if (!(await authorize())) {
			this.refusedCount += 1;
			return 'REFUSED';
		}

		if (this.closed) {
			return 'CLOSED';
		}

		if (this.outstanding() >= this.limits.maxQueueDepth) {
			this.close(
				new SubscriptionLimitError(
					'TRY_AGAIN_LATER',
					'This connection is not reading fast enough; it is closed so that the client can reconnect and re-read.',
					{ limit: this.limits.maxQueueDepth, actual: this.outstanding() }
				)
			);
			return 'CLOSED';
		}

		const buffer = this.buffers.get(event.name) ?? [];
		buffer.push(event);
		this.buffers.set(event.name, buffer);
		this.queued += 1;

		if (buffer.length === 1) {
			// The window opens with the first event of a burst and is not extended by later ones, so
			// the latency a client sees is bounded by the window rather than by the burst.
			const cancel = this.clock.schedule(() => this.flush(event.name), this.limits.coalesceWindowMs);
			this.cancels.set(event.name, cancel);
		}

		return 'QUEUED';
	}

	/**
	 * Emits one event name's window now.
	 *
	 * @param eventName The event name.
	 */
	flush(eventName: string): void {
		const cancel = this.cancels.get(eventName);
		if (cancel) {
			cancel();
			this.cancels.delete(eventName);
		}

		const payloads = this.buffers.get(eventName);
		this.buffers.delete(eventName);

		if (!payloads || payloads.length === 0 || this.closed) {
			return;
		}

		if (payloads.length > 1) {
			this.mergedCount += payloads.length - 1;
		}

		const message: SubscriptionMessage = {
			eventName,
			payloads,
			coalesced: payloads.length > 1
		};

		if (this.messageSize(message) > this.limits.maxMessageBytes) {
			// A frame the client cannot receive is worse than a frame it can act on, so the events are
			// withheld and the client is told to re-read the resource over the query API.
			this.oversizedCount += 1;
			this.write({ eventName, payloads: [], coalesced: true, oversized: true });
			return;
		}

		this.write(message);
	}

	/**
	 * Emits every window now and waits for the writes to settle.
	 *
	 * @returns A promise that resolves when nothing is outstanding.
	 */
	async drain(): Promise<void> {
		for (const eventName of Array.from(this.buffers.keys())) {
			this.flush(eventName);
		}

		while (this.inFlight.size > 0) {
			await Promise.all(Array.from(this.inFlight));
		}
	}

	/**
	 * Closes the subscription, discarding anything still buffered.
	 *
	 * @param error The limit that closed it, when a limit did.
	 */
	close(error?: SubscriptionLimitError): void {
		if (this.closed) {
			return;
		}

		this.closed = true;
		this.closeError = error;

		for (const cancel of this.cancels.values()) {
			cancel();
		}
		this.cancels.clear();
		this.buffers.clear();

		this.options.onClose?.(error);
	}

	/**
	 * What this subscription has done.
	 */
	get stats(): SubscriptionDeliveryStats {
		return {
			queued: this.queued,
			delivered: this.deliveredCount,
			merged: this.mergedCount,
			refused: this.refusedCount,
			oversized: this.oversizedCount,
			closed: this.closed,
			closeCode: this.closeError?.code
		};
	}

	/**
	 * How many buffered events and unsettled writes are outstanding.
	 *
	 * @returns The count.
	 */
	outstanding(): number {
		let buffered = 0;
		for (const payloads of this.buffers.values()) {
			buffered += payloads.length;
		}

		return buffered + this.inFlight.size;
	}

	/**
	 * Hands a message to the sink, counting the write while it is outstanding.
	 *
	 * @param message The message.
	 */
	private write(message: SubscriptionMessage): void {
		try {
			const result = this.options.sink(message);
			this.deliveredCount += 1;

			if (result && typeof (result as Promise<void>).then === 'function') {
				const pending = (result as Promise<void>)
					.catch(() => undefined)
					.then(() => {
						this.inFlight.delete(pending);
					});
				this.inFlight.add(pending);
			}
		} catch {
			// A sink that throws has closed the connection underneath us; the transport reports the
			// close, and this delivery stops writing rather than escalating.
			this.close();
		}
	}

	/**
	 * The size of a message, as the wire would carry it.
	 *
	 * @param message The message.
	 * @returns An approximate byte count.
	 */
	private messageSize(message: SubscriptionMessage): number {
		try {
			return JSON.stringify(message)?.length ?? 0;
		} catch {
			// A payload that cannot be serialised cannot be sent either; treat it as too large so the
			// client is told to re-read rather than the process failing.
			return this.limits.maxMessageBytes + 1;
		}
	}
}
