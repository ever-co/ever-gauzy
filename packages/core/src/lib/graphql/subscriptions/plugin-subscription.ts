import { AsyncResource } from 'async_hooks';
import { UnauthorizedException } from '@nestjs/common';
import { Observable, Subscription as RxSubscription } from 'rxjs';
import { RequestContext } from '../../core/context/request-context';
// Types only: a package's spec that loads this helper must not pull the outbox runtime in behind it.
import type { GraphqlPubSub } from './graphql-pubsub.service';
import type { SubscriptionCatalogue } from './subscription-catalogue';
import type { GraphqlSubscriptionConsumer } from './subscription-consumer';
import { DEFAULT_SUBSCRIPTION_LIMITS } from './subscription-limits';

/**
 * The one way a package streams its events to a GraphQL subscriber.
 *
 * A subscription field hands graphql-js an async iterable, and every value it yields is delivered to
 * the client that opened it. Each package that streamed a fact used to carry its own adapter from its
 * event source to that iterable, and none of them asked whose fact it was: the catalogue's collection
 * and publication streams, the inventory streams and the entitlement streams all delivered every
 * tenant's events to every subscriber holding the view permission, narrowed only by the ids the
 * subscriber passed. The adapters below are the replacement, and the tenant predicate is not an option
 * a resolver can forget — it is what the adapters are for.
 *
 * 🛑 **Why the subscriber's scope is captured once, when the stream opens, and never read again.** The
 * platform's in-process bus is an rxjs `Subject`: `EventBus.publish` calls every observer synchronously,
 * inside the **publisher's** async context. Anything an observer reads from `RequestContext` at that
 * moment — `currentTenantId()`, a tenant-aware service's implicit predicate, a scoped `findOne` — is the
 * publisher's request, not the subscriber's. A filter written as `event.tenantId === RequestContext
 * .currentTenantId()` inside the pipe compares the event with its own tenant and always passes, and a
 * "scoped re-read" in the observer reads the row in the tenant that wrote it and always finds it. That
 * is how the entitlement stream, which re-read every event through `findOneScoped`, still delivered
 * another tenant's rights: its read ran in the other tenant's context. Here the subscriber's tenant and
 * organization are taken from the request context when the resolver runs — after the guards, inside the
 * operation's own context — and every decision is made against that captured value. A stream opened
 * without a tenant is refused rather than opened wide.
 *
 * **What decides delivery.** An event reaches the subscriber only when every check below holds, and a
 * check that cannot be answered refuses:
 *
 * 1. the arguments the subscriber narrowed by (`narrow`);
 * 2. the event's own tenant, when the event states one (`tenantOf`): it must be the subscriber's — an
 *    event of another tenant, or one stating none, is dropped before it is buffered, so another tenant's
 *    burst cannot fill this subscriber's queue either;
 * 3. the event's organization, when both it and the subscriber have one (`organizationOf`);
 * 4. the value delivered (`read`): when a scoped re-read is supplied, it runs **inside the subscriber's
 *    async context** with the captured scope handed in, and a read that finds nothing — or throws — drops
 *    the event rather than delivering an empty frame;
 * 5. the value's own `tenantId` and `organizationId`, when it carries them, checked against the scope
 *    again — and a value that carries no tenant is delivered only when step 2 established one. A stream
 *    with no tenant evidence at all delivers nothing.
 *
 * Two feeds are supported, because the platform has two:
 *
 * - {@link tenantScopedEventStream} — the in-process `EventBus` (or any rxjs source);
 * - {@link tenantScopedTopicStream} — the tenant topics of `GraphqlPubSub` (`<eventName>:<tenantId>`),
 *   which the outbox consumer and `GraphqlSubscriptionBusBridge.follow` publish to. The topic is opened
 *   for the captured tenant, so the structural separation the topic gives is kept, and the checks above
 *   run on every envelope as the second line.
 *
 * A resolver returns the stream and states `resolve: deliverPayloadAsIs`: graphql-js reads a
 * subscription payload as the root value and, with no resolver, looks up `payload[fieldName]` — which a
 * row does not have — so every frame would otherwise answer `Cannot return null for non-nullable field`.
 */

