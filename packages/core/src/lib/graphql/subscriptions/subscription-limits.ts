/**
 * The limits a subscription runs under.
 *
 * A subscription is a long-lived connection that a client holds open, so the resource it consumes is
 * the connection and the fan-out, not the request. The limits below are therefore stated per
 * connection and per tenant rather than per HTTP call, and they are configuration: a deployment that
 * needs more raises the number rather than changing the code.
 *
 * The two behaviours worth reading the table for:
 *
 * - a **burst is coalesced, never dropped**: at most one message per event name per window, with the
 *   payloads of the burst merged, because a client that receives the latest stock level does not need
 *   the two hundred intermediate ones;
 * - a **connection that cannot keep up is closed**, rather than buffered without bound, so a dead
 *   client cannot hold a worker's memory.
 */

/**
 * Every limit, resolved.
 */
export interface SubscriptionLimits {
	/** Concurrent connections one tenant may hold. */
	readonly maxConnectionsPerTenant: number;
	/** Concurrent connections one credential (a user or an API key) may hold. */
	readonly maxConnectionsPerCredential: number;
	/** Concurrent subscriptions one connection may hold. */
	readonly maxSubscriptionsPerConnection: number;
	/** Outbound messages per connection per second, before coalescing merges them. */
	readonly maxMessagesPerSecond: number;
	/** The window in which messages for one event name are merged into one. */
	readonly coalesceWindowMs: number;
	/** Messages a connection may have outstanding before it is closed. */
	readonly maxQueueDepth: number;
	/** The largest frame the server will send. */
	readonly maxMessageBytes: number;
}

/**
 * The shipped defaults, matching the documented limits.
 */
export const DEFAULT_SUBSCRIPTION_LIMITS: SubscriptionLimits = {
	maxConnectionsPerTenant: 200,
	maxConnectionsPerCredential: 20,
	maxSubscriptionsPerConnection: 10,
	maxMessagesPerSecond: 50,
	coalesceWindowMs: 20,
	maxQueueDepth: 1000,
	maxMessageBytes: 1024 * 1024
};

/**
 * The environment variable that overrides each limit.
 */
const ENVIRONMENT_KEYS: Readonly<Record<keyof SubscriptionLimits, string>> = {
	maxConnectionsPerTenant: 'GRAPHQL_SUBSCRIPTION_MAX_CONNECTIONS_PER_TENANT',
	maxConnectionsPerCredential: 'GRAPHQL_SUBSCRIPTION_MAX_CONNECTIONS_PER_CREDENTIAL',
	maxSubscriptionsPerConnection: 'GRAPHQL_SUBSCRIPTION_MAX_SUBSCRIPTIONS_PER_CONNECTION',
	maxMessagesPerSecond: 'GRAPHQL_SUBSCRIPTION_MAX_MESSAGES_PER_SECOND',
	coalesceWindowMs: 'GRAPHQL_SUBSCRIPTION_COALESCE_WINDOW_MS',
	maxQueueDepth: 'GRAPHQL_SUBSCRIPTION_MAX_QUEUE_DEPTH',
	maxMessageBytes: 'GRAPHQL_SUBSCRIPTION_MAX_MESSAGE_BYTES'
};

/**
 * The codes a limit breach carries, so a client can tell "slow down" from "you are not allowed".
 */
export type SubscriptionLimitCode =
	/** Too many connections. Retryable. */
	| 'RATE_LIMITED'
	/** Too many subscriptions on one connection. The connection stays open. */
	| 'SUBSCRIPTION_LIMIT_EXCEEDED'
	/** The connection's queue is full. The connection is closed and the client reconnects. */
	| 'TRY_AGAIN_LATER'
	/** The frame is larger than the connection may receive. */
	| 'MESSAGE_TOO_LARGE';

/**
 * Raised when a limit is reached.
 */
export class SubscriptionLimitError extends Error {
	constructor(
		readonly code: SubscriptionLimitCode,
		message: string,
		readonly details?: Readonly<Record<string, unknown>>
	) {
		super(message);
		this.name = 'SubscriptionLimitError';
	}
}

/**
 * Resolves the limits from the environment, falling back per value.
 *
 * A value that is not a positive integer falls back to its default rather than failing the boot: a
 * typo in one environment variable must not take the API down, and the fallback is the documented
 * behaviour either way.
 *
 * @param overrides Values that win over the environment.
 * @param environment The environment to read.
 * @returns The resolved limits.
 */
export function resolveSubscriptionLimits(
	overrides: Partial<SubscriptionLimits> = {},
	environment: Record<string, string | undefined> = readProcessEnvironment()
): SubscriptionLimits {
	const resolved = { ...DEFAULT_SUBSCRIPTION_LIMITS } as Record<keyof SubscriptionLimits, number>;

	for (const key of Object.keys(DEFAULT_SUBSCRIPTION_LIMITS) as (keyof SubscriptionLimits)[]) {
		const raw = environment[ENVIRONMENT_KEYS[key]];
		const parsed = raw === undefined || raw === '' ? undefined : Number(raw);

		if (parsed !== undefined && Number.isFinite(parsed) && parsed > 0) {
			resolved[key] = Math.floor(parsed);
		}

		const override = overrides[key];
		if (override !== undefined && Number.isFinite(override) && override > 0) {
			resolved[key] = Math.floor(override);
		}
	}

	return resolved;
}

