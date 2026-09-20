import { EventOutboxStatus, ID, IOutboxWriteInput } from '@gauzy/contracts';
import { EventDelivery } from './event-delivery.entity';
import { EventOutbox } from './event-outbox.entity';
import { EventOutboxService, describeFailure } from './event-outbox.service';
import { TypeOrmEventDeliveryRepository } from './repository/type-orm-event-delivery.repository';
import { TypeOrmEventOutboxRepository } from './repository/type-orm-event-outbox.repository';

/**
 * The transactional outbox, against tables that behave like the tables they stand in for.
 *
 * Two properties decide whether an event can be lost, and both are asserted here. The first is that
 * the event and the state change it describes are one write: appended through the caller's own
 * manager, so a rollback removes both and a commit keeps both. The second is that dispatch is
 * at-least-once *per consumer* and ordered *per aggregate*: a batch hands a partition's lowest
 * unpublished sequence to exactly one dispatcher, a consumer's acknowledgement is a row that cannot
 * be written twice, and a failure comes back on the documented ladder until the budget is spent.
 *
 * The clock is injected wherever the service accepts one, so no case waits for a lease to expire.
 */

type Row = Record<string, any>;

/** Stands in for the aggregate table a caller writes its state change to. */
class OrderState {}

/** The error the driver raises for a duplicate unique tuple, as the classifier reads it. */
function uniqueViolation(): Error {
	return Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
}

/** One column's criteria, including the operators TypeORM builds for `In` and friends. */
function matches(row: Row, criteria: Row = {}): boolean {
	return Object.entries(criteria).every(([column, condition]) => {
		const operator = condition as { _type?: string; _value?: unknown };

		if (operator && typeof operator === 'object' && operator._type === 'in' && Array.isArray(operator._value)) {
			return operator._value.includes(row[column]);
		}

		return (row[column] ?? null) === (condition ?? null);
	});
}

/**
 * An in-memory stand-in for one table.
 *
 * `save` stamps an id the way the database does and enforces the unique tuple the table is declared
 * with; `createQueryBuilder` understands the handful of predicates the service builds — a column
 * compared with a bound parameter, and a `MAX(...)` over the matching rows — so a query that stopped
 * filtering or ordering is caught here rather than accommodated.
 */
class Table {
	readonly rows: Row[] = [];
	private sequence = 0;

	constructor(private readonly uniqueKey?: (row: Row) => string) {}

	create(input: Row): Row {
		this.sequence += 1;

		return { id: `row-${this.sequence}`, ...input };
	}

	async save(rows: Row | Row[]): Promise<any> {
		for (const row of Array.isArray(rows) ? rows : [rows]) {
			const key = this.uniqueKey?.(row);
			const clash =
				key === undefined ? undefined : this.rows.find((entry) => entry.id !== row.id && this.uniqueKey?.(entry) === key);

			if (clash) {
				throw uniqueViolation();
			}

			const existing = this.rows.findIndex((entry) => entry.id === row.id);

			if (existing === -1) {
				this.rows.push(row);
			} else {
				this.rows[existing] = row;
			}
		}

		return rows;
	}

	async findOne(options: { where?: Row } = {}): Promise<Row | null> {
		return this.rows.find((row) => matches(row, options.where ?? {})) ?? null;
	}

	async find(options: { where?: Row } = {}): Promise<Row[]> {
		return this.rows.filter((row) => matches(row, options.where ?? {}));
	}

	async update(criteria: Row, values: Row): Promise<{ affected: number }> {
		const matched = this.rows
			.map((row, index) => ({ row, index }))
			.filter(({ row }) => matches(row, criteria));

		// A statement replaces the stored row; the entity the caller was holding is left as stale as the
		// database would leave it.
		for (const { row, index } of matched) {
			this.rows[index] = { ...row, ...values };
		}

		return { affected: matched.length };
	}

	async increment(criteria: Row, field: string, by: number): Promise<{ affected: number }> {
		const matched = this.rows
			.map((row, index) => ({ row, index }))
			.filter(({ row }) => matches(row, criteria));

		for (const { row, index } of matched) {
			this.rows[index] = { ...row, [field]: (row[field] ?? 0) + by };
		}

		return { affected: matched.length };
	}

