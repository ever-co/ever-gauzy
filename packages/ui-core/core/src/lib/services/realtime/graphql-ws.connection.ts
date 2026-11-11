/**
 * A minimal client of the `graphql-transport-ws` protocol over the browser's own `WebSocket`: `connection_init` /
 * `connection_ack`, `subscribe` / `next` / `error` / `complete`, `ping` / `pong`. One socket, one `connection_init`,
 * any number of subscriptions. Small on purpose and free of Angular, so it is tested with a stand-in socket.
 */

export const GRAPHQL_TRANSPORT_WS_PROTOCOL = 'graphql-transport-ws';

/** The members of a WebSocket this client uses; the browser's `WebSocket` satisfies it. */
export interface SocketLike {
	readyState: number;
	send(data: string): void;
	close(code?: number, reason?: string): void;
	onopen: ((event: unknown) => void) | null;
	onmessage: ((event: { data: unknown }) => void) | null;
	onclose: ((event: { code: number; reason: string }) => void) | null;
	onerror: ((event: unknown) => void) | null;
}

export type SocketFactory = (url: string, protocol: string) => SocketLike;

/** The default factory: the global `WebSocket`. */
export const defaultSocketFactory: SocketFactory = (url, protocol) =>
	new (globalThis as unknown as { WebSocket: new (url: string, protocols: string) => SocketLike }).WebSocket(
		url,
		protocol
	);

interface ProtocolMessage {
	type: string;
	id?: string;
	payload?: unknown;
}

/** What a subscriber receives. */
export interface SubscriptionSink<T = unknown> {
	next(data: T): void;
	error(errors: unknown): void;
	complete(): void;
}

export interface GraphqlWsOptions {
	url: string;
	/** The `connection_init` payload: the credential and the scope, as the platform reads them. */
	connectionParams: () => Record<string, unknown>;
	createSocket?: SocketFactory;
	/** A ping is sent after this long without a message; three silent intervals close the socket as dead. */
	pingIntervalMs?: number;
	/** How long the server has to acknowledge the connection; past it the socket closes with 4408 (retryable). */
	ackTimeoutMs?: number;
	/** Called once the server acknowledged the connection. */
	onAck?: () => void;
	/** Called once the socket closed, for whatever reason, with the close code. */
	onClose?: (code: number, reason: string) => void;
	setTimeout?: (fn: () => void, ms: number) => unknown;
	clearTimeout?: (handle: unknown) => void;
}

/**
 * Close codes after which reconnecting is pointless: the server refused the credential or the request, not the
 * moment. A new credential (sign-in, token refresh) starts again.
 */
export function isFatalCloseCode(code: number): boolean {
	return code === 4400 || code === 4401 || code === 4403 || code === 4429 || code === 1002 || code === 1003;
}

/** The codes a browser's `WebSocket.close()` accepts: 1000, and 3000–4999. */
export function isSendableCloseCode(code: number): boolean {
	return code === 1000 || (code >= 3000 && code <= 4999);
}

/**
 * The WebSocket URL of the platform's GraphQL endpoint, from an explicit URL or derived from the API's base URL
 * (with or without its `/api` suffix): `https://api.example.com/api` → `wss://api.example.com/graphql`. An empty API
 * base URL (the app served by the API's own origin) takes the page's origin.
 *
 * @param explicit An explicit socket URL, when the deployment sets one.
 * @param apiBaseUrl The API base URL the app calls.
 * @param pageOrigin The page's origin, for an empty API base URL.
 * @returns The URL, or `null` when none can be made.
 */
export function socketUrlFrom(
	explicit: string | null | undefined,
	apiBaseUrl: string | null | undefined,
	pageOrigin?: string | null
): string | null {
	const direct = String(explicit ?? '').trim();
	if (direct) {
		return direct.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
	}
	const api = String(apiBaseUrl ?? '').trim() || String(pageOrigin ?? '').trim();
	if (!api) {
		return null;
	}
	const origin = api.replace(/\/+$/, '').replace(/\/api$/i, '');
	if (!/^(https?|wss?):\/\//i.test(origin)) {
		return null;
	}
	return origin.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:') + '/graphql';
}

/**
 * One socket. Opens on construction; {@link GraphqlWsConnection.ready} resolves on `connection_ack` and rejects when
 * the socket closes first.
 */
export class GraphqlWsConnection {
	readonly ready: Promise<void>;
	private socket: SocketLike | null = null;
	private acknowledged = false;
	private closed = false;
	private nextId = 1;
	private readonly sinks = new Map<string, SubscriptionSink>();
	private readonly setTimer: (fn: () => void, ms: number) => unknown;
	private readonly clearTimer: (handle: unknown) => void;
	private readonly pingIntervalMs: number;
	private readonly ackTimeoutMs: number;
	private pingTimer: unknown = null;
	private ackTimer: unknown = null;
	private silentIntervals = 0;
	private settleReady: { resolve: () => void; reject: (error: Error) => void } | null = null;

	constructor(private readonly options: GraphqlWsOptions) {
		this.setTimer = options.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
		this.clearTimer = options.clearTimeout ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
		this.pingIntervalMs = options.pingIntervalMs ?? 25_000;
		this.ackTimeoutMs = options.ackTimeoutMs ?? 10_000;
		this.ready = new Promise<void>((resolve, reject) => {
			this.settleReady = { resolve, reject };
		});
		// A rejected `ready` nobody awaits must not surface as an unhandled rejection.
		this.ready.catch(() => undefined);
		this.open();
	}

	/** Whether the server acknowledged the connection and the socket is still open. */
	get isReady(): boolean {
		return this.acknowledged && !this.closed;
	}

