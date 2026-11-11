// cspell:ignore pmessage psubscribe PGPORT
import { Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Redis } from 'ioredis';
import { dbTypeOrmConnectionConfig } from '@gauzy/config';
import { resolveBullConnection } from '@gauzy/scheduler';
import { GraphqlPubSubEngine, GraphqlTopicBroker } from './graphql-pubsub.service';

/**
 * The part of an ioredis client the engine uses, so a suite can hand it a double.
 */
export interface RedisPubSubClient {
	publish(channel: string, message: string): Promise<unknown>;
	psubscribe(...patterns: string[]): Promise<unknown>;
	on(event: 'pmessage', listener: (pattern: string, channel: string, message: string) => void): unknown;
	on(event: 'error', listener: (error: Error) => void): unknown;
	/** The connection is up (again); ioredis re-subscribes on its own right before it says so. */
	on(event: 'ready', listener: () => void): unknown;
	/** The connection went away; nothing published meanwhile reaches this client. */
	on(event: 'close' | 'end', listener: () => void): unknown;
	quit(): Promise<unknown>;
}

/** What the engine is built from. */
export interface RedisGraphqlPubSubEngineOptions {
	/** The connection that publishes. */
	publisher: RedisPubSubClient;
	/** A second connection: a Redis connection in subscriber mode can run no other command. */
	subscriber: RedisPubSubClient;
	/** Put in front of every topic, so two installations sharing one Redis never hear each other. */
	channelPrefix: string;
}

/** The key a `Date` travels under, so a subscriber reads back a `Date` and not a string. */
const DATE_KEY = '$gauzyDate';

/**
 * Encodes a payload for the wire, keeping `Date` values as dates.
 *
 * @param payload The payload.
 * @returns The JSON text.
 */
export function encodePubSubPayload(payload: unknown): string {
	return JSON.stringify(payload, function (this: Record<string, unknown>, key: string, value: unknown) {
		// `JSON.stringify` has already called `toJSON` on `value`; the holder still has the original.
		const original = this[key];
		return original instanceof Date ? { [DATE_KEY]: original.toISOString() } : value;
	});
}

/**
 * Decodes a payload from the wire.
 *
 * @param message The JSON text.
 * @returns The payload, with its dates restored.
 */
export function decodePubSubPayload(message: string): unknown {
	return JSON.parse(message, (_key, value) => {
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			const keys = Object.keys(value);
			if (keys.length === 1 && keys[0] === DATE_KEY && typeof value[DATE_KEY] === 'string') {
				return new Date(value[DATE_KEY]);
			}
		}
		return value;
	});
}

/**
 * The fan-out across processes, over Redis pub/sub.
 *
 * **Why it is needed.** The dispatch pass runs in whichever process takes it — a queue worker host, or
 * one API replica among several — and a subscriber's socket is held by one API process. The in-process
 * broker only reaches the sockets of the process that publishes, so with more than one process an
 * event reached a socket only when the two happened to be the same.
 *
 * **How.** Every publish goes to Redis on `<prefix><topic>`; every process listens to `<prefix>*` and
 * hands what arrives to its own in-process broker, which serves its own sockets exactly as before. The
 * topic (`<eventName>:<tenantId>`) and every check around it are unchanged. While this process does not
 * hear Redis — before the subscription is acknowledged at boot, and from the moment its subscriber
 * connection drops until it is back — a publish also goes to this process's broker directly, so its own
 * sockets never miss what it publishes.
 *
 * **When Redis is unreachable** a publish falls back to this process's own broker, so a single process
 * keeps delivering, and the failure is logged once per outage. Subscribers miss nothing they can't
 * get back: a client catches up from the outbox after a gap.
 */
export class RedisGraphqlPubSubEngine implements GraphqlPubSubEngine {
	private readonly logger = new Logger(RedisGraphqlPubSubEngine.name);
	private readonly local = new GraphqlTopicBroker();
	private publishFailing = false;
	/** The subscription was acknowledged once; ioredis keeps it across reconnects. */
	private started = false;
	/** This process hears Redis now: subscribed, and the subscriber connection is up. */
	private listening = false;
	private closed = false;

