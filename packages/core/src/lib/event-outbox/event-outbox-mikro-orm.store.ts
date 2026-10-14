import { randomUUID } from 'node:crypto';
import { EntityManager as MikroOrmEntityManager, LockMode, QueryOrder, raw } from '@mikro-orm/core';
import { SqlEntityManager } from '@mikro-orm/knex';
import { isMySQL, isPostgres } from '@gauzy/config';
import { EventOutboxStatus, ID, IOutboxWriteInput, JsonData } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { EventDelivery } from './event-delivery.entity';
import { EventOutbox } from './event-outbox.entity';
import { MikroOrmEventDeliveryRepository } from './repository/mikro-orm-event-delivery.repository';
import { MikroOrmEventOutboxRepository } from './repository/mikro-orm-event-outbox.repository';

/** One of the two tables this store reads and writes. */
type OutboxTable = typeof EventOutbox | typeof EventDelivery;

/** A row as a statement states it, or as the store answers it: members by property name. */
type Row = Record<string, unknown>;

/**
 * The JSON members of a table, and what each reads as when the column holds nothing usable.
 *
 * The fallbacks are the ones `@JsonColumn` gives the TypeORM mapping of the same members — an empty body for
 * `payload`, nothing for `headers` — so a row answered through either ORM reads the same.
 */
const JSON_MEMBERS: ReadonlyMap<OutboxTable, Readonly<Record<string, JsonData | null>>> = new Map<
	OutboxTable,
	Readonly<Record<string, JsonData | null>>
>([
	[EventOutbox, { payload: {}, headers: null }],
	[EventDelivery, {}]
]);

/**
 * Whether a manager is MikroORM's.
 *
 * A caller's transaction is the thing `append` joins, and the manager is the only thing that says which ORM
 * opened it. The class test is the one the entity subscribers make; the shape test covers a manager that
 * reached this module through a second copy of `@mikro-orm/core`, where the class test alone would send a
 * MikroORM manager down the TypeORM path. A TypeORM manager has neither member, so the answer for it is
 * always no.
 *
 * @param manager The manager a caller handed over.
 * @returns True when it is a MikroORM entity manager.
 */
export function isMikroOrmEntityManager(manager: unknown): manager is MikroOrmEntityManager {
	if (manager instanceof MikroOrmEntityManager) {
		return true;
	}

	const candidate = manager as { getUnitOfWork?: unknown; nativeUpdate?: unknown } | null | undefined;

	return typeof candidate?.getUnitOfWork === 'function' && typeof candidate?.nativeUpdate === 'function';
}

/**
 * Chooses the rows a dispatch pass claims: the head of each partition that is due, and nothing behind it.
 *
 * It is the rule the TypeORM claim applies inline, member for member, so the two ORMs hand out the same rows:
 * the candidates arrive partition-major, the first row seen for a partition is its lowest sequence, a head
 * inside its backoff holds its whole partition back, and at most `batchSize` heads are taken.
 *
 * @param candidates Every non-terminal row read, in partition then sequence order.
 * @param batchSize How many rows the pass may claim.
 * @param now The clock the due check reads.
 * @returns The rows to claim, in partition then sequence order.
 */
export function claimablePartitionHeads(candidates: EventOutbox[], batchSize: number, now: Date): EventOutbox[] {
	const heads = new Map<string, EventOutbox>();
	const heldBack = new Set<string>();

	for (const candidate of candidates) {
		const key = candidate.partitionKey ?? (candidate.id as string);

		if (heads.has(key) || heldBack.has(key)) {
			continue;
		}

		if ((candidate.availableAt?.getTime() ?? 0) > now.getTime()) {
			heldBack.add(key);
			continue;
		}

		if (heads.size < batchSize) {
			heads.set(key, candidate);
		}
	}

	return Array.from(heads.values());
}

