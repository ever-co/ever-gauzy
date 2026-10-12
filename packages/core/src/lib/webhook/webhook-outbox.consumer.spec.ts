/**
 * The step that turns a `webhook_subscription` row into a delivery.
 *
 * Everything else in this domain existed without it — the subscription resource, the signing secret,
 * the pattern matcher, the retry ladder, the circuit breaker — and all of it was reachable only from
 * a controller. An operator could create an endpoint, rotate its secret and read an empty delivery log
 * forever, because nothing ever matched an event against the rows. So what this suite pins is the
 * matching and the fan-out themselves, against a subscription table and a delivery store that behave
 * like the tables they stand in for:
 *
 * - **scope, which is the one thing that must never be approximate**: an event reaches its own
 *   tenant's endpoints and no other tenant's, an organization's endpoints and the tenant-wide ones
 *   beside them, and an event that names no tenant reaches nobody at all — because a background caller
 *   that lost its scope would otherwise ask the store for every subscription there is;
 * - **the selection rules the subscription resource already declares** — the disabled switch, the
 *   channel and the patterns — reaching the fan-out unchanged, because a second copy of them is how a
 *   subscription comes to receive an event over one path and not the other;
 * - **one delivery row per matched endpoint, carrying the exact body**, and a re-run of the handler
 *   producing no second row and no second attempt;
 * - **a refused attempt staying the delivery row's business**: it is not raised, because raising would
 *   return the whole event to the outbox ladder and re-attempt every endpoint that had already
 *   accepted it — two schedules for one delivery. A delivery that could not be *recorded* is raised,
 *   because an endpoint with no row is an endpoint nothing will ever call.
 *
 * The registry and the subscription service are the real ones; the transport is not, because no case
 * here is about HTTP.
 */

/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — see
 * `../channel/channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined
 * when the entity applies it if the graph is entered through the validators rather than the entities.
 */
import '../core/entities/internal';

import { Logger, NotFoundException } from '@nestjs/common';
import {
	EventConsumerKind,
	EventConsumerOrdering,
	ID,
	IEventConsumerContext,
	IEventEnvelope,
	WebhookDeliveryStatus
} from '@gauzy/contracts';
import { EventConsumerRegistry } from '../event-outbox/event-consumer.registry';
import { EventOutboxService } from '../event-outbox/event-outbox.service';
import { NON_SUBSCRIBABLE_EVENT_NAMES, SubscriptionCatalogue } from '../graphql/subscriptions/subscription-catalogue';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookOutboxConsumer, WEBHOOK_OUTBOX_CONSUMER_KEY } from './webhook-outbox.consumer';
import { WebhookSubscriptionService } from './webhook-subscription.service';
import { TypeOrmWebhookSubscriptionRepository } from './repository/type-orm-webhook-subscription.repository';

type Row = Record<string, any>;

/** The lines the consumer wrote about an attempt it could not make. */
let failure: jest.SpyInstance;

beforeEach(() => {
	jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	failure = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
	jest.restoreAllMocks();
});

/**
 * One column's criteria, including the `IS NULL` a nullable scope is read with.
 *
 * The operator matters: an `organizationId` stated as `undefined` means "do not narrow on this
 * column" and `IsNull()` means "this column is null", and reading the two as the same thing is the
 * difference between selecting the tenant-wide endpoints and selecting every organization's.
 */
function matches(row: Row, criteria: Row = {}): boolean {
	return Object.entries(criteria).every(([column, condition]) => {
		const operator = condition as { _type?: string };

		if (operator && typeof operator === 'object' && operator._type === 'isNull') {
			return (row[column] ?? null) === null;
		}

		return (row[column] ?? null) === (condition ?? null);
	});
}

/** An in-memory stand-in for the `webhook_subscription` table, including an ORed `where`. */
class SubscriptionTable {
	readonly rows: Row[] = [];
	private sequence = 0;

	/** Seeds one subscription, as an operator's creation would leave it. */
	seed(input: Partial<Row> = {}): Row {
		this.sequence += 1;

		const row: Row = {
			id: `subscription-${this.sequence}`,
			name: `endpoint ${this.sequence}`,
			url: `https://partner-${this.sequence}.example.com/hooks`,
			secret: 'encrypted',
			events: ['order.placed'],
			isActive: true,
			failureCount: 0,
			tenantId: 'tenant-1',
			organizationId: 'organization-1',
			...input
		};

		this.rows.push(row);

		return row;
	}

	async find(options: { where?: Row | Row[] } = {}): Promise<Row[]> {
		// A `where` array is how the platform asks for an OR, and the scoped read uses one, so the
		// stand-in has to answer it as the store would rather than as a single criterion.
		const criteria = Array.isArray(options.where) ? options.where : [options.where ?? {}];

		return this.rows.filter((row) => criteria.some((entry) => matches(row, entry)));
	}

	async findOne(options: { where?: Row } = {}): Promise<Row | null> {
		return this.rows.find((row) => matches(row, options.where ?? {})) ?? null;
	}
}

