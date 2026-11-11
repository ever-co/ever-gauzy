// cspell:ignore pmessage psubscribe PGPORT
import { Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import {
	createGraphqlPubSubEngineFromEnv,
	decodePubSubPayload,
	encodePubSubPayload,
	graphqlPubSubChannelPrefix,
	isRedisGraphqlPubSubEnabled,
	RedisGraphqlPubSubEngine,
	RedisPubSubClient
} from './redis-pubsub.engine';
import { GraphqlPubSub, subscriptionTopic } from './graphql-pubsub.service';

/**
 * The dispatch pass runs in whichever process takes it, and a socket is held by one API process. With the
 * in-process broker an event reached a socket only when those were the same process: on a deployment with a
 * worker or more than one API replica, a chat message was "published" and nobody saw it. Over Redis every API
 * process hears every publish and serves its own sockets.
 */

/** One Redis server: channels and pattern subscribers, as far as pub/sub goes. */
class FakeRedisServer {
	readonly clients = new Set<FakeRedisClient>();
	down = false;

	publish(channel: string, message: string): number {
		let receivers = 0;
		for (const client of this.clients) {
			for (const pattern of client.patterns) {
				if (pattern.endsWith('*') ? channel.startsWith(pattern.slice(0, -1)) : channel === pattern) {
					receivers += 1;
					// Redis delivers asynchronously.
					setImmediate(() => client.emit('pmessage', pattern, channel, message));
				}
			}
		}
		return receivers;
	}
}

class FakeRedisClient extends EventEmitter implements RedisPubSubClient {
	readonly patterns = new Set<string>();
	quitCalled = false;
	acknowledge = true;

	constructor(private readonly server: FakeRedisServer) {
		super();
		server.clients.add(this);
	}

	async publish(channel: string, message: string): Promise<number> {
		if (this.server.down) {
			throw new Error("Stream isn't writeable and enableOfflineQueue options is false");
		}
		return this.server.publish(channel, message);
	}

	psubscribe(...patterns: string[]): Promise<number> {
		if (!this.acknowledge) {
			return new Promise(() => undefined);
		}
		patterns.forEach((pattern) => this.patterns.add(pattern));
		return Promise.resolve(this.patterns.size);
	}

	async quit(): Promise<'OK'> {
		this.quitCalled = true;
		this.server.clients.delete(this);
		return 'OK';
	}
}

function engineOn(server: FakeRedisServer, channelPrefix = 'gauzy:graphql:test:') {
	const publisher = new FakeRedisClient(server);
	const subscriber = new FakeRedisClient(server);
	const engine = new RedisGraphqlPubSubEngine({ publisher, subscriber, channelPrefix });
	return { engine, publisher, subscriber };
}

/** Reads the next value of a stream, or `undefined` when nothing arrives in a few event-loop turns. */
async function next<T>(stream: AsyncIterableIterator<T>): Promise<T | undefined> {
	const timeout = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 50));
	const value = stream.next().then((result) => (result.done ? undefined : result.value));
	return Promise.race([value, timeout]);
}

const TENANT = '00000000-0000-4000-8000-0000000000aa';
const topic = subscriptionTopic('chat_message.created', TENANT);
const envelope = () => ({
	eventId: 'e-1',
	eventName: 'chat_message.created',
	occurredAt: new Date('2026-11-10T20:00:00.000Z'),
	aggregate: { type: 'ChatMessage', id: 'm-1' },
	recipientUserIds: ['u-1', 'u-2'],
	tenantId: TENANT
});

