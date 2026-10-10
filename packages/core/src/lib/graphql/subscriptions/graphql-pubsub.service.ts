import { Injectable, Inject, OnModuleDestroy, Optional } from '@nestjs/common';
import { SubscriptionLimits, DEFAULT_SUBSCRIPTION_LIMITS } from './subscription-limits';

/**
 * The fan-out a subscription is fed from.
 *
 * The platform already has event buses; this is not another one. It is the last hop: a bus produces
 * a fact, the outbox consumer or a bus bridge hands it here, and here it is published on a topic that
 * names the tenant as well as the event, so a subscriber is structurally incapable of receiving
 * another tenant's message. The topic spelling is `<eventName>:<tenantId>`.
 *
 * The in-process engine below is the default. A deployment that runs more than one replica and wants
 * a subscriber to see events produced by another replica supplies an engine of its own through
 * `GRAPHQL_PUBSUB_ENGINE`; the service, its topic naming and every check around it are unchanged,
 * which is what keeps the multi-replica story a deployment decision rather than a second code path.
 */

/**
 * The token an engine is provided under.
 */
export const GRAPHQL_PUBSUB_ENGINE = 'GRAPHQL_PUBSUB_ENGINE';

/**
 * What an engine has to do to be usable here.
 */
export interface GraphqlPubSubEngine {
	/**
	 * Publishes one payload on one topic.
	 *
	 * @param topic The topic.
	 * @param payload The payload.
	 */
	publish(topic: string, payload: unknown): void | Promise<void>;

	/**
	 * Opens a stream of the payloads published on one topic.
	 *
	 * @param topic The topic.
	 * @returns An iterator that ends when the topic is closed.
	 */
	asyncIterableIterator<T>(topic: string): AsyncIterableIterator<T>;

	/**
	 * Ends every open stream, for a shutdown.
	 */
	close?(): void;
}

/**
 * The topic one event belongs to.
 *
 * The tenant is part of the topic rather than a filter applied to it: a filter can be wrong, and a
 * topic cannot deliver what it was never given.
 *
 * @param eventName The event name, `<aggregate>.<action>`.
 * @param tenantId The tenant the fact belongs to.
 * @returns The topic.
 */
export function subscriptionTopic(eventName: string, tenantId: string): string {
	return `${eventName}:${tenantId}`;
}

/**
 * Reads a topic back into its parts.
 *
 * @param topic The topic.
 * @returns The event name and the tenant, or undefined when the topic is malformed.
 */
export function parseSubscriptionTopic(topic: string): { eventName: string; tenantId: string } | undefined {
	const separator = topic.lastIndexOf(':');
	if (separator <= 0 || separator === topic.length - 1) {
		return undefined;
	}

	return { eventName: topic.slice(0, separator), tenantId: topic.slice(separator + 1) };
}

/**
 * One subscriber's queue of payloads.
 */
interface TopicQueue {
	readonly values: unknown[];
	readonly waiting: Array<(result: IteratorResult<unknown>) => void>;
	done: boolean;
}

/**
 * The in-process engine.
 *
 * A topic is a queue per subscriber plus a set of waiting readers, which is all a single-process
 * fan-out needs. `close` ends every stream, which is what lets a `for await` loop around an iterator
 * finish when the API shuts down or when a subscription is closed.
 */
export class GraphqlTopicBroker implements GraphqlPubSubEngine {
	private readonly queues = new Map<string, Set<TopicQueue>>();

	/**
	 * Publishes a payload to every reader of a topic.
	 *
	 * @param topic The topic.
	 * @param payload The payload.
	 */
	publish(topic: string, payload: unknown): void {
		const subscribers = this.queues.get(topic);
		if (!subscribers) {
			// Nobody is listening. That is the normal case for most events, and it is not an error:
			// a subscription is a delivery optimisation over the read API, never a ledger.
			return;
		}

		for (const queue of Array.from(subscribers)) {
			if (queue.done) {
				continue;
			}

			const reader = queue.waiting.shift();
			if (reader) {
				reader({ value: payload, done: false });
				continue;
			}

			queue.values.push(payload);
		}
	}

