import { AsyncLocalStorage } from 'async_hooks';
import { UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Subject } from 'rxjs';
import { RequestContext } from '../../core/context/request-context';
import { BaseEvent } from '../../event-bus/base-event';
import { EventBus } from '../../event-bus/event-bus';
import { GraphqlPubSub } from './graphql-pubsub.service';
import {
	currentSubscriberScope,
	declareStreamedEvents,
	deliverPayloadAsIs,
	observableToAsyncIterable,
	tenantScopedEventStream,
	tenantScopedTopicStream
} from './plugin-subscription';
import { GraphqlSubscriptionBusBridge } from './subscription-bus-bridge';
import { SubscriptionCatalogue, SubscriptionCatalogueError } from './subscription-catalogue';
import { GraphqlSubscriptionHub } from './subscription-hub.service';
import { SubscriptionAuthorizer } from './subscription-scope';

/**
 * The kernel's tenant-scoped subscription streams.
 *
 * The cases are written against the failure they exist to prevent, and that failure is only visible with
 * two request contexts in play: the in-process bus calls its observers synchronously inside the
 * **publisher's** request, so anything an observer reads from `RequestContext` is the publisher's tenant.
 * Every case below therefore opens the stream inside the subscriber's context and publishes inside
 * another one, with a real CLS store behind `RequestContext`, exactly as the socket and an HTTP mutation
 * do in the running API.
 */