/**
 * Who a stream is delivering to, captured when it opened.
 */
export interface SubscriberScope {
	/** The subscriber's tenant. Every delivered fact belongs to it. */
	readonly tenantId: string;
	/** The organization the subscriber is acting in, when it is scoped to one. */
	readonly organizationId?: string;
}

/**
 * How one stream decides what it may deliver.
 *
 * @typeParam E The event the source emits.
 * @typeParam R The value the subscriber receives.
 */
export interface TenantEventStreamOptions<E, R> {
	/**
	 * The subscriber, when the caller already captured it. Defaults to {@link currentSubscriberScope},
	 * read when the stream is built — which is why a resolver builds the stream in its own body.
	 */
	readonly scope?: SubscriberScope;
	/**
	 * The subscriber's own narrowing — the ids its arguments named. It can only narrow. It runs in the
	 * publisher's context for an in-process source, so it must read the event and its own closure only,
	 * never `RequestContext`.
	 */
	readonly narrow?: (event: E) => boolean;
	/**
	 * The tenant the event belongs to. When supplied, an event stating another tenant — or none — is
	 * dropped.
	 */
	readonly tenantOf?: (event: E) => unknown;
	/**
	 * The organization the event belongs to. When it and the subscriber's organization are both known
	 * and differ, the event is dropped.
	 */
	readonly organizationOf?: (event: E) => unknown;
	/**
	 * What the subscriber receives for an event: a scoped re-read of the row it names, or a projection
	 * of the event. It runs inside the subscriber's async context with the captured scope, so a
	 * tenant-aware service reads as the subscriber. `null`, `undefined` or a throw drops the event.
	 * Without it the event itself is delivered.
	 */
	readonly read?: (event: E, scope: SubscriberScope) => R | null | undefined | Promise<R | null | undefined>;
	/**
	 * How many admitted events may wait for the subscriber to pull them. A subscriber that falls this
	 * far behind is ended, so it reconnects and re-reads, rather than growing the process without bound.
	 */
	readonly maxBuffered?: number;
}

/**
 * The subscriber of the operation being resolved.
 *
 * Read from the request context, which the guards have already authenticated when a resolver body runs
 * (on the socket, `subscribeInRequestContext` opens it for the operation). Fails closed: a stream with
 * no tenant behind it could only be empty or wide, and only one of those is acceptable — so it is not
 * opened at all, and the client is told why.
 *
 * @returns The scope.
 * @throws UnauthorizedException when the operation carries no tenant.
 */
export function currentSubscriberScope(): SubscriberScope {
	const tenantId = RequestContext.currentTenantId();

	if (!tenantId) {
		throw new UnauthorizedException('The subscription carries no tenant, so no event can be delivered to it.');
	}

	const organizationId = RequestContext.currentOrganizationId();

	return { tenantId: String(tenantId), ...(organizationId ? { organizationId: String(organizationId) } : {}) };
}

/**
 * The resolver option every stream built here is delivered with: the payload is the value itself.
 *
 * @param payload The value the stream yielded.
 * @returns The same value.
 */
export function deliverPayloadAsIs<T>(payload: T): T {
	return payload;
}

/**
 * Streams the events of an in-process source that belong to the subscriber's tenant.
 *
 * @param source The source, typically `eventBus.ofType(SomeEvent)`.
 * @param options What decides delivery; see {@link TenantEventStreamOptions}.
 * @returns The stream a subscription resolver returns.
 * @throws UnauthorizedException when the operation carries no tenant.
 */
