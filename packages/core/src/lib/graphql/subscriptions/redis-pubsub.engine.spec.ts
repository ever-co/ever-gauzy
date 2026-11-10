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
		process.env['DB_NAME'] = 'gauzy';
		process.env['API_BASE_URL'] = 'https://api.stage.example';
		const stage = graphqlPubSubChannelPrefix();
		process.env['API_BASE_URL'] = 'https://api.example';
		const prod = graphqlPubSubChannelPrefix();

		expect(stage).toMatch(/^gauzy:graphql:[0-9a-f]{12}:$/);
		expect(stage).not.toBe(prod);

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
