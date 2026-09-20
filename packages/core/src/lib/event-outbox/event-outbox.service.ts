import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { EntityManager, FindOptionsWhere, IsNull } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { isMySQL, isPostgres } from '@gauzy/config';
import {
	EventOutboxStatus,
	ID,
	IEventEnvelope,
	IEventHeaders,
	IOutboxWriteInput,
	JsonData
} from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context/request-context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { isUniqueViolation } from '../core/errors/unique-violation';
import { EventDelivery } from './event-delivery.entity';
import { EventOutbox } from './event-outbox.entity';
import {
	EVENT_DELIVERY_ACTIONS,
	EventDeliveryAction,
	EventDeliveryEventPublisher
} from './event-delivery.publisher';
import { TypeOrmEventDeliveryRepository } from './repository/type-orm-event-delivery.repository';
import { TypeOrmEventOutboxRepository } from './repository/type-orm-event-outbox.repository';
import { MikroOrmEventDeliveryRepository } from './repository/mikro-orm-event-delivery.repository';
import { MikroOrmEventOutboxRepository } from './repository/mikro-orm-event-outbox.repository';

/**
 * The knobs one dispatch pass reads.
 */
export interface IOutboxDispatchPolicy {
	/** How many rows one pass may claim. */
	batchSize?: number;
	/** How long a claimed row stays out of another pass's reach. */
	leaseMs?: number;
	/** Attempts after which a row is dead-lettered. */
	maxAttempts?: number;
	/** Clock override, so a test can drive the backoff without waiting. */
	now?: Date;
}

/**
 * A request to create the delivery record for one consumer of one event.
 */
export interface IOutboxDeliveryClaimInput {
	eventId: ID;
	/** `<kind>:<key>` — `subscriber:<name>`, `job:<queue>` or `webhook:<subscriptionId>`. */
	consumerKey: string;
	/** Copied from the outbox row so a strict consumer can compare sequences without a join. */
	partitionKey?: string;
	/** Copied from the outbox row. */
	sequence?: number;
	/**
	 * Overrides the tenant taken from the request context, exactly as `append` accepts one.
	 *
	 * The dispatcher claims deliveries from a queue worker, where there is no request and therefore no
	 * context to read a tenant from — so a record written without this would carry none, and a record
	 * that carries no tenant is invisible to every read this service scopes: the delivery listing, the
	 * node read, and the two operator moves that are reached through it. The event knows whose fact it
	 * is; this is how it says so.
	 */
	tenantId?: ID;
	/** Overrides the organization taken from the request context, for the same reason. */
	organizationId?: ID;
}

/**
 * Whether the caller must invoke the consumer, and the record it must complete afterwards.
 */
export interface IOutboxDeliveryClaim {
	/** False when this consumer already acknowledged the event, in which case nothing is invoked. */
	claimed: boolean;
	delivery: EventDelivery;
}

/**
 * What a consumer reported.
 */
export interface IOutboxDeliveryOutcome {
	/** True when the consumer succeeded. */
	delivered: boolean;
	error?: unknown;
	/** Attempts after which the delivery is dead-lettered; defaults to the service's budget. */
	maxAttempts?: number;
}

/**
 * The narrowing the diagnostic outbox list accepts.
 *
 * Three members and no more, because three are the questions an operator asks of the queue: what is
 * still waiting, what one event name is doing, and what happened to one aggregate.
 */
export interface IOutboxRowQuery {
	status?: EventOutboxStatus;
	eventName?: string;
	aggregateId?: ID;
}

/**
 * The narrowing the diagnostic delivery list accepts.
 *
 * `consumerKey` is the member the dead-letter runbook groups by — one consumer failing broadly is a
 * regression in that consumer, many consumers failing on one event is a bad payload — and `eventId`
 * is its other half.
 */
export interface IDeliveryRowQuery {
	status?: EventOutboxStatus;
	consumerKey?: string;
	eventId?: ID;
}

/**
 * Writes events, hands them to consumers, and keeps the record of who received what.
 *
 * The write path is `append`, and it **requires** the caller's transaction manager: there is no
 * overload that opens a transaction of its own, so the state change and the event cannot drift
 * apart by accident. Everything after that — the dispatch lease, the per-consumer delivery record,
 * the backoff and the dead-letter — exists to make a best-effort transport behave like a durable
 * one, and every step of it is a row an operator can read.
 */