/**
 * An in-memory stand-in for the delivery runtime.
 *
 * It keeps the `(subscriptionId, eventId)` identity the table is declared with and records an
 * attempt's outcome on the row the way the service does — including the part that matters most here,
 * that a refused attempt is *recorded* rather than raised.
 */
class DeliveryStore {
	readonly rows: Row[] = [];
	/** Endpoints whose call is refused, so the row is failed and rescheduled rather than delivered. */
	readonly refusing = new Set<string>();
	/** Endpoints whose attempt cannot be made at all, so `deliver` raises the way a lost row does. */
	readonly unreachable = new Set<string>();
	/** Endpoints whose delivery row cannot be written, which is a fan-out failure and not an attempt. */
	readonly unwritable = new Set<string>();

	/** The row of one `(subscription, event)` pair. */
	row(subscriptionId: string, eventId: string): Row | undefined {
		return this.rows.find((entry) => entry.subscriptionId === subscriptionId && entry.eventId === eventId);
	}

	async enqueue(input: Row): Promise<{ delivery: Row; created: boolean }> {
		if (this.unwritable.has(String(input.subscriptionId))) {
			throw new Error('could not serialize access due to concurrent update');
		}

		const existing = this.row(String(input.subscriptionId), String(input.eventId));

		if (existing) {
			// The unique pair is what makes a re-run of the handler find the row instead of making a
			// second one, which is the whole reason an event can be redelivered safely.
			return { delivery: existing, created: false };
		}

		const row: Row = {
			id: `delivery-${this.rows.length + 1}`,
			...input,
			status: WebhookDeliveryStatus.PENDING,
			attemptCount: 0,
			// The first attempt is due immediately; the ladder applies from the second one.
			nextAttemptAt: new Date('2026-03-01T10:00:00.000Z')
		};

		this.rows.push(row);

		return { delivery: row, created: true };
	}

	async deliver(id: ID): Promise<{ delivery: Row; skipped: boolean }> {
		const row = this.rows.find((entry) => entry.id === id);

		if (!row) {
			throw new NotFoundException('The webhook delivery does not exist.');
		}

		if (this.unreachable.has(String(row.subscriptionId))) {
			throw new Error('the delivery row vanished between the enqueue and the attempt');
		}

		row.attemptCount += 1;

		if (this.refusing.has(String(row.subscriptionId))) {
			Object.assign(row, {
				status: WebhookDeliveryStatus.FAILED,
				responseStatus: 503,
				lastError: 'The endpoint answered 503.',
				nextAttemptAt: new Date('2026-03-01T10:00:05.000Z')
			});
		} else {
			Object.assign(row, {
				status: WebhookDeliveryStatus.DELIVERED,
				responseStatus: 200,
				deliveredAt: new Date('2026-03-01T10:00:01.000Z'),
				nextAttemptAt: null,
				lastError: null
			});
		}

		return { delivery: row, skipped: false };
	}
}