	/**
	 * @param options The two connections and the channel prefix; the engine listens to the connections' events at
	 * once and subscribes when {@link start} is called.
	 */
	constructor(private readonly options: RedisGraphqlPubSubEngineOptions) {
		this.options.subscriber.on('pmessage', (_pattern, channel, message) => this.receive(channel, message));
		this.options.subscriber.on('error', (error) => this.logger.warn(`Redis subscriber: ${error.message}`));
		this.options.subscriber.on('close', () => (this.listening = false));
		this.options.subscriber.on('end', () => (this.listening = false));
		this.options.subscriber.on('ready', () => (this.listening = this.started));
		this.options.publisher.on('error', (error) => this.logger.debug(`Redis publisher: ${error.message}`));
	}

	/**
	 * Whether events reach sockets across every process, both ways: only while this process hears Redis (the
	 * subscription is acknowledged and the subscriber connection is up), not while publishing to Redis fails (a
	 * publish then reaches this process's sockets only), and not once the engine is closed. Before the
	 * subscription is acknowledged — the factory returns the engine at once — it is not shared yet.
	 */
	get shared(): boolean {
		return !this.closed && !this.publishFailing && this.listening;
	}

	/**
	 * Starts listening. Resolves once Redis acknowledged the subscription.
	 */
	async start(): Promise<void> {
		await this.options.subscriber.psubscribe(`${this.options.channelPrefix}*`);
		this.started = true;
		this.listening = true;
	}

	/**
	 * Publishes one payload to every process through Redis, and to this process's sockets directly while this
	 * process does not hear Redis or Redis refuses the publish.
	 *
	 * @param topic The topic, `<eventName>:<tenantId>`.
	 * @param payload The envelope.
	 */
	async publish(topic: string, payload: unknown): Promise<void> {
		if (this.closed) {
			return;
		}

		try {
			await this.options.publisher.publish(`${this.options.channelPrefix}${topic}`, encodePubSubPayload(payload));
			if (!this.listening) {
				// This process does not hear Redis now (booting, or its subscriber connection dropped): its
				// own sockets are served directly. Other processes still get the event through Redis.
				this.local.publish(topic, payload);
			}
			if (this.publishFailing) {
				this.publishFailing = false;
				this.logger.log('Publishing subscription events through Redis again.');
			}
		} catch (error) {
			if (!this.publishFailing) {
				this.publishFailing = true;
				this.logger.warn(
					`Could not publish a subscription event to Redis (${
						error instanceof Error ? error.message : String(error)
					}); delivering to this process's subscribers only until it is back.`
				);
			}
			this.local.publish(topic, payload);
		}
	}

	/**
	 * Opens a stream of one topic, served by this process's broker (which Redis messages feed).
	 *
	 * @param topic The topic.
	 * @returns The iterator.
	 */
	asyncIterableIterator<T>(topic: string): AsyncIterableIterator<T> {
		return this.local.asyncIterableIterator<T>(topic);
	}

	/** How many streams this process has open, over every topic. */
	get openStreams(): number {
		return this.local.topics().reduce((total, topic) => total + this.local.subscriberCount(topic), 0);
	}

	/**
	 * Ends every open stream and closes both connections, once.
	 */
	close(): void {
		if (this.closed) {
			return;
		}
		this.closed = true;
		this.local.close();
		void this.options.subscriber.quit().catch(() => undefined);
		void this.options.publisher.quit().catch(() => undefined);
	}

	/**
	 * Hands a message heard on Redis to this process's broker, under the topic the channel names.
	 *
	 * @param channel The Redis channel, `<prefix><topic>`.
	 * @param message The encoded payload.
	 */
	private receive(channel: string, message: string): void {
		if (this.closed || !channel.startsWith(this.options.channelPrefix)) {
			return;
		}

		let payload: unknown;
		try {
			payload = decodePubSubPayload(message);
		} catch (error) {
			this.logger.warn(`Dropped an unreadable subscription event on ${channel}`);
			return;
		}

		this.local.publish(channel.slice(this.options.channelPrefix.length), payload);
	}
}

/**
 * Whether subscription events travel through Redis: when Redis is on (`REDIS_ENABLED=true`) unless
 * `GRAPHQL_PUBSUB_REDIS` is exactly `false`.
 */
export function isRedisGraphqlPubSubEnabled(): boolean {
	return process.env['REDIS_ENABLED'] === 'true' && process.env['GRAPHQL_PUBSUB_REDIS'] !== 'false';
}