/**
 * The process environment, when there is one.
 *
 * Read through `globalThis` so the module stays loadable in a runtime that has no `process` — the
 * limits then resolve to their defaults rather than failing to load.
 *
 * @returns The environment, or an empty map.
 */
function readProcessEnvironment(): Record<string, string | undefined> {
	const runtime = globalThis as { process?: { env?: Record<string, string | undefined> } };
	return runtime.process?.env ?? {};
}

/**
 * Who is using the subscription surface right now.
 *
 * Kept apart from the transport so the caps can be asserted without a socket: the transport asks the
 * budget before it accepts a connection or a `subscribe` message, and tells it when either ends.
 */
export class SubscriptionBudget {
	private readonly connections = new Map<string, { tenantId: string; credentialId: string }>();
	private readonly subscriptions = new Map<string, number>();

	constructor(private readonly limits: SubscriptionLimits = DEFAULT_SUBSCRIPTION_LIMITS) {}

	/**
	 * Takes a connection slot, or refuses.
	 *
	 * @param connectionId The connection's identity, from the transport.
	 * @param tenantId The tenant the credential belongs to.
	 * @param credentialId The user id or the API key id.
	 * @throws SubscriptionLimitError when a cap is reached.
	 */
	openConnection(connectionId: string, tenantId: string, credentialId: string): void {
		const connectionsForTenant = this.countConnections((entry) => entry.tenantId === tenantId);
		if (connectionsForTenant >= this.limits.maxConnectionsPerTenant) {
			throw new SubscriptionLimitError(
				'RATE_LIMITED',
				`The tenant already holds ${this.limits.maxConnectionsPerTenant} subscription connections.`,
				{ limit: this.limits.maxConnectionsPerTenant, scope: 'tenant' }
			);
		}

		const connectionsForCredential = this.countConnections((entry) => entry.credentialId === credentialId);
		if (connectionsForCredential >= this.limits.maxConnectionsPerCredential) {
			throw new SubscriptionLimitError(
				'RATE_LIMITED',
				`This credential already holds ${this.limits.maxConnectionsPerCredential} subscription connections.`,
				{ limit: this.limits.maxConnectionsPerCredential, scope: 'credential' }
			);
		}

		this.connections.set(connectionId, { tenantId, credentialId });
	}

	/**
	 * Releases a connection slot.
	 *
	 * @param connectionId The connection.
	 */
	closeConnection(connectionId: string): void {
		this.connections.delete(connectionId);
		this.subscriptions.delete(connectionId);
	}

	/**
	 * Takes a subscription slot on a connection, or refuses. The connection stays open either way.
	 *
	 * @param connectionId The connection.
	 * @throws SubscriptionLimitError when the connection already holds its maximum.
	 */
	openSubscription(connectionId: string): void {
		const open = this.subscriptions.get(connectionId) ?? 0;

		if (open >= this.limits.maxSubscriptionsPerConnection) {
			throw new SubscriptionLimitError(
				'SUBSCRIPTION_LIMIT_EXCEEDED',
				`This connection already holds ${this.limits.maxSubscriptionsPerConnection} subscriptions.`,
				{ limit: this.limits.maxSubscriptionsPerConnection, actual: open }
			);
		}

		this.subscriptions.set(connectionId, open + 1);
	}

	/**
	 * Releases a subscription slot.
	 *
	 * @param connectionId The connection.
	 */
	closeSubscription(connectionId: string): void {
		const open = this.subscriptions.get(connectionId) ?? 0;
		if (open <= 1) {
			this.subscriptions.delete(connectionId);
			return;
		}

		this.subscriptions.set(connectionId, open - 1);
	}

	/**
	 * How many connections are open.
	 */
	get connectionCount(): number {
		return this.connections.size;
	}

	/**
	 * How many subscriptions a connection holds.
	 *
	 * @param connectionId The connection.
	 * @returns The count.
	 */
	subscriptionsOn(connectionId: string): number {
		return this.subscriptions.get(connectionId) ?? 0;
	}

	/**
	 * Forgets every connection, for a shutdown.
	 */
	reset(): void {
		this.connections.clear();
		this.subscriptions.clear();
	}

	/**
	 * Counts connections matching a predicate.
	 *
	 * @param predicate The predicate.
	 * @returns The count.
	 */
	private countConnections(predicate: (entry: { tenantId: string; credentialId: string }) => boolean): number {
		let count = 0;
		for (const entry of this.connections.values()) {
			if (predicate(entry)) {
				count += 1;
			}
		}
		return count;
	}
}