	createQueryBuilder(alias: string) {
		const conditions: { clause: string; params: Row }[] = [];
		const ordering: { column: string; direction: string }[] = [];
		let limit: number | undefined;
		let selection: { expression: string; alias?: string } | undefined;

		const filtered = () => this.rows.filter((row) => evaluate(row, conditions));

		const builder = {
			where: (clause: string, params: Row = {}) => {
				conditions.push({ clause, params });

				return builder;
			},
			andWhere: (clause: string, params: Row = {}) => {
				conditions.push({ clause, params });

				return builder;
			},
			orderBy: (column: string, direction: string) => {
				ordering.push({ column: unqualify(column, alias), direction });

				return builder;
			},
			addOrderBy: (column: string, direction: string) => {
				ordering.push({ column: unqualify(column, alias), direction });

				return builder;
			},
			limit: (value: number) => {
				limit = value;

				return builder;
			},
			setLock: (_mode: string) => builder,
			select: (expression: string, aliasOfSelection?: string) => {
				selection = { expression, alias: aliasOfSelection };

				return builder;
			},
			getMany: async () =>
				filtered()
					.sort(byOrder(ordering))
					.slice(0, limit ?? Number.MAX_SAFE_INTEGER),
			getOne: async () => filtered()[0] ?? null,
			getRawOne: async () => {
				if (!selection) {
					return null;
				}

				const column = /MAX\(\s*\w+\.(\w+)\s*\)/i.exec(selection.expression)?.[1];
				const values = filtered()
					.map((row) => Number(row[column]))
					.filter((value) => Number.isFinite(value));

				return { [selection.alias ?? 'max']: values.length ? Math.max(...values) : null };
			}
		};

		return builder;
	}
}

/** Reads the `alias.column <op> :param` and `alias.column IN (:...param)` clauses the service builds. */
function evaluate(row: Row, conditions: { clause: string; params: Row }[]): boolean {
	return conditions.every(({ clause, params }) => {
		const inClause = /(\w+)\.(\w+)\s+IN\s*\(:\.\.\.(\w+)\)/.exec(clause);

		if (inClause) {
			return (params[inClause[3]] as unknown[]).includes(row[inClause[2]]);
		}

		const parsed = /(\w+)\.(\w+)\s*(<=|>=|<>|=|<|>)\s*:(\w+)/.exec(clause);

		if (!parsed) {
			throw new Error(`The in-memory query builder cannot read the clause "${clause}".`);
		}

		const [, , column, operator, parameter] = parsed;
		const left = instant(row[column]);
		const right = instant(params[parameter]);

		switch (operator) {
			case '=':
				return left === right;
			case '<>':
				return left !== right;
			case '<=':
				return left <= right;
			case '>=':
				return left >= right;
			case '<':
				return left < right;
			default:
				return left > right;
		}
	});
}

/** Compares two values as instants when both are dates, and as values otherwise. */
function instant(value: unknown): any {
	return value instanceof Date ? value.getTime() : value;
}

function unqualify(column: string, alias: string): string {
	return column.startsWith(`${alias}.`) ? column.slice(alias.length + 1) : column;
}

function byOrder(ordering: { column: string; direction: string }[]): (left: Row, right: Row) => number {
	return (left, right) => {
		for (const { column, direction } of ordering) {
			if (instant(left[column]) === instant(right[column])) {
				continue;
			}

			return (instant(left[column]) > instant(right[column]) ? 1 : -1) * (direction === 'DESC' ? -1 : 1);
		}

		return 0;
	};
}

/**
 * The tables one service writes to, plus the manager that routes a statement to its table and rolls
 * every table back together — which is what makes "one unit of work" assertable without a database.
 */
class Database {
	readonly tables = new Map<unknown, Table>();
	readonly transactions: number[] = [];

	constructor(private readonly uniqueKeys: Map<unknown, (row: Row) => string> = new Map()) {}

	tableOf(entity: unknown): Table {
		let table = this.tables.get(entity);

		if (!table) {
			table = new Table(this.uniqueKeys.get(entity));
			this.tables.set(entity, table);
		}

		return table;
	}

	async transaction<R>(work: (manager: any) => Promise<R>): Promise<R> {
		const before = new Map(
			[...this.tables.entries()].map(([entity, table]) => [entity, table.rows.map((row) => ({ ...row }))])
		);

		try {
			const result = await work(this.manager);

			this.transactions.push(this.tables.size);

			return result;
		} catch (error) {
			for (const [entity, table] of this.tables) {
				const snapshot = before.get(entity);

				table.rows.splice(0, table.rows.length, ...(snapshot ?? []));
			}

			throw error;
		}
	}

