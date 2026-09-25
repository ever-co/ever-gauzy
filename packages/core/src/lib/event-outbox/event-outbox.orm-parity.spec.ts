/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — see
 * `../channel/channel.controller.spec.ts` for the cycle it avoids. It also loads the entity registry
 * under the default ORM, which is the TypeORM mapping the first half of this suite runs on.
 */
import '../core/entities/internal';

import { randomUUID } from 'node:crypto';
import { Logger, NotFoundException } from '@nestjs/common';
import type { Job } from 'bullmq';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { EventOutboxStatus, ID, IEventEnvelope, IOutboxWriteInput } from '@gauzy/contracts';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { coreEntities } from '../core/entities';
import { RequestContext } from '../core/context/request-context';
import { CreateEventOutboxTables1791000000020 } from '../database/migrations/1791000000020-CreateEventOutboxTables';
import { EventConsumerRegistry } from './event-consumer.registry';
import { EventDelivery } from './event-delivery.entity';
import { EventOutboxDispatchWorker } from './event-outbox-dispatch.worker';
import { EventOutbox } from './event-outbox.entity';
import { EventOutboxService } from './event-outbox.service';
import { TypeOrmEventDeliveryRepository } from './repository/type-orm-event-delivery.repository';
import { TypeOrmEventOutboxRepository } from './repository/type-orm-event-outbox.repository';

/**
 * The outbox kernel on both ORMs, against the tables its own migration creates, on real in-memory SQLite.
 *
 * `append` used to take a TypeORM manager only, and every other operation — the claim, the three marks, the
 * delivery ledger, the order gate, the scoped reads and the two operator moves — read and wrote through the
 * TypeORM repositories. Under `DB_ORM=mikro-orm` those TypeORM entities carry their base columns and nothing
 * else, because `@MultiORMColumn` registers the configured ORM's decorator alone: no event could be appended
 * through the kernel, and nothing appended could be dispatched. Each half below runs the **real** entities
 * under the mapping its ORM gives them — the TypeORM half over the registry this file loads, the MikroORM
 * half over the same registry loaded again with `DB_ORM=mikro-orm` — so what is exercised is what each ORM
 * actually sends, the JSON body and headers included, under whichever mapping `@JsonColumn` gives them there.
 *
 * The cases are the same on both ORMs, with the same expectations, because the promise is that the rows do
 * not depend on the ORM: a rollback removes the event with the state change, a partition's positions stay
 * gapless, a claim hands out each partition's due head under a lease, and publish, fail and dead-letter
 * leave the same row behind. Postgres and MySQL are not available to this suite; what differs there — the
 * row lock the claim takes — is pinned by observing that each ORM asks for it on those dialects and not on
 * SQLite.
 */

type Row = Record<string, any>;

/** The tenant and organization every scoped case reads as, and a second of each whose rows must stay out. */
const TENANT = '6b1e0f2a-0000-4000-8000-0000000000a1';
const OTHER_TENANT = '6b1e0f2a-0000-4000-8000-0000000000a2';
const ORG = '6b1e0f2a-0000-4000-8000-0000000000b1';
const OTHER_ORG = '6b1e0f2a-0000-4000-8000-0000000000b2';

/** Two aggregates whose partitions sort in this order. */
const ORDER = '6b1e0f2a-0000-4000-8000-000000000001';
const OTHER_ORDER = '6b1e0f2a-0000-4000-8000-000000000002';
const PARTITION = `Order:${ORDER}`;
const OTHER_PARTITION = `Order:${OTHER_ORDER}`;

const CONSUMER = 'subscriber:notification.order-confirmation';

/** An `order.placed` write, so a case can vary exactly one thing. */
const placed = (overrides: Partial<IOutboxWriteInput> = {}): IOutboxWriteInput => ({
	name: 'order.placed',
	aggregateType: 'Order',
	aggregateId: ORDER,
	data: { orderId: ORDER, total: '199.90', lines: [{ sku: 'SKU-1', quantity: 2 }] },
	tenantId: TENANT,
	organizationId: ORG,
	...overrides
});

/** One ORM's store, and the kernel wired to it the way its module wires it. */
interface IOutboxHarness {
	service: EventOutboxService;
	registry: EventConsumerRegistry;
	worker: EventOutboxDispatchWorker;
	/** This registry's request context, which the scoped reads consult. */
	requestContext: typeof RequestContext;
	/** Runs work in a transaction of this ORM, handing it the transaction's own manager. */
	inTransaction<T>(work: (manager: any) => Promise<T>): Promise<T>;
	/** Writes the caller's own state change through a manager, as a service writes its aggregate. */
	writeState(manager: any, id: string): Promise<void>;
	/** Reads the store raw, as the database holds it. */
	query(sql: string, params?: unknown[]): Promise<Row[]>;
	/**
	 * Observes the row lock the claim asks for, without sending it to a dialect that has none.
	 *
	 * @returns A reader of the lock modes asked for so far, by name.
	 */
	observeLock(): () => string[];
	/** This registry's dialect questions, so a case can answer them as Postgres or MySQL would. */
	dialect: { isPostgres: () => boolean; isMySQL: () => boolean };
	/** Silences the worker's pass log in this registry. */
	quiet(): void;
	close(): Promise<void>;
}

