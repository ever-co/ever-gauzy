import { Injectable, Logger } from '@nestjs/common';

/**
 * How appended events reach their consumers in this process.
 *
 * - `inline`: this process runs the dispatch pass itself, moments after an append (no queue).
 * - `queue`: an append asks the queue for a pass at once; a process hosting the consumers takes it.
 * - `none`: nothing reacts to an append here; only a schedule, if any, drains the outbox.
 */
export type EventOutboxDeliveryMode = 'inline' | 'queue' | 'none';

/**
 * Tells whoever drains the outbox that an event was just appended.
 *
 * `append` stays half of the transactional outbox: it writes the row in the caller's transaction and
 * performs no I/O. What it adds is a signal, so a pass can start moments later instead of at the next
 * per-minute tick — the difference between a chat message that shows at once and one that shows a
 * minute later. The signal carries nothing and promises nothing: a listener that misses it (or a
 * process without one) leaves the row exactly where the schedule finds it.
 *
 * It lives in `EventOutboxModule`, which every process that appends imports, and the module that
 * drains the outbox in this process registers the one listener — so the kernel does not depend on
 * the scheduler, and a process that drains nothing simply has no listener.
 */
@Injectable()
export class EventOutboxAppendSignal {
	private readonly logger = new Logger(EventOutboxAppendSignal.name);
	private readonly listeners = new Set<() => void>();
	private mode: EventOutboxDeliveryMode = 'none';

	/**
	 * Registers what reacts to an append.
	 *
	 * @param listener Called after every append, synchronously; it must return at once.
	 * @param mode How the listener delivers, reported by {@link deliveryMode}.
	 * @returns A function that removes the listener.
	 */
	listen(listener: () => void, mode: Exclude<EventOutboxDeliveryMode, 'none'>): () => void {
		this.listeners.add(listener);
		this.mode = mode;

		return () => {
			this.listeners.delete(listener);
			if (this.listeners.size === 0) {
				this.mode = 'none';
			}
		};
	}

	/**
	 * Announces an append. Never throws: a listener's failure is logged, and the row is still stored.
	 */
	notify(): void {
		for (const listener of Array.from(this.listeners)) {
			try {
				listener();
			} catch (error) {
				this.logger.warn(
					`An outbox append listener failed: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}
	}

	/**
	 * How appended events reach their consumers in this process.
	 */
	deliveryMode(): EventOutboxDeliveryMode {
		return this.listeners.size > 0 ? this.mode : 'none';
	}
}