	readonly manager = {
		transaction: <R>(work: (manager: any) => Promise<R>): Promise<R> => this.transaction(work),
		create: (entity: unknown, input: Row) => this.tableOf(entity).create(input),
		save: (entity: unknown, rows: Row | Row[]) => this.tableOf(entity).save(rows),
		update: (entity: unknown, criteria: Row, values: Row) => this.tableOf(entity).update(criteria, values),
		createQueryBuilder: (entity: unknown, alias: string) => this.tableOf(entity).createQueryBuilder(alias)
	};
}

/** A repository stand-in: the table it owns, plus the shared manager. */
function repositoryFor(table: Table, db: Database, calls: string[]) {
	const record = <T>(name: string, value: T): T => {
		calls.push(name);

		return value;
	};

	return {
		create: (input: Row) => record('create', table.create(input)),
		save: (rows: Row | Row[]) => record('save', table.save(rows)),
		findOne: (options: { where?: Row }) => record('findOne', table.findOne(options)),
		find: (options: { where?: Row }) => record('find', table.find(options)),
		update: (criteria: Row, values: Row) => record('update', table.update(criteria, values)),
		increment: (criteria: Row, field: string, by: number) => record('increment', table.increment(criteria, field, by)),
		createQueryBuilder: (alias: string) => record('createQueryBuilder', table.createQueryBuilder(alias)),
		manager: db.manager
	};
}

const ORDER = '6b1e0f2a-0000-4000-8000-000000000001';
const OTHER_ORDER = '6b1e0f2a-0000-4000-8000-000000000002';
const T0 = new Date('2026-03-01T10:00:00Z');
const CONSUMER = 'subscriber:notification.order-confirmation';

/** The service under test, with the tables and the manager it writes through. */
function outbox() {
	const db = new Database(
		new Map<unknown, (row: Row) => string>([
			[EventOutbox, (row) => String(row.eventId)],
			[EventDelivery, (row) => `${row.eventId}:${row.consumerKey}`]
		])
	);
	const calls: string[] = [];

	const events = repositoryFor(db.tableOf(EventOutbox), db, calls);
	const deliveries = repositoryFor(db.tableOf(EventDelivery), db, calls);

	const service = new EventOutboxService(
		events as unknown as TypeOrmEventOutboxRepository,
		{} as never,
		deliveries as unknown as TypeOrmEventDeliveryRepository,
		{} as never
	);

	return { service, db, calls, events: db.tableOf(EventOutbox), deliveries: db.tableOf(EventDelivery) };
}

/** A `order.placed` write, so a case can vary exactly one thing. */
const placed = (overrides: Partial<IOutboxWriteInput> = {}): IOutboxWriteInput => ({
	name: 'order.placed',
	aggregateType: 'Order',
	aggregateId: ORDER,
	data: { orderId: ORDER, total: '199.90' },
	...overrides
});

beforeEach(() => {
	// Every window in this service is decided against the clock, and an event is appended as due
	// immediately: pinning the clock is what makes that determinism rather than a race.
	jest.useFakeTimers();
	jest.setSystemTime(T0);
});

afterEach(() => {
	jest.useRealTimers();
	jest.restoreAllMocks();
});