/**
 * The outbox's two tables, read and written through MikroORM.
 *
 * `EventOutboxService` keeps every TypeORM statement it has always made and hands the MikroORM half of each
 * operation to this store, which states the same rows with the same rules. Three things about the MikroORM
 * mapping of these entities decide how it does so, and each is a fact of the mapping rather than a choice:
 *
 * - **`tenantId` and `organizationId` are relation mirrors.** On this ORM they are the ids of the `tenant` and
 *   `organization` relations, mapped `persist: false`, so the entity path would write neither. Every write
 *   here is a native statement, which names the columns by those members and writes them.
 * - **`payload` and `headers` are written and read whether or not the mapping knows them.** `@JsonColumn`
 *   once registered the ORM that `ORM_TYPE` names, which nothing sets, so under `DB_ORM=mikro-orm` the two
 *   members were TypeORM's alone: a hydrated entity carried no body, and an entity-path write stored the
 *   column default. The store does not depend on which mapping it runs against. A JSON member the mapping
 *   knows is handed to its column type, and one it does not know is written as its encoded text under the
 *   column's own name; rows are read through the query builder, whose answer keeps a column the mapping does
 *   not know, and each JSON member is decoded the way the TypeORM mapping decodes it — so neither mapping
 *   encodes twice or drops the body.
 * - **The row id has no default on three of the four dialects.** The column default is `gen_random_uuid()`,
 *   a Postgres function, so the id is stated by the writer, as the event id already is.
 *
 * A row the store answers is a plain object with the entity's own members — its scalars and its relation
 * ids, never the relations — as TypeORM answers them: an entity instance of this ORM would serialise through
 * its metadata, and with it through whichever mapping of the JSON members is in force.
 *
 * **Every statement outside `append` runs in a context of the store's own**, forked from the repository's
 * manager and holding no transaction: the TypeORM half reaches the tables through the data source's own
 * manager, never through a caller's transaction, and a fork is the MikroORM spelling of the same thing. It is
 * also what lets a queue worker — which has no request, and therefore no request context — run a dispatch
 * pass at all, since MikroORM refuses context-specific work on its global manager.
 */
export class EventOutboxMikroOrmStore {
	constructor(
		private readonly outboxes: MikroOrmEventOutboxRepository,
		private readonly deliveries: MikroOrmEventDeliveryRepository
	) {}

	/**
	 * Appends an event inside the caller's persistence context.
	 *
	 * The context is the one the caller's manager resolves to: the transaction it opened — whether it hands
	 * over the transaction's own fork or a repository's manager while the transaction is open — or, for a
	 * caller with no transaction, the request's fork. The sequence is read and the row inserted there, so a
	 * rollback removes the row, and an append later in the same transaction reads this one and takes the next
	 * position.
	 *
	 * The row is inserted natively rather than persisted, so nothing else the caller has pending in its unit of
	 * work is flushed by this call: the append performs its two statements and no others, as the TypeORM half
	 * does.
	 *
	 * @param manager The caller's MikroORM entity manager.
	 * @param input What changed.
	 * @returns The stored row.
	 */
	async append(manager: MikroOrmEntityManager, input: IOutboxWriteInput): Promise<EventOutbox> {
		const em = manager.getContext(false) as SqlEntityManager;
		const partitionKey = input.partitionKey ?? `${input.aggregateType}:${input.aggregateId}`;
		const sequence = (await this.highestSequence(EventOutbox, { partitionKey }, em)) + 1;
		// Stated rather than left to an `onCreate` hook, which a native insert does not run: the timestamps are
		// the ones MikroORM's own unit of work would have written.
		const now = new Date();

		const row: Row = {
			id: randomUUID(),
			eventId: randomUUID(),
			eventName: input.name,
			aggregateType: input.aggregateType,
			aggregateId: input.aggregateId,
			payload: input.data ?? {},
			headers: input.headers,
			status: EventOutboxStatus.PENDING,
			attemptCount: 0,
			availableAt: now,
			partitionKey,
			sequence,
			tenantId: input.tenantId ?? RequestContext.currentTenantId(),
			organizationId: input.organizationId ?? RequestContext.currentOrganizationId(),
			createdAt: now,
			updatedAt: now
		};

		await em.insert(EventOutbox, this.columnsOf(EventOutbox, row, em) as never);

		return row as unknown as EventOutbox;
	}

	/**
	 * Claims a batch of events under a lease, in a transaction of the store's own.
	 *
	 * The statement set is the TypeORM claim's: every non-terminal row read in partition then sequence order,
	 * bounded at four batches, under `FOR UPDATE` where the dialect has row locks — Postgres and MySQL — and
	 * inside the transaction alone on SQLite, which serialises writers; the partition heads chosen by
	 * {@link claimablePartitionHeads}; and each chosen row's lease written as an absolute `availableAt` and
	 * `attemptCount` before the transaction commits.
	 *
	 * @param policy The batch size, the lease length and the clock.
	 * @returns The rows this caller now owns.
	 */
	async claimBatch(policy: { batchSize: number; leaseMs: number; now: Date }): Promise<EventOutbox[]> {
		const { batchSize, leaseMs, now } = policy;

		return this.manager(EventOutbox).transactional(async (em) => {
			const query = em
				.createQueryBuilder(EventOutbox, 'outbox')
				.select('*')
				.where({
					status: { $in: [EventOutboxStatus.PENDING, EventOutboxStatus.FAILED] },
					deletedAt: null
				} as never)
				.orderBy([{ partitionKey: QueryOrder.ASC }, { sequence: QueryOrder.ASC }] as never)
				.limit(Math.max(batchSize * 4, batchSize));

			if (isPostgres() || isMySQL()) {
				// `FOR UPDATE`, as the TypeORM claim takes: the rows are held until the lease is written, so two
				// dispatchers cannot claim one event. Not `SKIP LOCKED` — a pass that skipped a locked head would
				// read the next row of the same partition as its head and claim it out of order.
				query.setLockMode(LockMode.PESSIMISTIC_WRITE);
			}

			const candidates = ((await query.execute('all')) as Row[]).map(
				(candidate) => this.rowOf(EventOutbox, candidate) as unknown as EventOutbox
			);
			const claimed = claimablePartitionHeads(candidates, batchSize, now);
			const leaseUntil = new Date(now.getTime() + leaseMs);

			for (const row of claimed) {
				row.availableAt = leaseUntil;
				row.attemptCount = (row.attemptCount ?? 0) + 1;

				await this.write(em, EventOutbox, row.id as ID, {
					availableAt: row.availableAt,
					attemptCount: row.attemptCount
				});
			}

			return claimed;
		});
	}