@Injectable()
export class EventOutboxService extends CrudService<EventOutbox> {
	/** Rows one dispatch pass claims by default. */
	static readonly DEFAULT_BATCH_SIZE = 50;

	/**
	 * How long a claim is leased for.
	 *
	 * The lease is the crash recovery mechanism: a dispatcher that dies mid-pass leaves rows whose
	 * `availableAt` expires, and the next pass — in this process or another — picks them up.
	 */
	static readonly DEFAULT_LEASE_MS = 60_000;

	/** Attempts after which an outbox row is dead-lettered. */
	static readonly DEFAULT_MAX_ATTEMPTS = 10;

	/** Attempts after which a single consumer's delivery is dead-lettered. */
	static readonly DEFAULT_CONSUMER_MAX_ATTEMPTS = 8;

	/**
	 * The retry ladder, in milliseconds.
	 *
	 * It is data rather than a formula because it is written onto the row: an operator reading
	 * `availableAt` can see exactly when the next attempt is due without re-deriving it.
	 */
	static readonly BACKOFF_LADDER_MS: ReadonlyArray<number> = [5_000, 30_000, 120_000, 600_000, 3_600_000];

	/** The envelope contract version this build produces. */
	static readonly PAYLOAD_VERSION = 1;

	constructor(
		readonly typeOrmEventOutboxRepository: TypeOrmEventOutboxRepository,
		readonly mikroOrmEventOutboxRepository: MikroOrmEventOutboxRepository,
		readonly typeOrmEventDeliveryRepository: TypeOrmEventDeliveryRepository,
		readonly mikroOrmEventDeliveryRepository: MikroOrmEventDeliveryRepository,
		/**
		 * Where the two operator moves are announced.
		 *
		 * **The producers live here rather than in the routes**, which is the one place this kernel
		 * departs from the shape the channel domain uses: a route and a GraphQL field would each have to
		 * remember to announce, and a third caller would silently not. Both surfaces reach a move
		 * through this service, so both announce through this one call and a subscriber cannot tell
		 * which protocol moved the row.
		 *
		 * It is injected optionally because absence is a legitimate shape rather than a wiring fault:
		 * every state this service writes is asserted on its own — the dispatch path and the retry
		 * ladder are tested without a subscription surface behind them — and a process that hosts no
		 * GraphQL endpoint (a worker, a seeding run, a suite) writes exactly the same rows and
		 * announces nothing. `EventOutboxModule` declares the publisher as a provider, so a process
		 * that does serve the endpoint always has one, which its own suite asserts.
		 */
		@Optional()
		private readonly deliveryPublisher?: EventDeliveryEventPublisher
	) {
		super(typeOrmEventOutboxRepository, mikroOrmEventOutboxRepository);
	}

	/**
	 * Appends an event to the outbox inside the caller's transaction.
	 *
	 * Called **last** in that transaction, so a rollback removes the event together with the state
	 * change it describes. The method performs no I/O beyond the two statements it needs: no HTTP,
	 * no queue publish, no notification.
	 *
	 * @param manager The caller's transaction manager.
	 * @param input What changed.
	 * @returns The stored row, including the `eventId` and `sequence` consumers will see.
	 */
	async append(manager: EntityManager, input: IOutboxWriteInput): Promise<EventOutbox> {
		// The ordering key defaults to the aggregate, because per-aggregate ordering is the only
		// ordering the platform promises.
		const partitionKey = input.partitionKey ?? `${input.aggregateType}:${input.aggregateId}`;
		const sequence = await this.nextSequence(manager, partitionKey);

		const event = manager.create(EventOutbox, {
			// Generated here rather than by the database: the caller needs the id in the same
			// transaction, and it is what the delivery records and the webhook signature carry.
			eventId: randomUUID(),
			eventName: input.name,
			aggregateType: input.aggregateType,
			aggregateId: input.aggregateId,
			payload: input.data ?? {},
			headers: input.headers,
			status: EventOutboxStatus.PENDING,
			attemptCount: 0,
			availableAt: new Date(),
			partitionKey,
			sequence,
			tenantId: input.tenantId ?? RequestContext.currentTenantId(),
			organizationId: input.organizationId ?? RequestContext.currentOrganizationId()
		} as Partial<EventOutbox>);

		return manager.save(EventOutbox, event);
	}

