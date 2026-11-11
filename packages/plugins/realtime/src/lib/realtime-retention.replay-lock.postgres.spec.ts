// cspell:ignore pids replayer
/**
 * A delivery replay against the outbox retention's delete, on a real PostgreSQL, two connections (the follow-up to
 * task T23, ever-co/ever-gauzy#11763).
 *
 * `EventOutboxService.replayDelivery` reads the record's outbox row under `FOR UPDATE`, then resets the record and
 * re-queues the row, in one transaction. `RealtimeRetentionService` deletes a dispatched row only while it is still
 * `PUBLISHED` with no unacknowledged delivery. What happens when the two meet was argued from PostgreSQL's Read
 * Committed rules; here it is run, in both lock orders, with the replay on each ORM (TypeORM, and MikroORM — whose
 * installation still runs the retention through the TypeORM data source, so the two sides use two separate pools):
 *
 * 1. **The retention's delete holds the row, uncommitted, when the replay reads it.** The replay's `FOR UPDATE` waits;
 *    the delete commits, and the read skips the deleted row. The replay is refused (`NotFoundException`: its event is
 *    no longer in the outbox) and the delivery record is exactly as it was.
 * 2. **The replay holds the row (`FOR UPDATE`, nothing written yet) when the retention deletes it.** The delete waits;
 *    the replay commits, and the delete re-checks its `WHERE` against the row's new version, which is `PENDING`.
 *    Nothing is removed: the row is back in the queue and the record is `PENDING` with its attempt budget restored.
 *
 * Each order is forced, not hoped for. A gate stops one side inside its transaction — the retention after its delete
 * (in the watermark write that follows it), the replay after its locked read (before its first write) — and the
 * other side's statement must show up in `pg_stat_activity` waiting on that transaction's backend (`pg_blocking_pids`)
 * before the gate is opened.
 *
 * Nothing on the path is doubled: the service, the MikroORM store, the retention and both ORMs are the platform's
 * own, each ORM's entity registry loaded as `DB_TYPE=postgres` loads it, over the tables the outbox migration creates.
 * `@gauzy/core` is narrowed to the two outbox entities (its barrel boots the whole application), and the retention's
 * watermark service is a stand-in, which is where the retention's gate sits.
 *
 * **Runs only when `REALTIME_TEST_POSTGRES_URL` points at a disposable PostgreSQL** (the build-api job's service
 * container); without it the suite is skipped. It works in a schema of its own, dropped at the end. It has a Jest config
 * of its own, `jest.postgres.config.ts` (see there why), which the plugin's unit run leaves out. Locally:
 *
 *     REALTIME_TEST_POSTGRES_URL=postgres://postgres@127.0.0.1:5432/postgres yarn nx run plugin-realtime:test-postgres
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;

	return {
		__esModule: true,
		// The platform's own entities, from the registry that is loading: what the retention deletes is what the
		// replay locks.
		EventOutbox: jest.requireActual('@gauzy/core/src/lib/event-outbox/event-outbox.entity').EventOutbox,
		EventDelivery: jest.requireActual('@gauzy/core/src/lib/event-outbox/event-delivery.entity').EventDelivery,
		SubscriptionCatalogue: class SubscriptionCatalogue {},
		matchesEventSelection: (selection: string, name: string) => selection === name,
		// What the plugin's own entities are declared with; the watermark entity is not used here.
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		ColumnIndex: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {}
	};
});

import { randomUUID } from 'node:crypto';
import { EventOutboxStatus } from '@gauzy/contracts';

type Row = Record<string, any>;

const POSTGRES_URL = process.env['REALTIME_TEST_POSTGRES_URL'];

/** The suite's own schema, so it never meets an `event_outbox` another suite created. */
const SCHEMA = 'realtime_replay_lock_test';
/** Every connection of both ORMs resolves the outbox tables in that schema. */
const SEARCH_PATH = `-c search_path=${SCHEMA}`;