/**
 * The channel prefix of this installation.
 *
 * `GRAPHQL_PUBSUB_CHANNEL_PREFIX` when set. Otherwise derived from what makes an installation itself — the database
 * it connects to and its public API address — because Redis pub/sub ignores the database index: two environments
 * sharing one Redis would otherwise hear each other's events (and a stage restored from a production copy has the
 * same tenant ids). The database part is the platform's resolved connection settings, not the raw environment, so
 * replicas that spell the same database differently (`DB_PORT` unset, or set to the default) share their channels.
 *
 * @param connection The resolved database connection settings.
 * @param apiBaseUrl The public API address.
 */
export function graphqlPubSubChannelPrefix(
	connection: Readonly<Record<string, unknown>> = dbTypeOrmConnectionConfig as unknown as Record<string, unknown>,
	apiBaseUrl: string | undefined = process.env['API_BASE_URL']
): string {
	const explicit = process.env['GRAPHQL_PUBSUB_CHANNEL_PREFIX']?.trim();
	if (explicit) {
		return explicit.endsWith(':') ? explicit : `${explicit}:`;
	}

	const type = String(connection?.['type'] ?? '');
	const identity = [
		`type=${type}`,
		`host=${String(connection?.['host'] ?? '').toLowerCase()}`,
		`port=${effectivePort(type, connection?.['port'])}`,
		`database=${String(connection?.['database'] ?? '')}`,
		`api=${String(apiBaseUrl ?? '').replace(/\/+$/, '')}`
	].join('|');
	const digest = createHash('sha256').update(identity).digest('hex').slice(0, 12);

	return `gauzy:graphql:${digest}:`;
}

/**
 * The port a driver actually connects to: the configured one, or — for an unset, zero or invalid port, which every
 * driver reads as "my default" — that default (`PGPORT` or 5432 for PostgreSQL, 3306 for MySQL).
 *
 * @param type The database type.
 * @param configured The configured port.
 */
function effectivePort(type: string, configured: unknown): number | '' {
	const port = Number(configured);
	if (Number.isInteger(port) && port > 0) {
		return port;
	}
	if (type === 'postgres') {
		const fallback = Number(process.env['PGPORT']);
		return Number.isInteger(fallback) && fallback > 0 ? fallback : 5432;
	}
	if (type === 'mysql') {
		return 3306;
	}
	return '';
}

/**
 * Builds the Redis engine from the environment, or nothing when it is off.
 *
 * The connection is the queue's (`REDIS_URL`, or `REDIS_HOST` / `REDIS_PORT` / `REDIS_USER` /
 * `REDIS_PASSWORD` / `REDIS_TLS`). The publisher fails fast while Redis is down (no offline queue), so a
 * publish never waits on a reconnect and falls back to this process instead; the subscriber reconnects
 * and re-subscribes on its own.
 *
 * @returns The started engine, or null when it is off (the in-process broker is used).
 */
export function createGraphqlPubSubEngineFromEnv(): GraphqlPubSubEngine | null {
	if (!isRedisGraphqlPubSubEnabled()) {
		return null;
	}

	const logger = new Logger(RedisGraphqlPubSubEngine.name);

	try {
		const connection = resolveBullConnection() as Record<string, unknown>;

		const publisher = new Redis({
			...connection,
			lazyConnect: false,
			enableOfflineQueue: false,
			maxRetriesPerRequest: 1,
			// A Redis that keeps the connection open and stops answering would otherwise hold the publish,
			// and the dispatch pass behind it, forever; a timeout reaches the fallback instead.
			commandTimeout: 2_000,
			connectionName: 'gauzy-graphql-publish'
		} as any) as unknown as RedisPubSubClient;
		const subscriber = new Redis({
			...connection,
			lazyConnect: false,
			maxRetriesPerRequest: null,
			connectionName: 'gauzy-graphql-subscribe'
		} as any) as unknown as RedisPubSubClient;

		const engine = new RedisGraphqlPubSubEngine({
			publisher,
			subscriber,
			channelPrefix: graphqlPubSubChannelPrefix()
		});

		// Do not hold the boot on Redis: the subscription is acknowledged when Redis answers, and until
		// then a publish also reaches this process's own sockets directly.
		void engine
			.start()
			.then(() => logger.log('Subscription events travel through Redis between every API process.'))
			.catch((error) =>
				logger.warn(`Could not subscribe to Redis for subscription events: ${error?.message ?? error}`)
			);

		return engine;
	} catch (error) {
		logger.warn(
			`Redis pub/sub for subscriptions is unavailable (${
				error instanceof Error ? error.message : String(error)
			}); subscriptions reach this process's sockets only.`
		);
		return null;
	}
}