	/**
	 * Claims a batch of events for dispatch, under a lease.
	 *
	 * Only the lowest-`sequence` row of each partition is claimable, so a consumer never sees one
	 * aggregate's events out of order. The claim is the `availableAt` push combined with an
	 * `attemptCount` increment: a row claimed by a process that then dies is reclaimed once the
	 * lease expires.
	 *
	 * @param policy Batch size, lease length and clock override.
	 * @returns The rows this caller now owns, in partition then sequence order.
	 */
	async claimBatch(policy: IOutboxDispatchPolicy = {}): Promise<EventOutbox[]> {
		const batchSize = policy.batchSize ?? EventOutboxService.DEFAULT_BATCH_SIZE;
		const leaseMs = policy.leaseMs ?? EventOutboxService.DEFAULT_LEASE_MS;
		const now = policy.now ?? new Date();

		return this.typeOrmEventOutboxRepository.manager.transaction(async (manager) => {
			const query = manager
				.createQueryBuilder(EventOutbox, 'outbox')
				// Every non-terminal row is a candidate, including one that is not yet due. Both
				// statuses belong here: `PENDING` is an event nobody has attempted, and `FAILED` is one
				// whose attempt failed and whose next attempt the backoff scheduled — the status means
				// "waiting for its turn again", not "give up". Claiming only `PENDING` stranded every
				// failed event, because nothing returned a `FAILED` row to `PENDING`.
				//
				// Due-ness is deliberately NOT part of this filter, and that is the whole point of
				// reading the partition's first row rather than its first due row. A head waiting out a
				// backoff is still the head: if the query dropped it, the next event of the same
				// aggregate would appear to be the head and would be claimed while its predecessor is
				// still unpublished — the ordering promise this service makes. So the head is chosen
				// first and the due check is applied to the choice, below.
				.where('outbox.status IN (:...statuses)', {
					statuses: [EventOutboxStatus.PENDING, EventOutboxStatus.FAILED]
				})
				.orderBy('outbox.partitionKey', 'ASC')
				.addOrderBy('outbox.sequence', 'ASC')
				.limit(Math.max(batchSize * 4, batchSize));

			const candidates =
				isPostgres() || isMySQL()
					? // Both dialects map this to FOR UPDATE, which holds the row until the lease is
					  // written, so two dispatchers cannot claim the same event.
					  await query.setLock('pessimistic_write').getMany()
					: // The embedded dialect serializes writers, so the transaction is the lock.
					  await query.getMany();

			// Candidates arrive partition-major, so the first row seen for a partition is its lowest
			// sequence: that row is the partition's head whether or not it is claimable yet, and every
			// later row of that partition is behind it in line.
			const heads = new Map<string, EventOutbox>();
			const heldBack = new Set<string>();

			for (const candidate of candidates) {
				const key = candidate.partitionKey ?? (candidate.id as string);

				if (heads.has(key) || heldBack.has(key)) {
					continue;
				}

				// The partition's turn has come only when its head is due. A head inside its backoff
				// therefore holds the whole partition back: skipping it without recording the block
				// would let the *next* row of the same partition be chosen as a head and claimed while
				// its predecessor is still unpublished — which is the ordering promise this service
				// makes, and the consumer-side order gate would otherwise have to reject and redeliver
				// the event that overtook it.
				if ((candidate.availableAt?.getTime() ?? 0) > now.getTime()) {
					heldBack.add(key);
					continue;
				}

				if (heads.size < batchSize) {
					heads.set(key, candidate);
				}
			}

			const claimed = Array.from(heads.values());
			const leaseUntil = new Date(now.getTime() + leaseMs);

			for (const row of claimed) {
				row.availableAt = leaseUntil;
				row.attemptCount = (row.attemptCount ?? 0) + 1;
			}

			if (claimed.length) {
				await manager.save(EventOutbox, claimed);
			}

			return claimed;
		});
	}

	/**
	 * Records that every consumer entry point accepted an event.
	 *
	 * @param id The outbox row id.
	 * @param options Clock override.
	 * @returns The updated row, or null when it no longer exists.
	 */
	async markPublished(id: ID, options: { at?: Date } = {}): Promise<EventOutbox | null> {
		await this.typeOrmEventOutboxRepository.update({ id } as any, {
			status: EventOutboxStatus.PUBLISHED,
			publishedAt: options.at ?? new Date(),
			lastError: null
		} as any);

		return this.findById(id);
	}

