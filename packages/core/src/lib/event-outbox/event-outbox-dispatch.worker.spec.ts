/**
 * The dispatch pass: the schedule that asks for it and the worker that drains the outbox.
 *
 * `append` writes an event in the caller's transaction and publishes nothing, which is the whole
 * point of an outbox — and which makes this pair the only reason a stored event ever reaches anyone.
 * Nothing else in the kernel notices its absence: the writer's transaction commits, the row is
 * exactly as promised, and every consumer is silent. So what this suite pins is not that the worker
 * calls the service, but what state the rows and the delivery ledger are left in:
 *
 * - **an event nobody consumes is published, not retried**, because a row that climbed its attempt
 *   counter until it dead-lettered would fill the dead-letter listing an operator reads with events
 *   whose only fault is that this installation has no consumer for them;
 * - **every consumer of one event is run, and one that throws costs the others nothing** — a pass
 *   that stopped at the first failure would deliver consumers in registration order and no further;
 * - **a row is published only once every consumer has settled**, and on the pass after a failure only
 *   the consumer that is still owed the event is invoked again: the delivery record, not the worker,
 *   is what makes the other one a no-op;
 * - **a consumer whose budget is spent stops holding the row**, because re-claiming a dead-lettered
 *   record on every pass would invoke a consumer the platform has already given up on, forever;
 * - **a pass that could not claim is raised and a row that could not be moved is not**, which are
 *   different recoveries: the first is the queue's to retry, the second the row's own lease.
 *
 * The registry under test is the real one, over a ledger that keeps the `(eventId, consumerKey)`
 * identity the delivery table is declared with — so "at most once per consumer" is exercised rather
 * than asserted about a mock. The queue is not stood up, so the worker is the only thing driving it.
 */