export function tenantScopedEventStream<E, R = E>(
	source: Observable<E>,
	options: TenantEventStreamOptions<E, R> = {}
): AsyncIterableIterator<R> {
	const scope = options.scope ?? currentSubscriberScope();
	const admitted = new Observable<E>((subscriber) =>
		source.subscribe({
			// Runs in the publisher's context: it reads the captured scope and the event, nothing ambient.
			next: (event) => {
				if (admits(event, scope, options)) {
					subscriber.next(event);
				}
			},
			error: (error) => subscriber.error(error),
			complete: () => subscriber.complete()
		})
	);

	return screened(observableToAsyncIterable(admitted, options.maxBuffered), scope, options);
}

/**
 * Streams envelopes published on the subscriber's tenant topics of `GraphqlPubSub`.
 *
 * The topic is `<eventName>:<capturedTenantId>`, so a publisher of another tenant never reaches it; the
 * envelope's own `tenantId` is still required to be the subscriber's (an envelope without one is
 * dropped), which keeps a mis-published envelope from crossing.
 *
 * @param pubSub The fan-out.
 * @param eventNames The catalogued event name, or names, to follow.
 * @param options What decides delivery. `tenantOf` and `organizationOf` default to the envelope's own.
 * @returns The stream a subscription resolver returns.
 * @throws UnauthorizedException when the operation carries no tenant.
 */
export function tenantScopedTopicStream<E extends object, R = E>(
	pubSub: GraphqlPubSub,
	eventNames: string | readonly string[],
	options: TenantEventStreamOptions<E, R> = {}
): AsyncIterableIterator<R> {
	const scope = options.scope ?? currentSubscriberScope();
	const resolved: TenantEventStreamOptions<E, R> = {
		...options,
		tenantOf: options.tenantOf ?? ((event: E) => memberOf(event, 'tenantId')),
		organizationOf: options.organizationOf ?? ((event: E) => memberOf(event, 'organizationId'))
	};
	const names = (typeof eventNames === 'string' ? [eventNames] : [...eventNames]).filter(Boolean);
	const topics = names.map((name) => pubSub.asyncIterableIterator<E>(pubSub.topicFor(name, scope.tenantId)));

	return screened(mergeAsyncIterators(topics), scope, resolved, true);
}

/**
 * Declares the events a package streams, and makes sure the outbox consumer is listening for them.
 *
 * The catalogue is what `Subscription.events` resolves a selection against and what the outbox
 * consumer forwards, so a package that appends a fact to the outbox and does not declare it is a fact
 * no subscriber can receive. The consumer registers itself at bootstrap only when something is already
 * declared — the registry refuses a consumer with no events — so the consumer is asked to register
 * again after the declaration; the registry accepts the same consumer twice.
 *
 * @param catalogue The catalogue.
 * @param consumer The outbox consumer that feeds subscribers. Absent in a process with no subscription
 * surface, where declaring is still harmless.
 * @param names The event names, `<aggregate>.<action>`.
 * @throws SubscriptionCatalogueError when a name is malformed or deliberately not streamed.
 */
export function declareStreamedEvents(
	catalogue: SubscriptionCatalogue,
	consumer: GraphqlSubscriptionConsumer | undefined,
	...names: readonly string[]
): void {
	catalogue.declare(...names);
	consumer?.register();
}

/**
 * Adapts an rxjs source to the async iterator a subscription returns.
 *
 * Values that arrive between two pulls are buffered rather than dropped, up to `maxBuffered`; past it
 * the stream ends, so a client that stopped reading reconnects instead of growing the process. Ending
 * the iterator — the client completed, or the socket went away — unsubscribes from the source and
 * settles a pull that was waiting, so no reader is left pending.
 *
 * This is the shared replacement for the private `toAsyncIterable` copies the packages carried. It does
 * no scoping of its own: a resolver uses {@link tenantScopedEventStream}, which is built on it.
 *
 * @param source The observable.
 * @param maxBuffered How many values may wait for a pull.
 * @returns The iterator.
 */