	/**
	 * Records a failed dispatch attempt and schedules the next one.
	 *
	 * When the attempt budget is spent the row is dead-lettered instead: the last backoff step is
	 * the end of the schedule, not the start of an unbounded one.
	 *
	 * @param id The outbox row id.
	 * @param error What went wrong.
	 * @param policy Attempt budget and clock override.
	 * @returns The updated row, or null when it no longer exists.
	 */
	async markFailed(id: ID, error: unknown, policy: IOutboxDispatchPolicy = {}): Promise<EventOutbox | null> {
		const record = await this.findById(id);

		if (!record) {
			return null;
		}

		const maxAttempts = policy.maxAttempts ?? EventOutboxService.DEFAULT_MAX_ATTEMPTS;
		const now = policy.now ?? new Date();

		if ((record.attemptCount ?? 0) >= maxAttempts) {
			return this.markDead(id, error, { at: now });
		}

		await this.typeOrmEventOutboxRepository.update({ id } as any, {
			status: EventOutboxStatus.FAILED,
			availableAt: new Date(now.getTime() + this.backoffFor(record.attemptCount ?? 1)),
			lastError: describeFailure(error)
		} as any);

		return this.findById(id);
	}

	/**
	 * Dead-letters an event.
	 *
	 * The row is kept, because a dead event is the diagnosis: it names the event, the aggregate and
	 * the error, and an admin action can reset it to pending to replay it.
	 *
	 * @param id The outbox row id.
	 * @param error What went wrong.
	 * @param options Clock override.
	 * @returns The updated row, or null when it no longer exists.
	 */
	async markDead(id: ID, error: unknown, options: { at?: Date } = {}): Promise<EventOutbox | null> {
		await this.typeOrmEventOutboxRepository.update({ id } as any, {
			status: EventOutboxStatus.DEAD,
			lastError: describeFailure(error),
			publishedAt: null,
			availableAt: options.at ?? new Date()
		} as any);

		return this.findById(id);
	}

	/**
	 * Reads one outbox row.
	 *
	 * @param id The row id.
	 * @returns The row, or null.
	 */
	async findById(id: ID): Promise<EventOutbox | null> {
		return this.typeOrmEventOutboxRepository.findOne({ where: { id } as any });
	}

	/**
	 * Builds the envelope a consumer receives.
	 *
	 * The envelope is derived from the stored row rather than passed around beside it, so a consumer
	 * and a replay always see the same event identity, aggregate and sequence.
	 *
	 * @param row The outbox row.
	 * @returns The envelope.
	 */
	toEnvelope(row: EventOutbox): IEventEnvelope {
		const headers = (row.headers ?? {}) as IEventHeaders;

		return {
			id: row.eventId,
			name: row.eventName,
			version: EventOutboxService.PAYLOAD_VERSION,
			occurredAt: row.createdAt ?? new Date(),
			tenantId: row.tenantId,
			organizationId: row.organizationId,
			channelId: headers.channelId,
			aggregate: { type: row.aggregateType, id: row.aggregateId },
			sequence: row.sequence,
			partitionKey: row.partitionKey,
			correlationId: headers.correlationId,
			causationId: headers.causationId,
			// By the catalogue's naming rule the leading segment of an event name is the aggregate
			// that owns the change, which is what `producer` reports.
			producer: row.eventName.split('.')[0],
			data: row.payload as JsonData
		};
	}