	/**
	 * Writes members of one row, by id.
	 *
	 * `updatedAt` is stamped as TypeORM's update stamps it, and the soft-delete filter is left off, as TypeORM's
	 * update leaves it: a statement addressed to a row by id writes that row.
	 *
	 * @param table The table.
	 * @param id The row id.
	 * @param values The members to write.
	 */
	async update(table: OutboxTable, id: ID, values: Row): Promise<void> {
		await this.write(this.manager(table), table, id, values);
	}

	/**
	 * Counts one more attempt on a delivery record, in one relative statement.
	 *
	 * @param id The record id.
	 */
	async incrementDeliveryAttempts(id: ID): Promise<void> {
		const em = this.manager(EventDelivery);

		await em.nativeUpdate(
			EventDelivery,
			{ id } as never,
			{
				attemptCount: raw(`${em.getPlatform().quoteIdentifier('attemptCount')} + 1`),
				updatedAt: new Date()
			} as never,
			{ filters: false }
		);
	}

	/**
	 * Inserts a delivery record for one consumer of one event.
	 *
	 * @param input The event, the consumer, the ordering it carries and its scope.
	 * @returns The stored record.
	 * @throws The driver's unique violation when the pair already has a record — the lost race the caller reads.
	 */
	async insertDelivery(input: Row): Promise<EventDelivery> {
		const em = this.manager(EventDelivery);
		const now = new Date();
		const row: Row = {
			id: randomUUID(),
			...input,
			status: EventOutboxStatus.PENDING,
			attemptCount: 0,
			createdAt: now,
			updatedAt: now
		};

		await em.insert(EventDelivery, this.columnsOf(EventDelivery, row, em) as never);

		return row as unknown as EventDelivery;
	}

	/**
	 * Reads one row, leaving out a soft-deleted one as TypeORM's reads do.
	 *
	 * @param table The table.
	 * @param where The criteria, by member name, in MikroORM's spelling.
	 * @returns The row, or null.
	 */
	async findOne<T>(table: OutboxTable, where: Row): Promise<T | null> {
		const row = (await this.manager(table)
			.createQueryBuilder(table, 'record')
			.select('*')
			.where({ ...where, deletedAt: null } as never)
			.limit(1)
			.execute('get')) as Row | null | undefined;

		return row ? (this.rowOf(table, row) as unknown as T) : null;
	}

	/**
	 * Reads rows in a stated order, leaving out soft-deleted ones as TypeORM's reads do.
	 *
	 * @param table The table.
	 * @param where The criteria, by member name, in MikroORM's spelling.
	 * @param orderBy The order, as MikroORM states one.
	 * @returns The rows.
	 */
	async find<T>(table: OutboxTable, where: Row, orderBy: Array<Record<string, QueryOrder>>): Promise<T[]> {
		const rows = (await this.manager(table)
			.createQueryBuilder(table, 'record')
			.select('*')
			.where({ ...where, deletedAt: null } as never)
			.orderBy(orderBy as never)
			.execute('all')) as Row[];

		return rows.map((row) => this.rowOf(table, row) as unknown as T);
	}

	/**
	 * The highest `sequence` among the rows that match, or 0 when none does.
	 *
	 * It is the `MAX(sequence)` the TypeORM half selects, read as the first row of a descending order: rows
	 * without a sequence are left out, as `MAX` leaves them out, and a soft-deleted row is left out as TypeORM's
	 * select leaves it out. The descending read is served by the same indexes the aggregate is.
	 *
	 * @param table The table.
	 * @param where The criteria, by member name.
	 * @param em The context to read in; the store's own when none is stated.
	 * @returns The highest sequence.
	 */
	async highestSequence(table: OutboxTable, where: Row, em: SqlEntityManager = this.manager(table)): Promise<number> {
		const row = (await em
			.createQueryBuilder(table, 'record')
			.select('sequence')
			.where({ ...where, sequence: { $ne: null }, deletedAt: null } as never)
			.orderBy({ sequence: QueryOrder.DESC } as never)
			.limit(1)
			.execute('get')) as Row | null | undefined;

		return Number(row?.sequence ?? 0);
	}