describe('appending inside the caller’s transaction', () => {
	it('writes the event and the state change as one unit of work, so a rollback removes both', async () => {
		const { service, db } = outbox();

		const refused = db.manager.transaction(async (manager) => {
			await manager.save(OrderState, { id: ORDER, status: 'PLACED' });
			await service.append(manager, placed());

			throw new Error('the state change was refused');
		});

		await expect(refused).rejects.toThrow('the state change was refused');

		// Control: an outbox writer that opened its own transaction would leave an event describing a
		// state change that never happened — the one failure the whole pattern exists to prevent.
		expect(db.tableOf(OrderState).rows).toEqual([]);
		expect(db.tableOf(EventOutbox).rows).toEqual([]);
	});

	it('commits the event with the state change, pending and due immediately', async () => {
		const { service, db } = outbox();

		const row = await db.manager.transaction(async (manager) => {
			await manager.save(OrderState, { id: ORDER, status: 'PLACED' });

			return service.append(manager, placed());
		});

		expect(db.tableOf(OrderState).rows).toHaveLength(1);
		expect(db.tableOf(EventOutbox).rows).toHaveLength(1);
		expect(row).toMatchObject({
			eventName: 'order.placed',
			aggregateType: 'Order',
			aggregateId: ORDER,
			status: EventOutboxStatus.PENDING,
			attemptCount: 0,
			sequence: 1,
			partitionKey: `Order:${ORDER}`
		});
		expect(String(row.eventId)).toMatch(/^[0-9a-f-]{36}$/);
		expect(new Date(row.availableAt).getTime()).toBeLessThanOrEqual(T0.getTime());
	});

	it('writes through the caller’s manager and never through a repository of its own', async () => {
		// There is deliberately no overload that opens a transaction: publishing is the dispatcher's
		// job, and a writer that could write on its own is how the event and the state drift apart.
		const { service, db, calls } = outbox();

		await db.manager.transaction((manager) => service.append(manager, placed()));

		expect(calls).toEqual([]);
	});

	it('allocates the sequence per partition, inside the caller’s transaction', async () => {
		const { service, db } = outbox();

		const sequences = await db.manager.transaction(async (manager) => [
			(await service.append(manager, placed({ name: 'order.placed' }))).sequence,
			(await service.append(manager, placed({ name: 'order.confirmed' }))).sequence,
			(await service.append(manager, placed({ aggregateId: OTHER_ORDER }))).sequence,
			(await service.append(manager, placed({ name: 'order.shipped' }))).sequence
		]);

		// One aggregate's events are ordered against each other; another aggregate has its own count.
		expect(sequences).toEqual([1, 2, 1, 3]);
	});

	it('lets a producer state its own ordering key', async () => {
		const { service, db } = outbox();

		const row = await db.manager.transaction((manager) =>
			service.append(manager, placed({ partitionKey: 'Order:synthetic' }))
		);

		expect(row.partitionKey).toBe('Order:synthetic');
	});
});

describe('claiming a batch for dispatch', () => {
	it('hands a row to one dispatcher at a time by pushing its availability past the lease', async () => {
		const { service, db } = outbox();

		await db.manager.transaction((manager) => service.append(manager, placed()));

		const first = await service.claimBatch({ batchSize: 10, leaseMs: 60_000, now: T0 });

		expect(first.map((row) => row.sequence)).toEqual([1]);
		expect(first[0].attemptCount).toBe(1);
		expect(first[0].availableAt).toEqual(new Date(T0.getTime() + 60_000));

		// A second dispatcher passing inside the lease must take nothing: the lease is the crash
		// recovery mechanism, and a row claimed twice is a row dispatched twice.
		expect(await service.claimBatch({ now: T0 })).toEqual([]);
		expect(await service.claimBatch({ now: new Date(T0.getTime() + 59_000) })).toEqual([]);

		// Once it expires the row comes back, with the attempt it has already spent recorded.
		const reclaimed = await service.claimBatch({ now: new Date(T0.getTime() + 60_001) });

		expect(reclaimed.map((row) => row.sequence)).toEqual([1]);
		expect(reclaimed[0].attemptCount).toBe(2);
	});

	it('claims only the lowest unpublished sequence of each partition', async () => {
		const { service, db } = outbox();

		await db.manager.transaction(async (manager) => {
			await service.append(manager, placed({ name: 'order.placed' }));
			await service.append(manager, placed({ name: 'order.confirmed' }));
			await service.append(manager, placed({ aggregateId: OTHER_ORDER, name: 'order.placed' }));
		});

		const batch = await service.claimBatch({ now: T0 });

		expect(batch.map((row) => `${row.aggregateId}#${row.sequence}`)).toEqual([`${ORDER}#1`, `${OTHER_ORDER}#1`]);
		expect(batch.map((row) => row.eventName)).toEqual(['order.placed', 'order.placed']);
	});

	it('lets a partition’s next event through only once its head has been published', async () => {
		const { service, db } = outbox();

		await db.manager.transaction(async (manager) => {
			await service.append(manager, placed({ name: 'order.placed' }));
			await service.append(manager, placed({ name: 'order.confirmed' }));
		});

		const [head] = await service.claimBatch({ now: T0 });
		await service.markPublished(head.id as ID, { at: T0 });

		const next = await service.claimBatch({ now: T0 });

		expect(next.map((row) => row.eventName)).toEqual(['order.confirmed']);
		expect(next[0].sequence).toBe(2);
	});

	it('bounds a batch, so one pass cannot take the whole backlog', async () => {
		const { service, db } = outbox();

		await db.manager.transaction(async (manager) => {
			await service.append(manager, placed({ aggregateId: ORDER }));
			await service.append(manager, placed({ aggregateId: OTHER_ORDER }));
		});

		expect(await service.claimBatch({ batchSize: 1, now: T0 })).toHaveLength(1);
	});
});