	/**
	 * Creates the delivery record for one consumer, or reports that it already exists.
	 *
	 * The record is written **before** the consumer is invoked, which is the whole mechanism: a
	 * consumer crash leaves a pending row the retry scan picks up, and a second attempt at the same
	 * `(event, consumer)` pair fails the unique insert instead of doing the work twice.
	 *
	 * @param input The event and the consumer.
	 * @returns Whether the caller must invoke the consumer, and the record to complete afterwards.
	 */
	async claimDelivery(input: IOutboxDeliveryClaimInput): Promise<IOutboxDeliveryClaim> {
		const delivery = this.typeOrmEventDeliveryRepository.create({
			eventId: input.eventId,
			consumerKey: input.consumerKey,
			status: EventOutboxStatus.PENDING,
			attemptCount: 0,
			partitionKey: input.partitionKey,
			sequence: input.sequence,
			// The stated scope wins over the context's, the same way `append` reads it: a claim made
			// inside a request still takes the caller's tenant, and a claim made by the dispatcher takes
			// the one the event carries instead of none at all.
			tenantId: input.tenantId ?? RequestContext.currentTenantId(),
			organizationId: input.organizationId ?? RequestContext.currentOrganizationId()
		} as Partial<EventDelivery>);

		try {
			return { claimed: true, delivery: await this.typeOrmEventDeliveryRepository.save(delivery) };
		} catch (error) {
			if (!isUniqueViolation(error)) {
				throw error;
			}

			const existing = await this.findDelivery(input.eventId, input.consumerKey);

			if (!existing) {
				// The row vanished between the failed insert and this read; the original error is the
				// honest answer, and the caller may retry.
				throw error;
			}

			if (existing.status === EventOutboxStatus.PUBLISHED) {
				// This consumer already acknowledged the event, which is what makes at-least-once
				// delivery safe rather than merely noisy.
				return { claimed: false, delivery: existing };
			}

			// A pending or failed record means the event was lost mid-delivery the first time round,
			// so it is handed over again and the attempt is counted against the consumer's budget.
			await this.typeOrmEventDeliveryRepository.increment({ id: existing.id } as any, 'attemptCount', 1);

			return {
				claimed: true,
				delivery: { ...existing, attemptCount: (existing.attemptCount ?? 0) + 1 } as EventDelivery
			};
		}
	}

	/**
	 * Records what a consumer did.
	 *
	 * @param id The delivery row id.
	 * @param outcome Whether the consumer succeeded.
	 * @returns The updated delivery, or null when it no longer exists.
	 */
	async completeDelivery(id: ID, outcome: IOutboxDeliveryOutcome): Promise<EventDelivery | null> {
		const delivery = await this.findDeliveryById(id);

		if (!delivery) {
			return null;
		}

		const maxAttempts = outcome.maxAttempts ?? EventOutboxService.DEFAULT_CONSUMER_MAX_ATTEMPTS;

		const values: Record<string, unknown> = {
			status: outcome.delivered
				? EventOutboxStatus.PUBLISHED
				: (delivery.attemptCount ?? 0) >= maxAttempts
				? EventOutboxStatus.DEAD
				: EventOutboxStatus.FAILED,
			lastError: outcome.delivered ? null : describeFailure(outcome.error)
		};

		if (outcome.delivered) {
			values.deliveredAt = new Date();
		}

		await this.typeOrmEventDeliveryRepository.update({ id } as any, values as any);

		return this.findDeliveryById(id);
	}

	/**
	 * Dead-letters one consumer's record for an event.
	 *
	 * Used when the error is classified as non-retryable, where retrying would only repeat a
	 * request the consumer has already refused.
	 *
	 * @param id The delivery row id.
	 * @param error What went wrong.
	 * @returns The updated delivery, or null when it no longer exists.
	 */
	async markDeliveryDead(id: ID, error: unknown): Promise<EventDelivery | null> {
		await this.typeOrmEventDeliveryRepository.update({ id } as any, {
			status: EventOutboxStatus.DEAD,
			lastError: describeFailure(error)
		} as any);

		return this.findDeliveryById(id);
	}

	/**
	 * Reads the delivery record for one `(event, consumer)` pair.
	 *
	 * @param eventId The event id.
	 * @param consumerKey The consumer key.
	 * @returns The record, or null when this consumer has never seen the event.
	 */
	async findDelivery(eventId: ID, consumerKey: string): Promise<EventDelivery | null> {
		return this.typeOrmEventDeliveryRepository.findOne({
			where: { eventId, consumerKey } as any
		});
	}

	/**
	 * Reads a delivery record by id.
	 *
	 * @param id The record id.
	 * @returns The record, or null.
	 */
	async findDeliveryById(id: ID): Promise<EventDelivery | null> {
		return this.typeOrmEventDeliveryRepository.findOne({ where: { id } as any });
	}