/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — see
 * `../channel/channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined
 * when the entity applies it if the graph is entered through the validators rather than the entities.
 * The worker's constructor reaches `EventOutboxService`, which reaches the crud layer.
 */
import '../core/entities/internal';

import { AsyncLocalStorage } from 'node:async_hooks';
import { Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import type { Job } from 'bullmq';
import {
	EventConsumerKind,
	EventOutboxStatus,
	ID,
	IEventConsumer,
	IEventConsumerContext,
	IEventEnvelope
} from '@gauzy/contracts';
import {
	EVENT_OUTBOX_COMMIT_PASS_LIMIT,
	EVENT_OUTBOX_DISPATCH_BATCH_SIZE,
	EVENT_OUTBOX_DISPATCH_JOB,
	EVENT_OUTBOX_DISPATCH_LEASE_MS,
	EVENT_OUTBOX_DISPATCH_ON_COMMIT_ENV,
	EVENT_OUTBOX_DISPATCH_SCHEDULE,
	EVENT_OUTBOX_QUEUE_NAME
} from './event-outbox-constant';
import { EventOutboxCommitSignal } from './event-outbox-commit.signal';
import { EventConsumerRegistry } from './event-consumer.registry';
import { EventOutboxDispatchScheduler } from './event-outbox-dispatch.scheduler';
import { EventOutboxDispatchWorker, EventOutboxRowOutcome } from './event-outbox-dispatch.worker';
import type { IEventOutboxDispatchJob } from './event-outbox-dispatch.worker';
import { describeFailure, EventOutboxService } from './event-outbox.service';

/**
 * The metadata keys the declarations under test are written under.
 *
 * `SCHEDULED_JOB_METADATA` and `QUEUE_JOB_HANDLER_METADATA` live in the scheduler package's own
 * `constants/scheduler.constants.ts`, which its barrel does not re-export, so they are stated as text
 * here. Reading the metadata rather than the decorator's arguments is the point — the decorator is
 * applied at load and only what it wrote is what a discovery pass would read — and a wrong key
 * surfaces as `undefined` at the assertion below rather than as a pass.
 */
const SCHEDULED_JOB_METADATA = 'gauzy:scheduler:job';
const QUEUE_JOB_HANDLER_METADATA = 'gauzy:scheduler:queue-job-handler';

/** The key `@nestjs/bullmq`'s `Processor` — which the scheduler's `QueueWorker` is — writes the queue under. */
const PROCESSOR_METADATA = 'bullmq:processor_metadata';

type Row = Record<string, any>;

/** The lines the worker wrote about a pass. */
let log: jest.SpyInstance;
/** The lines the worker wrote about a consumer the platform has given up on. */
let warn: jest.SpyInstance;
/** The lines the worker wrote about something it could not do. */
let failure: jest.SpyInstance;

beforeEach(() => {
	log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	failure = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
	jest.restoreAllMocks();
});

/** The lines the worker logged, joined so a case can read the pass's own report. */
function logged(): string {
	return log.mock.calls.map((call) => String(call[0])).join('\n');
}

/**
 * The outbox and the delivery ledger, behaving like the tables they stand in for.
 *
 * Only the terminal rules are mirrored, not the ladder: what this suite is about is which of the
 * service's two answers the worker asks for and what the ledger looks like afterwards, and a copy of
 * the backoff arithmetic here would assert the copy rather than the worker. The delivery half keeps
 * the `(eventId, consumerKey)` identity the table is declared with, because that identity is what
 * makes the second pass below a no-op for the consumer that already succeeded.
 */
class Ledger {
	readonly rows: Row[] = [];
	readonly deliveries: Row[] = [];
	/** Every policy a pass claimed with, so a case can read the bounds the worker stated. */
	readonly claims: Array<Record<string, unknown>> = [];
	/** Row ids whose `markPublished` the store refuses, so a case can strand one row of a batch. */
	readonly refuseToPublish = new Set<string>();
	/** The service's commit signal, which the worker listens to for its pass after a commit. */
	readonly commitSignal = new EventOutboxCommitSignal();

	private sequence = 0;

	/** Seeds one appended event, as `append` would leave it. */
	append(input: Partial<Row> = {}): Row {
		this.sequence += 1;

		const row: Row = {
			id: `outbox-${this.sequence}`,
			eventId: `event-${this.sequence}`,
			eventName: 'order.placed',
			aggregateType: 'order',
			aggregateId: `order-${this.sequence}`,
			payload: { total: 100 },
			headers: {},
			status: EventOutboxStatus.PENDING,
			attemptCount: 0,
			availableAt: new Date('2026-03-01T10:00:00.000Z'),
			createdAt: new Date('2026-03-01T09:59:00.000Z'),
			partitionKey: `order:order-${this.sequence}`,
			sequence: 1,
			tenantId: 'tenant-1',
			organizationId: 'organization-1',
			...input
		};

		this.rows.push(row);

		return row;
	}

	/** The row a case reads back, by the id it was seeded with. */
	row(id: string): Row {
		return this.rows.find((entry) => entry.id === id) as Row;
	}

	/** The delivery record of one `(event, consumer)` pair, or undefined when it was never claimed. */
	delivery(eventId: string, consumerKey: string): Row | undefined {
		return this.deliveries.find((entry) => entry.eventId === eventId && entry.consumerKey === consumerKey);
	}

	// --- what the worker asks the service for -------------------------------------------------

	async claimBatch(policy: { batchSize?: number; leaseMs?: number } = {}): Promise<Row[]> {
		this.claims.push({ ...policy });

		const claimable = this.rows.filter(
			(row) => row.status === EventOutboxStatus.PENDING || row.status === EventOutboxStatus.FAILED
		);
		const claimed = claimable.slice(0, policy.batchSize ?? EventOutboxService.DEFAULT_BATCH_SIZE);

		for (const row of claimed) {
			row.attemptCount += 1;
		}

		return claimed;
	}

	toEnvelope(row: Row): IEventEnvelope {
		return {
			id: row.eventId,
			name: row.eventName,
			version: EventOutboxService.PAYLOAD_VERSION,
			occurredAt: row.createdAt,
			tenantId: row.tenantId,
			organizationId: row.organizationId,
			channelId: row.headers?.channelId,
			aggregate: { type: row.aggregateType, id: row.aggregateId },
			sequence: row.sequence,
			partitionKey: row.partitionKey,
			producer: String(row.eventName).split('.')[0],
			data: row.payload
		};
	}

	async markPublished(id: ID): Promise<Row | null> {
		if (this.refuseToPublish.has(String(id))) {
			throw new Error('could not serialize access due to concurrent update');
		}

		const row = this.row(String(id));

		if (!row) {
			return null;
		}

		Object.assign(row, {
			status: EventOutboxStatus.PUBLISHED,
			publishedAt: new Date('2026-03-01T10:00:01.000Z'),
			lastError: null
		});

		return row;
	}

	async markFailed(id: ID, error: unknown): Promise<Row | null> {
		const row = this.row(String(id));

		if (!row) {
			return null;
		}

		// The service dead-letters once the budget is spent and reschedules otherwise; the budget is
		// the service's own constant so a case that exhausts it exhausts the documented one.
		Object.assign(row, {
			status:
				row.attemptCount >= EventOutboxService.DEFAULT_MAX_ATTEMPTS
					? EventOutboxStatus.DEAD
					: EventOutboxStatus.FAILED,
			lastError: describeFailure(error)
		});

		return row;
	}

	// --- what `EventConsumerRegistry` asks the service for -------------------------------------

	async claimDelivery(input: {
		eventId: ID;
		consumerKey: string;
		partitionKey?: string;
		sequence?: number;
		tenantId?: ID;
		organizationId?: ID;
	}) {
		const existing = this.delivery(String(input.eventId), input.consumerKey);

		if (existing) {
			if (existing.status === EventOutboxStatus.PUBLISHED) {
				return { claimed: false, delivery: existing };
			}

			existing.attemptCount += 1;

			return { claimed: true, delivery: { ...existing } };
		}

		const record: Row = {
			id: `delivery-${this.deliveries.length + 1}`,
			eventId: input.eventId,
			consumerKey: input.consumerKey,
			partitionKey: input.partitionKey,
			sequence: input.sequence,
			status: EventOutboxStatus.PENDING,
			attemptCount: 0,
			// The scope the claim stated, which in a queue worker is the event's rather than a request's.
			tenantId: input.tenantId ?? null,
			organizationId: input.organizationId ?? null
		};

		this.deliveries.push(record);

		return { claimed: true, delivery: record };
	}

	async completeDelivery(id: ID, outcome: { delivered: boolean; error?: unknown; maxAttempts?: number }) {
		const record = this.deliveries.find((entry) => entry.id === id);

		if (!record) {
			return null;
		}

		if (outcome.delivered) {
			Object.assign(record, { status: EventOutboxStatus.PUBLISHED, deliveredAt: new Date(), lastError: null });
		} else {
			Object.assign(record, {
				status:
					record.attemptCount >= (outcome.maxAttempts ?? EventOutboxService.DEFAULT_CONSUMER_MAX_ATTEMPTS)
						? EventOutboxStatus.DEAD
						: EventOutboxStatus.FAILED,
				lastError: describeFailure(outcome.error)
			});
		}

		return record;
	}

	async findDeliveryById(id: ID) {
		return this.deliveries.find((entry) => entry.id === id) ?? null;
	}

	async findLastDeliveredSequence(consumerKey: string, partitionKey: string): Promise<number> {
		const settled = this.deliveries.filter(
			(entry) =>
				entry.consumerKey === consumerKey &&
				entry.partitionKey === partitionKey &&
				(entry.status === EventOutboxStatus.PUBLISHED || entry.status === EventOutboxStatus.DEAD)
		);

		return settled.reduce((highest, entry) => Math.max(highest, Number(entry.sequence ?? 0)), 0);
	}
}

/** The queued request, named as the kernel names it. */
function queued(requestedAt = '2026-03-01T10:00:00.000Z'): Job<IEventOutboxDispatchJob> {
	return { name: EVENT_OUTBOX_DISPATCH_JOB, data: { requestedAt } } as Job<IEventOutboxDispatchJob>;
}

/** A consumer that records what it was handed. */
function consumer(
	key: string,
	handle: (event: IEventEnvelope, context: IEventConsumerContext) => Promise<void>,
	overrides: Partial<IEventConsumer> = {}
): IEventConsumer & { seen: IEventEnvelope[] } {
	const seen: IEventEnvelope[] = [];
	const declared: IEventConsumer & { seen: IEventEnvelope[] } = {
		key,
		kind: EventConsumerKind.SUBSCRIBER,
		events: ['order.placed'],
		seen,
		async handle(event: IEventEnvelope, context: IEventConsumerContext): Promise<void> {
			seen.push(event);

			await handle(event, context);
		}
	};

	return Object.assign(declared, overrides);
}

/** The worker over the ledger, with the real registry between them. */
function dispatcher() {
	const ledger = new Ledger();
	const registry = new EventConsumerRegistry(ledger as unknown as EventOutboxService);
	const worker = new EventOutboxDispatchWorker(ledger as unknown as EventOutboxService, registry);

	return { ledger, registry, worker };
}

describe('EventOutboxDispatchWorker — one bounded pass', () => {
	it('claims one batch, bounded and leased by the kernel’s own constants', async () => {
		const { ledger, worker } = dispatcher();

		await worker.handleDispatch(queued());

		// Both bounds are stated rather than left to the service's defaults, and they are asserted
		// against the imported constants rather than against numbers repeated here.
		expect(ledger.claims).toEqual([
			{ batchSize: EVENT_OUTBOX_DISPATCH_BATCH_SIZE, leaseMs: EVENT_OUTBOX_DISPATCH_LEASE_MS }
		]);
		// Control: the lease has to outlive the period the schedule fires on, or the next pass reclaims
		// rows this one is still handing to consumers. One minute is that period.
		expect(EVENT_OUTBOX_DISPATCH_LEASE_MS).toBeGreaterThan(60_000);
	});

	it('reports an empty outbox as an empty outbox', async () => {
		const { worker } = dispatcher();

		await worker.handleDispatch(queued());

		expect(logged()).toContain('The event outbox had nothing due');
		// Control: nothing is reported as dispatched, which is the line a pass that found work writes.
		expect(logged()).not.toContain('Dispatched');
	});

	it('raises a pass that could not claim rather than reporting a drained outbox', async () => {
		const refusal = new Error('connection terminated unexpectedly');
		const { ledger, worker } = dispatcher();

		jest.spyOn(ledger, 'claimBatch').mockRejectedValue(refusal);

		await expect(worker.handleDispatch(queued())).rejects.toBe(refusal);
		// The queue's own retry and dead-letter handling is what sees a raised failure, and the rejection
		// is the store's own error rather than a message wrapped around it.
		expect(logged()).not.toContain('Dispatched');
		expect(failure).toHaveBeenCalled();
	});
});

describe('EventOutboxDispatchWorker — an event nobody consumes', () => {
	it('publishes the row rather than retrying it forever', async () => {
		const { ledger, worker } = dispatcher();
		const row = ledger.append();

		await worker.handleDispatch(queued());

		// Published, not failed: no consumer is registered for the name, which is a fact about this
		// deployment rather than a delivery that did not happen.
		expect(ledger.row(row.id).status).toBe(EventOutboxStatus.PUBLISHED);
		expect(ledger.row(row.id).lastError).toBeNull();
		// Control: nothing was invoked, so no delivery record was written for an event with no consumer.
		expect(ledger.deliveries).toHaveLength(0);
	});

	it('does not claim the row again on the next pass', async () => {
		const { ledger, worker } = dispatcher();

		ledger.append();

		await worker.handleDispatch(queued());
		await worker.handleDispatch(queued());

		// The row's status is what takes it out of the claim, so a published row costs the second pass
		// nothing — which is the difference between "published" and "retried on the ladder".
		expect(ledger.row('outbox-1').attemptCount).toBe(1);
		expect(logged()).toContain('The event outbox had nothing due');
	});
});

describe('EventOutboxDispatchWorker — every consumer of an event', () => {
	it('hands the row’s own envelope to each registered consumer and publishes once both settle', async () => {
		const { ledger, registry, worker } = dispatcher();
		const first = consumer('projection', async () => undefined);
		const second = consumer('notification', async () => undefined);
		const row = ledger.append();

		registry.register(first);
		registry.register(second);

		await worker.handleDispatch(queued());

		// The envelope is the row's, built once: the identity, the aggregate and the sequence a delivery
		// record and a replay both describe.
		for (const seen of [first.seen, second.seen]) {
			expect(seen).toHaveLength(1);
			expect(seen[0]).toMatchObject({
				id: row.eventId,
				name: 'order.placed',
				aggregate: { type: 'order', id: row.aggregateId },
				sequence: 1,
				partitionKey: row.partitionKey,
				tenantId: 'tenant-1'
			});
		}

		expect(ledger.row(row.id).status).toBe(EventOutboxStatus.PUBLISHED);
		expect(ledger.delivery(row.eventId, 'subscriber:projection')?.status).toBe(EventOutboxStatus.PUBLISHED);
		expect(ledger.delivery(row.eventId, 'subscriber:notification')?.status).toBe(EventOutboxStatus.PUBLISHED);
	});

	it('writes the event’s own scope onto each delivery record', async () => {
		const { ledger, registry, worker } = dispatcher();
		const row = ledger.append();

		registry.register(consumer('projection', async () => undefined));

		await worker.handleDispatch(queued());

		// A pass runs in a queue worker, where there is no request to take a tenant from — so a record
		// written without one would be invisible to the delivery listing and to the two operator moves
		// that are reached through it, which is the dead-letter runbook not working at all.
		expect(ledger.delivery(row.eventId, 'subscriber:projection')).toMatchObject({
			tenantId: 'tenant-1',
			organizationId: 'organization-1'
		});
	});

	it('ignores a consumer registered for another event name', async () => {
		const { ledger, registry, worker } = dispatcher();
		const wrong = consumer('shipment', async () => undefined, { events: ['shipment.dispatched'] });

		registry.register(wrong);
		ledger.append();

		await worker.handleDispatch(queued());

		// Control for the case above: the registry selects by name, so a consumer of a different event is
		// neither invoked nor able to hold the row open.
		expect(wrong.seen).toHaveLength(0);
		expect(ledger.row('outbox-1').status).toBe(EventOutboxStatus.PUBLISHED);
	});
});

describe('EventOutboxDispatchWorker — a consumer that throws', () => {
	it('costs the other consumers nothing and leaves the row unpublished', async () => {
		const { ledger, registry, worker } = dispatcher();
		const broken = consumer('projection', async () => {
			throw new Error('the projection store rejected the write');
		});
		const healthy = consumer('notification', async () => undefined);
		const row = ledger.append();

		registry.register(broken);
		registry.register(healthy);

		await worker.handleDispatch(queued());

		// The consumer registered *after* the failing one still received the event: a pass that stopped
		// at the first failure would deliver in registration order and no further.
		expect(healthy.seen).toHaveLength(1);
		expect(ledger.delivery(row.eventId, 'subscriber:notification')?.status).toBe(EventOutboxStatus.PUBLISHED);

		// The failure is the failing consumer's record, and the row is returned to the ladder rather than
		// published — publishing it would be the platform reporting a delivery that did not happen.
		expect(ledger.delivery(row.eventId, 'subscriber:projection')?.status).toBe(EventOutboxStatus.FAILED);
		expect(ledger.row(row.id).status).toBe(EventOutboxStatus.FAILED);
		// The diagnosis an operator reads names who is still owed the event and why.
		expect(String(ledger.row(row.id).lastError)).toContain('subscriber:projection');
		expect(String(ledger.row(row.id).lastError)).toContain('the projection store rejected the write');
	});

	it('re-invokes only the consumer that is still owed the event', async () => {
		const { ledger, registry, worker } = dispatcher();
		let refuse = true;
		const flaky = consumer('projection', async () => {
			if (refuse) {
				throw new Error('the projection store rejected the write');
			}
		});
		const healthy = consumer('notification', async () => undefined);
		const row = ledger.append();

		registry.register(flaky);
		registry.register(healthy);

		await worker.handleDispatch(queued());
		refuse = false;
		await worker.handleDispatch(queued());

		// At most once per consumer, and the delivery record is what enforces it: the consumer that
		// acknowledged the event on the first pass is not invoked again on the second.
		expect(healthy.seen).toHaveLength(1);
		expect(flaky.seen).toHaveLength(2);
		expect(ledger.row(row.id).status).toBe(EventOutboxStatus.PUBLISHED);
		expect(ledger.row(row.id).lastError).toBeNull();
	});

	it('does not stop the rest of the batch', async () => {
		const { ledger, registry, worker } = dispatcher();

		registry.register(
			consumer('projection', async (event) => {
				if (event.aggregate.id === 'order-1') {
					throw new Error('the projection store rejected the write');
				}
			})
		);

		const first = ledger.append();
		const second = ledger.append();

		await worker.handleDispatch(queued());

		expect(ledger.row(first.id).status).toBe(EventOutboxStatus.FAILED);
		expect(ledger.row(second.id).status).toBe(EventOutboxStatus.PUBLISHED);
		expect(logged()).toContain('Dispatched 2 event(s): 1 published, 1 retrying, 0 unresolved');
	});
});

describe('EventOutboxDispatchWorker — a consumer the platform has given up on', () => {
	it('settles the row once the consumer’s own budget is spent, and stops invoking it', async () => {
		const { ledger, registry, worker } = dispatcher();
		// A budget of one, so the second attempt is the one that exhausts it: `claimDelivery` counts the
		// re-claim, and `completeDelivery` dead-letters once the count has reached the budget.
		const doomed = consumer(
			'projection',
			async () => {
				throw new Error('the projection store rejected the write');
			},
			{ maxAttempts: 1 }
		);
		const row = ledger.append();

		registry.register(doomed);

		await worker.handleDispatch(queued());
		expect(ledger.delivery(row.eventId, 'subscriber:projection')?.status).toBe(EventOutboxStatus.FAILED);
		expect(ledger.row(row.id).status).toBe(EventOutboxStatus.FAILED);

		await worker.handleDispatch(queued());

		// The record is terminal, and the order gate already counts this position as resolved — so the
		// row is settled rather than held open. A worker that treated a dead letter as a failure would
		// re-claim this record on every pass and invoke a consumer nothing is waiting for, forever.
		expect(ledger.delivery(row.eventId, 'subscriber:projection')?.status).toBe(EventOutboxStatus.DEAD);
		expect(ledger.row(row.id).status).toBe(EventOutboxStatus.PUBLISHED);
		expect(warn).toHaveBeenCalled();

		await worker.handleDispatch(queued());

		// Control: the published row is not claimed again, so the dead-lettered consumer is invoked twice
		// in total and never again.
		expect(doomed.seen).toHaveLength(2);
	});
});

describe('EventOutboxDispatchWorker — a row that could not be moved', () => {
	it('leaves it for its lease and finishes the rest of the batch', async () => {
		const { ledger, registry, worker } = dispatcher();

		registry.register(consumer('projection', async () => undefined));

		const stranded = ledger.append();
		const healthy = ledger.append();

		ledger.refuseToPublish.add(stranded.id);

		await worker.handleDispatch(queued());

		// The pass does not raise: the row carries its own recovery — the lease it was claimed under
		// expires — and one row the store refused must not cost the rest of the batch its turn.
		expect(ledger.row(healthy.id).status).toBe(EventOutboxStatus.PUBLISHED);
		expect(ledger.row(stranded.id).status).toBe(EventOutboxStatus.PENDING);
		expect(logged()).toContain('Dispatched 2 event(s): 1 published, 0 retrying, 1 unresolved');
		expect(failure).toHaveBeenCalled();
	});

	it('counts the three outcomes apart', () => {
		// The three are different recoveries, not three words for one: a retrying row is on the service's
		// ladder, an unresolved one is waiting out a lease, and a published one is done.
		expect(
			new Set([
				EventOutboxRowOutcome.PUBLISHED,
				EventOutboxRowOutcome.RETRYING,
				EventOutboxRowOutcome.UNRESOLVED
			]).size
		).toBe(3);
	});
});

describe('EventOutboxDispatchWorker — the job name it answers is the schedule’s', () => {
	/** The schedule's own declaration, as the discovery pass reads it. */
	function scheduleOf(handler: string) {
		const declared = EventOutboxDispatchScheduler.prototype as unknown as Record<string, object>;

		return Reflect.getMetadata(SCHEDULED_JOB_METADATA, declared[handler]);
	}

	it('declares the queue and the queue job the worker consumes, as the kernel’s constants state them', () => {
		// The two names are different things on purpose: the first is what the scheduler fires, the
		// second is what a worker consumes and what a queue dashboard shows. Both are read against the
		// imported constants rather than against a copy of the same text, because a drifted name is a
		// pass that never runs with nothing red anywhere.
		expect(scheduleOf('enqueueDispatch')).toMatchObject({
			name: EVENT_OUTBOX_DISPATCH_SCHEDULE,
			queueName: EVENT_OUTBOX_QUEUE_NAME,
			queueJobName: EVENT_OUTBOX_DISPATCH_JOB
		});
	});

	it('declares that job name on the handler that runs the pass', () => {
		expect(
			Reflect.getMetadata(QUEUE_JOB_HANDLER_METADATA, EventOutboxDispatchWorker.prototype.handleDispatch)
		).toBe(EVENT_OUTBOX_DISPATCH_JOB);
	});

	it('registers the worker on the queue the schedule enqueues into', () => {
		// A worker listening on another queue would never be handed the job, which is the same silent
		// failure as a drifted job name and is caught the same way.
		expect(Reflect.getMetadata(PROCESSOR_METADATA, EventOutboxDispatchWorker)).toEqual({
			name: EVENT_OUTBOX_QUEUE_NAME
		});
	});

	it('routes the queued job to the pass through the worker’s own dispatch', async () => {
		const { ledger, worker } = dispatcher();

		await worker.process(queued());

		expect(ledger.claims).toHaveLength(1);
		// Control: the dispatch answers the name the worker declared and no other — without this, the
		// assertion above would also pass against a worker that ran the pass for every job it was handed.
		await expect(worker.process({ name: 'event-outbox.dispatch.other' } as Job)).rejects.toThrow(
			/No handler found/
		);
	});

	it('fires every minute and refuses to overlap, because an outbox is a transport and not a nightly batch', () => {
		// An hourly sweep is right for a retention table and wrong for this one: an event delivered an
		// hour late is a subscription that looks broken and a partner that has already timed out. Overlap
		// is refused because two passes would spend their batches on each other's rows and count attempts
		// against events that never failed.
		expect(scheduleOf('enqueueDispatch')).toMatchObject({
			cron: CronExpression.EVERY_MINUTE,
			preventOverlap: true
		});
	});

	it('announces the request it queued', async () => {
		const scheduler = new EventOutboxDispatchScheduler();

		const answer = await scheduler.enqueueDispatch();

		// The instant travels to the worker as the job's data, which is what the worker reports back when
		// it starts the pass — so a pass can be traced to the tick that asked for it.
		expect(Date.parse(answer.requestedAt)).not.toBeNaN();
		expect(logged()).toContain(answer.requestedAt);
	});
});

describe('EventOutboxDispatchWorker — the pass after a commit (T28)', () => {
	let debug: jest.SpyInstance;

	beforeEach(() => {
		debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	afterEach(() => {
		delete process.env[EVENT_OUTBOX_DISPATCH_ON_COMMIT_ENV];
	});

	/** Lets the scheduled wake and every pass it runs finish. */
	async function settle(): Promise<void> {
		for (let turn = 0; turn < 50; turn += 1) {
			await new Promise((resolve) => setImmediate(resolve));
		}
	}

	/** The worker of a process that consumes the dispatch queue, listening for commits. */
	function consuming() {
		const parts = dispatcher();

		jest.spyOn(parts.worker as any, 'consumesQueue').mockReturnValue(true);
		parts.worker.onModuleInit();

		return parts;
	}

	it('hands a committed event to its consumer without waiting for the scheduled pass', async () => {
		const { ledger, registry, worker } = consuming();
		const placed = consumer('subscriber:orders', async () => undefined);

		registry.register(placed);
		ledger.append();
		ledger.commitSignal.committed();
		await settle();

		expect(placed.seen.map((event) => event.name)).toEqual(['order.placed']);
		expect(ledger.rows[0].status).toBe(EventOutboxStatus.PUBLISHED);
		// The same bounded, leased claim the scheduled pass makes. The pass published a row, so one more
		// looks for the next event of that partition and finds nothing.
		const bounded = { batchSize: EVENT_OUTBOX_DISPATCH_BATCH_SIZE, leaseMs: EVENT_OUTBOX_DISPATCH_LEASE_MS };

		expect(ledger.claims).toEqual([bounded, bounded]);
		// Once per commit burst, so its report is at debug level rather than in every log.
		expect(logged()).not.toContain('Dispatch');
		expect(debug.mock.calls.map((call) => String(call[0])).join('\n')).toContain('Dispatched 1 event(s)');

		await worker.onModuleDestroy();
	});

	it('runs nothing in a process that does not consume the dispatch queue', async () => {
		const { ledger, worker } = dispatcher();

		// No BullMQ worker is attached, as in a process without a queue root.
		worker.onModuleInit();
		ledger.append();
		ledger.commitSignal.committed();
		await settle();

		expect(ledger.claims).toEqual([]);
		expect(ledger.rows[0].status).toBe(EventOutboxStatus.PENDING);
	});

	it('folds the commits made during a pass into one more pass, which starts after them', async () => {
		const { ledger, worker } = consuming();
		let release!: () => void;
		const held = new Promise<void>((resolve) => (release = resolve));
		const claim = jest.spyOn(ledger, 'claimBatch');

		claim.mockImplementationOnce(async () => {
			await held;

			return [];
		});

		ledger.commitSignal.committed();
		await settle();
		// The first pass is claiming; three more commits land while it does.
		ledger.commitSignal.committed();
		ledger.commitSignal.committed();
		ledger.commitSignal.committed();
		release();
		await settle();

		expect(claim).toHaveBeenCalledTimes(2);

		// Control: the wake is over, so the next commit runs a pass of its own.
		ledger.commitSignal.committed();
		await settle();

		expect(claim).toHaveBeenCalledTimes(3);

		await worker.onModuleDestroy();
	});

	it('drains a burst larger than a batch in passes, up to its limit', async () => {
		const { ledger, worker } = consuming();
		const full = { claimed: EVENT_OUTBOX_DISPATCH_BATCH_SIZE, published: 0 };
		const pass = jest
			.spyOn(worker as any, 'runPass')
			.mockResolvedValueOnce(full)
			.mockResolvedValueOnce(full)
			.mockResolvedValueOnce({ claimed: 3, published: 3 })
			.mockResolvedValueOnce({ claimed: 0, published: 0 });

		ledger.commitSignal.committed();
		await settle();

		// Two full batches may have left rows behind; the fourth pass found nothing left.
		expect(pass).toHaveBeenCalledTimes(4);

		pass.mockReset();
		pass.mockResolvedValue(full);
		ledger.commitSignal.committed();
		await settle();

		// A steady flood stops at the limit; what is left is due for the next wake or the scheduled pass.
		expect(pass).toHaveBeenCalledTimes(EVENT_OUTBOX_COMMIT_PASS_LIMIT);

		await worker.onModuleDestroy();
	});

	it('passes again while a pass claims anything, because a settled head lets its partition’s next event be claimed', async () => {
		const { ledger, worker } = consuming();
		const pass = jest
			.spyOn(worker as any, 'runPass')
			.mockResolvedValueOnce({ claimed: 1, published: 1 })
			// A head dead-lettered by its attempt budget is counted as a retry, yet it no longer blocks.
			.mockResolvedValueOnce({ claimed: 1, published: 0 })
			.mockResolvedValueOnce({ claimed: 0, published: 0 });

		ledger.commitSignal.committed();
		await settle();

		expect(pass).toHaveBeenCalledTimes(3);

		await worker.onModuleDestroy();
	});

	it('runs the pass outside the committing request’s async context', async () => {
		const { ledger, worker } = consuming();
		// Stands in for `nestjs-cls`, which keeps `RequestContext` in an AsyncLocalStorage.
		const request = new AsyncLocalStorage<string>();
		const seen: Array<string | undefined> = [];

		jest.spyOn(ledger, 'claimBatch').mockImplementation(async () => {
			seen.push(request.getStore());

			return [];
		});

		request.run('the committing request', () => ledger.commitSignal.committed());
		await settle();

		expect(seen).toEqual([undefined]);

		await worker.onModuleDestroy();
	});

	it('stops a wake whose claim fails, and the next commit wakes it again', async () => {
		const { ledger, worker } = consuming();
		const claim = jest.spyOn(ledger, 'claimBatch').mockRejectedValueOnce(new Error('connection reset'));

		ledger.commitSignal.committed();
		await settle();

		expect(claim).toHaveBeenCalledTimes(1);
		// The pass logs the failed claim, as the scheduled one does.
		expect(failure).toHaveBeenCalled();

		ledger.commitSignal.committed();
		await settle();

		expect(claim).toHaveBeenCalledTimes(2);

		await worker.onModuleDestroy();
	});

	it('waits for a running wake when destroyed, and starts no pass after it', async () => {
		const { ledger, worker } = consuming();
		let release!: () => void;
		const held = new Promise<void>((resolve) => (release = resolve));
		const claim = jest.spyOn(ledger, 'claimBatch').mockImplementationOnce(async () => {
			await held;

			return [];
		});

		ledger.commitSignal.committed();
		await settle();
		// A commit lands while the pass claims, so one more pass is owed.
		ledger.commitSignal.committed();

		let destroyed = false;
		const destroying = worker.onModuleDestroy().then(() => (destroyed = true));

		await settle();
		expect(destroyed).toBe(false);

		release();
		await destroying;

		// The owed pass does not start once the module is going away.
		expect(claim).toHaveBeenCalledTimes(1);

		ledger.commitSignal.committed();
		worker.wake();
		await settle();

		expect(claim).toHaveBeenCalledTimes(1);
	});

	it('cancels a wake that has not started yet when destroyed', async () => {
		const { ledger, worker } = consuming();
		const claim = jest.spyOn(ledger, 'claimBatch');

		ledger.commitSignal.committed();
		await worker.onModuleDestroy();
		await settle();

		expect(claim).not.toHaveBeenCalled();
	});

	it(`listens to nothing when ${EVENT_OUTBOX_DISPATCH_ON_COMMIT_ENV}=false, and stops listening when destroyed`, async () => {
		process.env[EVENT_OUTBOX_DISPATCH_ON_COMMIT_ENV] = 'false';

		const off = consuming();

		off.ledger.commitSignal.committed();
		await settle();

		expect(off.ledger.claims).toEqual([]);

		delete process.env[EVENT_OUTBOX_DISPATCH_ON_COMMIT_ENV];

		const destroyed = consuming();

		await destroyed.worker.onModuleDestroy();
		destroyed.ledger.commitSignal.committed();
		await settle();

		expect(destroyed.ledger.claims).toEqual([]);
	});
});
