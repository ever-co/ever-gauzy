/** How many refused credentials one address may send to an instance within a window before it is capped. */
export const EMBED_EXCHANGE_FAILURES_PER_ADDRESS = 60;

/** The window refused credentials are counted in, in milliseconds. */
export const EMBED_EXCHANGE_FAILURE_WINDOW_MS = 60_000;

/** How long a credential an instance accepted passes the cap after its last acceptance, in milliseconds. */
export const EMBED_ACCEPTED_CREDENTIAL_TTL_MS = 60 * 60_000;

/** How many addresses, and how many accepted credentials, an instance remembers; the oldest is forgotten first. */
export const EMBED_EXCHANGE_MEMORY_MAX_ENTRIES = 10_000;

interface IFailureWindow {
	count: number;
	readonly startedAt: number;
}

/**
 * Drops the entries of a map kept in the order they started that have ended, oldest first, up to the first live one.
 *
 * @param entries The map.
 * @param hasEnded Whether an entry has ended.
 */
function dropEnded<T>(entries: Map<string, T>, hasEnded: (entry: T) => boolean): void {
	for (const [key, entry] of entries) {
		if (!hasEnded(entry)) {
			return;
		}
		entries.delete(key);
	}
}

/** Makes room for one more entry: the oldest goes when the map is full. */
function makeRoom<T>(entries: Map<string, T>): void {
	if (entries.size < EMBED_EXCHANGE_MEMORY_MAX_ENTRIES) {
		return;
	}
	entries.delete(entries.keys().next().value);
}

/**
 * The refused exchanges of each address and the credentials accepted recently, as one instance saw them.
 *
 * The rate limiter gives each well-formed credential its own budget, so made-up credentials sent from one address each
 * get a fresh one, and each costs a database lookup. Once an address has had
 * {@link EMBED_EXCHANGE_FAILURES_PER_ADDRESS} credentials refused within a window, its exchanges are answered 429
 * before any lookup until the window ends, except with a credential this instance accepted recently: a host whose bad
 * deployment sent wrong secrets keeps its good credential. Per instance on purpose: the cost it bounds is this
 * instance's lookups.
 */
export class EmbedExchangeFailures {
	/** By address, in the order their windows started. */
	private readonly windows = new Map<string, IFailureWindow>();

	/** The time of the last acceptance, by credential digest, in that order. */
	private readonly accepted = new Map<string, number>();

	constructor(private readonly clock: () => number = () => Date.now()) {}

	/**
	 * Whether a credential sent from an address may be looked up.
	 *
	 * @param address The client address, as the rate limiter resolves it.
	 * @param keyHash The credential's digest.
	 */
	allows(address: string, keyHash: string): boolean {
		if (this.isAccepted(keyHash)) {
			return true;
		}
		return !this.isCapped(address);
	}

	/**
	 * Counts a refused credential against an address.
	 *
	 * @param address The client address, as the rate limiter resolves it.
	 * @returns True when this refusal brings the address to the cap.
	 */
	recordFailure(address: string): boolean {
		dropEnded(this.windows, (window) => this.hasEnded(window));
		const window = this.liveWindowOf(address) ?? this.openWindow(address);
		window.count += 1;
		return window.count === EMBED_EXCHANGE_FAILURES_PER_ADDRESS;
	}

	/**
	 * Remembers a credential this instance accepted, so it passes the cap of any address.
	 *
	 * @param keyHash The credential's digest.
	 */
	recordAccepted(keyHash: string): void {
		const now = this.clock();
		dropEnded(this.accepted, (acceptedAt) => now - acceptedAt >= EMBED_ACCEPTED_CREDENTIAL_TTL_MS);
		this.accepted.delete(keyHash);
		makeRoom(this.accepted);
		this.accepted.set(keyHash, now);
	}

	private isAccepted(keyHash: string): boolean {
		const acceptedAt = this.accepted.get(keyHash);
		if (acceptedAt === undefined) {
			return false;
		}
		if (this.clock() - acceptedAt >= EMBED_ACCEPTED_CREDENTIAL_TTL_MS) {
			this.accepted.delete(keyHash);
			return false;
		}
		return true;
	}

	private isCapped(address: string): boolean {
		const window = this.liveWindowOf(address);
		if (!window) {
			return false;
		}
		return window.count >= EMBED_EXCHANGE_FAILURES_PER_ADDRESS;
	}

	private liveWindowOf(address: string): IFailureWindow | null {
		const window = this.windows.get(address);
		if (!window || this.hasEnded(window)) {
			return null;
		}
		return window;
	}

	/** A new window for the address, last in the order, after any ended one of it. */
	private openWindow(address: string): IFailureWindow {
		this.windows.delete(address);
		makeRoom(this.windows);
		const window: IFailureWindow = { count: 0, startedAt: this.clock() };
		this.windows.set(address, window);
		return window;
	}

	private hasEnded(window: IFailureWindow): boolean {
		return this.clock() - window.startedAt >= EMBED_EXCHANGE_FAILURE_WINDOW_MS;
	}
}