/** The consumer over the two stores, with the real subscription service between it and the table. */
function fanOut(declared: readonly string[] = ['order.placed', 'order.quote-sent']) {
	const table = new SubscriptionTable();
	const deliveries = new DeliveryStore();
	const catalogue = new SubscriptionCatalogue();

	catalogue.declare(...declared);

	const subscriptions = new WebhookSubscriptionService(
		table as unknown as TypeOrmWebhookSubscriptionRepository,
		{} as never,
		// Neither collaborator is reached by the reads this suite drives: the secret is revealed by the
		// transport, and the switch-off is announced by the write that makes it.
		{} as never,
		{} as never
	);
	const registry = new EventConsumerRegistry({} as unknown as EventOutboxService);
	const consumer = new WebhookOutboxConsumer(
		subscriptions,
		deliveries as unknown as WebhookDeliveryService,
		catalogue,
		registry
	);

	return { table, deliveries, catalogue, registry, subscriptions, consumer };
}

/** The envelope the dispatcher hands a consumer. */
function envelope(overrides: Partial<IEventEnvelope> = {}): IEventEnvelope {
	return {
		id: 'event-1',
		name: 'order.placed',
		version: 1,
		occurredAt: new Date('2026-03-01T09:59:00.000Z'),
		tenantId: 'tenant-1',
		organizationId: 'organization-1',
		aggregate: { type: 'order', id: 'order-1' },
		sequence: 4,
		partitionKey: 'order:order-1',
		producer: 'order',
		data: { total: 100 },
		...overrides
	};
}

/** The delivery context, with the two questions a consumer may ask of its own record. */
function context(overrides: Partial<IEventConsumerContext> = {}): IEventConsumerContext {
	const base: IEventConsumerContext = {
		consumerKey: 'webhook:fan-out',
		async alreadyDelivered(): Promise<boolean> {
			return false;
		},
		async markDelivered(): Promise<void> {
			return undefined;
		},
		async assertOrder(): Promise<void> {
			return undefined;
		}
	};

	return Object.assign(base, overrides);
}

/** The subscription ids a fan-out produced a delivery row for. */
function reached(deliveries: DeliveryStore): string[] {
	return deliveries.rows.map((row) => String(row.subscriptionId)).sort();
}

describe('WebhookOutboxConsumer — the scope an event carries', () => {
	it('reaches its own tenant’s endpoints and no other tenant’s', async () => {
		const { table, deliveries, consumer } = fanOut();
		const mine = table.seed({ tenantId: 'tenant-1' });

		table.seed({ tenantId: 'tenant-2', organizationId: 'organization-9' });

		await consumer.handle(envelope(), context());

		// The one assertion this whole file exists for. The dispatcher runs with no request context, so a
		// fan-out that read a tenant from one would read none — and a store handed no tenant answers with
		// every tenant's endpoints, which is one tenant's order payload posted to another's partner.
		expect(reached(deliveries)).toEqual([mine.id]);
	});

	it('reaches nobody when the event names no tenant', async () => {
		const { table, deliveries, consumer } = fanOut();

		table.seed({ tenantId: 'tenant-1' });
		// Even an endpoint that itself has no tenant: a row nobody owns is not a row every event owns.
		table.seed({ tenantId: null, organizationId: null });

		await consumer.handle(envelope({ tenantId: undefined }), context());

		expect(deliveries.rows).toHaveLength(0);
	});

	it('reaches its own organization’s endpoints and the tenant-wide ones beside them', async () => {
		const { table, deliveries, consumer } = fanOut();
		const mine = table.seed({ organizationId: 'organization-1' });
		const shared = table.seed({ organizationId: null });

		table.seed({ organizationId: 'organization-2' });

		await consumer.handle(envelope({ organizationId: 'organization-1' }), context());

		// An endpoint with no organization is the tenant-wide endpoint, and equality alone would hide it
		// from every event that names one — which is the mistake a single `where` object makes silently.
		expect(reached(deliveries)).toEqual([mine.id, shared.id].sort());
	});

	it('reaches every organization of the tenant when the event is the tenant-wide fact', async () => {
		const { table, deliveries, consumer } = fanOut();
		const first = table.seed({ organizationId: 'organization-1' });
		const second = table.seed({ organizationId: 'organization-2' });
		const shared = table.seed({ organizationId: null });

		await consumer.handle(envelope({ organizationId: undefined }), context());

		expect(reached(deliveries)).toEqual([first.id, second.id, shared.id].sort());
	});

	it('narrows on the channel only when both sides state one', async () => {
		const { table, deliveries, consumer } = fanOut();
		const listening = table.seed({ channelId: 'channel-1' });
		const everyChannel = table.seed({ channelId: null });

		table.seed({ channelId: 'channel-2' });

		await consumer.handle(envelope({ channelId: 'channel-1' }), context());

		// A subscription that names no channel listens to every channel; a subscription that names
		// another one is not this channel's.
		expect(reached(deliveries)).toEqual([listening.id, everyChannel.id].sort());
	});

	it('reaches a channel-scoped endpoint with a fact that is not channel scoped', async () => {
		const { table, deliveries, consumer } = fanOut();
		const listening = table.seed({ channelId: 'channel-1' });

		await consumer.handle(envelope({ channelId: undefined }), context());

		// The existing rule, carried across unchanged: the narrowing applies only when the event states a
		// channel, so a platform-wide fact is not withheld from an endpoint that happens to name one.
		expect(reached(deliveries)).toEqual([listening.id]);
	});
});

