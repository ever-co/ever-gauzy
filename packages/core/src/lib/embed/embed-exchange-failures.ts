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
 * The credentials an instance accepted recently, by digest, in the order of their last acceptance. Bounded: one entry
 * per real credential, at most {@link EMBED_EXCHANGE_MEMORY_MAX_ENTRIES}, each for {@link EMBED_ACCEPTED_CREDENTIAL_TTL_MS}.
 */
export class AcceptedEmbedCredentials {
	/** The time of the last acceptance, by credential digest, in that order. */
	private readonly entries = new Map<string, number>();

	constructor(private readonly clock: () => number = () => Date.now()) {}

	/** Remembers a credential accepted now. */
	record(keyHash: string): void {
		const now = this.clock();
		dropEnded(this.entries, (acceptedAt) => now - acceptedAt >= EMBED_ACCEPTED_CREDENTIAL_TTL_MS);
		this.entries.delete(keyHash);
		makeRoom(this.entries);
		this.entries.set(keyHash, now);
	}

	/** Whether a credential was accepted within {@link EMBED_ACCEPTED_CREDENTIAL_TTL_MS}. */
	has(keyHash: string): boolean {
		const acceptedAt = this.entries.get(keyHash);
		if (acceptedAt === undefined) {
			return false;
		}
		if (this.clock() - acceptedAt >= EMBED_ACCEPTED_CREDENTIAL_TTL_MS) {
			this.entries.delete(keyHash);
			return false;
		}
		return true;
	}

	/** Forgets a credential: revoked, it is accepted no more. */
	forget(keyHash: string): void {
		this.entries.delete(keyHash);
	}
}

/**
 * The credentials this instance accepted recently: one memory, shared by the exchange (`EmbedCredentialService`) and
 * the route's rate limiter (`embed-exchange-throttle.ts`), which gives only these a budget of their own.
 */
export const recentlyAcceptedEmbedCredentials = new AcceptedEmbedCredentials();

/** What {@link EmbedExchangeFailures.admit} decided about a lookup. */
export interface IEmbedExchangeAdmission {
	/** Whether the credential may be looked up. */
	readonly allowed: boolean;
	/** Whether the lookup was counted against the address: to {@link EmbedExchangeFailures.release} if it earns a token. */
	readonly counted: boolean;
	/** Whether this lookup brought the address to the cap. */
	readonly reachesCap: boolean;
}

/**
 * The refused exchanges of each address and the credentials accepted recently, as one instance saw them.
 *
 * A credential nobody has seen accepted is counted against its address. Once an address has had
 * {@link EMBED_EXCHANGE_FAILURES_PER_ADDRESS} credentials refused within a window, its exchanges are answered 429
 * before any lookup until the window ends, except with a credential this instance accepted recently: a host whose bad
 * deployment sent wrong secrets keeps its good credential. Per instance on purpose: the cost it bounds is this
 * instance's lookups.
 */
export class EmbedExchangeFailures {
	/** By address, in the order their windows started. */
	private readonly windows = new Map<string, IFailureWindow>();

	constructor(
		private readonly clock: () => number = () => Date.now(),
		private readonly accepted: AcceptedEmbedCredentials = new AcceptedEmbedCredentials(clock)
	) {}

	/**
	 * Whether a credential sent from an address may be looked up.
	 *
	 * @param address The client address, as the rate limiter resolves it.
	 * @param keyHash The credential's digest.
	 */
	allows(address: string, keyHash: string): boolean {
		if (this.accepted.has(keyHash)) {
			return true;
		}
		return !this.isCapped(address);
	}

	/**
	 * Decides whether a credential sent from an address may be looked up, and counts the lookup against the address
	 * BEFORE it starts, unless the credential was accepted recently: lookups that run at the same time each take their
	 * place, so they cannot all pass a cap that none of them has reached yet. A lookup that earns a token is given back
	 * ({@link release}); a refused one stays counted.
	 *
	 * @param address The client address, as the rate limiter resolves it.
	 * @param keyHash The credential's digest.
	 */
	admit(address: string, keyHash: string): IEmbedExchangeAdmission {
		if (this.accepted.has(keyHash)) {
			return { allowed: true, counted: false, reachesCap: false };
		}
		if (this.isCapped(address)) {
			return { allowed: false, counted: false, reachesCap: false };
		}
		const reachesCap = this.recordFailure(address);
		return { allowed: true, counted: true, reachesCap };
	}

	/**
	 * Gives back a lookup {@link admit} counted, once it earned a token or could not be judged.
	 *
	 * @param address The client address, as the rate limiter resolves it.
	 */
	release(address: string): void {
		const window = this.liveWindowOf(address);
		if (window && window.count > 0) {
			window.count -= 1;
		}
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
		this.accepted.record(keyHash);
	}

	/**
	 * Forgets a credential this instance accepted: revoked, it passes no cap any more.
	 *
	 * @param keyHash The credential's digest.
	 */
	forgetAccepted(keyHash: string): void {
		this.accepted.forget(keyHash);
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