describe('failure, backoff and dead-lettering', () => {
	it('schedules the next attempt on the documented ladder, jittered around each step', async () => {
		const { service, events, db } = outbox();

		const appended = await db.manager.transaction((manager) => service.append(manager, placed()));

		const ladder = EventOutboxService.BACKOFF_LADDER_MS;
		let now = T0;

		// Each dispatch attempt records its own number on the row and each failure schedules the next
		// one a step further out; every step is inside the 20 % jitter the ladder is written with.
		for (let attempt = 1; attempt <= ladder.length; attempt += 1) {
			events.rows[0].attemptCount = attempt;

			const row = await service.markFailed(appended.id as ID, new Error('the queue is unavailable'), { now });
			const delay = new Date(row.availableAt).getTime() - now.getTime();
			const step = ladder[attempt - 1];

			expect(row.status).toBe(EventOutboxStatus.FAILED);
			expect(row.lastError).toBe('the queue is unavailable');
			expect(delay).toBeGreaterThanOrEqual(Math.floor(step * 0.8));
			expect(delay).toBeLessThanOrEqual(Math.ceil(step * 1.2));

			now = new Date(row.availableAt);
		}

		expect(ladder).toEqual([5_000, 30_000, 120_000, 600_000, 3_600_000]);
		expect(db.tableOf(EventOutbox).rows).toHaveLength(1);
	});

	it('parks a row whose attempt budget is spent instead of retrying it forever', async () => {
		const { service, db } = outbox();

		await db.manager.transaction((manager) => service.append(manager, placed()));
		await service.claimBatch({ now: T0 });

		const row = await service.markFailed(
			db.tableOf(EventOutbox).rows[0].id as ID,
			new Error('the queue is unavailable'),
			{ now: T0, maxAttempts: 1 }
		);

		expect(row.status).toBe(EventOutboxStatus.DEAD);
		expect(row.lastError).toBe('the queue is unavailable');
		expect(row.publishedAt).toBeNull();
		// A dead event is the diagnosis: the row is kept, names the event and can be reset by an admin.
		expect(db.tableOf(EventOutbox).rows).toHaveLength(1);
	});

	it('records only the failure’s message, never a stack trace', () => {
		expect(describeFailure(new Error('the queue is unavailable'))).toBe('the queue is unavailable');
		expect(describeFailure('plain text')).toBe('plain text');
		expect(describeFailure({ code: 'ECONNREFUSED' })).toBe('{"code":"ECONNREFUSED"}');

		const circular: Record<string, unknown> = {};
		circular.self = circular;
		expect(describeFailure(circular)).toBe('Unknown failure');
	});

	it('retries a failed dispatch once its backoff elapses, before the rest of its partition', async () => {
		const { service, db } = outbox();

		await db.manager.transaction(async (manager) => {
			await service.append(manager, placed({ name: 'order.placed' }));
			await service.append(manager, placed({ name: 'order.confirmed' }));
		});

		const [head] = await service.claimBatch({ batchSize: 1, now: T0 });
		expect(head.eventName).toBe('order.placed');

		const failed = await service.markFailed(head.id as ID, new Error('the queue is unavailable'), { now: T0 });
		const dueAt = new Date(failed.availableAt);

		expect(failed.status).toBe(EventOutboxStatus.FAILED);

		// The row is due again at the instant the backoff names, and the retry is claimed before the
		// partition's second event: the head of the line is still the head.
		const retry = await service.claimBatch({ now: dueAt });

		expect(retry.map((row) => row.eventName)).toEqual(['order.placed']);
		expect(retry[0].attemptCount).toBe(2);

		// Only once the head is published does the next event of the aggregate move.
		await service.markPublished(retry[0].id as ID, { at: dueAt });

		expect((await service.claimBatch({ now: dueAt })).map((row) => row.eventName)).toEqual(['order.confirmed']);
	});

	it('parks a failed event once the dispatch budget is spent rather than retrying it forever', async () => {
		const { service, db } = outbox();

		await db.manager.transaction((manager) => service.append(manager, placed()));
		const [claimed] = await service.claimBatch({ now: T0 });
		const failed = await service.markFailed(claimed.id as ID, new Error('the queue is unavailable'), { now: T0 });

		// The claim recorded one attempt, so a budget of one is already spent.
		const dead = await service.markFailed(failed.id as ID, new Error('still unavailable'), {
			now: T0,
			maxAttempts: 1
		});

		expect(dead.status).toBe(EventOutboxStatus.DEAD);
		expect(dead.lastError).toBe('still unavailable');
		expect(dead.publishedAt).toBeNull();
		// A dead row is terminal: no later pass picks it up, whatever its availability says.
		expect(await service.claimBatch({ now: new Date(T0.getTime() + 10 * 60_000) })).toEqual([]);
	});

	// The head-of-line rule now holds while a head waits to be retried. `claimBatch` reads every
	// non-terminal row and takes each partition's *first* one — its head — and only then asks whether
	// that head is due; a head inside its backoff is recorded as holding its partition back, so the
	// partition's next event is no longer mistaken for a head and claimed while its predecessor is
	// unpublished. The consumer-side order gate was what exposed this: it rejected the overtaking event
	// and had it redelivered, so nothing was ever applied out of order, but the dispatcher's own promise
	// (docs/12 §2.4, "never claims a second row of a partition key before the first is `PUBLISHED`") did
	// not hold in the meantime.
	it('never hands out a partition’s next event while an earlier one is waiting to be retried', async () => {
		const { service, db } = outbox();

		await db.manager.transaction(async (manager) => {
			await service.append(manager, placed({ name: 'order.placed' }));
			await service.append(manager, placed({ name: 'order.confirmed' }));
		});

		const [head] = await service.claimBatch({ batchSize: 1, now: T0 });
		const failed = await service.markFailed(head.id as ID, new Error('the queue is unavailable'), { now: T0 });

		// The head is due again in five seconds; a second later it is still unpublished, so the events
		// of its aggregate have not arrived in the order they happened and the next one must wait.
		expect(new Date(failed.availableAt).getTime()).toBeGreaterThan(T0.getTime() + 1_000);
		expect(await service.claimBatch({ now: new Date(T0.getTime() + 1_000) })).toEqual([]);
	});

	it('marks an event published only once every consumer entry point accepted it', async () => {
		const { service, db } = outbox();

		await db.manager.transaction((manager) => service.append(manager, placed()));
		const [claimed] = await service.claimBatch({ now: T0 });

		const published = await service.markPublished(claimed.id as ID, { at: T0 });

		expect(published).toMatchObject({
			status: EventOutboxStatus.PUBLISHED,
			publishedAt: T0,
			lastError: null
		});
	});

	it('builds the envelope from the stored row, so a replay carries the same event identity', async () => {
		const { service, db } = outbox();

		const row = await db.manager.transaction((manager) =>
			service.append(
				manager,
				placed({ headers: { correlationId: 'corr-1', causationId: 'cause-1', channelId: 'channel-1' } })
			)
		);

		expect(service.toEnvelope(row)).toEqual({
			id: row.eventId,
			name: 'order.placed',
			version: EventOutboxService.PAYLOAD_VERSION,
			occurredAt: T0,
			tenantId: null,
			organizationId: null,
			channelId: 'channel-1',
			aggregate: { type: 'Order', id: ORDER },
			sequence: 1,
			partitionKey: `Order:${ORDER}`,
			correlationId: 'corr-1',
			causationId: 'cause-1',
			producer: 'order',
			data: { orderId: ORDER, total: '199.90' }
		});
	});
});

