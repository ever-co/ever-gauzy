import { validateSync } from 'class-validator';
import {
	EventConsumerKind,
	EventConsumerOrdering,
	EventOutboxStatus,
	IEventConsumer,
	IEventConsumerContext,
	IEventEnvelope
} from '@gauzy/contracts';
import { EventDelivery } from './event-delivery.entity';
import { EventConsumerRegistry, EventConsumerRunOutcome, EventOrderGapError } from './event-consumer.registry';
import { EventOutboxService } from './event-outbox.service';

/**
 * The consumer registry and the delivery record that makes a consumer safe to write naively.
 *
 * A consumer is invoked at most once per event, and a strict consumer refuses an event whose
 * predecessor has not been delivered rather than processing it and hoping the earlier one arrives
 * afterwards. Both properties belong to the record, not to the consumer, so they are asserted here
 * against a ledger that keeps the same `(eventId, consumerKey)` identity the table is declared with.
 */

type Row = Record<string, any>;

/** A delivery ledger that behaves like the delivery table for the operations the registry uses. */
class DeliveryLedger {
	readonly records: Row[] = [];

	async claimDelivery(input: { eventId: string; consumerKey: string; partitionKey?: string; sequence?: number }) {
		const existing = this.records.find(
			(record) => record.eventId === input.eventId && record.consumerKey === input.consumerKey
		);

		if (existing) {
			if (existing.status === EventOutboxStatus.PUBLISHED) {
				return { claimed: false, delivery: existing };
			}

			existing.attemptCount += 1;

			return { claimed: true, delivery: { ...existing } };
		}

		const record = {
			id: `delivery-${this.records.length + 1}`,
			eventId: input.eventId,
			consumerKey: input.consumerKey,
			partitionKey: input.partitionKey,
			sequence: input.sequence,
			status: EventOutboxStatus.PENDING,
			attemptCount: 0
		};

		this.records.push(record);

		return { claimed: true, delivery: record };
	}

	async completeDelivery(id: string, outcome: { delivered: boolean; error?: unknown; maxAttempts?: number }) {
		const record = this.records.find((entry) => entry.id === id);

		if (!record) {
			return null;
		}

		if (outcome.delivered) {
			record.status = EventOutboxStatus.PUBLISHED;
			record.deliveredAt = new Date('2026-03-01T10:00:00Z');
		} else {
			record.status =
				record.attemptCount >= (outcome.maxAttempts ?? 8) ? EventOutboxStatus.DEAD : EventOutboxStatus.FAILED;
			record.lastError = outcome.error instanceof Error ? outcome.error.message : String(outcome.error);
		}

		return record;
	}

	async findDeliveryById(id: string) {
		return this.records.find((entry) => entry.id === id) ?? null;
	}

	async findLastDeliveredSequence(consumerKey: string, partitionKey: string) {
		const sequences = this.records
			.filter(
				(record) =>
					record.consumerKey === consumerKey &&
					record.partitionKey === partitionKey &&
					record.status === EventOutboxStatus.PUBLISHED
			)
			.map((record) => Number(record.sequence ?? 0));

		return sequences.length ? Math.max(...sequences) : 0;
	}
}

/** One event, as a consumer receives it. */
const event = (overrides: Partial<IEventEnvelope> = {}): IEventEnvelope => ({
	id: 'event-1',
	name: 'order.placed',
	version: 1,
	occurredAt: new Date('2026-03-01T10:00:00Z'),
	aggregate: { type: 'Order', id: '6b1e0f2a-0000-4000-8000-000000000001' },
	sequence: 1,
	partitionKey: 'Order:6b1e0f2a-0000-4000-8000-000000000001',
	producer: 'order',
	data: { orderId: 'order-1' },
	...overrides
});

/** One consumer, with a handle that counts its invocations. */
function consumer(overrides: Partial<IEventConsumer> & { handle?: IEventConsumer['handle'] } = {}) {
	const invocations: IEventEnvelope[] = [];
	const built: IEventConsumer = {
		key: 'notification.order-confirmation',
		events: ['order.placed'],
		async handle(received) {
			invocations.push(received);
		},
		...overrides
	};

	return { consumer: built, invocations };
}

/** The registry under test, with the ledger it records through. */
function registry() {
	const ledger = new DeliveryLedger();
	const service = new EventConsumerRegistry(ledger as unknown as EventOutboxService);

	return { service, ledger };
}