export function observableToAsyncIterable<T>(
	source: Observable<T>,
	maxBuffered: number = DEFAULT_SUBSCRIPTION_LIMITS.maxQueueDepth
): AsyncIterableIterator<T> {
	const buffered: T[] = [];
	const waiting: Array<(result: IteratorResult<T>) => void> = [];
	let finished = false;
	let subscription: RxSubscription | undefined;

	const finish = (): void => {
		if (finished) {
			return;
		}

		finished = true;
		subscription?.unsubscribe();
		for (const resolve of waiting.splice(0)) {
			resolve({ value: undefined, done: true });
		}
	};

	subscription = source.subscribe({
		next: (value: T) => {
			if (finished) {
				return;
			}

			const resolve = waiting.shift();
			if (resolve) {
				resolve({ value, done: false });
				return;
			}

			if (buffered.length >= maxBuffered) {
				// The subscriber is not reading. Ending is what the subscription limits promise.
				buffered.length = 0;
				finish();
				return;
			}

			buffered.push(value);
		},
		error: () => finish(),
		complete: () => finish()
	});

	// A source that completed synchronously while it was being subscribed to leaves nothing to undo.
	if (finished) {
		subscription.unsubscribe();
	}

	const iterator: AsyncIterableIterator<T> = {
		next: (): Promise<IteratorResult<T>> => {
			if (buffered.length > 0) {
				return Promise.resolve({ value: buffered.shift() as T, done: false });
			}

			if (finished) {
				return Promise.resolve({ value: undefined, done: true });
			}

			return new Promise<IteratorResult<T>>((resolve) => waiting.push(resolve));
		},
		return: (): Promise<IteratorResult<T>> => {
			buffered.length = 0;
			finish();
			return Promise.resolve({ value: undefined, done: true });
		},
		throw: (error?: unknown): Promise<IteratorResult<T>> => {
			buffered.length = 0;
			finish();
			return Promise.reject(error);
		},
		[Symbol.asyncIterator]() {
			return iterator;
		}
	};

	return iterator;
}

/**
 * The marker a screened event is dropped with.
 */
const DROPPED = Symbol('dropped');

/**
 * Whether an event may be queued for a subscriber: the narrowing, the tenant and the organization.
 *
 * @param event The event.
 * @param scope The captured subscriber.
 * @param options The stream's checks.
 * @returns True when the event is admitted.
 */
function admits<E, R>(event: E, scope: SubscriberScope, options: TenantEventStreamOptions<E, R>): boolean {
	if (event === null || event === undefined) {
		return false;
	}

	try {
		if (options.narrow && !options.narrow(event)) {
			return false;
		}

		if (options.tenantOf) {
			const tenantId = options.tenantOf(event);

			if (!isPresent(tenantId) || String(tenantId) !== scope.tenantId) {
				return false;
			}
		}

		if (options.organizationOf && scope.organizationId) {
			const organizationId = options.organizationOf(event);

			if (isPresent(organizationId) && String(organizationId) !== scope.organizationId) {
				return false;
			}
		}

		return true;
	} catch {
		// A check that throws cannot be answered, and an unanswerable check is a refusal.
		return false;
	}
}

/**
 * The value a subscriber receives for an admitted event, or {@link DROPPED}.
 *
 * @param event The admitted event.
 * @param scope The captured subscriber.
 * @param options The stream's checks.
 * @returns The value, or the drop marker.
 */
async function settle<E, R>(
	event: E,
	scope: SubscriberScope,
	options: TenantEventStreamOptions<E, R>
): Promise<R | typeof DROPPED> {
	let value: R | E | null | undefined;

	try {
		value = options.read ? await options.read(event, scope) : event;
	} catch {
		// A row the subscriber cannot read — another tenant's, another organization's, a deleted one — is
		// one it is not told about. Delivering an empty frame instead would still tell it something happened.
		return DROPPED;
	}

	if (value === null || value === undefined) {
		return DROPPED;
	}

	const tenantId = memberOf(value, 'tenantId');
	if (isPresent(tenantId)) {
		if (String(tenantId) !== scope.tenantId) {
			return DROPPED;
		}
	} else if (!options.tenantOf) {
		// Neither the event nor the value says whose fact this is: there is nothing to scope it by.
		return DROPPED;
	}

	const organizationId = memberOf(value, 'organizationId');
	if (scope.organizationId && isPresent(organizationId) && String(organizationId) !== scope.organizationId) {
		return DROPPED;
	}

	return value as R;
}