	/**
	 * The outbox rows of the caller's own scope, in the queue's own order.
	 *
	 * The order is the queue's rather than the ledger's: `availableAt` is when a row is next due —
	 * the instant it was appended for a row nobody has attempted, the end of its lease for a claimed
	 * one, the end of its backoff for a failed one — so the first row is the row whose turn comes
	 * first. That is what makes the listing answer the backlog runbook's two questions
	 * (`12-events-webhooks-and-workflows.md` §14.5): what is waiting, and what has been waiting
	 * longest. `sequence` breaks a tie inside one partition and the identifier makes the order total,
	 * because a cursor walk is only stable if the order it walks is.
	 *
	 * There is no store-side `where` to push the narrowing into and no page to push either: the
	 * connection protocol is applied to the rows this read answers, which is what makes the REST list
	 * and the GraphQL connection the same set of rows under the same filters.
	 *
	 * @param query The status, event name or aggregate to narrow to.
	 * @returns The rows, due first.
	 */
	async listOutboxRows(query: IOutboxRowQuery = {}): Promise<EventOutbox[]> {
		return this.typeOrmEventOutboxRepository.find({
			where: this.rowsOfTheCaller<EventOutbox>({
				...(query.status ? { status: query.status } : {}),
				...(query.eventName ? { eventName: query.eventName } : {}),
				...(query.aggregateId ? { aggregateId: query.aggregateId } : {})
			}),
			order: { availableAt: 'ASC', sequence: 'ASC', id: 'ASC' }
		} as never);
	}

	/**
	 * Reads one outbox row of the caller's own scope.
	 *
	 * The dispatcher's own reads deliberately do not scope — they run in a system context, where there
	 * is no caller to scope to — so this is the diagnostic read that does, and it is the one the
	 * routes and the resolvers call.
	 *
	 * @param id The row id.
	 * @returns The row, or null when it is not the caller's.
	 */
	async findOutboxRow(id: ID): Promise<EventOutbox | null> {
		return this.typeOrmEventOutboxRepository.findOne({
			where: this.rowsOfTheCaller<EventOutbox>({ id })
		});
	}

	/**
	 * The delivery records of the caller's own scope, newest first.
	 *
	 * The order is the dead-letter listing's: the runbook opens the newest record and reads its event
	 * name, attempt count and error, so a listing that answered oldest-first would make the reader
	 * walk to the end of every page to find what just broke.
	 *
	 * @param query The status, consumer key or event to narrow to.
	 * @returns The records, newest first.
	 */
	async listDeliveryRows(query: IDeliveryRowQuery = {}): Promise<EventDelivery[]> {
		return this.typeOrmEventDeliveryRepository.find({
			where: this.rowsOfTheCaller<EventDelivery>({
				...(query.status ? { status: query.status } : {}),
				...(query.consumerKey ? { consumerKey: query.consumerKey } : {}),
				...(query.eventId ? { eventId: query.eventId } : {})
			}),
			order: { createdAt: 'DESC', id: 'DESC' }
		} as never);
	}

	/**
	 * Reads one delivery record of the caller's own scope.
	 *
	 * @param id The record id.
	 * @returns The record, or null when it is not the caller's.
	 */
	async findDeliveryRow(id: ID): Promise<EventDelivery | null> {
		return this.typeOrmEventDeliveryRepository.findOne({
			where: this.rowsOfTheCaller<EventDelivery>({ id })
		});
	}

	/**
	 * Re-drives one consumer's delivery record: the operator's first move.
	 *
	 * The move writes the state a fresh record is written in — the attempt budget back to zero, the
	 * last error cleared and the acknowledgement withdrawn — so the retry scan claims it exactly as it
	 * claims a record whose consumer crashed mid-delivery. Nothing is re-published here and no
	 * consumer is invoked: the record *is* the queue, and the scan that reads `PENDING` rows is what
	 * re-drives it. That is also what makes the move safe to repeat, and why it resets the budget
	 * rather than incrementing anything.
	 *
	 * @param id The record id.
	 * @returns The record as it stands after the move.
	 * @throws NotFoundException when the record does not exist inside the caller's own scope.
	 */
	async replayDelivery(id: ID): Promise<EventDelivery> {
		await this.deliveryOfTheCaller(id);

		await this.typeOrmEventDeliveryRepository.update({ id } as any, {
			status: EventOutboxStatus.PENDING,
			attemptCount: 0,
			lastError: null,
			// A record that is waiting to be re-driven has not been acknowledged, whatever it recorded
			// before: leaving the instant on it would answer a `PENDING` row that claims a delivery.
			deliveredAt: null
		} as any);

		return this.announce(id, EVENT_DELIVERY_ACTIONS.REPLAYED);
	}