describe('registering a consumer', () => {
	it('namespaces a consumer key by its kind, so a subscriber, a job and an endpoint cannot collide', () => {
		expect(EventConsumerRegistry.consumerKeyOf({ key: 'x', events: ['a'] } as IEventConsumer)).toBe('subscriber:x');
		expect(
			EventConsumerRegistry.consumerKeyOf({ key: 'x', kind: EventConsumerKind.JOB, events: ['a'] } as IEventConsumer)
		).toBe('job:x');
		expect(
			EventConsumerRegistry.consumerKeyOf({
				key: 'sub-1',
				kind: EventConsumerKind.WEBHOOK,
				events: ['a']
			} as IEventConsumer)
		).toBe('webhook:sub-1');
	});

	it('refuses a declaration it could not honour', () => {
		const { service } = registry();

		expect(() => service.register({ events: ['order.placed'] } as unknown as IEventConsumer)).toThrow(/must declare a key/);
		expect(() => service.register({ key: 'a', events: [] } as unknown as IEventConsumer)).toThrow(/declares no events/);
		expect(() => service.register({ key: 'a', events: 'order.placed' } as unknown as IEventConsumer)).toThrow(
			/declares no events/
		);
	});

	it('accepts a module loaded twice and refuses a second consumer behind one key', () => {
		const { service } = registry();
		const { consumer: first } = consumer();

		service.register(first);
		expect(() => service.register(first)).not.toThrow();
		// Two consumers behind one delivery record would silently halve each other's work.
		expect(() => service.register(consumer().consumer)).toThrow(/already registered/);
		// The same key under another kind is another consumer, because the kind is part of the key.
		expect(() =>
			service.register({ key: 'notification.order-confirmation', kind: EventConsumerKind.JOB, events: ['order.placed'], handle: async () => undefined })
		).not.toThrow();
		expect(service.list()).toHaveLength(2);
	});

	it('selects the consumers an event name is registered to, and unregisters by either spelling', () => {
		const { service } = registry();
		const orders = consumer();
		const invoices = consumer({ key: 'notification.invoice-issued', events: ['invoice.issued'] });

		service.register(orders.consumer);
		service.register(invoices.consumer);

		expect(service.consumersFor('order.placed')).toEqual([orders.consumer]);
		expect(service.consumersFor('order.canceled')).toEqual([]);

		service.unregister('notification.order-confirmation');
		expect(service.consumersFor('order.placed')).toEqual([]);
		expect(service.list()).toEqual([invoices.consumer]);

		service.unregister('job:nothing-registered-here');
		expect(service.list()).toHaveLength(1);
	});

	it('writes a delivery row the table it is stored as would accept', () => {
		const { consumer: subscriber } = consumer();
		const row = () =>
			Object.assign(new EventDelivery(), {
				eventId: '6b1e0f2a-0000-4000-8000-000000000001',
				consumerKey: EventConsumerRegistry.consumerKeyOf(subscriber),
				status: EventOutboxStatus.PENDING,
				attemptCount: 0
			});

		expect(validateSync(row()).map((error) => error.property)).toEqual([]);
		// Control: the delivery row reuses the outbox vocabulary, so a status outside it is refused
		// rather than stored — which is what keeps one retry policy covering both tables.
		expect(validateSync(Object.assign(row(), { status: 'SKIPPED' })).map((error) => error.property)).toEqual(['status']);
		expect(validateSync(Object.assign(row(), { attemptCount: -1 })).map((error) => error.property)).toEqual([
			'attemptCount'
		]);
	});
});

