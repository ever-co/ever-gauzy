import { BehaviorSubject, Observable, Subscriber } from 'rxjs';
import { GraphqlWsConnection, isFatalCloseCode, SocketFactory } from './graphql-ws.connection';

/** Where the tab's socket stands. */
export type RealtimeSocketStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'stopped';

export interface RealtimeSocketOptions {
	/** The socket URL; `null` when the deployment has none, which keeps every subscription from starting. */
	url: () => string | null;
	/** The `connection_init` payload (credential and scope); `null` when signed out. */
	connectionParams: () => Record<string, unknown> | null;
	createSocket?: SocketFactory;
	backoff?: { minMs: number; maxMs: number };
	pingIntervalMs?: number;
	ackTimeoutMs?: number;
	/** How long an unused socket stays open after its last subscription ended. */
	idleCloseMs?: number;
	random?: () => number;
	setTimeout?: (fn: () => void, ms: number) => unknown;
	clearTimeout?: (handle: unknown) => void;
}

/** Why a subscription could not run: no socket URL, no credential, or a socket the server refused. */
export class RealtimeSocketUnavailableError extends Error {
	constructor(
		message: string,
		readonly code?: number
	) {
		super(message);
		this.name = 'RealtimeSocketUnavailableError';
	}
}

interface IOperation {
	readonly payload: { query: string; variables?: Record<string, unknown>; operationName?: string };
	readonly subscriber: Subscriber<unknown>;
	connection: GraphqlWsConnection | null;
	stop?: () => void;
}

/**
 * The tab's one socket to the platform's GraphQL subscriptions, shared by every feature that streams (the
 * collaboration events, a live Docs page).
 *
 * The socket opens with the first subscription and closes a while after the last one ended. A socket that drops
 * reconnects with jittered exponential backoff and starts every open subscription again, so a subscriber sees the
 * stream resume (a live Docs session answers a new `sync` frame). A subscription the server completes or fails
 * completes or fails its observable. The server refusing the credential (or no URL, no credential) stops the socket
 * and fails every open subscription with {@link RealtimeSocketUnavailableError}, which is a feature's cue to fall back
 * to what it did without a socket.
 */
export class RealtimeSocket {
	readonly status$ = new BehaviorSubject<RealtimeSocketStatus>('idle');

	private connection: GraphqlWsConnection | null = null;
	private readonly operations = new Set<IOperation>();
	private attempts = 0;
	private reconnectTimer: unknown = null;
	private idleTimer: unknown = null;
	/** The `connection_init` payload of the current socket, as JSON. */
	private connectedParams: string | null = null;
	private readonly setTimer: (fn: () => void, ms: number) => unknown;
	private readonly clearTimer: (handle: unknown) => void;

	constructor(private readonly options: RealtimeSocketOptions) {
		this.setTimer = options.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
		this.clearTimer = options.clearTimeout ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
	}

	/**
	 * Streams one GraphQL subscription.
	 *
	 * @param query The subscription document.
	 * @param variables Its variables.
	 * @returns The `data` of each result.
	 */
	subscribe<T>(query: string, variables?: Record<string, unknown>): Observable<T> {
		return new Observable<T>((subscriber) => {
			const operation: IOperation = {
				payload: { query, variables },
				subscriber: subscriber as Subscriber<unknown>,
				connection: null
			};
			this.operations.add(operation);
			this.clearIdle();
			// A socket opened for another user or organization is not this subscription's.
			this.refresh();
			if (this.connection?.isReady) {
				this.start(operation, this.connection);
			} else {
				this.connect();
			}
			return () => {
				this.operations.delete(operation);
				operation.stop?.();
				operation.stop = undefined;
				if (this.operations.size === 0 && this.connection) {
					this.scheduleIdleClose();
				}
			};
		});
	}

	/** Closes the socket and fails every open subscription (signing out). */
	stop(): void {
		this.stopWith(new RealtimeSocketUnavailableError('The socket was stopped.'));
	}

	/**
	 * Replaces the socket when the credential or the scope changed since it opened (another user signed in, another
	 * organization was selected): the server reads them once, from `connection_init`, so a socket opened for the
	 * previous ones would keep streaming their events. Every open subscription starts again on the new socket.
	 */
	refresh(): void {
		const params = this.options.connectionParams();
		// Signed out: fail what is open now (also while a reconnect waits in its backoff, with no socket).
		if (!params && (this.connection || this.reconnectTimer !== null || this.operations.size > 0)) {
			this.stopWith(new RealtimeSocketUnavailableError('Not signed in.'));
			return;
		}
		if (!this.connection || !params) {
			return;
		}
		if (JSON.stringify(params) === this.connectedParams) {
			return;
		}
		const previous = this.connection;
		this.connection = null;
		for (const operation of this.operations) {
			operation.connection = null;
			operation.stop = undefined;
		}
		// Its close is ignored (it is no longer the socket), and so are the completions it reports.
		previous.close(1000, 'credentials changed');
		this.connect();
	}