	/**
	 * Dead-letters one consumer's record by hand: the operator's second move.
	 *
	 * The write is the kernel's own dead-letter write, and it is called rather than restated: an
	 * operator's decision and a spent attempt budget produce the same terminal row, and a second
	 * statement writing `DEAD` is how the two come to disagree. What this move adds is what a *route*
	 * owes — the caller's own scope, checked before anything is written, and the announcement — and
	 * the reason, which lands on the row's `lastError` and is the diagnosis an operator reads later.
	 *
	 * The acknowledgement instant is left as the row has it. Dead-lettering records a decision about
	 * the *retry* of a fact, not a claim that the consumer never saw it, and the kernel's own
	 * dead-letter write leaves that column alone; a move that cleared it would be editing a fact it
	 * was not asked about.
	 *
	 * **What the move does do to the rest of the stream is advance the order gate past this position.**
	 * The gate asks what a consumer has settled, and a record an operator has deliberately stopped is
	 * settled — so the events that follow it stop waiting for a position that will never be published.
	 * A dead letter is therefore not only a diagnosis; it is the one thing that unblocks the aggregate
	 * it belongs to.
	 *
	 * @param id The record id.
	 * @param reason Why the record is being stopped.
	 * @returns The record as it stands after the move.
	 * @throws NotFoundException when the record does not exist inside the caller's own scope.
	 */
	async deadLetterDelivery(id: ID, reason: string): Promise<EventDelivery> {
		await this.deliveryOfTheCaller(id);

		await this.markDeliveryDead(id, reason);

		return this.announce(id, EVENT_DELIVERY_ACTIONS.MARKED_DEAD);
	}

	/**
	 * The highest sequence a consumer has already acknowledged for a partition.
	 *
	 * This is the order gate: a consumer that receives `n + 2` while `n + 1` is still in flight
	 * rejects the message and is redelivered later, so a gap never becomes a silently skipped event.
	 *
	 * **A dead letter is a resolved position.** The gate advances past a position that was published
	 * *or* deliberately stopped, because dead-lettering is an operator deciding that this fact will
	 * never reach this consumer — and a gate that kept waiting for it would hold every later event of
	 * the aggregate forever, which is a worse outcome than the one the operator chose. The two are not
	 * the same fact and the record keeps the difference in its `status`: what the gate answers is
	 * whether the position is settled, not whether it was delivered.
	 *
	 * A replay moves a dead letter back to `PENDING`, which un-settles it: the position leaves the gate
	 * until the re-driven attempt either publishes or is stopped again. That is the ordering guarantee
	 * being re-established rather than a side effect — an operator who asks for the fact to be
	 * delivered again is asking for it to be delivered in its place.
	 *
	 * @param consumerKey The consumer key.
	 * @param partitionKey The ordering key.
	 * @returns The highest settled sequence, or 0 when nothing of the partition was settled.
	 */
	async findLastDeliveredSequence(consumerKey: string, partitionKey: string): Promise<number> {
		const raw = await this.typeOrmEventDeliveryRepository
			.createQueryBuilder('delivery')
			.select('MAX(delivery.sequence)', 'max')
			.where('delivery.consumerKey = :consumerKey', { consumerKey })
			.andWhere('delivery.partitionKey = :partitionKey', { partitionKey })
			.andWhere('delivery.status IN (:...statuses)', {
				statuses: [EventOutboxStatus.PUBLISHED, EventOutboxStatus.DEAD]
			})
			.getRawOne();

		return Number(raw?.max ?? 0);
	}

