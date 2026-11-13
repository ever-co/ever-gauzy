import { GraphqlWsConnection, SocketLike, socketUrlFrom } from './graphql-ws.connection';
import { RealtimeSocket, RealtimeSocketUnavailableError } from './realtime-socket';

/** A stand-in socket the test drives: it records what the client sent and delivers what the "server" says. */
class FakeSocket implements SocketLike {
	static all: FakeSocket[] = [];
	readyState = 0;
	sent: Array<Record<string, any>> = [];
	onopen: ((event: unknown) => void) | null = null;
	onmessage: ((event: { data: unknown }) => void) | null = null;
	onclose: ((event: { code: number; reason: string }) => void) | null = null;
	onerror: ((event: unknown) => void) | null = null;
	closedWith: number | null = null;

	constructor(
		readonly url: string,
		readonly protocol: string
	) {
		FakeSocket.all.push(this);
	}

	send(data: string): void {
		this.sent.push(JSON.parse(data));
	}

	close(code = 1000): void {
		this.closedWith = code;
	}

	open(): void {
		this.readyState = 1;
		this.onopen?.({});
	}

	say(message: Record<string, unknown>): void {
		this.onmessage?.({ data: JSON.stringify(message) });
	}

	drop(code: number, reason = ''): void {
		this.onclose?.({ code, reason });
	}