beforeEach(() => {
	jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('RedisGraphqlPubSubEngine', () => {
	it('delivers an event published in one process to a socket held by another', async () => {
		const server = new FakeRedisServer();
		const worker = engineOn(server);
		const api = engineOn(server);
		await worker.engine.start();
		await api.engine.start();

		const socket = api.engine.asyncIterableIterator<ReturnType<typeof envelope>>(topic);
		await worker.engine.publish(topic, envelope());

		const received = await next(socket);
		expect(received).toEqual(envelope());
		// Dates come back as dates, as the in-process broker handed them over.
		expect(received?.occurredAt).toBeInstanceOf(Date);
	});

	it('delivers to the publishing process too, once — through Redis like everyone else', async () => {
		const server = new FakeRedisServer();
		const { engine } = engineOn(server);
		await engine.start();

		const socket = engine.asyncIterableIterator(topic);
		await engine.publish(topic, envelope());

		expect(await next(socket)).toEqual(envelope());
		expect(await next(socket)).toBeUndefined();
	});

	it('never hears another installation sharing the same Redis', async () => {
		const server = new FakeRedisServer();
		const stage = engineOn(server, 'gauzy:graphql:stage:');
		const prod = engineOn(server, 'gauzy:graphql:prod:');
		await stage.engine.start();
		await prod.engine.start();

		const prodSocket = prod.engine.asyncIterableIterator(topic);
		await stage.engine.publish(topic, envelope());

		expect(await next(prodSocket)).toBeUndefined();
	});

	it('keeps serving its own sockets while Redis is down, and says so once', async () => {
		const server = new FakeRedisServer();
		const { engine } = engineOn(server);
		await engine.start();
		const socket = engine.asyncIterableIterator(topic);

		server.down = true;
		await engine.publish(topic, envelope());
		await engine.publish(topic, { ...envelope(), eventId: 'e-2' });

		expect((await next(socket)) as { eventId: string }).toMatchObject({ eventId: 'e-1' });
		expect((await next(socket)) as { eventId: string }).toMatchObject({ eventId: 'e-2' });
		expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);
	});

	it('serves its own sockets directly until Redis acknowledged the subscription', async () => {
		const server = new FakeRedisServer();
		const { engine, subscriber } = engineOn(server);
		subscriber.acknowledge = false;
		void engine.start();

		const socket = engine.asyncIterableIterator(topic);
		await engine.publish(topic, envelope());

		expect(await next(socket)).toEqual(envelope());
	});

	it('serves its own sockets directly while its subscriber connection is down, and once only when it is back', async () => {
		const server = new FakeRedisServer();
		const { engine, subscriber } = engineOn(server);
		await engine.start();
		const socket = engine.asyncIterableIterator(topic);

		// The subscriber connection drops; publishing (another connection) still works.
		server.clients.delete(subscriber);
		subscriber.emit('close');
		// Other processes' events no longer reach this process's sockets: not shared.
		expect(engine.shared).toBe(false);
		await engine.publish(topic, envelope());
		expect(await next(socket)).toEqual(envelope());

		// Back: ioredis re-subscribed before saying it is ready. No second copy from the direct path.
		server.clients.add(subscriber);
		subscriber.emit('ready');
		expect(engine.shared).toBe(true);
		await engine.publish(topic, { ...envelope(), eventId: 'e-2' });
		expect((await next(socket)) as { eventId: string }).toMatchObject({ eventId: 'e-2' });
		expect(await next(socket)).toBeUndefined();
	});

	it('stops calling itself shared while publishing to Redis fails, so clients keep polling', async () => {
		const server = new FakeRedisServer();
		const { engine } = engineOn(server);
		await engine.start();
		expect(engine.shared).toBe(true);

		server.down = true;
		await engine.publish(topic, envelope());
		expect(engine.shared).toBe(false);

		server.down = false;
		await engine.publish(topic, envelope());
		expect(engine.shared).toBe(true);

		engine.close();
		expect(engine.shared).toBe(false);
	});

	it('ends every stream and closes both connections on shutdown', async () => {
		const server = new FakeRedisServer();
		const { engine, publisher, subscriber } = engineOn(server);
		await engine.start();
		const socket = engine.asyncIterableIterator(topic);

		engine.close();

		expect(await socket.next()).toEqual({ value: undefined, done: true });
		expect(publisher.quitCalled && subscriber.quitCalled).toBe(true);
	});

	it('counts the streams this process has open, for the status a diagnostic reads', async () => {
		const server = new FakeRedisServer();
		const { engine } = engineOn(server);
		const pubSub = new GraphqlPubSub(engine);
		engine.asyncIterableIterator(topic);
		engine.asyncIterableIterator(subscriptionTopic('inbox_item.created', TENANT));

		expect(pubSub.openStreams).toBe(2);
		// Not shared until Redis acknowledged the subscription: until then this process hears nobody else.
		expect(pubSub.sharedAcrossProcesses).toBe(false);
		await engine.start();
		expect(pubSub.sharedAcrossProcesses).toBe(true);
		// Control: the in-process broker reaches this process only.
		expect(new GraphqlPubSub().sharedAcrossProcesses).toBe(false);
	});
});

describe('the wire format', () => {
	it('keeps dates as dates, at any depth, and everything else as JSON', () => {
		const payload = {
			at: new Date('2026-01-02T03:04:05.006Z'),
			list: [{ when: new Date(0) }],
			n: 1,
			s: 'x',
			none: null
		};

		const decoded = decodePubSubPayload(encodePubSubPayload(payload)) as typeof payload;

		expect(decoded).toEqual(payload);
		expect(decoded.list[0].when).toBeInstanceOf(Date);
	});
});

describe('switching it on', () => {
	const NAMES = ['REDIS_ENABLED', 'GRAPHQL_PUBSUB_REDIS', 'GRAPHQL_PUBSUB_CHANNEL_PREFIX', 'API_BASE_URL', 'DB_NAME'];
	let saved: Record<string, string | undefined>;

	beforeEach(() => {
		saved = Object.fromEntries(NAMES.map((name) => [name, process.env[name]]));
	});

	afterEach(() => {
		for (const name of NAMES) {
			if (saved[name] === undefined) delete process.env[name];
			else process.env[name] = saved[name];
		}
	});

	it('is on with Redis, unless switched off', () => {
		process.env['REDIS_ENABLED'] = 'true';
		delete process.env['GRAPHQL_PUBSUB_REDIS'];
		expect(isRedisGraphqlPubSubEnabled()).toBe(true);

		process.env['GRAPHQL_PUBSUB_REDIS'] = 'false';
		expect(isRedisGraphqlPubSubEnabled()).toBe(false);

		delete process.env['GRAPHQL_PUBSUB_REDIS'];
		process.env['REDIS_ENABLED'] = 'false';
		expect(isRedisGraphqlPubSubEnabled()).toBe(false);
		// Off: no engine, and the service keeps its in-process broker.
		expect(createGraphqlPubSubEngineFromEnv()).toBeNull();
	});

	it('names its channels after the installation, so two environments on one Redis stay apart', () => {
		delete process.env['GRAPHQL_PUBSUB_CHANNEL_PREFIX'];
		const db = { type: 'postgres', host: 'db.internal', port: 5432, database: 'gauzy' };
		const stage = graphqlPubSubChannelPrefix(db, 'https://api.stage.example');
		const prod = graphqlPubSubChannelPrefix(db, 'https://api.example');

		expect(stage).toMatch(/^gauzy:graphql:[0-9a-f]{12}:$/);
		expect(stage).not.toBe(prod);
		expect(graphqlPubSubChannelPrefix({ ...db, database: 'gauzy_stage' }, 'https://api.example')).not.toBe(prod);
	});

	it('gives replicas of one installation the same channels, however they spell the same settings', () => {
		delete process.env['GRAPHQL_PUBSUB_CHANNEL_PREFIX'];
		const resolved = { type: 'postgres', host: 'db.internal', port: 5432, database: 'gauzy' };

		expect(graphqlPubSubChannelPrefix({ ...resolved, port: '5432' }, 'https://api.example/')).toBe(
			graphqlPubSubChannelPrefix(resolved, 'https://api.example')
		);
		expect(graphqlPubSubChannelPrefix({ ...resolved, host: 'DB.internal' }, 'https://api.example')).toBe(
			graphqlPubSubChannelPrefix(resolved, 'https://api.example')
		);
		// Port 0 (or none) is the driver's default port: the same database as an explicit 5432.
		const previous = process.env['PGPORT'];
		try {
			delete process.env['PGPORT'];
			expect(graphqlPubSubChannelPrefix({ ...resolved, port: 0 }, 'https://api.example')).toBe(
				graphqlPubSubChannelPrefix(resolved, 'https://api.example')
			);
			process.env['PGPORT'] = '6432';
			expect(graphqlPubSubChannelPrefix({ ...resolved, port: 0 }, 'https://api.example')).toBe(
				graphqlPubSubChannelPrefix({ ...resolved, port: 6432 }, 'https://api.example')
			);
		} finally {
			if (previous === undefined) delete process.env['PGPORT'];
			else process.env['PGPORT'] = previous;
		}
		// The default settings resolve to one value, so an unset DB_PORT and DB_PORT=5432 hash alike.
		expect(graphqlPubSubChannelPrefix()).toBe(graphqlPubSubChannelPrefix());

		process.env['GRAPHQL_PUBSUB_CHANNEL_PREFIX'] = 'teams-dev';
		expect(graphqlPubSubChannelPrefix()).toBe('teams-dev:');
	});
});

/**
 * Against a real Redis, when one is named: `GAUZY_TEST_REDIS_URL=redis://127.0.0.1:6379`. Skipped otherwise.
 */
const REAL_REDIS = process.env['GAUZY_TEST_REDIS_URL'];
(REAL_REDIS ? describe : describe.skip)('RedisGraphqlPubSubEngine against a real Redis', () => {
	it('carries an event from one process to another through ioredis', async () => {
		const { Redis } = await import('ioredis');
		const client = () =>
			new Redis(REAL_REDIS as string, { maxRetriesPerRequest: 1 }) as unknown as RedisPubSubClient;
		const prefix = `gauzy:graphql:spec-${Date.now()}:`;
		const a = new RedisGraphqlPubSubEngine({ publisher: client(), subscriber: client(), channelPrefix: prefix });
		const b = new RedisGraphqlPubSubEngine({ publisher: client(), subscriber: client(), channelPrefix: prefix });
		try {
			await a.start();
			await b.start();
			const socket = b.asyncIterableIterator<ReturnType<typeof envelope>>(topic);

			await a.publish(topic, envelope());

			const received = await Promise.race([
				socket.next().then((result) => result.value),
				new Promise((resolve) => setTimeout(() => resolve(undefined), 2_000))
			]);
			expect(received).toEqual(envelope());
		} finally {
			a.close();
			b.close();
		}
	});
});