/** The table a scoped case's own state change lands in, beside the two the migration creates. */
const STATE_TABLE = `CREATE TABLE "outbox_probe_state" ("id" varchar PRIMARY KEY NOT NULL)`;

/**
 * The TypeORM store: the platform's own entity registry over one in-memory database.
 *
 * The data source is given every core entity because TypeORM resolves each relation's target, and the base
 * entity alone relates the outbox to the tenant, the organization and the user.
 */
async function typeOrmHarness(): Promise<IOutboxHarness> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: coreEntities,
		synchronize: false,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});
	await dataSource.initialize();

	const runner = dataSource.createQueryRunner();
	await new CreateEventOutboxTables1791000000020().sqliteUpQueryRunner(runner);
	await runner.query(STATE_TABLE);
	await runner.release();

	const service = new EventOutboxService(
		new TypeOrmEventOutboxRepository(dataSource.getRepository(EventOutbox)),
		{} as never,
		new TypeOrmEventDeliveryRepository(dataSource.getRepository(EventDelivery)),
		{} as never
	);
	const registry = new EventConsumerRegistry(service);
	// Read through the module the service reads, so a spy answers the question the service asks.
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const dialect = require('../../../../config/src/lib/database-helpers');

	return {
		service,
		registry,
		worker: new EventOutboxDispatchWorker(service, registry),
		requestContext: RequestContext,
		inTransaction: (work) => dataSource.manager.transaction((manager) => work(manager)),
		writeState: async (manager, id) => {
			await manager.query(`INSERT INTO "outbox_probe_state" ("id") VALUES (?)`, [id]);
		},
		query: (sql, params = []) => dataSource.query(sql, params),
		observeLock: () => {
			const lock = jest.spyOn(SelectQueryBuilder.prototype, 'setLock').mockImplementation(function (this: unknown) {
				return this as never;
			});

			return () => lock.mock.calls.map(([mode]) => String(mode).toUpperCase());
		},
		dialect,
		quiet: () => silence(Logger),
		close: () => dataSource.destroy()
	};
}

/** The registry loaded under MikroORM, and the MikroORM instance over it. */
interface IMikroOrmModules {
	orm: any;
	EventOutbox: any;
	EventDelivery: any;
}

/** The MikroORM half of the last harness built, for the cases that are about that ORM alone. */
let mikroOrm: IMikroOrmModules;

/**
 * The MikroORM store: the platform's own entity registry loaded again under `DB_ORM=mikro-orm`.
 *
 * The decorators decide the mapping when a class is defined, so the registry is re-required in a fresh
 * module registry, with the kernel, the ORM and the driver it uses — as the entity specs beside the invoice
 * and the product category do. MikroORM discovers every entity the outbox relates to from the two it is
 * handed, and it does so **inside** the fresh registry: the base entity reaches the user entity through a
 * `require` in its relation callbacks, which discovery calls, and a callback called after the isolation
 * ended would resolve the TypeORM-mapped class instead. The context rule is the application's: a statement
 * that needs a persistence context must find one of its own, so a pass that leaned on the global manager
 * would fail here as it fails in a queue worker.
 *
 * @param options.jsonMembersUnmapped Loads the registry with `@JsonColumn` registering a TypeORM column and
 * no MikroORM property — what it did under `DB_ORM=mikro-orm` while it read `ORM_TYPE` — so the store is
 * proven against the mapping that does not know `payload` and `headers` as well as the one that does.
 */