describe('WebhookOutboxConsumer — which subscriptions an event selects', () => {
	it('honours the patterns the subscription resource already declares', async () => {
		const { table, deliveries, consumer } = fanOut();
		const exact = table.seed({ events: ['order.placed'] });
		const oneSegment = table.seed({ events: ['order.*'] });
		const everything = table.seed({ events: ['*'] });

		// `order.*` matches exactly one more segment, which is what stops it being an accidental
		// catch-all — so an endpoint subscribed to a deeper name is not selected by this event.
		table.seed({ events: ['order.quote.*'] });
		table.seed({ events: ['shipment.dispatched'] });

		await consumer.handle(envelope({ name: 'order.placed' }), context());

		expect(reached(deliveries)).toEqual([exact.id, oneSegment.id, everything.id].sort());
	});

	it('never selects a switched-off endpoint', async () => {
		const { table, deliveries, consumer } = fanOut();
		const live = table.seed();

		table.seed({ isActive: false });
		// The circuit breaker writes the instant as well as the switch, and either one alone is enough to
		// take an endpoint out of the fan-out.
		table.seed({ disabledAt: new Date('2026-02-01T00:00:00.000Z') });

		await consumer.handle(envelope(), context());

		expect(reached(deliveries)).toEqual([live.id]);
	});

	it('does nothing at all when nothing matches', async () => {
		const { table, deliveries, consumer } = fanOut();

		table.seed({ events: ['shipment.dispatched'] });

		await consumer.handle(envelope(), context());

		// No row, and no failure either: an event that no endpoint subscribed to is fanned out correctly
		// by producing nothing, and reporting it as a failure would return the event to the outbox ladder.
		expect(deliveries.rows).toHaveLength(0);
	});

	it('does nothing when its own delivery record already says the fan-out happened', async () => {
		const { table, deliveries, consumer } = fanOut();

		table.seed();

		await consumer.handle(envelope(), context({ alreadyDelivered: async () => true }));

		// The guard is what makes a redelivered *event* safe before the unique pair even comes into it:
		// a record that was already acknowledged means this fan-out has run.
		expect(deliveries.rows).toHaveLength(0);
	});
});