const TENANT = '7c3e0f2a-0000-4000-8000-0000000000a1';
const ORG = '7c3e0f2a-0000-4000-8000-0000000000b1';
const TASK = '7c3e0f2a-0000-4000-8000-000000000001';
const PARTITION = `Task:${TASK}`;
const CONSUMER = 'subscriber:realtime.replay-lock-probe';

const HOUR = 60 * 60_000;
/**
 * One pass's bounds: the scope's newest row is the count floor, and a row older than half an hour is past the age
 * bound — so of the two rows a case seeds, the older one is what the pass removes.
 */
const BOUNDS = { minAgeMs: HOUR / 2, minEvents: 1, batch: 10, scopes: 10 };
/** How long a side may take to reach its gate, or to show up waiting on a lock. */
const WAIT_MS = 15_000;

/** Stops a transaction where it calls `pass`, until the case releases it. */
interface IGate {
	/** Resolves once the transaction reached the gate, with the backend (`pg_backend_pid()`) that runs it. */
	reached: Promise<number>;
	release(): void;
	/** @param holder The backend of the transaction that stops here, read on its own connection. */
	pass(holder: number): Promise<void>;
}

function createGate(): IGate {
	let reach: (holder: number) => void = () => undefined;
	let release: () => void = () => undefined;
	const reached = new Promise<number>((resolve) => (reach = resolve));
	const released = new Promise<void>((resolve) => (release = resolve));

	return {
		reached,
		release: () => release(),
		pass: async (holder) => {
			reach(holder);
			await released;
		}
	};
}

/** Asked on a transaction's own connection, before it stops at its gate: which backend holds its locks. */
const BACKEND_PID = `SELECT pg_backend_pid() AS "pid"`;

/** The backend in an answer to `BACKEND_PID`. */
const backendOf = (rows: Row[]): number => Number(rows[0]['pid']);

/** A transaction's TypeORM manager, as far as asking for its backend goes. */
type TypeOrmTransaction = { query(sql: string): Promise<Row[]> };

/**
 * Loads the platform's registry under one ORM, in a module registry of its own.
 *
 * The decorators decide each entity's mapping when its class is defined — `DB_ORM` which ORM's decorators apply,
 * `DB_TYPE` the column types — so each ORM gets a fresh registry, as `event-outbox.orm-parity.spec.ts` does it. The
 * work that builds metadata (TypeORM's data source, MikroORM's discovery) runs inside the registry too: the base
 * entity reaches the user entity through a `require` in its relation callbacks, and a callback called after the
 * isolation ended would resolve another copy of the class.
 *
 * @param orm The ORM the registry is loaded for.
 * @param load What to require and initialise inside it.
 * @returns What `load` answered.
 */
async function loadRegistry(orm: 'typeorm' | 'mikro-orm', load: () => Promise<Row>): Promise<Row> {
	const previous = process.env['DB_ORM'];
	let loaded: Row = {};

	process.env['DB_ORM'] = orm;

	try {
		await jest.isolateModulesAsync(async () => {
			// MikroORM keeps decorator metadata in a store global to the process; each load starts from an empty one.
			require('@mikro-orm/core').MetadataStorage.clear();
			// Before any core service: see `event-outbox.orm-parity.spec.ts` for the import cycle this order avoids.
			require('@gauzy/core/src/lib/core/entities/internal');

			loaded = await load();
		});
	} finally {
		if (previous === undefined) {
			delete process.env['DB_ORM'];
		} else {
			process.env['DB_ORM'] = previous;
		}
	}

	return loaded;
}

/** The outbox modules of a registry, by the paths the service itself is loaded from. */
function outboxModules(): Row {
	const outbox = '@gauzy/core/src/lib/event-outbox';

	return {
		config: require('@gauzy/config'),
		EventOutbox: require(`${outbox}/event-outbox.entity`).EventOutbox,
		EventDelivery: require(`${outbox}/event-delivery.entity`).EventDelivery,
		EventOutboxService: require(`${outbox}/event-outbox.service`).EventOutboxService,
		RequestContext: require('@gauzy/core/src/lib/core/context/request-context').RequestContext
	};
}