async function mikroOrmHarness(options: { jsonMembersUnmapped?: boolean } = {}): Promise<IOutboxHarness> {
	const previous = process.env.DB_ORM;
	const jsonColumn = '../core/decorators/entity/json-column.decorator';
	let loaded: Row = {};
	let orm: any;

	process.env.DB_ORM = 'mikro-orm';

	try {
		await jest.isolateModulesAsync(async () => {
			// MikroORM keeps decorator metadata in a store global to the process, keyed by class and file, so a
			// second load of the same entity files would merge into what the first load registered. Each load
			// starts from an empty store, so the mapping under test is the one this load's decorators wrote.
			require('@mikro-orm/core').MetadataStorage.clear();

			if (options.jsonMembersUnmapped) {
				jest.doMock(jsonColumn, () => {
					const { Column } = jest.requireActual('typeorm');

					return {
						...jest.requireActual(jsonColumn),
						JsonColumn: (column: { nullable?: boolean } = {}) =>
							Column({ type: 'simple-json', nullable: column.nullable })
					};
				});
			}

			require('../core/entities/internal');

			loaded = {
				core: require('@mikro-orm/core'),
				knex: require('@mikro-orm/knex'),
				driver: require('@mikro-orm/better-sqlite'),
				nest: require('@nestjs/common'),
				dialect: require('../../../../config/src/lib/database-helpers'),
				EventOutbox: require('./event-outbox.entity').EventOutbox,
				EventDelivery: require('./event-delivery.entity').EventDelivery,
				EventOutboxService: require('./event-outbox.service').EventOutboxService,
				EventConsumerRegistry: require('./event-consumer.registry').EventConsumerRegistry,
				EventOutboxDispatchWorker: require('./event-outbox-dispatch.worker').EventOutboxDispatchWorker,
				RequestContext: require('../core/context/request-context').RequestContext,
				Migration: require('../database/migrations/1791000000020-CreateEventOutboxTables')
					.CreateEventOutboxTables1791000000020
			};

			orm = await loaded.core.MikroORM.init({
				driver: loaded.driver.BetterSqliteDriver,
				dbName: ':memory:',
				entities: [loaded.EventOutbox, loaded.EventDelivery],
				namingStrategy: loaded.core.EntityCaseNamingStrategy,
				persistOnCreate: true,
				allowGlobalContext: false,
				discovery: { warnWhenNoEntities: false }
			});
		});
	} finally {
		if (options.jsonMembersUnmapped) {
			jest.dontMock(jsonColumn);
		}

		if (previous === undefined) {
			delete process.env.DB_ORM;
		} else {
			process.env.DB_ORM = previous;
		}
	}

	const connection = orm.em.getConnection();

	// Control: the variant maps what it says it maps, or the cases below would prove one mapping twice.
	if (options.jsonMembersUnmapped && orm.getMetadata().find('EventOutbox')?.properties?.payload) {
		throw new Error('The JSON members are still mapped; the unmapped variant did not take.');
	}

	await new loaded.Migration().sqliteUpQueryRunner({ query: (sql: string) => connection.execute(sql) });
	await connection.execute(STATE_TABLE);

	const service = new loaded.EventOutboxService(
		{} as never,
		orm.em.getRepository(loaded.EventOutbox),
		{} as never,
		orm.em.getRepository(loaded.EventDelivery)
	);
	const registry = new loaded.EventConsumerRegistry(service);

	mikroOrm = { orm, EventOutbox: loaded.EventOutbox, EventDelivery: loaded.EventDelivery };

	return {
		service,
		registry,
		worker: new loaded.EventOutboxDispatchWorker(service, registry),
		requestContext: loaded.RequestContext,
		inTransaction: (work) => orm.em.fork().transactional((manager: any) => work(manager)),
		writeState: async (manager, id) => {
			await manager.execute(`INSERT INTO "outbox_probe_state" ("id") VALUES (?)`, [id], 'run');
		},
		query: (sql, params = []) => connection.execute(sql, params),
		observeLock: () => {
			const lock = jest
				.spyOn(loaded.knex.QueryBuilder.prototype, 'setLockMode')
				.mockImplementation(function (this: unknown) {
					return this as never;
				});

			// `LockMode` is a numeric enum; its member name is the mode's name.
			return () => lock.mock.calls.map(([mode]) => String(loaded.core.LockMode[mode as number]));
		},
		dialect: loaded.dialect,
		quiet: () => silence(loaded.nest.Logger),
		close: () => orm.close(true)
	};
}

/** Silences a registry's logger for the case. */
function silence(logger: typeof Logger): void {
	for (const method of ['log', 'warn', 'error'] as const) {
		jest.spyOn(logger.prototype, method).mockImplementation(() => undefined);
	}
}

/** The outbox rows as the database holds them, in partition then sequence order. */
async function storedEvents(harness: IOutboxHarness): Promise<Row[]> {
	return harness.query(`SELECT * FROM "event_outbox" ORDER BY "partitionKey" ASC, "sequence" ASC`);
}