describe('WebhookOutboxConsumer — the delivery it records and attempts', () => {
	it('stores the envelope as the exact body and calls the endpoint once', async () => {
		const { table, deliveries, consumer } = fanOut();
		const subscription = table.seed();

		await consumer.handle(envelope(), context());

		const row = deliveries.row(subscription.id, 'event-1') as Row;

		expect(row).toMatchObject({
			eventId: 'event-1',
			eventName: 'order.placed',
			// Stated rather than taken from a request context the queue worker does not have: a row with
			// no tenant is invisible to every operator of the tenant that owns the endpoint.
			tenantId: 'tenant-1',
			organizationId: 'organization-1',
			status: WebhookDeliveryStatus.DELIVERED,
			attemptCount: 1
		});

		// The body is the envelope, written member by member: it is a wire contract, and a member added
		// to the envelope for the platform's own use must not start appearing in a partner's payload.
		expect(row.payload).toEqual({
			id: 'event-1',
			name: 'order.placed',
			version: 1,
			occurredAt: '2026-03-01T09:59:00.000Z',
			tenantId: 'tenant-1',
			organizationId: 'organization-1',
			channelId: undefined,
			aggregate: { type: 'order', id: 'order-1' },
			sequence: 4,
			partitionKey: 'order:order-1',
			correlationId: undefined,
			causationId: undefined,
			producer: 'order',
			data: { total: 100 }
		});
		expect(Object.keys(row.payload).sort()).toEqual(
			[
				'aggregate',
				'causationId',
				'channelId',
				'correlationId',
				'data',
				'id',
				'name',
				'occurredAt',
				'organizationId',
				'partitionKey',
				'producer',
				'sequence',
				'tenantId',
				'version'
			].sort()
		);
	});

	it('normalises the instant, so two deployments of one platform send the same bytes', async () => {
		const { table, deliveries, consumer } = fanOut();
		const subscription = table.seed();

		// A store that hands a date column back as text is a dialect difference, not an event that
		// happened differently — and the signature is taken over these bytes.
		await consumer.handle(envelope({ occurredAt: '2026-03-01T09:59:00.000Z' }), context());

		expect((deliveries.row(subscription.id, 'event-1') as Row).payload.occurredAt).toBe(
			'2026-03-01T09:59:00.000Z'
		);
	});

	it('gives every matched endpoint identical bytes', async () => {
		const { table, deliveries, consumer } = fanOut();
		const first = table.seed();
		const second = table.seed();

		await consumer.handle(envelope(), context());

		// Two partners comparing notes see one fact rather than two renderings of it — and the body is
		// built once for that reason.
		expect((deliveries.row(first.id, 'event-1') as Row).payload).toEqual(
			(deliveries.row(second.id, 'event-1') as Row).payload
		);
	});

	it('produces no second row and no second attempt when the event is redelivered', async () => {
		const { table, deliveries, consumer } = fanOut();
		const subscription = table.seed();

		await consumer.handle(envelope(), context());
		await consumer.handle(envelope(), context());

		expect(deliveries.rows).toHaveLength(1);
		// The attempt counter is the gate rather than whether this call created the row: a row that has
		// been attempted belongs to its own schedule, and calling it again from here would be an attempt
		// the ladder never scheduled.
		expect(deliveries.row(subscription.id, 'event-1')?.attemptCount).toBe(1);
	});

	it('makes the first attempt at a row an earlier pass created but never called', async () => {
		const { table, deliveries, consumer } = fanOut();
		const subscription = table.seed();

		// The state a pass that died between the insert and the call leaves behind: the endpoint is owed
		// a call that nothing has made, and the row says so.
		await deliveries.enqueue({ subscriptionId: subscription.id, eventId: 'event-1', eventName: 'order.placed' });

		await consumer.handle(envelope(), context());

		expect(deliveries.row(subscription.id, 'event-1')).toMatchObject({
			attemptCount: 1,
			status: WebhookDeliveryStatus.DELIVERED
		});
	});
});