	private connect(): void {
		if (this.connection || this.reconnectTimer !== null) {
			return;
		}
		const url = this.options.url();
		const params = this.options.connectionParams();
		if (!url || !params) {
			this.stopWith(
				new RealtimeSocketUnavailableError(
					url ? 'Not signed in.' : 'This deployment has no subscription socket.'
				)
			);
			return;
		}
		this.status$.next(this.attempts > 0 ? 'reconnecting' : 'connecting');
		// What this socket presents, once: `refresh` compares the current credential and scope with it.
		this.connectedParams = JSON.stringify(params);
		const connection: GraphqlWsConnection = new GraphqlWsConnection({
			url,
			connectionParams: () => params,
			createSocket: this.options.createSocket,
			pingIntervalMs: this.options.pingIntervalMs,
			ackTimeoutMs: this.options.ackTimeoutMs,
			setTimeout: this.setTimer,
			clearTimeout: this.clearTimer,
			onAck: () => this.onAck(connection),
			onClose: (code, reason) => this.onClose(connection, code, reason)
		});
		this.connection = connection;
	}

	private onAck(connection: GraphqlWsConnection): void {
		if (this.connection !== connection) {
			return;
		}
		this.attempts = 0;
		this.status$.next('connected');
		for (const operation of Array.from(this.operations)) {
			this.start(operation, connection);
		}
		if (this.operations.size === 0) {
			this.scheduleIdleClose();
		}
	}

	private start(operation: IOperation, connection: GraphqlWsConnection): void {
		operation.stop?.();
		operation.connection = connection;
		operation.stop = connection.subscribe(operation.payload, {
			next: (data) => operation.subscriber.next(data),
			error: (errors) => {
				this.operations.delete(operation);
				operation.subscriber.error(errors);
			},
			complete: () => {
				// The connection completes every subscription when the socket goes; only a subscription the server
				// completed on a live socket is over. The socket's own close is seen first, in `onClose`.
				queueMicrotask(() => {
					if (this.connection === connection && connection.isReady && operation.connection === connection) {
						this.operations.delete(operation);
						operation.subscriber.complete();
					}
				});
			}
		});
	}

	private onClose(connection: GraphqlWsConnection, code: number, reason: string): void {
		if (this.connection !== connection) {
			return;
		}
		this.connection = null;
		for (const operation of this.operations) {
			operation.connection = null;
			operation.stop = undefined;
		}
		if (isFatalCloseCode(code)) {
			this.stopWith(new RealtimeSocketUnavailableError(`The server refused the socket: ${code} ${reason}`, code));
			return;
		}
		if (this.operations.size === 0) {
			this.status$.next('idle');
			return;
		}
		const { minMs, maxMs } = this.options.backoff ?? { minMs: 1000, maxMs: 30_000 };
		const exponent = Math.min(this.attempts, 10);
		const delay = Math.min(maxMs, minMs * 2 ** exponent) * (0.5 + (this.options.random ?? Math.random)() / 2);
		this.attempts += 1;
		this.status$.next('reconnecting');
		this.reconnectTimer = this.setTimer(() => {
			this.reconnectTimer = null;
			if (this.operations.size > 0) {
				this.connect();
			}
		}, delay);
	}

	private stopWith(error: RealtimeSocketUnavailableError): void {
		if (this.reconnectTimer !== null) {
			this.clearTimer(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		this.clearIdle();
		const connection = this.connection;
		this.connection = null;
		const operations = Array.from(this.operations);
		this.operations.clear();
		connection?.close(1000, 'stopped');
		this.attempts = 0;
		this.status$.next('stopped');
		for (const operation of operations) {
			operation.subscriber.error(error);
		}
	}

	private scheduleIdleClose(): void {
		this.clearIdle();
		this.idleTimer = this.setTimer(() => {
			this.idleTimer = null;
			if (this.operations.size === 0 && this.connection) {
				const connection = this.connection;
				this.connection = null;
				connection.close(1000, 'idle');
				this.status$.next('idle');
			}
		}, this.options.idleCloseMs ?? 30_000);
	}

	private clearIdle(): void {
		if (this.idleTimer !== null) {
			this.clearTimer(this.idleTimer);
			this.idleTimer = null;
		}
	}
}