/**
 * Wraps a source of admitted events into the stream a resolver returns.
 *
 * Each pull settles the next admitted event inside the subscriber's async context — captured here, when
 * the resolver builds the stream — so a re-read through a tenant-aware service reads as the subscriber
 * whoever pulls. Events are settled one at a time, in order.
 *
 * @param source The admitted events.
 * @param scope The captured subscriber.
 * @param options The stream's checks.
 * @param admitOnPull Whether the admission checks still have to run (a pull-based source).
 * @returns The stream.
 */
function screened<E, R>(
	source: AsyncIterator<E>,
	scope: SubscriberScope,
	options: TenantEventStreamOptions<E, R>,
	admitOnPull = false
): AsyncIterableIterator<R> {
	const context = new AsyncResource('GraphqlTenantEventStream');
	let closed = false;

	const close = async (): Promise<void> => {
		if (closed) {
			return;
		}

		closed = true;
		await source.return?.(undefined);
	};

	const iterator: AsyncIterableIterator<R> = {
		next: async (): Promise<IteratorResult<R>> => {
			while (!closed) {
				const result = await source.next();

				if (result.done || closed) {
					closed = true;
					break;
				}

				if (admitOnPull && !admits(result.value, scope, options)) {
					continue;
				}

				const value = await context.runInAsyncScope(() => settle(result.value, scope, options));

				if (value !== DROPPED && !closed) {
					return { value, done: false };
				}
			}

			return { value: undefined, done: true };
		},
		return: async (): Promise<IteratorResult<R>> => {
			await close();
			return { value: undefined, done: true };
		},
		throw: async (error?: unknown): Promise<IteratorResult<R>> => {
			await close();
			throw error;
		},
		[Symbol.asyncIterator]() {
			return iterator;
		}
	};

	return iterator;
}

/**
 * Reads several pull-based streams as one.
 *
 * @param sources The streams.
 * @returns One stream that yields whichever value arrives first, and ends when every source has.
 */
function mergeAsyncIterators<T>(sources: AsyncIterator<T>[]): AsyncIterator<T> {
	if (sources.length === 1) {
		return sources[0];
	}

	const pending = new Map<number, Promise<{ index: number; result: IteratorResult<T> }>>();
	const pull = (index: number): void => {
		pending.set(
			index,
			sources[index].next().then(
				(result) => ({ index, result }),
				() => ({ index, result: { value: undefined, done: true } as IteratorResult<T> })
			)
		);
	};
	let closed = false;

	sources.forEach((_, index) => pull(index));

	return {
		next: async (): Promise<IteratorResult<T>> => {
			while (!closed && pending.size > 0) {
				const { index, result } = await Promise.race(pending.values());
				pending.delete(index);

				if (result.done) {
					continue;
				}

				pull(index);
				return { value: result.value, done: false };
			}

			return { value: undefined, done: true };
		},
		return: async (): Promise<IteratorResult<T>> => {
			closed = true;
			pending.clear();
			await Promise.all(sources.map((source) => source.return?.(undefined)));
			return { value: undefined, done: true };
		}
	};
}

/**
 * Whether a scoping member carries a value.
 *
 * @param value The member.
 * @returns True for anything but null, undefined and the empty string.
 */
function isPresent(value: unknown): boolean {
	return value !== null && value !== undefined && value !== '';
}

/**
 * Reads one member of a delivered value, when the value is an object.
 *
 * @param value The value.
 * @param member The member.
 * @returns The member, or undefined.
 */
function memberOf(value: unknown, member: 'tenantId' | 'organizationId'): unknown {
	return value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[member] : undefined;
}