	subscribed(): Array<Record<string, any>> {
		return this.sent.filter((message) => message.type === 'subscribe');
	}
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('socketUrlFrom', () => {
	it('derives the GraphQL socket from the API base URL', () => {
		expect(socketUrlFrom(null, 'https://api.example.com/api')).toBe('wss://api.example.com/graphql');
		expect(socketUrlFrom(undefined, 'http://localhost:3000/')).toBe('ws://localhost:3000/graphql');
		expect(socketUrlFrom('https://rt.example.com/graphql', 'https://api.example.com')).toBe(
			'wss://rt.example.com/graphql'
		);
		expect(socketUrlFrom(null, '', 'https://app.example.com')).toBe('wss://app.example.com/graphql');
		expect(socketUrlFrom(null, '/api')).toBeNull();
	});
});

describe('RealtimeSocket', () => {
	let timers: Array<{ fn: () => void; ms: number }>;

	beforeEach(() => {
		FakeSocket.all = [];
		timers = [];
	});

	function socket(params: Record<string, unknown> | null = { authorization: 'Bearer t', 'tenant-id': 'tenant-1' }) {
		return new RealtimeSocket({
			url: () => 'wss://api.example.com/graphql',
			connectionParams: () => params,
			createSocket: (url, protocol) => new FakeSocket(url, protocol),
			pingIntervalMs: 0,
			ackTimeoutMs: 0,
			random: () => 1,
			setTimeout: (fn, ms) => {
				const timer = { fn, ms };
				timers.push(timer);
				return timer;
			},
			clearTimeout: (handle) => {
				timers = timers.filter((timer) => timer !== handle);
			}
		});
	}

	it('opens one socket with the credential and subscribes once it is acknowledged', async () => {
		const client = socket();
		const frames: unknown[] = [];
		client.subscribe('subscription { a }', { x: 1 }).subscribe((frame) => frames.push(frame));
		client.subscribe('subscription { b }').subscribe();

		expect(FakeSocket.all).toHaveLength(1);
		const ws = FakeSocket.all[0];
		expect(ws.protocol).toBe('graphql-transport-ws');
		ws.open();
		expect(ws.sent[0]).toEqual({
			type: 'connection_init',
			payload: { authorization: 'Bearer t', 'tenant-id': 'tenant-1' }
		});
		expect(ws.subscribed()).toHaveLength(0);

		ws.say({ type: 'connection_ack' });
		expect(ws.subscribed().map((message) => message.payload)).toEqual([
			{ query: 'subscription { a }', variables: { x: 1 } },
			{ query: 'subscription { b }', variables: undefined }
		]);

		ws.say({ type: 'next', id: ws.subscribed()[0].id, payload: { data: { a: 1 } } });
		expect(frames).toEqual([{ a: 1 }]);
		expect(client.status$.value).toBe('connected');
	});

	it('reconnects after a drop and starts every open subscription again', async () => {
		const client = socket();
		const done = jest.fn();
		client.subscribe('subscription { a }').subscribe({ complete: done });
		FakeSocket.all[0].open();
		FakeSocket.all[0].say({ type: 'connection_ack' });

		FakeSocket.all[0].drop(1006);
		await flush();

		// Not completed: the subscriber sees the stream resume on the next socket.
		expect(done).not.toHaveBeenCalled();
		expect(client.status$.value).toBe('reconnecting');
		expect(timers).toHaveLength(1);
		timers.shift()!.fn();

		const next = FakeSocket.all[1];
		next.open();
		next.say({ type: 'connection_ack' });
		expect(next.subscribed()).toHaveLength(1);
	});

	it('completes a subscription the server completed, and fails one it refused', async () => {
		const client = socket();
		const completed = jest.fn();
		const failed = jest.fn();
		client.subscribe('subscription { a }').subscribe({ complete: completed });
		client.subscribe('subscription { b }').subscribe({ error: failed });
		const ws = FakeSocket.all[0];
		ws.open();
		ws.say({ type: 'connection_ack' });
		const [a, b] = ws.subscribed();

		ws.say({ type: 'complete', id: a.id });
		ws.say({ type: 'error', id: b.id, payload: [{ message: 'Forbidden' }] });
		await flush();

		expect(completed).toHaveBeenCalled();
		expect(failed).toHaveBeenCalledWith([{ message: 'Forbidden' }]);
	});

	it('stops on a refused credential, failing every subscription so the feature falls back', async () => {
		const client = socket();
		const failed = jest.fn();
		client.subscribe('subscription { a }').subscribe({ error: failed });
		FakeSocket.all[0].open();

		FakeSocket.all[0].drop(4403, 'Forbidden');

		expect(failed).toHaveBeenCalledWith(expect.any(RealtimeSocketUnavailableError));
		expect(client.status$.value).toBe('stopped');
		expect(timers).toHaveLength(0);
	});

	it('does not open a socket without a credential', () => {
		const client = socket(null);
		const failed = jest.fn();

		client.subscribe('subscription { a }').subscribe({ error: failed });

		expect(FakeSocket.all).toHaveLength(0);
		expect(failed).toHaveBeenCalledWith(expect.any(RealtimeSocketUnavailableError));
	});

	it('sends complete when a subscriber leaves, and closes the idle socket later', () => {
		const client = socket();
		const subscription = client.subscribe('subscription { a }').subscribe();
		const ws = FakeSocket.all[0];
		ws.open();
		ws.say({ type: 'connection_ack' });
		const [a] = ws.subscribed();

		subscription.unsubscribe();

		expect(ws.sent[ws.sent.length - 1]).toEqual({ id: a.id, type: 'complete' });
		expect(ws.closedWith).toBeNull();
		timers.shift()!.fn();
		expect(ws.closedWith).toBe(1000);
		expect(client.status$.value).toBe('idle');
	});

	it('replaces the socket when the user or organization changed, and starts its subscriptions again', async () => {
		let params: Record<string, unknown> = { authorization: 'Bearer t', 'organization-id': 'org-1' };
		const client = new RealtimeSocket({
			url: () => 'wss://api.example.com/graphql',
			connectionParams: () => params,
			createSocket: (url, protocol) => new FakeSocket(url, protocol),
			pingIntervalMs: 0,
			ackTimeoutMs: 0,
			setTimeout: (fn, ms) => {
				const timer = { fn, ms };
				timers.push(timer);
				return timer;
			},
			clearTimeout: (handle) => {
				timers = timers.filter((timer) => timer !== handle);
			}
		});
		const done = jest.fn();
		client.subscribe('subscription { a }').subscribe({ complete: done });
		FakeSocket.all[0].open();
		FakeSocket.all[0].say({ type: 'connection_ack' });

		client.refresh();
		expect(FakeSocket.all).toHaveLength(1);

		params = { authorization: 'Bearer t', 'organization-id': 'org-2' };
		client.refresh();
		await flush();

		expect(FakeSocket.all[0].closedWith).toBe(1000);
		expect(done).not.toHaveBeenCalled();
		const next = FakeSocket.all[1];
		next.open();
		expect(next.sent[0]).toEqual({ type: 'connection_init', payload: params });
		next.say({ type: 'connection_ack' });
		expect(next.subscribed()).toHaveLength(1);
	});

	it('fails the open subscriptions at once on sign-out, even while a reconnect waits', async () => {
		let params: Record<string, unknown> | null = { authorization: 'Bearer t' };
		const client = new RealtimeSocket({
			url: () => 'wss://api.example.com/graphql',
			connectionParams: () => params,
			createSocket: (url, protocol) => new FakeSocket(url, protocol),
			pingIntervalMs: 0,
			ackTimeoutMs: 0,
			random: () => 1,
			setTimeout: (fn, ms) => {
				const timer = { fn, ms };
				timers.push(timer);
				return timer;
			},
			clearTimeout: (handle) => {
				timers = timers.filter((timer) => timer !== handle);
			}
		});
		const failed = jest.fn();
		client.subscribe('subscription { a }').subscribe({ error: failed });
		FakeSocket.all[0].open();
		FakeSocket.all[0].say({ type: 'connection_ack' });
		FakeSocket.all[0].drop(1006);
		await flush();
		expect(timers).toHaveLength(1);

		params = null;
		client.refresh();

		expect(failed).toHaveBeenCalledWith(expect.any(RealtimeSocketUnavailableError));
		expect(timers).toHaveLength(0);
		expect(client.status$.value).toBe('stopped');
	});

	it('answers a ping with a pong', () => {
		const connection = new GraphqlWsConnection({
			url: 'wss://x/graphql',
			connectionParams: () => ({}),
			createSocket: (url, protocol) => new FakeSocket(url, protocol),
			pingIntervalMs: 0,
			ackTimeoutMs: 0
		});
		const ws = FakeSocket.all[0];
		ws.open();
		ws.say({ type: 'ping' });

		expect(ws.sent[ws.sent.length - 1]).toEqual({ type: 'pong' });
		connection.close();
	});
});