describe('running a consumer exactly once per event', () => {
	it('invokes the consumer, records the acknowledgement, and never invokes it again', async () => {
		const { service, ledger } = registry();
		const { consumer: subscriber, invocations } = consumer();

		service.register(subscriber);

		const first = await service.runOnce(subscriber, event());
		const second = await service.runOnce(subscriber, event());

		// Control: the record is written before the consumer is invoked, which is what makes
		// at-least-once dispatch an at-most-once effect without any bookkeeping in the consumer.
		expect(first.outcome).toBe(EventConsumerRunOutcome.DELIVERED);
		expect(second.outcome).toBe(EventConsumerRunOutcome.ALREADY_DELIVERED);
		expect(invocations).toHaveLength(1);
		expect(ledger.records).toHaveLength(1);
		expect(ledger.records[0].status).toBe(EventOutboxStatus.PUBLISHED);
	});

	it('records a failure against the consumer and hands the event over again', async () => {
		const { service, ledger } = registry();
		const attempts: number[] = [];
		const subscriber: IEventConsumer = {
			key: 'notification.order-confirmation',
			events: ['order.placed'],
			maxAttempts: 3,
			async handle(): Promise<void> {
				attempts.push(attempts.length + 1);

				throw new Error('the mail relay refused the message');
			}
		};

		service.register(subscriber);

		const failed = await service.runOnce(subscriber, event());
		const retried = await service.runOnce(subscriber, event());

		expect(failed.outcome).toBe(EventConsumerRunOutcome.FAILED);
		expect(failed.error).toBe('the mail relay refused the message');
		expect(ledger.records[0].status).toBe(EventOutboxStatus.FAILED);
		// A consumer that threw did not acknowledge the event, so the record stays claimable.
		expect(retried.outcome).toBe(EventConsumerRunOutcome.FAILED);
		expect(retried.delivery.attemptCount).toBe(1);
		expect(attempts).toEqual([1, 2]);
	});

	it('lets a consumer mark itself delivered, and makes marking twice harmless', async () => {
		const { service, ledger } = registry();
		const seen: IEventConsumerContext[] = [];
		const subscriber: IEventConsumer = {
			key: 'notification.order-confirmation',
			events: ['order.placed'],
			async handle(_received, context): Promise<void> {
				seen.push(context);

				expect(await context.alreadyDelivered()).toBe(false);
				await context.markDelivered();
				await context.markDelivered();
				expect(await context.alreadyDelivered()).toBe(true);
			}
		};

		service.register(subscriber);
		const run = await service.runOnce(subscriber, event());

		expect(run.outcome).toBe(EventConsumerRunOutcome.DELIVERED);
		expect(ledger.records[0].status).toBe(EventOutboxStatus.PUBLISHED);
		expect(seen).toHaveLength(1);
	});
});

describe('the consumer-side order gate', () => {
	/** A strict consumer that asserts the order of what it is handed. */
	const strict = (): IEventConsumer => ({
		key: 'projection.order',
		events: ['order.placed', 'order.confirmed'],
		ordering: EventConsumerOrdering.STRICT,
		async handle(received, context): Promise<void> {
			await context.assertOrder(received);
		}
	});

	it('refuses an event whose predecessor has not been delivered', async () => {
		const { service } = registry();
		const subscriber = strict();

		service.register(subscriber);

		// Sequence 1 arrives first, so the gate is satisfied.
		expect((await service.runOnce(subscriber, event({ id: 'event-1', sequence: 1 }))).outcome).toBe(
			EventConsumerRunOutcome.DELIVERED
		);

		const gap = await service.runOnce(subscriber, event({ id: 'event-3', sequence: 3 }));

		expect(gap.outcome).toBe(EventConsumerRunOutcome.FAILED);
		expect(gap.error).toContain('received sequence 3');
		expect(gap.delivery.status).toBe(EventOutboxStatus.FAILED);
	});

	it('reports a gap as a failure a caller can branch on', async () => {
		const { service } = registry();
		const subscriber = strict();

		service.register(subscriber);

		const gap = await service.runOnce(subscriber, event({ id: 'event-2', sequence: 2 }));

		expect(gap.error).toContain('only 0 was delivered');
		expect(new EventOrderGapError('projection.order', 'Order:1', 0, 2)).toMatchObject({
			name: 'EventOrderGapError',
			consumerKey: 'projection.order',
			partitionKey: 'Order:1',
			lastDeliveredSequence: 0,
			receivedSequence: 2
		});
	});

	it('lets a reorderable consumer through, and does not gate an event that carries no sequence', async () => {
		const { service } = registry();
		const reorderable: IEventConsumer = {
			key: 'projection.reorderable',
			events: ['order.placed'],
			ordering: EventConsumerOrdering.REORDERABLE,
			async handle(received, context): Promise<void> {
				await context.assertOrder(received);
			}
		};
		const strictConsumer = strict();

		service.register(reorderable);
		service.register(strictConsumer);

		// A reorderable consumer declared it tolerates reordering, so it skips the check entirely.
		expect((await service.runOnce(reorderable, event({ id: 'event-9', sequence: 9 }))).outcome).toBe(
			EventConsumerRunOutcome.DELIVERED
		);

		// An event with no partition carries no ordering promise, so there is nothing to compare.
		expect(
			(await service.runOnce(strictConsumer, event({ id: 'event-10', sequence: undefined, partitionKey: undefined })))
				.outcome
		).toBe(EventConsumerRunOutcome.DELIVERED);
	});
});