/** One ORM's replay: the service of its registry, and where its transaction can be stopped. */
interface IReplaySide {
	service: any;
	requestContext: any;
	/** Whether the registry was loaded as PostgreSQL, which is what makes the service ask for the row lock. */
	isPostgres(): boolean;
	/** Stops the replay's transaction after its locked read of the row, before its first write. */
	holdAfterLock(gate: IGate): void;
}

const describeOnPostgres = POSTGRES_URL ? describe : describe.skip;

describeOnPostgres('a delivery replay against the outbox retention on PostgreSQL, two connections', () => {
	const previousDbType = process.env['DB_TYPE'];
	/** The TypeORM registry: the retention, the TypeORM replay, and the observer's connections. */
	let platform: Row;
	let mikro: Row;
	let dataSource: any;
	const sides: Record<string, IReplaySide> = {};
	let eventName: string;

	beforeAll(async () => {
		process.env['DB_TYPE'] = 'postgres';

		platform = await loadRegistry('typeorm', async () => {
			const loaded: Row = {
				...outboxModules(),
				typeorm: require('typeorm'),
				TypeOrmEventOutboxRepository:
					require('@gauzy/core/src/lib/event-outbox/repository/type-orm-event-outbox.repository')
						.TypeOrmEventOutboxRepository,
				TypeOrmEventDeliveryRepository:
					require('@gauzy/core/src/lib/event-outbox/repository/type-orm-event-delivery.repository')
						.TypeOrmEventDeliveryRepository,
				CreateEventOutboxTables:
					require('@gauzy/core/src/lib/database/migrations/1791000000020-CreateEventOutboxTables')
						.CreateEventOutboxTables1791000000020,
				RealtimeRetentionService: require('./realtime-retention.service').RealtimeRetentionService,
				collaborationReplayNames: require('./graphql/realtime-envelope').collaborationReplayNames
			};

			// Every core entity: TypeORM resolves each relation's target, and the base entity alone relates the outbox
			// to the tenant, the organization and the user.
			loaded['dataSource'] = await new loaded['typeorm'].DataSource({
				type: 'postgres',
				url: POSTGRES_URL,
				entities: require('@gauzy/core/src/lib/core/entities').coreEntities,
				synchronize: false,
				logging: false,
				invalidWhereValuesBehavior: loaded['config'].TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR,
				extra: { options: SEARCH_PATH }
			}).initialize();

			return loaded;
		});
		dataSource = platform['dataSource'];

		await dataSource.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
		await dataSource.query(`CREATE SCHEMA "${SCHEMA}"`);

		const runner = dataSource.createQueryRunner();

		try {
			await new platform['CreateEventOutboxTables']().postgresUpQueryRunner(runner);
		} finally {
			await runner.release();
		}

		mikro = await loadRegistry('mikro-orm', async () => {
			const loaded: Row = {
				...outboxModules(),
				EventOutboxMikroOrmStore: require('@gauzy/core/src/lib/event-outbox/event-outbox-mikro-orm.store')
					.EventOutboxMikroOrmStore
			};
			const core = require('@mikro-orm/core');

			// The platform's MikroORM options for PostgreSQL (`packages/config/src/lib/database.ts`), on this database.
			loaded['orm'] = await core.MikroORM.init({
				driver: require('@mikro-orm/postgresql').PostgreSqlDriver,
				clientUrl: POSTGRES_URL,
				entities: [loaded['EventOutbox'], loaded['EventDelivery']],
				namingStrategy: core.EntityCaseNamingStrategy,
				persistOnCreate: true,
				autoJoinRefsForFilters: loaded['config'].MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS,
				allowGlobalContext: false,
				ensureDatabase: false,
				discovery: { warnWhenNoEntities: false },
				driverOptions: { connection: { options: SEARCH_PATH } },
				pool: { min: 0, max: 4 }
			});

			return loaded;
		});

		sides['TypeORM'] = {
			service: new platform['EventOutboxService'](
				new platform['TypeOrmEventOutboxRepository'](dataSource.getRepository(platform['EventOutbox'])),
				{} as never,
				new platform['TypeOrmEventDeliveryRepository'](dataSource.getRepository(platform['EventDelivery'])),
				{} as never
			),
			requestContext: platform['RequestContext'],
			isPostgres: () => platform['config'].isPostgres(),
			holdAfterLock: (gate) => {
				const { EntityManager } = platform['typeorm'];
				const update = EntityManager.prototype.update;

				// The record's reset is the transaction's first write, right after the locked read.
				jest.spyOn(EntityManager.prototype, 'update').mockImplementation(async function (
					this: TypeOrmTransaction,
					target: unknown,
					...rest: unknown[]
				) {
					if (target === platform['EventDelivery']) {
						// The transaction's manager queries on the transaction's own connection.
						await gate.pass(backendOf(await this.query(BACKEND_PID)));
					}

					return update.call(this, target, ...rest);
				});
			}
		};

		sides['MikroORM'] = {
			service: new mikro['EventOutboxService'](
				{} as never,
				mikro['orm'].em.getRepository(mikro['EventOutbox']),
				{} as never,
				mikro['orm'].em.getRepository(mikro['EventDelivery'])
			),
			requestContext: mikro['RequestContext'],
			isPostgres: () => mikro['config'].isPostgres(),
			holdAfterLock: (gate) => {
				const store = mikro['EventOutboxMikroOrmStore'].prototype;
				const write = store.write;

				// The store's own writes; the record's reset is the transaction's first, right after the locked read.
				jest.spyOn(store, 'write').mockImplementation(async function (
					this: unknown,
					em: { execute(sql: string): Promise<Row[]> },
					table: unknown,
					...rest: unknown[]
				) {
					if (table === mikro['EventDelivery']) {
						// The transactional `em` executes in its transaction's context, on that connection.
						await gate.pass(backendOf(await em.execute(BACKEND_PID)));
					}

					return write.call(this, em, table, ...rest);
				});
			}
		};

		[eventName] = platform['collaborationReplayNames']();
	}, 300_000);

	afterAll(async () => {
		await mikro?.['orm']?.close(true);

		if (dataSource?.isInitialized) {
			await dataSource.query(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
			await dataSource.destroy();
		}

		if (previousDbType === undefined) {
			delete process.env['DB_TYPE'];
		} else {
			process.env['DB_TYPE'] = previousDbType;
		}
	});

	const query = (sql: string, params: unknown[] = []): Promise<Row[]> => dataSource.query(sql, params);

	const outboxRowOf = async (eventId: string): Promise<Row | undefined> =>
		(
			await query(
				`SELECT "status", "attemptCount", "publishedAt", "lastError" FROM "event_outbox" WHERE "eventId" = $1`,
				[eventId]
			)
		)[0];

	const deliveryRowOf = async (id: string): Promise<Row | undefined> =>
		(await query(`SELECT * FROM "event_delivery" WHERE "id" = $1`, [id]))[0];

	/**
	 * Seeds one scope with two dispatched rows of one task and one acknowledged delivery of the older row.
	 *
	 * The older row is what a pass removes: past both bounds, not its partition's newest, every delivery of it
	 * acknowledged. The record is what an operator replays.
	 *
	 * @returns The older row's event and its delivery record.
	 */
	async function seed(): Promise<{ eventId: string; deliveryId: string }> {
		const now = Date.now();
		const rows = [
			{ id: randomUUID(), eventId: randomUUID(), sequence: 1, at: new Date(now - 2 * HOUR) },
			{ id: randomUUID(), eventId: randomUUID(), sequence: 2, at: new Date(now - HOUR) }
		];

		for (const row of rows) {
			await query(
				`INSERT INTO "event_outbox" ("id", "tenantId", "organizationId", "eventId", "eventName", "aggregateType", "aggregateId", "payload", "status", "attemptCount", "availableAt", "publishedAt", "partitionKey", "sequence", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, 'Task', $6, $7, $8, 1, $9, $9, $10, $11, $9, $9)`,
				[
					row.id,
					TENANT,
					ORG,
					row.eventId,
					eventName,
					TASK,
					JSON.stringify({ taskId: TASK }),
					EventOutboxStatus.PUBLISHED,
					row.at,
					PARTITION,
					row.sequence
				]
			);
		}

		const deliveryId = randomUUID();

		await query(
			`INSERT INTO "event_delivery" ("id", "tenantId", "organizationId", "eventId", "consumerKey", "status", "attemptCount", "deliveredAt", "partitionKey", "sequence", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8, 1, $7, $7)`,
			[deliveryId, TENANT, ORG, rows[0].eventId, CONSUMER, EventOutboxStatus.PUBLISHED, rows[0].at, PARTITION]
		);

		return { eventId: rows[0].eventId, deliveryId };
	}

	describe.each(['TypeORM', 'MikroORM'])('the replay on %s', (orm) => {
		let side: IReplaySide;
		let retention: any;
		let watermarks: { advance: jest.Mock };
		/** The transactions a case started, settled before the next case, whatever the case did. */
		const inFlight: Array<Promise<unknown>> = [];
		const gates: IGate[] = [];

		const track = <T>(work: Promise<T>): Promise<T> => {
			inFlight.push(work.catch(() => undefined));

			return work;
		};

		const gate = (): IGate => {
			const created = createGate();

			gates.push(created);

			return created;
		};

		/**
		 * Waits until a statement is blocked by the lock of the transaction stopped at the gate, and fails if the side
		 * that should send it finished, or never got there.
		 *
		 * Only a wait on that one backend counts (`pg_blocking_pids`): the holder locks nothing but the suite's own rows,
		 * so no other connection of the database — another suite's, or another blocked `SELECT` — can stand in for the
		 * side under test.
		 *
		 * The statement is matched by how it starts: `pg_stat_activity` keeps only the first
		 * `track_activity_query_size` bytes (1 kB by default), and TypeORM's column list alone is longer than that.
		 *
		 * @param statement The waiting statement, as `pg_stat_activity` shows it.
		 * @param holder The backend of the transaction stopped at the gate.
		 * @param who The side, for the failure message.
		 * @param work That side's work.
		 */
		async function waitingOnALock(
			statement: RegExp,
			holder: number,
			who: string,
			work: Promise<unknown>
		): Promise<void> {
			let finished: unknown = null;
			const watched = work.then(
				(value) => (finished = { value }),
				(error) => (finished = { error })
			);
			const deadline = Date.now() + WAIT_MS;

			for (;;) {
				const waiting = await query(
					`SELECT "query" FROM pg_stat_activity WHERE "datname" = current_database() AND "wait_event_type" = 'Lock' AND "pid" <> $1 AND $1 = ANY(pg_blocking_pids("pid"))`,
					[holder]
				);

				if (waiting.some((backend) => statement.test(String(backend['query'])))) {
					return;
				}

				if (finished) {
					throw new Error(`${who} finished without waiting on a lock: ${JSON.stringify(finished)}`);
				}

				if (Date.now() > deadline) {
					throw new Error(`${who} did not wait on backend ${holder}'s lock within ${WAIT_MS} ms`);
				}

				await Promise.race([watched, new Promise((resolve) => setTimeout(resolve, 20))]);
			}
		}

		beforeAll(() => {
			side = sides[orm];

			// Control: a registry that did not load as PostgreSQL would ask for no row lock, and both orders below would
			// prove nothing about the lock.
			expect(side.isPostgres()).toBe(true);
		});

		beforeEach(() => {
			watermarks = { advance: jest.fn(async () => undefined) };
			retention = new platform['RealtimeRetentionService'](dataSource, watermarks as never);

			// An operator of the event's own tenant and organization.
			jest.spyOn(side.requestContext, 'currentTenantId').mockReturnValue(TENANT);
			jest.spyOn(side.requestContext, 'currentOrganizationId').mockReturnValue(ORG);
		});

		afterEach(async () => {
			for (const open of gates.splice(0)) {
				open.release();
			}

			await Promise.all(inFlight.splice(0));
			jest.restoreAllMocks();
			await query(`DELETE FROM "event_delivery"`);
			await query(`DELETE FROM "event_outbox"`);
		});

		it('a retention delete in flight lands first: the replay waits, finds no row, is refused, and writes nothing', async () => {
			const { eventId, deliveryId } = await seed();
			const before = await deliveryRowOf(deliveryId);
			const deleted = gate();

			// The pass stops inside its transaction, after its delete, at the watermark write that follows it (on the
			// transaction's manager, so on its connection).
			watermarks.advance.mockImplementationOnce(async (manager: TypeOrmTransaction) =>
				deleted.pass(backendOf(await manager.query(BACKEND_PID)))
			);

			const pruning = track(retention.prune(new Date(), BOUNDS));

			const deleting = await deleted.reached;
			// The delete is not committed: another connection still reads the row.
			expect(await outboxRowOf(eventId)).toMatchObject({ status: EventOutboxStatus.PUBLISHED });

			const replaying = track(side.service.replayDelivery(deliveryId));

			// The replay's read of the row. A plain read never waits on a row lock in PostgreSQL, so its waiting is itself
			// the proof that it asks for one (`FOR UPDATE`).
			await waitingOnALock(/^\s*SELECT\b/i, deleting, 'the replay', replaying);
			deleted.release();

			expect(await pruning).toEqual({
				removed: 1,
				scopes: [{ tenantId: TENANT, organizationId: ORG, removed: 1 }],
				failed: 0
			});

			const refusal = await replaying.then(
				() => null,
				(error: unknown) => error
			);

			// By name, as each registry constructs the exception from its own `@nestjs/common`; and by message, as the
			// refusal of a record outside the caller's scope is a `NotFoundException` too.
			expect(refusal).toMatchObject({ name: 'NotFoundException' });
			expect(String((refusal as Error).message)).toContain('is no longer in the outbox');
			expect(await outboxRowOf(eventId)).toBeUndefined();
			// The record is exactly as it was: no reset was written before, or after, the refusal.
			expect(await deliveryRowOf(deliveryId)).toEqual(before);
		}, 60_000);

		it('a replay in flight lands first: the retention delete waits, then keeps the re-queued row', async () => {
			const { eventId, deliveryId } = await seed();
			const locked = gate();

			side.holdAfterLock(locked);

			const replaying = track(side.service.replayDelivery(deliveryId));

			// The replay holds the row under `FOR UPDATE` and has written nothing yet.
			const replayer = await locked.reached;

			const pruning = track(retention.prune(new Date(), BOUNDS));

			await waitingOnALock(/^\s*DELETE FROM "event_outbox"/i, replayer, 'the retention', pruning);
			locked.release();

			expect(await replaying).toMatchObject({
				id: deliveryId,
				status: EventOutboxStatus.PENDING,
				attemptCount: 0,
				lastError: null,
				deliveredAt: null
			});
			// The delete re-checked the row it waited for, found it `PENDING`, and removed nothing. It is the delete's
			// `status = PUBLISHED` that keeps the row: PostgreSQL re-checks the waited-for row's new version, but the
			// `NOT EXISTS` on the deliveries still reads the delete's own snapshot, in which the record is acknowledged.
			// Without the status check this case fails, with the row removed.
			expect(await pruning).toEqual({ removed: 0, scopes: [], failed: 0 });
			expect(watermarks.advance).not.toHaveBeenCalled();
			expect(await outboxRowOf(eventId)).toEqual({
				status: EventOutboxStatus.PENDING,
				attemptCount: 0,
				publishedAt: null,
				lastError: null
			});
			expect(await deliveryRowOf(deliveryId)).toMatchObject({
				status: EventOutboxStatus.PENDING,
				attemptCount: 0,
				lastError: null,
				deliveredAt: null
			});
		}, 60_000);
	});
});