	/**
	 * Starts one subscription.
	 *
	 * @param payload The operation.
	 * @param sink Where its results go.
	 * @returns The function that stops it (`complete` is sent while the socket is open).
	 */
	subscribe<T = unknown>(
		payload: { query: string; variables?: Record<string, unknown>; operationName?: string },
		sink: SubscriptionSink<T>
	): () => void {
		if (!this.isReady) {
			throw new Error('The connection is not acknowledged.');
		}
		const id = String(this.nextId++);
		this.sinks.set(id, sink as SubscriptionSink);
		this.send({ id, type: 'subscribe', payload });
		return () => {
			if (!this.sinks.delete(id)) {
				return;
			}
			if (!this.closed) {
				this.send({ id, type: 'complete' });
			}
		};
	}

	/** Closes the socket; every subscription completes. */
	close(code = 1000, reason = 'client closed'): void {
		if (this.closed) {
			return;
		}
		this.closed = true;
		this.stopPinging();
		this.stopAckTimer();
		const socket = this.socket;
		this.socket = null;
		if (socket) {
			socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
			try {
				socket.close(isSendableCloseCode(code) ? code : 1000, reason);
			} catch {
				// Already closed.
			}
		}
		this.settleReady?.reject(new Error(`closed: ${code} ${reason}`));
		this.settleReady = null;
		this.completeAll();
		this.options.onClose?.(code, reason);
	}

	private open(): void {
		const factory = this.options.createSocket ?? defaultSocketFactory;
		let socket: SocketLike;
		try {
			socket = factory(this.options.url, GRAPHQL_TRANSPORT_WS_PROTOCOL);
		} catch (error) {
			this.closed = true;
			this.settleReady?.reject(error instanceof Error ? error : new Error(String(error)));
			this.settleReady = null;
			// After the constructor returned, so the owner has stored the connection and takes its reconnect path.
			void Promise.resolve().then(() => this.options.onClose?.(1006, 'socket could not be created'));
			return;
		}
		this.socket = socket;
		if (this.ackTimeoutMs > 0) {
			this.ackTimer = this.setTimer(() => {
				this.ackTimer = null;
				if (!this.acknowledged) {
					this.close(4408, 'connection acknowledgement timeout');
				}
			}, this.ackTimeoutMs);
		}
		socket.onopen = () => {
			this.send({ type: 'connection_init', payload: this.options.connectionParams() });
			this.schedulePing();
		};
		socket.onmessage = (event) => this.receive(event.data);
		socket.onerror = () => {
			// The close event that follows carries the code.
		};
		socket.onclose = (event) => this.onSocketClosed(event.code, event.reason);
	}

	private onSocketClosed(code: number, reason: string): void {
		if (this.closed) {
			return;
		}
		this.closed = true;
		this.stopPinging();
		this.stopAckTimer();
		this.socket = null;
		this.settleReady?.reject(new Error(`closed before acknowledgement: ${code} ${reason}`));
		this.settleReady = null;
		this.completeAll();
		this.options.onClose?.(code, reason);
	}

	private completeAll(): void {
		const sinks = Array.from(this.sinks.values());
		this.sinks.clear();
		for (const sink of sinks) {
			sink.complete();
		}
	}

	private receive(raw: unknown): void {
		this.silentIntervals = 0;
		let message: ProtocolMessage;
		try {
			message = JSON.parse(String(raw)) as ProtocolMessage;
		} catch {
			this.close(4400, 'invalid message');
			return;
		}
		if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
			this.close(4400, 'invalid message');
			return;
		}
		switch (message.type) {
			case 'connection_ack':
				this.acknowledged = true;
				this.stopAckTimer();
				this.settleReady?.resolve();
				this.settleReady = null;
				this.options.onAck?.();
				return;
			case 'ping':
				this.send({ type: 'pong', ...(message.payload !== undefined ? { payload: message.payload } : {}) });
				return;
			case 'pong':
				return;
			case 'next': {
				const sink = message.id ? this.sinks.get(message.id) : undefined;
				const payload = (message.payload ?? {}) as { data?: unknown; errors?: unknown };
				if (!sink) {
					return;
				}
				if (payload.errors) {
					sink.error(payload.errors);
				} else {
					sink.next(payload.data);
				}
				return;
			}
			case 'error': {
				const sink = message.id ? this.sinks.get(message.id) : undefined;
				if (!sink || !message.id) {
					return;
				}
				this.sinks.delete(message.id);
				sink.error(message.payload);
				return;
			}
			case 'complete': {
				const sink = message.id ? this.sinks.get(message.id) : undefined;
				if (!sink || !message.id) {
					return;
				}
				this.sinks.delete(message.id);
				sink.complete();
				return;
			}
			default:
				return;
		}
	}

	private send(message: ProtocolMessage): void {
		const socket = this.socket;
		if (!socket || this.closed) {
			return;
		}
		try {
			socket.send(JSON.stringify(message));
		} catch {
			this.close(1006, 'send failed');
		}
	}

	private schedulePing(): void {
		this.stopPinging();
		if (this.pingIntervalMs <= 0) {
			return;
		}
		this.pingTimer = this.setTimer(() => {
			this.pingTimer = null;
			if (this.closed) {
				return;
			}
			this.silentIntervals += 1;
			if (this.silentIntervals >= 3) {
				// Our pings went unanswered: the socket is dead, whatever the browser thinks.
				this.close(4499, 'no answer');
				return;
			}
			this.send({ type: 'ping' });
			this.schedulePing();
		}, this.pingIntervalMs);
	}

	private stopAckTimer(): void {
		if (this.ackTimer !== null) {
			this.clearTimer(this.ackTimer);
			this.ackTimer = null;
		}
	}

	private stopPinging(): void {
		if (this.pingTimer !== null) {
			this.clearTimer(this.pingTimer);
			this.pingTimer = null;
		}
	}
}