describe('WebhookOutboxConsumer — what it raises and what it does not', () => {
	it('leaves a refused attempt to the delivery row’s own schedule', async () => {
		const { table, deliveries, consumer } = fanOut();
		const refusing = table.seed();
		const healthy = table.seed();

		deliveries.refusing.add(refusing.id);

		await expect(consumer.handle(envelope(), context())).resolves.toBeUndefined();

		// Raising would return the whole event to the outbox ladder and, on the next pass, produce a
		// second attempt against the endpoint that had already accepted it — two schedules for one
		// delivery, which is what `nextAttemptAt` exists to prevent.
		expect(deliveries.row(refusing.id, 'event-1')).toMatchObject({
			status: WebhookDeliveryStatus.FAILED,
			nextAttemptAt: new Date('2026-03-01T10:00:05.000Z')
		});
		expect(deliveries.row(healthy.id, 'event-1')?.status).toBe(WebhookDeliveryStatus.DELIVERED);
	});

	it('keeps an unmakeable attempt from costing the other endpoints theirs', async () => {
		const { table, deliveries, consumer } = fanOut();
		const broken = table.seed();
		const healthy = table.seed();

		deliveries.unreachable.add(broken.id);

		await expect(consumer.handle(envelope(), context())).resolves.toBeUndefined();

		// The row exists and is due, so the endpoint is still owed its call; what failed is this attempt
		// rather than the fan-out, and it is recorded in the log an operator reads.
		expect(deliveries.row(broken.id, 'event-1')?.status).toBe(WebhookDeliveryStatus.PENDING);
		expect(deliveries.row(healthy.id, 'event-1')?.status).toBe(WebhookDeliveryStatus.DELIVERED);
		expect(failure).toHaveBeenCalled();
	});

	it('raises a delivery it could not record, because an endpoint with no row is never called', async () => {
		const { table, deliveries, consumer } = fanOut();
		const subscription = table.seed();

		deliveries.unwritable.add(subscription.id);

		// This is a fan-out failure rather than an attempt's: the event has to come back round the outbox
		// ladder, because nothing else would ever create the row.
		await expect(consumer.handle(envelope(), context())).rejects.toThrow(/could not serialize access/);
	});
});

describe('WebhookOutboxConsumer — how it declares itself', () => {
	it('registers with the dispatcher under the outbound namespace', () => {
		const { registry, consumer } = fanOut();

		consumer.onModuleInit();

		// `webhook:fan-out` is the key an operator filters the delivery ledger by, and the one key under
		// that namespace that is not a subscription identifier — because the fan-out is the step before a
		// subscription has been chosen.
		expect(EventConsumerRegistry.consumerKeyOf(consumer)).toBe('webhook:fan-out');
		expect(registry.consumersFor('order.placed')).toContain(consumer);
		expect(consumer.key).toBe(WEBHOOK_OUTBOX_CONSUMER_KEY);
		expect(consumer.kind).toBe(EventConsumerKind.WEBHOOK);
	});

	it('is reorderable, so one unreachable partner does not hold an aggregate’s queue', () => {
		const { consumer } = fanOut();

		// A strict fan-out would hold the head of a partition — and with it the search index and the
		// subscription surface — behind an outside system with its own availability.
		expect(consumer.ordering).toBe(EventConsumerOrdering.REORDERABLE);
	});

	it('is dispatched the events the stream refuses as well as the ones it offers', () => {
		const { registry, consumer } = fanOut();

		consumer.onModuleInit();

		// The catalogue leaves these out because a stream is the wrong medium for their rate, and says in
		// as many words that they remain available through webhooks. A fan-out reading the streamed
		// catalogue alone would quietly turn "not streamable" into "not deliverable".
		for (const name of NON_SUBSCRIBABLE_EVENT_NAMES) {
			expect(registry.consumersFor(name)).toContain(consumer);
		}
	});

	it('is dispatched an event a package declares after it registered', () => {
		const { registry, catalogue, consumer } = fanOut();

		consumer.onModuleInit();

		expect(registry.consumersFor('payment.captured')).toEqual([]);

		catalogue.declare('payment.captured');

		// The registry holds the consumer and reads its events on every pass, so a package that bootstraps
		// after this module is still fanned out — without a second registration.
		expect(registry.consumersFor('payment.captured')).toContain(consumer);
	});

	it('does not register when there is no dispatcher to register with', () => {
		const table = new SubscriptionTable();
		const catalogue = new SubscriptionCatalogue();

		catalogue.declare('order.placed');

		const consumer = new WebhookOutboxConsumer(
			new WebhookSubscriptionService(
				table as unknown as TypeOrmWebhookSubscriptionRepository,
				{} as never,
				{} as never,
				{} as never
			),
			{} as never,
			catalogue
		);

		// A process that hosts no outbox runtime dispatches nothing, so there is nothing to register with
		// — and the boot succeeds rather than failing on a provider the deployment deliberately omitted.
		expect(consumer.register()).toBe(false);
		expect(() => consumer.onModuleInit()).not.toThrow();
	});
});