	/**
	 * A context of the store's own, holding no transaction.
	 *
	 * @param table The table the context is for.
	 * @returns A fresh fork of that table's repository manager.
	 */
	private manager(table: OutboxTable): SqlEntityManager {
		return this.repositoryOf(table).getEntityManager().fork();
	}

	/**
	 * The MikroORM repository of a table.
	 *
	 * @param table The table.
	 * @returns Its repository.
	 */
	private repositoryOf(table: OutboxTable): MikroOrmEventOutboxRepository | MikroOrmEventDeliveryRepository {
		return table === EventDelivery ? this.deliveries : this.outboxes;
	}

	/**
	 * Writes members of one row, by id, in the given context.
	 *
	 * @param em The context.
	 * @param table The table.
	 * @param id The row id.
	 * @param values The members to write.
	 */
	private async write(em: SqlEntityManager, table: OutboxTable, id: ID, values: Row): Promise<void> {
		await em.nativeUpdate(
			table,
			{ id } as never,
			{ ...this.columnsOf(table, values, em), updatedAt: new Date() } as never,
			{ filters: false }
		);
	}

	/**
	 * The members of a statement, with the JSON members stated the way the mapping can write them.
	 *
	 * A JSON member the mapping knows is handed over as its value, and its type encodes it. One the mapping does
	 * not know reaches the statement under its own name, which is the column's, so it is encoded here: text for
	 * SQLite, and a JSON literal Postgres and MySQL cast to the column's type. A member left `undefined` is left
	 * out, so the column's own default applies, as TypeORM leaves it out.
	 *
	 * @param table The table.
	 * @param values The members, by property name.
	 * @param em The context whose metadata answers the mapping.
	 * @returns The members to hand the statement.
	 */
	private columnsOf(table: OutboxTable, values: Row, em: SqlEntityManager): Row {
		const mapped = em.getMetadata().find(table.name)?.properties ?? {};
		const jsonMembers = JSON_MEMBERS.get(table) ?? {};
		const columns: Row = {};

		for (const [member, value] of Object.entries(values)) {
			if (value === undefined) {
				continue;
			}

			columns[member] =
				member in jsonMembers && !(member in mapped) && value !== null ? JSON.stringify(value) : value;
		}

		return columns;
	}

	/**
	 * A row the query builder answered, as the entity's own members.
	 *
	 * The relations the query builder names beside their ids are dropped, the JSON members are decoded as the
	 * TypeORM mapping decodes them, and `sequence` — a `bigint`, which Postgres hands back as text — is read as a
	 * number, as the column's transformer reads it.
	 *
	 * @param table The table.
	 * @param answered The row as answered.
	 * @returns The row.
	 */
	private rowOf(table: OutboxTable, answered: Row): Row {
		const properties = this.repositoryOf(table).getEntityManager().getMetadata().find(table.name)?.properties ?? {};
		const jsonMembers = JSON_MEMBERS.get(table) ?? {};
		const row: Row = {};

		for (const [member, value] of Object.entries(answered)) {
			const property = properties[member] as { kind?: string } | undefined;

			if (property?.kind && property.kind !== 'scalar') {
				continue;
			}

			row[member] = value;
		}

		for (const [member, fallback] of Object.entries(jsonMembers)) {
			row[member] = decodeJson(row[member], fallback);
		}

		if ('sequence' in row) {
			row.sequence = row.sequence === null || row.sequence === undefined ? null : Number(row.sequence);
		}

		return row;
	}
}

/**
 * Reads a JSON column the way `@JsonColumn` reads it for TypeORM.
 *
 * A driver answers a JSON column as text (SQLite) or already decoded (Postgres `jsonb`, MySQL `json`); an
 * empty or unreadable column reads as the member's fallback rather than as an error.
 *
 * @param value The column as the driver answered it.
 * @param fallback What an empty or unreadable column reads as.
 * @returns The decoded value.
 */
function decodeJson(value: unknown, fallback: JsonData | null): JsonData | null {
	if (value === null || value === undefined) {
		return fallback;
	}

	if (typeof value === 'object') {
		return value as JsonData;
	}

	if (typeof value === 'string') {
		try {
			return JSON.parse(value) as JsonData;
		} catch {
			return fallback;
		}
	}

	return fallback;
}