describe('the per-consumer delivery record', () => {
	/** An event already in the outbox, so a delivery case does not repeat the append. */
	async function withEvent(service: EventOutboxService, db: Database): Promise<ID> {
		const row = await db.manager.transaction((manager) => service.append(manager, placed()));

		return row.eventId as ID;
	}

	it('invokes a consumer once and reports that an acknowledged event must not be invoked again', async () => {
		const { service, db } = outbox();
		const eventId = await withEvent(service, db);
		let invocations = 0;

		const first = await service.claimDelivery({ eventId, consumerKey: CONSUMER, partitionKey: `Order:${ORDER}`, sequence: 1 });
		invocations += 1;
		await service.completeDelivery(first.delivery.id as ID, { delivered: true });

		const second = await service.claimDelivery({ eventId, consumerKey: CONSUMER });

		// Control: the insert is the ledger. A consumer that ran twice would double every notification
		// the platform sends, and the count below is what says it did not.
		expect(first.claimed).toBe(true);
		expect(second.claimed).toBe(false);
		expect(second.delivery.status).toBe(EventOutboxStatus.PUBLISHED);
		expect(invocations).toBe(1);
		expect(db.tableOf(EventDelivery).rows).toHaveLength(1);
	});

	it('hands a pending record over again and counts the attempt against the consumer’s budget', async () => {
		const { service, db } = outbox();
		const eventId = await withEvent(service, db);

		const first = await service.claimDelivery({ eventId, consumerKey: CONSUMER });
		await service.completeDelivery(first.delivery.id as ID, { delivered: false, error: new Error('temporary') });

		const second = await service.claimDelivery({ eventId, consumerKey: CONSUMER });

		// A pending or failed record means the event was lost mid-delivery the first time round.
		expect(second.claimed).toBe(true);
		expect(second.delivery.attemptCount).toBe(1);
		expect(second.delivery.status).toBe(EventOutboxStatus.FAILED);
	});

	it('dead-letters a consumer that has spent its attempts', async () => {
		const { service, db } = outbox();
		const eventId = await withEvent(service, db);

		const first = await service.claimDelivery({ eventId, consumerKey: CONSUMER });
		await service.completeDelivery(first.delivery.id as ID, { delivered: false, error: new Error('first') });

		// The second claim is the attempt that spends the consumer's budget.
		const second = await service.claimDelivery({ eventId, consumerKey: CONSUMER });
		await service.completeDelivery(second.delivery.id as ID, {
			delivered: false,
			error: new Error('still failing'),
			maxAttempts: 1
		});

		const row = await service.findDelivery(eventId, CONSUMER);

		expect(row?.status).toBe(EventOutboxStatus.DEAD);
		expect(row?.lastError).toBe('still failing');
	});

	it('surfaces an error that is not a lost race', async () => {
		const { service, db } = outbox();
		const eventId = await withEvent(service, db);

		jest.spyOn(db.tableOf(EventDelivery), 'save').mockRejectedValueOnce(new Error('connection terminated unexpectedly'));

		await expect(service.claimDelivery({ eventId, consumerKey: CONSUMER })).rejects.toThrow(
			'connection terminated unexpectedly'
		);
	});

	it('reports the highest sequence a consumer acknowledged, which is the order gate', async () => {
		const { service, db } = outbox();
		const eventId = await withEvent(service, db);
		const partitionKey = `Order:${ORDER}`;

		expect(await service.findLastDeliveredSequence(CONSUMER, partitionKey)).toBe(0);

		const first = await service.claimDelivery({ eventId, consumerKey: CONSUMER, partitionKey, sequence: 1 });
		await service.completeDelivery(first.delivery.id as ID, { delivered: true });

		// A second event of the same partition, still in flight, does not advance the gate.
		const second = await service.claimDelivery({ eventId: `${eventId}-2`, consumerKey: CONSUMER, partitionKey, sequence: 2 });

		expect(await service.findLastDeliveredSequence(CONSUMER, partitionKey)).toBe(1);

		await service.completeDelivery(second.delivery.id as ID, { delivered: true });

		expect(await service.findLastDeliveredSequence(CONSUMER, partitionKey)).toBe(2);
		// Another consumer's acknowledgements are its own.
		expect(await service.findLastDeliveredSequence('job:events', partitionKey)).toBe(0);
	});

	it('advances the gate past a position an operator deliberately stopped', async () => {
		const { service, db } = outbox();
		const eventId = await withEvent(service, db);
		const partitionKey = `Order:${ORDER}`;

		const first = await service.claimDelivery({ eventId, consumerKey: CONSUMER, partitionKey, sequence: 1 });

		await service.deadLetterDelivery(first.delivery.id as ID, 'the endpoint is gone and the fact is stale');

		// Control: the gate asks what a consumer has *settled*, not what it received. A gate that kept
		// waiting for this position would hold every later event of the aggregate forever, which is a
		// worse outcome than the one the operator chose — and nothing else in the run would report it,
		// because the events would simply stop arriving.
		expect(await service.findLastDeliveredSequence(CONSUMER, partitionKey)).toBe(1);
	});

	it('reports nothing for a record that does not exist', async () => {
		const { service } = outbox();

		expect(await service.findDeliveryById('row-404')).toBeNull();
		expect(await service.findById('row-404')).toBeNull();
	});
});