	/**
	 * The criterion that limits a diagnostic read or a move to the caller's own rows.
	 *
	 * The outbox is infrastructure, but it is not tenant-less: every row carries the tenant of the
	 * write that appended it, and neither route may answer — or move — another tenant's record. A row
	 * written outside a request carries no tenant at all, and it is therefore invisible here rather
	 * than visible to everyone: a record nobody owns is not a record every caller owns.
	 *
	 * The organization is read the way the platform reads a shared row. An event appended with no
	 * organization is the tenant-wide fact, so the criterion is the caller's own organization **or**
	 * the absence of one; equality alone would hide every tenant-level event from every operator of
	 * the tenant it belongs to.
	 *
	 * @param narrowing The filters the read adds to the scope.
	 * @returns The two criteria a TypeORM `where` array ORs together.
	 */
	private rowsOfTheCaller<T>(narrowing: FindOptionsWhere<T> = {}): FindOptionsWhere<T>[] {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		return [
			{ ...narrowing, tenantId, organizationId } as FindOptionsWhere<T>,
			{ ...narrowing, tenantId, organizationId: IsNull() } as FindOptionsWhere<T>
		];
	}

	/**
	 * The one record a move is about, inside the caller's own scope.
	 *
	 * @param id The record id.
	 * @returns The record.
	 * @throws NotFoundException when it does not exist inside the caller's own scope. A record of
	 * another tenant is answered exactly as a record that does not exist, which is the same answer the
	 * REST node read gives for both and never a hint that the row is there.
	 */
	private async deliveryOfTheCaller(id: ID): Promise<EventDelivery> {
		const delivery = await this.findDeliveryRow(id);

		if (!delivery) {
			throw new NotFoundException(
				`${ApiErrorCode.RESOURCE_NOT_FOUND}: delivery '${String(id)}' could not be found.`
			);
		}

		return delivery;
	}

	/**
	 * The record as it stands after a move, and the announcement of that move.
	 *
	 * The answer is the row the store now holds rather than the object the statement was built from:
	 * the move's whole point is the state it leaves behind, and the columns it did not touch are the
	 * store's to report.
	 *
	 * @param id The record id.
	 * @param action The move that was made.
	 * @returns The record as it stands.
	 * @throws NotFoundException when the record vanished between the move and this read.
	 */
	private async announce(id: ID, action: EventDeliveryAction): Promise<EventDelivery> {
		const delivery = await this.findDeliveryById(id);

		if (!delivery) {
			// The record was removed between the move and this read, so there is no row to answer with
			// and the miss is reported as a miss rather than as the row the statement was built from.
			throw new NotFoundException(
				`${ApiErrorCode.RESOURCE_NOT_FOUND}: delivery '${String(id)}' could not be found.`
			);
		}

		// Absent only in a process that hosts no subscription surface; the move itself is already
		// written, and the record — not the notification — is the source of truth.
		await this.deliveryPublisher?.deliveryChanged(delivery, action);

		return delivery;
	}

	/**
	 * Allocates the next sequence of a partition inside the caller's transaction.
	 *
	 * A concurrent writer to the same partition computes the same value; the unique index over
	 * `(partitionKey, sequence)` is what makes that a lost race rather than a reordered partition,
	 * so the caller of `append` sees a loud error it can retry instead of two events claiming one
	 * position.
	 *
	 * @param manager The caller's transaction manager.
	 * @param partitionKey The ordering key.
	 * @returns The next sequence.
	 */
	private async nextSequence(manager: EntityManager, partitionKey: string): Promise<number> {
		const raw = await manager
			.createQueryBuilder(EventOutbox, 'outbox')
			.select('MAX(outbox.sequence)', 'max')
			.where('outbox.partitionKey = :partitionKey', { partitionKey })
			.getRawOne();

		return Number(raw?.max ?? 0) + 1;
	}

	/**
	 * The delay before a failed row is retried.
	 *
	 * @param attempt The attempt that just failed, 1-based.
	 * @returns The delay in milliseconds, jittered.
	 */
	private backoffFor(attempt: number): number {
		const ladder = EventOutboxService.BACKOFF_LADDER_MS;
		const step = ladder[Math.min(Math.max(attempt - 1, 0), ladder.length - 1)];

		// ±20 %: without jitter every row that failed in the same pass would come back at the same
		// instant, which turns a transient failure into a synchronised retry storm.
		const jitter = step * 0.2 * (Math.random() * 2 - 1);

		return Math.max(0, Math.round(step + jitter));
	}
}

/**
 * Renders a caught error as the single line a row stores.
 *
 * @param error The caught error.
 * @returns A message that names the failure without a stack trace.
 */
export function describeFailure(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === 'string') {
		return error;
	}

	try {
		return JSON.stringify(error);
	} catch {
		return 'Unknown failure';
	}
}