describe('tenant-scoped plugin subscriptions', () => {
	const TENANT_A = 'tenant-a';
	const TENANT_B = 'tenant-b';
	const ORG_A = 'organization-a';
	const ORG_A2 = 'organization-a2';

	class WidgetChangedEvent extends BaseEvent {
		constructor(
			readonly widgetId: string,
			readonly tenantId?: string,
			readonly organizationId?: string
		) {
			super();
		}
	}

	/** The rows a tenant-aware read answers from, as the subscriber or as the publisher. */
	const ROWS = [
		{ id: 'w-a', tenantId: TENANT_A, organizationId: ORG_A, name: 'tenant A widget' },
		{ id: 'w-a2', tenantId: TENANT_A, organizationId: ORG_A2, name: 'tenant A, other organization' },
		{ id: 'w-b', tenantId: TENANT_B, organizationId: 'organization-b', name: 'tenant B widget' }
	];

	/** A read that scopes itself the way `TenantAwareCrudService` does: by the ambient request context. */
	const ambientRead = async (id: string) => {
		const row = ROWS.find(
			(candidate) => candidate.id === id && candidate.tenantId === RequestContext.currentTenantId()
		);
		if (!row) {
			throw new Error('not found');
		}
		return row;
	};

	const originalClsService = RequestContext['clsService'];
	let bus: EventBus;

	/** Runs work as a signed-in user of one tenant. */
	const as = <T>(tenantId: string | undefined, work: () => T, organizationId?: string): T =>
		RequestContext.runWithRequest(
			{
				user: tenantId ? { id: `user-${tenantId}`, tenantId, lastOrganizationId: organizationId } : undefined
			} as never,
			work
		);

	/** Pulls the next value, or answers `'nothing'` when none arrives in time. */
	const nextWithin = async <T>(iterator: AsyncIterator<T>, ms = 50): Promise<T | 'nothing' | 'done'> => {
		let timer: NodeJS.Timeout | undefined;
		const timeout = new Promise<'nothing'>((resolve) => (timer = setTimeout(() => resolve('nothing'), ms)));
		const result = await Promise.race([
			iterator.next().then((r) => (r.done ? ('done' as const) : r.value)),
			timeout
		]);
		clearTimeout(timer);
		return result;
	};

	beforeAll(() => {
		RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
	});

	afterAll(() => {
		RequestContext['clsService'] = originalClsService;
	});

	beforeEach(() => {
		bus = new EventBus();
	});

	describe('the in-process feed', () => {
		it("never delivers another tenant's event, even though the bus calls back inside that tenant's request", async () => {
			const stream = as(TENANT_A, () =>
				tenantScopedEventStream(bus.ofType(WidgetChangedEvent), { tenantOf: (event) => event.tenantId })
			);

			await as(TENANT_B, () => bus.publish(new WidgetChangedEvent('w-b', TENANT_B)));
			// The trap the stream exists for: a check that read the ambient tenant here would compare the
			// event with its own publisher and pass it.
			await as(TENANT_B, () => bus.publish(new WidgetChangedEvent('w-a', TENANT_B)));
			await as(TENANT_A, () => bus.publish(new WidgetChangedEvent('w-a', TENANT_A)));

			const first = await nextWithin(stream);
			expect(first).toBeInstanceOf(WidgetChangedEvent);
			expect((first as WidgetChangedEvent).tenantId).toBe(TENANT_A);
			expect(await nextWithin(stream)).toBe('nothing');

			await stream.return?.();
		});

		it('re-reads as the subscriber — not as the publisher the bus called back in — and drops what the subscriber cannot read', async () => {
			const stream = as(TENANT_A, () =>
				tenantScopedEventStream(bus.ofType(WidgetChangedEvent), {
					read: (event) => ambientRead(event.widgetId)
				})
			);

			// Published by tenant B about its own row: a read in B's context would find it.
			await as(TENANT_B, () => bus.publish(new WidgetChangedEvent('w-b')));
			await as(TENANT_B, () => bus.publish(new WidgetChangedEvent('w-a')));

			expect(await nextWithin(stream)).toEqual(ROWS[0]);
			expect(await nextWithin(stream)).toBe('nothing');

			await stream.return?.();
		});

		it('hands the read the captured scope, so the statement can state the tenant itself', async () => {
			const scopes: unknown[] = [];
			const stream = as(
				TENANT_A,
				() =>
					tenantScopedEventStream(bus.ofType(WidgetChangedEvent), {
						read: (event, scope) => {
							scopes.push(scope);
							return ROWS.find((row) => row.id === event.widgetId && row.tenantId === scope.tenantId);
						}
					}),
				ORG_A
			);

			await as(TENANT_B, () => bus.publish(new WidgetChangedEvent('w-b')));
			await as(TENANT_B, () => bus.publish(new WidgetChangedEvent('w-a')));

			expect(await nextWithin(stream)).toEqual(ROWS[0]);
			expect(scopes).toEqual([
				{ tenantId: TENANT_A, organizationId: ORG_A },
				{ tenantId: TENANT_A, organizationId: ORG_A }
			]);

			await stream.return?.();
		});

		it("drops a value that carries another tenant even when the event claimed the subscriber's", async () => {
			const stream = as(TENANT_A, () =>
				tenantScopedEventStream(bus.ofType(WidgetChangedEvent), {
					tenantOf: (event) => event.tenantId,
					read: () => ROWS[2]
				})
			);

			await as(TENANT_A, () => bus.publish(new WidgetChangedEvent('w-b', TENANT_A)));

			expect(await nextWithin(stream)).toBe('nothing');
			await stream.return?.();
		});

		it('delivers nothing when neither the event nor the value says whose fact it is', async () => {
			const stream = as(TENANT_A, () =>
				tenantScopedEventStream(bus.ofType(WidgetChangedEvent), { read: () => ({ name: 'no owner' }) })
			);

			await as(TENANT_A, () => bus.publish(new WidgetChangedEvent('w-a')));

			expect(await nextWithin(stream)).toBe('nothing');
			await stream.return?.();
		});

		it('drops an event that states no tenant when the stream reads the tenant from the event', async () => {
			const stream = as(TENANT_A, () =>
				tenantScopedEventStream(bus.ofType(WidgetChangedEvent), { tenantOf: (event) => event.tenantId })
			);

			await as(TENANT_A, () => bus.publish(new WidgetChangedEvent('w-a')));

			expect(await nextWithin(stream)).toBe('nothing');
			await stream.return?.();
		});

		it("narrows to the subscriber's organization when both are known", async () => {
			const stream = as(
				TENANT_A,
				() =>
					tenantScopedEventStream(bus.ofType(WidgetChangedEvent), {
						tenantOf: (event) => event.tenantId,
						organizationOf: (event) => event.organizationId
					}),
				ORG_A
			);

			await as(TENANT_A, () => bus.publish(new WidgetChangedEvent('w-a2', TENANT_A, ORG_A2)));
			await as(TENANT_A, () => bus.publish(new WidgetChangedEvent('tenant-wide', TENANT_A)));
			await as(TENANT_A, () => bus.publish(new WidgetChangedEvent('w-a', TENANT_A, ORG_A)));

			expect(((await nextWithin(stream)) as WidgetChangedEvent).widgetId).toBe('tenant-wide');
			expect(((await nextWithin(stream)) as WidgetChangedEvent).widgetId).toBe('w-a');
			expect(await nextWithin(stream)).toBe('nothing');
			await stream.return?.();
		});

		it('applies the narrowing the subscriber asked for, and never an empty frame for a read that failed', async () => {
			const stream = as(TENANT_A, () =>
				tenantScopedEventStream(bus.ofType(WidgetChangedEvent), {
					narrow: (event) => event.widgetId !== 'skip',
					tenantOf: (event) => event.tenantId,
					read: (event) => (event.widgetId === 'gone' ? null : ambientRead(event.widgetId))
				})
			);

			await as(TENANT_A, () => bus.publish(new WidgetChangedEvent('skip', TENANT_A)));
			await as(TENANT_A, () => bus.publish(new WidgetChangedEvent('gone', TENANT_A)));
			await as(TENANT_A, () => bus.publish(new WidgetChangedEvent('missing', TENANT_A)));
			await as(TENANT_A, () => bus.publish(new WidgetChangedEvent('w-a', TENANT_A)));

			expect(await nextWithin(stream)).toEqual(ROWS[0]);
			expect(await nextWithin(stream)).toBe('nothing');
			await stream.return?.();
		});

		it('refuses to open a stream for an operation with no tenant', () => {
			expect(() =>
				as(undefined, () =>
					tenantScopedEventStream(bus.ofType(WidgetChangedEvent), { tenantOf: (e) => e.tenantId })
				)
			).toThrow(UnauthorizedException);
			expect(() => currentSubscriberScope()).toThrow(UnauthorizedException);
		});

		it('detaches from the source and settles a waiting pull when the client completes', async () => {
			const source = new Subject<WidgetChangedEvent>();
			const stream = as(TENANT_A, () => tenantScopedEventStream(source, { tenantOf: (event) => event.tenantId }));
			expect(source.observed).toBe(true);

			const pending = stream.next();
			await stream.return?.();

			await expect(pending).resolves.toEqual({ value: undefined, done: true });
			expect(source.observed).toBe(false);
		});

		it('ends a subscriber that stopped reading rather than buffering without bound', async () => {
			const stream = as(TENANT_A, () =>
				tenantScopedEventStream(bus.ofType(WidgetChangedEvent), {
					tenantOf: (event) => event.tenantId,
					maxBuffered: 2
				})
			);

			for (const id of ['1', '2', '3']) {
				await as(TENANT_A, () => bus.publish(new WidgetChangedEvent(id, TENANT_A)));
			}

			expect(await nextWithin(stream)).toBe('done');
		});

		it("does not let another tenant's burst fill the subscriber's queue", async () => {
			const stream = as(TENANT_A, () =>
				tenantScopedEventStream(bus.ofType(WidgetChangedEvent), {
					tenantOf: (event) => event.tenantId,
					maxBuffered: 2
				})
			);

			for (const id of ['1', '2', '3', '4']) {
				await as(TENANT_B, () => bus.publish(new WidgetChangedEvent(id, TENANT_B)));
			}
			await as(TENANT_A, () => bus.publish(new WidgetChangedEvent('w-a', TENANT_A)));

			expect(((await nextWithin(stream)) as WidgetChangedEvent).widgetId).toBe('w-a');
			await stream.return?.();
		});
	});

	describe('the tenant-topic feed', () => {
		let pubSub: GraphqlPubSub;

		beforeEach(() => {
			pubSub = new GraphqlPubSub();
		});

		afterEach(() => pubSub.onModuleDestroy());

		it("opens the subscriber's own topic only, and still drops an envelope that names another tenant", async () => {
			const stream = as(TENANT_A, () => tenantScopedTopicStream(pubSub, 'widget.changed'));
			expect(pubSub.openStreams).toBe(1);

			await pubSub.publish('widget.changed', TENANT_B, { name: 'widget.changed', tenantId: TENANT_B, id: 'b' });
			// Mis-published onto A's topic: the envelope's own tenant is the second line.
			await pubSub.publish('widget.changed', TENANT_A, { name: 'widget.changed', tenantId: TENANT_B, id: 'b2' });
			await pubSub.publish('widget.changed', TENANT_A, { name: 'widget.changed', id: 'no-tenant' });
			await pubSub.publish('widget.changed', TENANT_A, { name: 'widget.changed', tenantId: TENANT_A, id: 'a' });

			expect(await nextWithin(stream)).toEqual({ name: 'widget.changed', tenantId: TENANT_A, id: 'a' });
			expect(await nextWithin(stream)).toBe('nothing');

			await stream.return?.();
			expect(pubSub.openStreams).toBe(0);
		});

		it('follows several event names as one stream and closes every topic it opened', async () => {
			const stream = as(TENANT_A, () =>
				tenantScopedTopicStream<{ name: string; tenantId?: string }>(pubSub, [
					'widget.created',
					'widget.deleted'
				])
			);
			expect(pubSub.openStreams).toBe(2);

			await pubSub.publish('widget.deleted', TENANT_A, { name: 'widget.deleted', tenantId: TENANT_A });
			await pubSub.publish('widget.created', TENANT_B, { name: 'widget.created', tenantId: TENANT_B });

			expect(await nextWithin(stream)).toEqual({ name: 'widget.deleted', tenantId: TENANT_A });
			expect(await nextWithin(stream)).toBe('nothing');

			await stream.return?.();
			expect(pubSub.openStreams).toBe(0);
		});

		it('carries an in-process event the bus bridge follows to the subscriber of its tenant only', async () => {
			const hub = new GraphqlSubscriptionHub(pubSub, new SubscriptionAuthorizer(), new SubscriptionCatalogue());
			const bridge = new GraphqlSubscriptionBusBridge(hub, bus);
			bridge.follow(WidgetChangedEvent, (event) => ({
				eventId: event.widgetId,
				name: 'widget.changed',
				occurredAt: new Date(0),
				tenantId: event.tenantId,
				aggregate: { type: 'Widget', id: event.widgetId },
				data: { id: event.widgetId }
			}));

			const streamOfA = as(TENANT_A, () =>
				tenantScopedTopicStream<{ eventId: string }>(pubSub, 'widget.changed')
			);
			const streamOfB = as(TENANT_B, () =>
				tenantScopedTopicStream<{ eventId: string }>(pubSub, 'widget.changed')
			);

			await as(TENANT_B, () => bus.publish(new WidgetChangedEvent('w-b', TENANT_B)));
			await as(TENANT_A, () => bus.publish(new WidgetChangedEvent('w-a', TENANT_A)));
			// No tenant, no topic: the hub refuses to publish it at all.
			await bus.publish(new WidgetChangedEvent('orphan'));

			expect(((await nextWithin(streamOfA)) as { eventId: string }).eventId).toBe('w-a');
			expect(await nextWithin(streamOfA)).toBe('nothing');
			expect(((await nextWithin(streamOfB)) as { eventId: string }).eventId).toBe('w-b');
			expect(await nextWithin(streamOfB)).toBe('nothing');

			await streamOfA.return?.();
			await streamOfB.return?.();
			bridge.onModuleDestroy();
		});
	});

	describe('the plumbing around a stream', () => {
		it('hands the payload to graphql-js unchanged', () => {
			const row = { id: 'w-a' };
			expect(deliverPayloadAsIs(row)).toBe(row);
		});

		it('declares the events a package streams and asks the outbox consumer to listen for them', () => {
			const catalogue = new SubscriptionCatalogue();
			const consumer = { register: jest.fn() };

			declareStreamedEvents(catalogue, consumer as never, 'widget.created', 'widget.deleted');

			expect(catalogue.names()).toEqual(['widget.created', 'widget.deleted']);
			expect(consumer.register).toHaveBeenCalledTimes(1);
			// A process with no subscription surface declares without a consumer.
			expect(() => declareStreamedEvents(catalogue, undefined, 'widget.renamed')).not.toThrow();
			// The deliberately non-streamed names stay refused.
			expect(() => declareStreamedEvents(catalogue, consumer as never, 'commerce_cart.updated')).toThrow(
				SubscriptionCatalogueError
			);
		});

		it('adapts an observable without scoping it, for the packages that re-export it', async () => {
			const source = new Subject<number>();
			const iterator = observableToAsyncIterable(source);

			source.next(1);
			source.next(2);
			source.complete();

			await expect(iterator.next()).resolves.toEqual({ value: 1, done: false });
			await expect(iterator.next()).resolves.toEqual({ value: 2, done: false });
			await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
		});
	});
});
