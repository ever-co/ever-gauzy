/**
 * How many entity events may be on their way to Jitsu at the same time.
 *
 * The global entity subscriber sees every row the API writes. Tenant onboarding alone inserts about 3,300
 * rows in a second (8 roles, 3,136 role permissions, the feature toggles, the task statuses…), and each of
 * them used to start its own HTTPS request to the Jitsu server immediately. One pod then had thousands of
 * TLS handshakes in flight: the event loop stalled long enough for PostgreSQL connects to hit their 5 s
 * timeout and Redis to miss its 250 ms one, so the onboarding request failed after its tenant had been
 * created but before the user was linked to it (production, 2026-10-27: every signup failed). Analytics must
 * never cost the request it observes, so events are sent a few at a time instead.
 */
export const DEFAULT_JITSU_MAX_CONCURRENT_EVENTS = 4;

/**
 * How many entity events may wait for a free slot. Beyond it new events are dropped and counted: analytics
 * is best-effort, and an unbounded backlog would only move the outage from the event loop to the heap.
 */
export const DEFAULT_JITSU_MAX_QUEUED_EVENTS = 1000;

/** How often, at most, the number of dropped events is reported. */
export const JITSU_DROP_REPORT_INTERVAL_MS = 60_000;

/** Reads a whole, non-negative number from the environment, or `fallback` when it is unset or not one. */
export function readCountEnv(name: string, fallback: number, env: NodeJS.ProcessEnv = process.env): number {
	// Strict: a whole number only (`10abc` or `1e3` is not silently read as 10 or 1).
	const raw = String(env[name] ?? '').trim();
	const parsed = /^\d+$/.test(raw) ? Number(raw) : NaN;
	return Number.isSafeInteger(parsed) ? parsed : fallback;
}

export interface BoundedEventQueueOptions {
	/** Events sent at the same time; at least 1. */
	concurrency: number;
	/** Events waiting for a slot; 0 drops everything that does not find a free slot at once. */
	maxQueued: number;
	/** Told how many events were dropped since the last report, at most once per `reportIntervalMs`. */
	onDropped?: (dropped: number) => void;
	reportIntervalMs?: number;
	/** The clock the reporting interval is measured with; `Date.now` unless a test controls it. */
	now?: () => number;
}

/**
 * A send queue with a fixed number of slots and a bounded backlog.
 *
 * `offer` never sends on the caller's stack: the first send starts on the next turn of the event loop, so
 * an ORM hook that offers an event returns at once, and a burst of writes costs one array push per row.
 */
export class BoundedEventQueue<T> {
	private readonly waiting: T[] = [];
	private active = 0;
	private scheduled = false;
	private dropped = 0;
	// Never reported yet: the first drop is reported at once, whatever the clock reads.
	private lastReport = Number.NEGATIVE_INFINITY;
	private reportTimer: ReturnType<typeof setTimeout> | null = null;
	private readonly concurrency: number;

	constructor(
		private readonly send: (event: T) => Promise<unknown>,
		private readonly options: BoundedEventQueueOptions
	) {
		this.concurrency = Math.max(1, options.concurrency);
	}

	/**
	 * Queues the event `build` returns, unless the queue is full. `build` runs only for an event that is
	 * kept, and runs at once, so it captures the row as it is now.
	 *
	 * @returns whether the event was queued.
	 */
	offer(build: () => T): boolean {
		// Room for `maxQueued` waiting events, or for as many as there are free slots when that is more.
		if (this.waiting.length >= Math.max(this.options.maxQueued, this.concurrency - this.active)) {
			this.dropped++;
			this.reportDropped();
			return false;
		}
		this.waiting.push(build());
		this.schedule();
		return true;
	}

	/** Events waiting for a slot and events being sent. */
	get pending(): number {
		return this.waiting.length + this.active;
	}

	private schedule(): void {
		if (this.scheduled) return;
		this.scheduled = true;
		setImmediate(() => {
			this.scheduled = false;
			this.drain();
		});
	}

	private drain(): void {
		while (this.active < this.concurrency && this.waiting.length > 0) {
			const event = this.waiting.shift() as T;
			this.active++;
			Promise.resolve()
				.then(() => this.send(event))
				.catch(() => undefined) // the sender reports its own failures; one must not stop the rest
				.finally(() => {
					this.active--;
					if (this.waiting.length > 0) this.schedule();
				});
		}
	}

	private reportDropped(): void {
		if (!this.options.onDropped) return;
		const interval = this.options.reportIntervalMs ?? JITSU_DROP_REPORT_INTERVAL_MS;
		const wait = this.lastReport + interval - this.now();
		if (wait <= 0) {
			// A timer that is due but has not run yet (the event loop is busy with the burst) would report
			// again right after this flush, inside the next interval.
			this.cancelReportTimer();
			this.flushDropped();
		} else if (!this.reportTimer) {
			// The rest of a burst is reported when the interval ends, even if nothing is dropped after it.
			this.reportTimer = setTimeout(() => {
				this.reportTimer = null;
				this.flushDropped();
			}, wait);
			this.reportTimer.unref?.();
		}
	}

	private cancelReportTimer(): void {
		if (this.reportTimer) {
			clearTimeout(this.reportTimer);
			this.reportTimer = null;
		}
	}

	private now(): number {
		return (this.options.now ?? Date.now)();
	}

	private flushDropped(): void {
		if (this.dropped === 0) return;
		this.lastReport = this.now();
		const dropped = this.dropped;
		this.dropped = 0;
		this.options.onDropped?.(dropped);
	}
}