	/**
	 * Opens a stream of one topic.
	 *
	 * @param topic The topic.
	 * @returns The iterator.
	 */
	asyncIterableIterator<T>(topic: string): AsyncIterableIterator<T> {
		const queue: TopicQueue = { values: [], waiting: [], done: false };
		const subscribers = this.queues.get(topic) ?? new Set<TopicQueue>();
		subscribers.add(queue);
		this.queues.set(topic, subscribers);

		const detach = (): void => {
			queue.done = true;
			const current = this.queues.get(topic);
			current?.delete(queue);
			if (current && current.size === 0) {
				this.queues.delete(topic);
			}
			for (const waiting of queue.waiting.splice(0)) {
				waiting({ value: undefined, done: true });
			}
		};

		const iterator: AsyncIterableIterator<T> = {
			next: () =>
				new Promise<IteratorResult<T>>((resolve) => {
					if (queue.values.length > 0) {
						resolve({ value: queue.values.shift() as T, done: false });
						return;
					}

					if (queue.done) {
						resolve({ value: undefined, done: true });
						return;
					}

					queue.waiting.push(resolve as (result: IteratorResult<unknown>) => void);
				}),
			return: () => {
				detach();
				return Promise.resolve({ value: undefined, done: true as const });
			},
			throw: (error?: unknown) => {
				detach();
				return Promise.reject(error);
			},
			[Symbol.asyncIterator]() {
				return this;
			}
		};

		return iterator;
	}

	/**
	 * How many streams are open on a topic.
	 *
	 * @param topic The topic.
	 * @returns The count.
	 */
	subscriberCount(topic: string): number {
		return this.queues.get(topic)?.size ?? 0;
	}

	/**
	 * Every topic with at least one reader.
	 */
	topics(): readonly string[] {
		return Array.from(this.queues.keys()).sort();
	}

	/**
	 * Ends every open stream.
	 */
	close(): void {
		for (const [topic, subscribers] of Array.from(this.queues.entries())) {
			for (const queue of Array.from(subscribers)) {
				queue.done = true;
				for (const waiting of queue.waiting.splice(0)) {
					waiting({ value: undefined, done: true });
				}
			}
			this.queues.delete(topic);
		}
	}
}

/**
 * The published fan-out, as the rest of the platform sees it.
 */
@Injectable()
export class GraphqlPubSub implements OnModuleDestroy {
	private readonly broker: GraphqlTopicBroker;
	private readonly engine: GraphqlPubSubEngine;

	/**
	 * @param engine An engine to publish through instead of the in-process one. Supplied by a
	 * deployment that runs several replicas, so a subscriber sees the events every replica produces.
	 */
	constructor(@Optional() @Inject(GRAPHQL_PUBSUB_ENGINE) engine?: GraphqlPubSubEngine) {
		this.broker = new GraphqlTopicBroker();
		this.engine = engine ?? this.broker;
	}

	/**
	 * The topic an event of one tenant travels on.
	 *
	 * @param eventName The event name.
	 * @param tenantId The tenant.
	 * @returns The topic.
	 */
	topicFor(eventName: string, tenantId: string): string {
		return subscriptionTopic(eventName, tenantId);
	}

	/**
	 * Publishes one event envelope.
	 *
	 * An envelope without a tenant is refused rather than published on a topic nobody can be scoped
	 * to: every catalogued event carries one, and a broadcast topic is the one thing this design must
	 * not have.
	 *
	 * @param eventName The event name.
	 * @param tenantId The tenant the fact belongs to.
	 * @param payload The envelope.
	 * @returns True when the payload was published.
	 */
	async publish(eventName: string, tenantId: string, payload: unknown): Promise<boolean> {
		if (!eventName || !tenantId) {
			return false;
		}

		await this.engine.publish(subscriptionTopic(eventName, tenantId), payload);
		return true;
	}

	/**
	 * Opens a stream of one topic, which is what a subscription resolver returns.
	 *
	 * @param topic The topic.
	 * @returns The iterator.
	 */
	asyncIterableIterator<T>(topic: string): AsyncIterableIterator<T> {
		return this.engine.asyncIterableIterator<T>(topic);
	}

	/**
	 * How many streams are open. Zero when a remote engine is in use, which is the engine's business.
	 */
	get openStreams(): number {
		return this.broker.topics().reduce((total, topic) => total + this.broker.subscriberCount(topic), 0);
	}

	/**
	 * The limits in force, for a diagnostic.
	 */
	get limits(): SubscriptionLimits {
		return DEFAULT_SUBSCRIPTION_LIMITS;
	}

	/**
	 * Ends every open stream.
	 */
	onModuleDestroy(): void {
		this.engine.close?.();
		this.broker.close();
	}
}