describe.each([
	['TypeORM', typeOrmHarness],
	['MikroORM', () => mikroOrmHarness()],
	['MikroORM, the JSON members unmapped', () => mikroOrmHarness({ jsonMembersUnmapped: true })]
] as const)('EventOutboxService on %s (real SQLite, the migration’s own tables)', (_orm, open) => {
	let harness: IOutboxHarness;

	beforeAll(async () => {
		harness = await open();
	});

	afterAll(async () => {
		await harness?.close();
	});

	beforeEach(async () => {
		await harness.query(`DELETE FROM "event_outbox"`);
		await harness.query(`DELETE FROM "event_delivery"`);
		await harness.query(`DELETE FROM "outbox_probe_state"`);
	});

	afterEach(() => jest.restoreAllMocks());

	/** Appends events in one committed transaction and answers the stored rows. */
	async function appendCommitted(...inputs: IOutboxWriteInput[]): Promise<EventOutbox[]> {
		return harness.inTransaction(async (manager) => {
			const rows: EventOutbox[] = [];

			for (const input of inputs) {
				rows.push(await harness.service.append(manager, input));
			}

			return rows;
		});
	}

	describe('appending inside the caller’s transaction', () => {
		it('writes the event with the state change, and a rollback removes both', async () => {
			await expect(
				harness.inTransaction(async (manager) => {
					await harness.writeState(manager, 'state-1');
					await harness.service.append(manager, placed());

					throw new Error('the state change was refused');
				})
			).rejects.toThrow('the state change was refused');

			// Control: an outbox writer that wrote outside the caller's transaction would leave an event
			// describing a state change that never happened — the failure the pattern exists to prevent.
			expect(await harness.query(`SELECT * FROM "outbox_probe_state"`)).toEqual([]);
			expect(await storedEvents(harness)).toEqual([]);

			await harness.inTransaction(async (manager) => {
				await harness.writeState(manager, 'state-2');
				await harness.service.append(manager, placed());
			});

			expect(await harness.query(`SELECT "id" FROM "outbox_probe_state"`)).toEqual([{ id: 'state-2' }]);
			expect(await storedEvents(harness)).toHaveLength(1);
		});

		it('stores every member the dispatcher reads, the tenancy and the body included', async () => {
			const headers = { correlationId: 'corr-1', causationId: 'cause-1', channelId: 'channel-1' };
			const [appended] = await appendCommitted(placed({ headers }));
			const [stored] = await storedEvents(harness);

			expect(stored).toMatchObject({
				id: appended.id,
				eventId: appended.eventId,
				eventName: 'order.placed',
				aggregateType: 'Order',
				aggregateId: ORDER,
				status: EventOutboxStatus.PENDING,
				attemptCount: 0,
				partitionKey: PARTITION,
				sequence: 1,
				tenantId: TENANT,
				organizationId: ORG
			});
			expect(String(stored.eventId)).toMatch(/^[0-9a-f-]{36}$/);
			expect(String(stored.id)).toMatch(/^[0-9a-f-]{36}$/);
			// The body and the headers are in their columns, not the column defaults.
			expect(JSON.parse(stored.payload)).toEqual(placed().data);
			expect(JSON.parse(stored.headers)).toEqual(headers);

			// Read back through the kernel, the row is what the envelope is built from.
			const row = await harness.service.findById(appended.id as ID);

			expect(row).toMatchObject({ eventName: 'order.placed', sequence: 1, tenantId: TENANT, organizationId: ORG });
			expect(row.payload).toEqual(placed().data);
			expect(row.availableAt).toBeInstanceOf(Date);
			expect(harness.service.toEnvelope(row)).toMatchObject({
				id: appended.eventId,
				name: 'order.placed',
				tenantId: TENANT,
				organizationId: ORG,
				channelId: 'channel-1',
				correlationId: 'corr-1',
				causationId: 'cause-1',
				aggregate: { type: 'Order', id: ORDER },
				sequence: 1,
				partitionKey: PARTITION,
				producer: 'order',
				data: placed().data
			});
		});

		it('takes the tenancy from the request when the write does not state it', async () => {
			jest.spyOn(harness.requestContext, 'currentTenantId').mockReturnValue(TENANT);
			jest.spyOn(harness.requestContext, 'currentOrganizationId').mockReturnValue(ORG);

			await appendCommitted(placed({ tenantId: undefined, organizationId: undefined }));

			expect(await harness.query(`SELECT "tenantId", "organizationId" FROM "event_outbox"`)).toEqual([
				{ tenantId: TENANT, organizationId: ORG }
			]);
		});
	});

	describe('numbering a partition', () => {
		it('keeps each partition gapless: a rolled-back append gives its position to the next one', async () => {
			// Two appends in one transaction: the second reads the first, which is not committed yet.
			await appendCommitted(placed(), placed({ name: 'order.confirmed' }), placed({ aggregateId: OTHER_ORDER }));

			await expect(
				harness.inTransaction(async (manager) => {
					expect((await harness.service.append(manager, placed({ name: 'order.shipped' }))).sequence).toBe(3);

					throw new Error('the shipment was refused');
				})
			).rejects.toThrow('the shipment was refused');

			const [next] = await appendCommitted(placed({ name: 'order.shipped' }));

			expect(next.sequence).toBe(3);
			expect((await storedEvents(harness)).map((row) => [row.partitionKey, row.sequence, row.eventName])).toEqual([
				[PARTITION, 1, 'order.placed'],
				[PARTITION, 2, 'order.confirmed'],
				[PARTITION, 3, 'order.shipped'],
				[OTHER_PARTITION, 1, 'order.placed']
			]);
		});

		it('lets a producer state its own ordering key', async () => {
			const [row] = await appendCommitted(placed({ partitionKey: 'Order:synthetic' }));

			expect(row.partitionKey).toBe('Order:synthetic');
			expect(row.sequence).toBe(1);
		});
	});

	describe('claiming a batch', () => {
		it('hands out each partition’s head under a lease, and nothing again until the lease expires', async () => {
			await appendCommitted(placed(), placed({ name: 'order.confirmed' }), placed({ aggregateId: OTHER_ORDER }));
			const t0 = new Date(Date.now() + 1_000);

			const first = await harness.service.claimBatch({ batchSize: 10, leaseMs: 60_000, now: t0 });

			// One head per partition: the second event of the first aggregate waits behind its first.
			expect(first.map((row) => [row.partitionKey, Number(row.sequence), row.attemptCount])).toEqual([
				[PARTITION, 1, 1],
				[OTHER_PARTITION, 1, 1]
			]);
			expect(first[0].availableAt).toEqual(new Date(t0.getTime() + 60_000));

			// The lease is on the row, not only on the answer.
			const leased = await harness.service.findById(first[0].id as ID);

			expect(leased.attemptCount).toBe(1);
			expect(leased.availableAt).toEqual(new Date(t0.getTime() + 60_000));

			expect(await harness.service.claimBatch({ now: t0 })).toEqual([]);
			expect(await harness.service.claimBatch({ now: new Date(t0.getTime() + 59_999) })).toEqual([]);

			const reclaimed = await harness.service.claimBatch({ now: new Date(t0.getTime() + 60_001) });

			expect(reclaimed.map((row) => [row.partitionKey, Number(row.sequence), row.attemptCount])).toEqual([
				[PARTITION, 1, 2],
				[OTHER_PARTITION, 1, 2]
			]);
		});

		it('bounds a batch, so one pass cannot take the whole backlog', async () => {
			await appendCommitted(placed(), placed({ aggregateId: OTHER_ORDER }));

			const batch = await harness.service.claimBatch({ batchSize: 1, now: new Date(Date.now() + 1_000) });

			expect(batch.map((row) => row.partitionKey)).toEqual([PARTITION]);
		});

		it('asks for a row lock on Postgres and MySQL, and for none on SQLite', async () => {
			await appendCommitted(placed());
			const locks = harness.observeLock();
			const later = (seconds: number) => new Date(Date.now() + seconds * 1_000);

			// Each pass claims the row again once the previous lease is over, so each is a full claim.
			expect(await harness.service.claimBatch({ now: later(1) })).toHaveLength(1);
			expect(locks()).toEqual([]);

			jest.spyOn(harness.dialect, 'isPostgres').mockReturnValue(true);
			expect(await harness.service.claimBatch({ now: later(120) })).toHaveLength(1);

			jest.spyOn(harness.dialect, 'isPostgres').mockReturnValue(false);
			jest.spyOn(harness.dialect, 'isMySQL').mockReturnValue(true);
			expect(await harness.service.claimBatch({ now: later(240) })).toHaveLength(1);

			// Each ORM's spelling of `FOR UPDATE` — not `SKIP LOCKED`, which would let a pass read a partition's
			// second row as its head while another pass holds the first.
			expect(locks()).toEqual(['PESSIMISTIC_WRITE', 'PESSIMISTIC_WRITE']);
		});
	});

	describe('publishing, failing and dead-lettering', () => {
		it('publishes a head, and only then hands out the next event of its partition', async () => {
			await appendCommitted(placed(), placed({ name: 'order.confirmed' }));
			const t0 = new Date(Date.now() + 1_000);

			const [head] = await harness.service.claimBatch({ now: t0 });
			const published = await harness.service.markPublished(head.id as ID, { at: t0 });

			expect(published).toMatchObject({ status: EventOutboxStatus.PUBLISHED, lastError: null });
			expect(published.publishedAt).toEqual(t0);

			const next = await harness.service.claimBatch({ now: t0 });

			expect(next.map((row) => [row.eventName, Number(row.sequence)])).toEqual([['order.confirmed', 2]]);
		});

		it('fails a head onto the ladder, holds its partition back, and dead-letters it once the budget is spent', async () => {
			await appendCommitted(placed(), placed({ name: 'order.confirmed' }));
			const t0 = new Date(Date.now() + 1_000);

			const [head] = await harness.service.claimBatch({ now: t0 });
			const failed = await harness.service.markFailed(head.id as ID, new Error('the queue is unavailable'), {
				now: t0
			});
			const delay = failed.availableAt.getTime() - t0.getTime();

			expect(failed).toMatchObject({ status: EventOutboxStatus.FAILED, lastError: 'the queue is unavailable' });
			// The first step of the ladder, inside its 20 % jitter.
			expect(delay).toBeGreaterThanOrEqual(4_000);
			expect(delay).toBeLessThanOrEqual(6_000);

			// A head inside its backoff is still the head: the partition's next event does not overtake it.
			expect(await harness.service.claimBatch({ now: new Date(t0.getTime() + 1_000) })).toEqual([]);

			const [retry] = await harness.service.claimBatch({ now: failed.availableAt });

			expect([retry.eventName, retry.attemptCount]).toEqual(['order.placed', 2]);

			const dead = await harness.service.markFailed(retry.id as ID, new Error('still unavailable'), {
				now: failed.availableAt,
				maxAttempts: 2
			});

			expect(dead).toMatchObject({ status: EventOutboxStatus.DEAD, lastError: 'still unavailable', publishedAt: null });
			// A dead head is terminal and no longer a candidate, so the partition moves on.
			const after = await harness.service.claimBatch({ now: new Date(t0.getTime() + 3_600_000) });

			expect(after.map((row) => row.eventName)).toEqual(['order.confirmed']);
		});

		it('answers a mark on a row that does not exist with null', async () => {
			expect(await harness.service.findById(randomUUID())).toBeNull();
			expect(await harness.service.markFailed(randomUUID(), new Error('gone'))).toBeNull();
		});
	});

	describe('the per-consumer delivery record', () => {
		it('claims a consumer once, re-hands a record that did not settle, and never re-runs an acknowledged one', async () => {
			const [event] = await appendCommitted(placed());
			const claim = {
				eventId: event.eventId as ID,
				consumerKey: CONSUMER,
				partitionKey: PARTITION,
				sequence: 1,
				tenantId: TENANT,
				organizationId: ORG
			};

			const first = await harness.service.claimDelivery(claim);

			expect(first.claimed).toBe(true);
			expect(first.delivery).toMatchObject({ status: EventOutboxStatus.PENDING, attemptCount: 0 });

			const failed = await harness.service.completeDelivery(first.delivery.id as ID, {
				delivered: false,
				error: new Error('temporary')
			});

			expect(failed).toMatchObject({ status: EventOutboxStatus.FAILED, lastError: 'temporary' });

			// The lost race on the unique pair: the record is handed over again, one attempt further on.
			const second = await harness.service.claimDelivery(claim);

			expect(second.claimed).toBe(true);
			expect(second.delivery.attemptCount).toBe(1);
			expect((await harness.service.findDeliveryById(first.delivery.id as ID)).attemptCount).toBe(1);

			const delivered = await harness.service.completeDelivery(second.delivery.id as ID, { delivered: true });

			expect(delivered).toMatchObject({ status: EventOutboxStatus.PUBLISHED, lastError: null });
			expect(delivered.deliveredAt).toBeInstanceOf(Date);

			const third = await harness.service.claimDelivery(claim);

			expect(third.claimed).toBe(false);
			expect(third.delivery.status).toBe(EventOutboxStatus.PUBLISHED);
			expect(await harness.query(`SELECT "consumerKey", "sequence", "tenantId", "organizationId" FROM "event_delivery"`)).toEqual([
				{ consumerKey: CONSUMER, sequence: 1, tenantId: TENANT, organizationId: ORG }
			]);
		});

		it('advances the order gate past what a consumer settled, and past a position it stopped', async () => {
			const [one, two, three] = await appendCommitted(
				placed(),
				placed({ name: 'order.confirmed' }),
				placed({ name: 'order.shipped' })
			);
			const claimOf = (event: EventOutbox, sequence: number) =>
				harness.service.claimDelivery({
					eventId: event.eventId as ID,
					consumerKey: CONSUMER,
					partitionKey: PARTITION,
					sequence,
					tenantId: TENANT,
					organizationId: ORG
				});

			expect(await harness.service.findLastDeliveredSequence(CONSUMER, PARTITION)).toBe(0);

			await harness.service.completeDelivery((await claimOf(one, 1)).delivery.id as ID, { delivered: true });
			// A record still in flight does not advance the gate.
			const inFlight = await claimOf(two, 2);

			expect(await harness.service.findLastDeliveredSequence(CONSUMER, PARTITION)).toBe(1);

			await harness.service.markDeliveryDead(inFlight.delivery.id as ID, 'the endpoint is gone');

			expect(await harness.service.findLastDeliveredSequence(CONSUMER, PARTITION)).toBe(2);
			// Another consumer's acknowledgements are its own, and a pending record of this one does not count.
			await claimOf(three, 3);
			expect(await harness.service.findLastDeliveredSequence('job:events', PARTITION)).toBe(0);
			expect(await harness.service.findLastDeliveredSequence(CONSUMER, PARTITION)).toBe(2);
		});
	});

	describe('the scoped reads and the operator moves', () => {
		beforeEach(() => {
			jest.spyOn(harness.requestContext, 'currentTenantId').mockReturnValue(TENANT);
			jest.spyOn(harness.requestContext, 'currentOrganizationId').mockReturnValue(ORG);
		});

		/** One event in each scope a read has to tell apart, by name. */
		async function eventsInEveryScope(): Promise<Record<string, EventOutbox>> {
			const [own, otherOrganization, otherTenant] = await appendCommitted(
				placed({ name: 'order.placed' }),
				placed({ name: 'order.completed', organizationId: OTHER_ORG, partitionKey: 'Order:other-org' }),
				placed({ name: 'order.canceled', tenantId: OTHER_TENANT, partitionKey: 'Order:other-tenant' })
			);

			// A tenant-wide fact is one appended with no organization, stated or in the request.
			jest.spyOn(harness.requestContext, 'currentOrganizationId').mockReturnValue(null);
			const [tenantWide] = await appendCommitted(
				placed({ name: 'order.archived', organizationId: undefined, aggregateId: OTHER_ORDER })
			);
			jest.spyOn(harness.requestContext, 'currentOrganizationId').mockReturnValue(ORG);

			expect(
				await harness.query(`SELECT "organizationId" FROM "event_outbox" WHERE "id" = ?`, [tenantWide.id])
			).toEqual([{ organizationId: null }]);

			return { own, tenantWide, otherOrganization, otherTenant };
		}

		it('lists and reads only the caller’s own rows and the tenant-wide ones', async () => {
			const events = await eventsInEveryScope();

			const listed = await harness.service.listOutboxRows();

			expect(listed.map((row) => row.eventName).sort()).toEqual(['order.archived', 'order.placed']);
			expect((await harness.service.listOutboxRows({ eventName: 'order.archived' })).map((row) => row.id)).toEqual([
				events.tenantWide.id
			]);
			expect(await harness.service.findOutboxRow(events.own.id as ID)).toMatchObject({ eventName: 'order.placed' });
			expect(await harness.service.findOutboxRow(events.otherOrganization.id as ID)).toBeNull();
			expect(await harness.service.findOutboxRow(events.otherTenant.id as ID)).toBeNull();
		});

		it('reads nothing of a tenant for a caller that has none', async () => {
			await eventsInEveryScope();
			jest.spyOn(harness.requestContext, 'currentTenantId').mockReturnValue(null);
			jest.spyOn(harness.requestContext, 'currentOrganizationId').mockReturnValue(null);

			expect(await harness.service.listOutboxRows()).toEqual([]);
			expect(await harness.service.listDeliveryRows()).toEqual([]);
		});

		it('replays and dead-letters the caller’s own record, and answers another tenant’s as not found', async () => {
			const events = await eventsInEveryScope();
			const own = await harness.service.claimDelivery({
				eventId: events.own.eventId as ID,
				consumerKey: CONSUMER,
				tenantId: TENANT,
				organizationId: ORG
			});
			const foreign = await harness.service.claimDelivery({
				eventId: events.otherTenant.eventId as ID,
				consumerKey: CONSUMER,
				tenantId: OTHER_TENANT,
				organizationId: ORG
			});

			await harness.service.completeDelivery(own.delivery.id as ID, { delivered: true });

			expect((await harness.service.listDeliveryRows()).map((row) => row.id)).toEqual([own.delivery.id]);
			expect(await harness.service.findDeliveryRow(foreign.delivery.id as ID)).toBeNull();

			const replayed = await harness.service.replayDelivery(own.delivery.id as ID);

			expect(replayed).toMatchObject({
				status: EventOutboxStatus.PENDING,
				attemptCount: 0,
				lastError: null,
				deliveredAt: null
			});

			const stopped = await harness.service.deadLetterDelivery(own.delivery.id as ID, 'the fact is stale');

			expect(stopped).toMatchObject({ status: EventOutboxStatus.DEAD, lastError: 'the fact is stale' });

			// By name: each half constructs the exception from its own module registry.
			await expect(harness.service.replayDelivery(foreign.delivery.id as ID)).rejects.toMatchObject({
				name: NotFoundException.name
			});
			await expect(harness.service.deadLetterDelivery(foreign.delivery.id as ID, 'not mine')).rejects.toMatchObject({
				name: NotFoundException.name
			});
			// The other tenant's record is exactly as it was.
			expect(
				await harness.query(`SELECT "status", "lastError" FROM "event_delivery" WHERE "id" = ?`, [foreign.delivery.id])
			).toEqual([{ status: EventOutboxStatus.PENDING, lastError: null }]);
		});
	});

	describe('the dispatch pass', () => {
		it('drains the outbox with no request behind it: the consumer runs once, and the record and the row are published', async () => {
			harness.quiet();
			const received: IEventEnvelope[] = [];

			harness.registry.register({
				key: 'orm-parity.probe',
				events: ['order.placed'],
				handle: async (event: IEventEnvelope) => {
					received.push(event);
				}
			});

			try {
				const [event] = await appendCommitted(placed({ headers: { correlationId: 'corr-9' } }));

				await harness.worker.handleDispatch({ data: { requestedAt: new Date().toISOString() } } as Job<never>);
				// A second pass finds nothing due: the row is published, not leased.
				await harness.worker.handleDispatch({ data: { requestedAt: new Date().toISOString() } } as Job<never>);

				expect(received).toHaveLength(1);
				expect(received[0]).toMatchObject({
					id: event.eventId,
					name: 'order.placed',
					sequence: 1,
					partitionKey: PARTITION,
					tenantId: TENANT,
					organizationId: ORG,
					correlationId: 'corr-9',
					data: placed().data
				});
				expect(await harness.query(`SELECT "status", "attemptCount" FROM "event_outbox"`)).toEqual([
					{ status: EventOutboxStatus.PUBLISHED, attemptCount: 1 }
				]);
				expect(await harness.query(`SELECT "consumerKey", "status", "tenantId" FROM "event_delivery"`)).toEqual([
					{ consumerKey: 'subscriber:orm-parity.probe', status: EventOutboxStatus.PUBLISHED, tenantId: TENANT }
				]);
			} finally {
				harness.registry.unregister('orm-parity.probe');
			}
		});
	});
});

/**
 * What only MikroORM has to be told: which context an append joins when the caller hands over a manager that
 * resolves one, and that the append flushes nothing of the caller's own.
 */
describe('EventOutboxService on MikroORM — the context an append joins', () => {
	let harness: IOutboxHarness;

	beforeAll(async () => {
		harness = await mikroOrmHarness();
	});

	afterAll(async () => {
		await harness?.close();
	});

	beforeEach(async () => {
		await harness.query(`DELETE FROM "event_outbox"`);
		await harness.query(`DELETE FROM "event_delivery"`);
		await harness.query(`DELETE FROM "outbox_probe_state"`);
	});

	it('joins the open transaction when it is handed a repository’s manager, as a service holds one', async () => {
		// The shape the order and the returns packages use: the manager of a repository — MikroORM's global
		// one — handed over while the caller's transaction is open, which it resolves to that transaction.
		const manager = harness.service.mikroOrmEventOutboxRepository.getEntityManager();

		await expect(
			mikroOrm.orm.em.transactional(async () => {
				await harness.writeState(manager, 'state-1');
				await harness.service.append(manager, placed());

				throw new Error('the state change was refused');
			})
		).rejects.toThrow('the state change was refused');

		expect(await harness.query(`SELECT * FROM "outbox_probe_state"`)).toEqual([]);
		expect(await storedEvents(harness)).toEqual([]);

		await mikroOrm.orm.em.transactional(async () => {
			await harness.writeState(manager, 'state-2');
			await harness.service.append(manager, placed());
			await harness.service.append(manager, placed({ name: 'order.confirmed' }));
		});

		expect((await storedEvents(harness)).map((row) => [row.eventName, row.sequence])).toEqual([
			['order.placed', 1],
			['order.confirmed', 2]
		]);
	});

	it('writes its own row and flushes nothing the caller still has pending', async () => {
		let deliveriesSeenByTheAppend: Row[] = [];

		await harness.inTransaction(async (manager) => {
			// A change the caller has made but not flushed: it is the caller's to flush, at its own commit.
			manager.create(mikroOrm.EventDelivery, {
				id: randomUUID(),
				eventId: randomUUID(),
				consumerKey: 'subscriber:pending',
				status: EventOutboxStatus.PENDING,
				attemptCount: 0
			});

			await harness.service.append(manager, placed());
			deliveriesSeenByTheAppend = await manager.execute(`SELECT COUNT(*) AS "count" FROM "event_delivery"`);
		});

		expect(deliveriesSeenByTheAppend).toEqual([{ count: 0 }]);
		expect(await storedEvents(harness)).toHaveLength(1);
		// Control: the caller's own commit flushed it.
		expect(await harness.query(`SELECT "consumerKey" FROM "event_delivery"`)).toEqual([
			{ consumerKey: 'subscriber:pending' }
		]);
	});
});
