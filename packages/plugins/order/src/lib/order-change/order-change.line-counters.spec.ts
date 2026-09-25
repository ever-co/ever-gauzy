/**
 * Which ORM the services read and write through, and which dialect their statements are written for.
 *
 * Both are configured per case and doubled faithfully, as the fulfilment service's own suite does:
 * `getORMType` answers whatever the case configured, and the dialect helpers are the kernel's own
 * (`packages/core/src/lib/database/database.helper.ts`) reading the dialect the case configured.
 */
const mockOrm = { type: 'typeorm' };
const mockDialect = { type: 'better-sqlite3' };

jest.mock(
	'@gauzy/config',
	() => ({
		isMySQL: () => mockDialect.type === 'mysql',
		isPostgres: () => mockDialect.type === 'postgres'
	}),
	{ virtual: true }
);

/**
 * The cart barrel re-exports the cart plugin, which imports the catalogue and the rest of the marketplace;
 * the totals service reaches it only for the calculator, and the totals service is a double here.
 */
jest.mock('@gauzy/plugin-cart', () => ({ TotalsCalculator: class {} }));

/**
 * `@gauzy/core` boots the whole application graph from its barrel, so it is doubled at the module boundary
 * as the package's other suites double it. **The services under test are the real ones**: the change service
 * and the fulfilment service whose single statement it now moves the counters through. The base CRUD class is
 * the one piece of the platform restated, over an in-memory table, because the change row is not what these
 * cases are about.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');
	const statements = jest.requireActual('@gauzy/core/src/lib/database/database.helper');
	const decimal = jest.requireActual('@gauzy/core/src/lib/money/decimal');
	const versions = jest.requireActual('@gauzy/core/src/lib/concurrency/version.util');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class CrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return mockOrm.type;
		}
	}

	class TenantAwareCrudService extends CrudService {
		async findAll(options: any = {}): Promise<any> {
			const items = await this.typeOrmRepository.find(options);

			return { items, total: items.length };
		}

		async find(options: any = {}): Promise<any> {
			return this.typeOrmRepository.find(options);
		}

		async findOneByIdString(id: any, options: any = {}): Promise<any> {
			const record = id ? await this.typeOrmRepository.findOne({ ...options, where: { id } }) : null;

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(entity);
		}

		async update(id: any, partial: any): Promise<any> {
			return this.typeOrmRepository.update(id, partial);
		}
	}

	return {
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		CrudService,
		TenantAwareCrudService,
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		Idempotent: decorator,
		Versioned: decorator,
		VersionedColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		...decimal,
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		// The comparison a confirmation makes before it applies anything, and the refusal it raises, are the
		// kernel's own: what these cases assert is which row that comparison is made against.
		matchesExpectation: versions.matchesExpectation,
		parseEntityVersion: versions.parseEntityVersion,
		ApiException: jest.requireActual('@gauzy/core/src/lib/core/errors/api-exception').ApiException,
		ApiErrorCode: jest.requireActual('@gauzy/core/src/lib/core/errors/api-error-codes').ApiErrorCode,
		commitVersionedUpdate: jest.fn(),
		versionExpectationOf: jest.fn(),
		AdjustmentService: class {},
		TaxLineService: class {},
		SequenceService: class {},
		EventOutboxService: class {},
		MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
		getORMType: () => mockOrm.type,
		quoteIdentifier: statements.quoteIdentifier,
		toPositionalStatement: statements.toPositionalStatement,
		readAffectedRows: statements.readAffectedRows,
		wrapSerialize: (entity: unknown) => entity,
		// The fixture's scope, which is what a request-scoped read resolves to. A case about tenancy re-points
		// it with a spy.
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => 'tenant-1',
			currentOrganizationId: () => 'organization-1',
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

import { OrderChangeActionType, OrderChangeStatus, OrderChangeType, OrderStatus } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { OrderLineFulfillmentService } from '../order-line-fulfillment/order-line-fulfillment.service';
import { OrderChangeService } from './order-change.service';

/**
 * The SQLite binding, required rather than imported: nothing in this repository loads a native binding at
 * module-parse time. The two members used here are typed locally.
 */
interface ISqliteStatement {
	run(...parameters: unknown[]): { changes: number; lastInsertRowid: number | bigint };
	all(...parameters: unknown[]): Array<Record<string, unknown>>;
}
interface ISqliteDatabase {
	exec(sql: string): void;
	prepare(sql: string): ISqliteStatement;
	close(): void;
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Sqlite = require('better-sqlite3') as new (path: string) => ISqliteDatabase;

/**
 * The counters an order change moves on an order line, and the order row it decides against.
 *
 * `ITEM_RETURN`, `DISMISS_ITEM_RETURN` and `WRITE_OFF_ITEM` move `returnRequestedQuantity`,
 * `returnDismissedQuantity` and `writtenOffQuantity`. The change used to read the line, add the action's
 * quantity in JavaScript and write the sum back — a lost update, and on `returnRequestedQuantity` one that
 * overwrote the returns flow's own atomic move of the same counter whenever that move landed between the
 * change's read and its write. The cases below put exactly that writer between the two, and assert what the
 * row holds afterwards:
 *
 * - **the counter is moved by the fulfilment service's one statement**, so a concurrent move of the same
 *   counter survives the change's;
 * - **it never goes below zero**, and a refused move applies nothing of the change;
 * - **the line is confined to the order's tenant and organization by the statement itself**.
 *
 * Every case runs on both ORMs and the three spellings the statement has.
 *
 * The last block is about the order row a change decides against. Under `DB_ORM=mikro-orm` the TypeORM entity
 * carries no column metadata beyond the base columns — `@MultiORMColumn` registers the active ORM's decorator
 * alone — so a read through the TypeORM repository answers a row with no version, no status and no currency.
 * The TypeORM double answers exactly that under MikroORM, which is what makes those cases say something.
 */

const TENANT = 'tenant-1';
const ORG = 'organization-1';
const OTHER_ORG = 'organization-2';
const ORDER = 'order-1';
const CHANGE = 'change-1';

type Row = Record<string, unknown>;

/** The columns of the two tables, as the migration names them. */
const ORDER_COLUMNS = ['id', 'tenantId', 'organizationId', 'currency', 'status', 'version', 'deletedAt'];
const LINE_COLUMNS = [
	'id',
	'orderId',
	'tenantId',
	'organizationId',
	'position',
	'fulfilledQuantity',
	'returnRequestedQuantity',
	'returnReceivedQuantity',
	'returnDismissedQuantity',
	'writtenOffQuantity',
	'unitPrice',
	'deletedAt'
];

/** @returns An empty store with the two tables, the counters typed as the migration types them. */
function createStore(): ISqliteDatabase {
	const db = new Sqlite(':memory:');

	db.exec(
		`CREATE TABLE "order" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, ` +
			`"currency" varchar, "status" varchar, "version" integer NOT NULL DEFAULT (1), "deletedAt" datetime)`
	);
	db.exec(
		`CREATE TABLE "order_line" ("id" varchar PRIMARY KEY NOT NULL, "orderId" varchar NOT NULL, "tenantId" varchar, ` +
			`"organizationId" varchar, "position" integer NOT NULL DEFAULT (0), ` +
			`"fulfilledQuantity" numeric(20,6) NOT NULL DEFAULT (0), "returnRequestedQuantity" numeric(20,6) NOT NULL DEFAULT (0), ` +
			`"returnReceivedQuantity" numeric(20,6) NOT NULL DEFAULT (0), "returnDismissedQuantity" numeric(20,6) NOT NULL DEFAULT (0), ` +
			`"writtenOffQuantity" numeric(20,6) NOT NULL DEFAULT (0), "unitPrice" numeric(20,6) NOT NULL DEFAULT (0), "deletedAt" datetime)`
	);

	return db;
}

/**
 * @param db The store.
 * @param table The table.
 * @param columns Its columns.
 * @param row The row; a member it does not carry takes the column's default.
 */
function insert(db: ISqliteDatabase, table: string, columns: string[], row: Row): void {
	const present = columns.filter((column) => row[column] !== undefined);

	db.prepare(
		`INSERT INTO "${table}" (${present.map((column) => `"${column}"`).join(', ')}) VALUES (${present.map(() => '?').join(', ')})`
	).run(...present.map((column) => row[column]));
}

/**
 * Reads rows by equality, the way both ORMs read a criteria object: an `undefined` member is dropped, and a
 * soft-deleted row is never answered.
 */
function select(db: ISqliteDatabase, table: string, where: Row = {}): Row[] {
	const criteria = Object.entries(where ?? {}).filter(([, value]) => value !== undefined);
	const clause = criteria
		.map(([column]) => `"${column}" = ?`)
		.concat(['"deletedAt" IS NULL'])
		.join(' AND ');

	return db.prepare(`SELECT * FROM "${table}" WHERE ${clause}`).all(...criteria.map(([, value]) => value));
}

/** One statement a connection double ran. */
interface IStatement {
	orm: string;
	sql: string;
	parameters: unknown[];
}

/**
 * What a case can arrange to happen *between* the change's first touch of an order line and its write.
 *
 * The change's own path is the only one hooked: the read of the line, the write of the line and the
 * statement that moves a counter all call {@link IInterleaving.touch} first, and the writer a case parked
 * here runs once, at the first of them. A read runs the writer *after* it has read, which is the window a
 * read-then-write-back leaves open; a single statement has no such window, so the writer lands before it.
 */
interface IInterleaving {
	writer?: () => Promise<void>;
	touch(): Promise<void>;
}

/**
 * The repository and connection doubles of both ORMs over one store, as the fulfilment suite builds them.
 *
 * @param db The store.
 * @param statements Where the statements the connections run are recorded.
 * @param interleaving The hook the change's own path calls, when these doubles are the change's.
 */
function doubles(db: ISqliteDatabase, statements: IStatement[], interleaving?: IInterleaving) {
	const touch = async (sql: string) => {
		if (interleaving && /order_line/.test(sql)) {
			await interleaving.touch();
		}
	};
	const typeOrm = (table: string, reads: Row[]) => {
		const runner = {
			query: async (sql: string, parameters: unknown[] = [], structured?: boolean) => {
				await touch(sql);
				statements.push({ orm: 'typeorm', sql, parameters });

				const statement = db.prepare(sql);
				const result =
					mockDialect.type === 'postgres'
						? statement.run(
								Object.fromEntries(parameters.map((value, index) => [String(index + 1), value]))
							)
						: statement.run(...parameters);

				return structured ? { affected: result.changes, raw: result.lastInsertRowid } : result.lastInsertRowid;
			},
			release: async () => undefined
		};

		return {
			reads,
			manager: { queryRunner: undefined, dataSource: { createQueryRunner: () => runner } },
			find: async (options: Row = {}) => (reads.push(options), select(db, table, options.where as Row)),
			// Under MikroORM the TypeORM entity carries its base columns and nothing else, so what a read through
			// it answers is the id alone — and a criterion on any other column names a property it does not have.
			findOne: async (options: Row = {}) => {
				reads.push(options);

				const [row] = select(db, table, options.where as Row);

				if (mockOrm.type === 'mikro-orm') {
					const unknown = Object.keys((options.where as Row) ?? {}).filter((column) => column !== 'id');

					if (unknown.length) {
						throw new Error(`Property "${unknown[0]}" was not found in "${table}".`);
					}

					return row ? { id: row['id'] } : null;
				}

				return row ?? null;
			}
		};
	};
	const mikroOrm = (table: string, reads: Row[]) => ({
		reads,
		find: async (where: Row) => (reads.push(where), select(db, table, where)),
		findOne: async (where: Row) => (reads.push(where), select(db, table, where)[0] ?? null),
		getEntityManager: () => ({
			getConnection: () => ({
				execute: async (sql: string, parameters: unknown[] = []) => {
					await touch(sql);
					statements.push({ orm: 'mikro-orm', sql, parameters });

					return { affectedRows: db.prepare(sql).run(...parameters).changes };
				}
			})
		})
	});

	return {
		orders: typeOrm('order', []),
		orderLines: typeOrm('order_line', []),
		mikroOrders: mikroOrm('order', []),
		mikroOrderLines: mikroOrm('order_line', [])
	};
}

/** Every store a case opened, closed once the case is over. */
const stores: ISqliteDatabase[] = [];

afterEach(() => {
	jest.restoreAllMocks();
	mockOrm.type = 'typeorm';
	mockDialect.type = 'better-sqlite3';

	for (const db of stores.splice(0)) {
		db.close();
	}
});

/** One line of the order, in the fixture's scope, with every counter at zero unless stated. */
const lineOf = (id: string, overrides: Row = {}): Row => ({
	id,
	orderId: ORDER,
	tenantId: TENANT,
	organizationId: ORG,
	fulfilledQuantity: 5,
	unitPrice: 10,
	...overrides
});

/**
 * Builds the change service over one store, with a pending change of the stated actions.
 *
 * @param lines The order's lines.
 * @param actions The change's actions, in the order they run.
 * @param order Columns the order starts with.
 */
function fixture(lines: Row[], actions: Row[], order: Row = {}) {
	const db = createStore();
	const statements: IStatement[] = [];
	const interleaving: IInterleaving = {
		touch: async () => {
			const writer = interleaving.writer;

			interleaving.writer = undefined;
			await writer?.();
		}
	};

	stores.push(db);
	insert(db, 'order', ORDER_COLUMNS, {
		id: ORDER,
		tenantId: TENANT,
		organizationId: ORG,
		currency: 'USD',
		status: OrderStatus.CONFIRMED,
		version: 3,
		...order
	});

	for (const line of lines) {
		insert(db, 'order_line', LINE_COLUMNS, line);
	}

	const own = doubles(db, statements, interleaving);
	// The returns flow: the same fulfilment service over the same store, and never hooked — it is the writer a
	// case parks between the change's read and its write.
	const theirs = doubles(db, []);
	const returnsFlow = new OrderLineFulfillmentService(
		theirs.orders as never,
		theirs.orderLines as never,
		theirs.mikroOrders as never,
		theirs.mikroOrderLines as never
	);
	const lineCounters = new OrderLineFulfillmentService(
		own.orders as never,
		own.orderLines as never,
		own.mikroOrders as never,
		own.mikroOrderLines as never
	);

	/** The line service the change used to read and write the counters through, over the same store. */
	const lineService = {
		find: jest.fn(async (options: Row = {}) => {
			const rows = select(db, 'order_line', options.where as Row);

			// Read first, then let the parked writer land: the window a read-then-write-back leaves open.
			await interleaving.touch();

			return rows;
		}),
		update: jest.fn(async (id: string, partial: Row) => {
			await interleaving.touch();

			for (const [column, value] of Object.entries(partial)) {
				db.prepare(`UPDATE "order_line" SET "${column}" = ? WHERE "id" = ?`).run(value, id);
			}

			return { affected: 1 };
		})
	};

	const changeRow: Row = {
		id: CHANGE,
		orderId: ORDER,
		tenantId: TENANT,
		organizationId: ORG,
		changeType: OrderChangeType.RETURN,
		status: OrderChangeStatus.REQUESTED,
		version: 4,
		actions: actions.map((action, ordering) => ({ id: `action-${ordering}`, ordering, applied: false, ...action }))
	};
	const changes = {
		// A fixture with no actions is one a case creates its own change on, and an open change would hold the
		// order's exclusivity slot against it.
		rows: (actions.length ? [changeRow] : []) as Row[],
		find: async () => changes.rows,
		findOne: async (options: Row = {}) =>
			changes.rows.find((row) => row['id'] === (options.where as Row)?.['id']) ?? null,
		save: async (entity: Row) => {
			const saved = { id: `change-${changes.rows.length + 1}`, actions: [], ...entity };

			changes.rows.push(saved);

			return saved;
		},
		update: async (id: string, partial: Row) => {
			Object.assign(changes.rows.find((row) => row['id'] === id) ?? {}, partial);

			return { affected: 1 };
		}
	};
	const actionService = {
		create: jest.fn(async (action: Row) => action),
		update: jest.fn(async () => ({ affected: 1 })),
		findAll: jest.fn(async () => ({ items: changeRow['actions'], total: 1 }))
	};
	const historyService = { record: jest.fn(async () => undefined) };
	const totalsService = { recompute: jest.fn(async () => ({ id: ORDER })) };
	const creditLineService = { create: jest.fn(async (row: Row) => row) };
	const transactionService = { create: jest.fn(async (row: Row) => row) };

	const service = new (OrderChangeService as any)(
		changes,
		{},
		own.orders,
		actionService,
		lineService,
		{},
		{},
		creditLineService,
		transactionService,
		historyService,
		totalsService,
		lineCounters,
		own.mikroOrders
	) as OrderChangeService;

	return {
		db,
		service,
		statements,
		interleaving,
		returnsFlow,
		lineService,
		actionService,
		totalsService,
		creditLineService,
		transactionService,
		change: changeRow,
		orders: own.orders,
		mikroOrders: own.mikroOrders,
		/** The counters of one line, as the store holds them now. */
		counters: (id: string) => db.prepare(`SELECT * FROM "order_line" WHERE "id" = ?`).all(id)[0]
	};
}

/** One action of a change, stated as a caller states it. */
const action = (type: OrderChangeActionType, orderLineId: string, quantity: unknown): Row => ({
	action: type,
	referenceId: orderLineId,
	details: { orderLineId, quantity }
});

describe.each([
	['TypeORM on SQLite', 'typeorm', 'better-sqlite3'],
	['TypeORM, the MySQL spelling', 'typeorm', 'mysql'],
	['TypeORM, the Postgres placeholders', 'typeorm', 'postgres'],
	['MikroORM on Postgres', 'mikro-orm', 'postgres'],
	['MikroORM, the MySQL spelling', 'mikro-orm', 'mysql']
] as const)('OrderChangeService — the line counters a change moves, %s', (_label, orm, dialect) => {
	beforeEach(() => {
		mockOrm.type = orm;
		mockDialect.type = dialect;
	});

	it('keeps the move the returns flow made while the change was applying ITEM_RETURN', async () => {
		// The failure scenario: the returns flow raises a return of two units on the line at the moment the
		// change applies its own return of one. A read-then-write-back read 0, let the returns flow land 2,
		// and wrote 0 + 1 over it — the line then asked back one unit where three are asked for.
		const { service, counters, interleaving, returnsFlow } = fixture(
			[lineOf('line-1')],
			[action(OrderChangeActionType.ITEM_RETURN, 'line-1', 1)]
		);

		interleaving.writer = () =>
			returnsFlow.recordReturnRequest(ORDER, [{ orderLineId: 'line-1', quantityDelta: '2' }]);

		await service.confirm(CHANGE);

		expect(interleaving.writer).toBeUndefined();
		expect(counters('line-1')).toMatchObject({ returnRequestedQuantity: 3 });
	});

	it('keeps a concurrent dismissal and a concurrent write-off too', async () => {
		const { service, counters, interleaving, returnsFlow } = fixture(
			[lineOf('line-1', { returnRequestedQuantity: 4, returnDismissedQuantity: 1, writtenOffQuantity: 1 })],
			[
				action(OrderChangeActionType.DISMISS_ITEM_RETURN, 'line-1', 1),
				action(OrderChangeActionType.WRITE_OFF_ITEM, 'line-1', '0.5')
			]
		);

		interleaving.writer = async () => {
			await returnsFlow.recordReturnDismissal(ORDER, [{ orderLineId: 'line-1', quantityDelta: '1' }]);
			await returnsFlow.recordWriteOff(ORDER, [{ orderLineId: 'line-1', quantityDelta: '1' }]);
		};

		await service.confirm(CHANGE);

		expect(counters('line-1')).toMatchObject({
			returnRequestedQuantity: 4,
			returnDismissedQuantity: 3,
			writtenOffQuantity: 2.5
		});
	});

	it('moves each counter by one relative statement, scoped to the order, and never reads the line to do it', async () => {
		const { service, statements, lineService } = fixture(
			[lineOf('line-1', { returnRequestedQuantity: 2 })],
			[
				action(OrderChangeActionType.ITEM_RETURN, 'line-1', 1),
				action(OrderChangeActionType.DISMISS_ITEM_RETURN, 'line-1', 1),
				action(OrderChangeActionType.WRITE_OFF_ITEM, 'line-1', 2)
			]
		);

		await service.confirm(CHANGE);

		const moved = statements.filter((statement) => /^UPDATE/.test(statement.sql));
		const q = dialect === 'mysql' ? '`' : '"';

		expect(moved.map((statement) => statement.sql.split(' ')[3])).toEqual([
			`${q}returnRequestedQuantity${q}`,
			`${q}returnDismissedQuantity${q}`,
			`${q}writtenOffQuantity${q}`
		]);

		for (const statement of moved) {
			expect(statement.orm).toBe(orm);
			// `SET col = ROUND(col + :delta)`, never `SET col = <a value computed from a read>`.
			expect(statement.sql).toMatch(/SET (\S+) = ROUND\(\1 \+ CAST\(/);
			expect(statement.sql).toContain(`${q}tenantId${q} = `);
			expect(statement.sql).toContain(`${q}organizationId${q} = `);
			expect(statement.parameters).toEqual(expect.arrayContaining([ORDER, TENANT, ORG]));
		}

		expect(lineService.find).not.toHaveBeenCalled();
		expect(lineService.update).not.toHaveBeenCalled();
	});

	it('refuses a move below zero, and applies nothing of the change', async () => {
		const { service, counters, change, actionService, totalsService } = fixture(
			[lineOf('line-1', { writtenOffQuantity: 1 })],
			[action(OrderChangeActionType.WRITE_OFF_ITEM, 'line-1', -2)]
		);

		await expect(service.confirm(CHANGE)).rejects.toThrow(/ORDER_LINE_WRITE_OFF_BELOW_ZERO/);

		expect(counters('line-1')).toMatchObject({ writtenOffQuantity: 1 });
		expect(change['status']).toBe(OrderChangeStatus.REQUESTED);
		expect(actionService.update).not.toHaveBeenCalled();
		expect(totalsService.recompute).not.toHaveBeenCalled();
	});

	it('refuses a line of the order that carries another organization, because the statement is scoped', async () => {
		const { service, counters } = fixture(
			[lineOf('line-foreign', { organizationId: OTHER_ORG })],
			[action(OrderChangeActionType.ITEM_RETURN, 'line-foreign', 1)]
		);

		await expect(service.confirm(CHANGE)).rejects.toThrow(/ORDER_LINE_NOT_FOUND/);
		expect(counters('line-foreign')).toMatchObject({ returnRequestedQuantity: 0 });
	});

	it('still refuses an action that names no line', async () => {
		const { service, statements } = fixture(
			[lineOf('line-1')],
			[{ action: OrderChangeActionType.ITEM_RETURN, details: {} }]
		);

		await expect(service.confirm(CHANGE)).rejects.toThrow(/ORDER_CHANGE_ACTION_INVALID/);
		expect(statements).toEqual([]);
	});
});

/**
 * The order row a change decides against, read through the configured ORM and in the caller's scope.
 *
 * A confirmation compares the version its caller stated with the order's before it applies anything; the
 * creation of a change refuses an archived order and states the version it will produce; a credit states the
 * order's currency. All three read the order — through the TypeORM repository, whatever the ORM. Under
 * MikroORM that repository answers a row with none of those columns, so the comparison passed for a stale
 * version, an archived order took a change with a version of `NaN`, and a credit was written with no
 * currency.
 */
describe.each([
	['TypeORM', 'typeorm'],
	['MikroORM', 'mikro-orm']
] as const)('OrderChangeService — the order it decides against, %s', (_label, orm) => {
	beforeEach(() => {
		mockOrm.type = orm;
	});

	/** The repository the configured ORM reads through, and the one it must leave alone. */
	const readers = (built: ReturnType<typeof fixture>) =>
		orm === 'mikro-orm'
			? { used: built.mikroOrders.reads, unused: built.orders.reads }
			: { used: built.orders.reads, unused: built.mikroOrders.reads };

	it('refuses a confirmation stated against a version the order has moved past, before applying anything', async () => {
		const built = fixture([lineOf('line-1')], [action(OrderChangeActionType.ITEM_RETURN, 'line-1', 1)]);

		await expect(built.service.confirm(CHANGE, { wildcard: false, versions: [2] })).rejects.toMatchObject({
			code: 'ENTITY_VERSION_CONFLICT',
			status: 409
		});

		expect(built.counters('line-1')).toMatchObject({ returnRequestedQuantity: 0 });
		expect(built.actionService.update).not.toHaveBeenCalled();
		expect(readers(built).used.length).toBeGreaterThan(0);
		expect(readers(built).unused).toEqual([]);
	});

	it('refuses a change to an archived order, and states the version the change will produce', async () => {
		const archived = fixture([lineOf('line-1')], [], { status: OrderStatus.ARCHIVED });

		await expect(
			archived.service.create({
				orderId: ORDER,
				changeType: OrderChangeType.EDIT,
				actions: [{ action: OrderChangeActionType.NOTE_ADD, details: { title: 'note' } }]
			} as never)
		).rejects.toThrow(/ORDER_ARCHIVED/);

		const open = fixture([lineOf('line-1')], []);
		const created = await open.service.create({
			orderId: ORDER,
			changeType: OrderChangeType.EDIT,
			actions: [{ action: OrderChangeActionType.NOTE_ADD, details: { title: 'note' } }]
		} as never);

		// The order stands at version 3, so the change announces 4.
		expect(created.version).toBe(4);
		expect(readers(open).unused).toEqual([]);
	});

	it('writes a credit in the order’s currency, at the version the change produces', async () => {
		const built = fixture(
			[lineOf('line-1')],
			[{ action: OrderChangeActionType.CREDIT_LINE_ADD, amount: 5, details: { amount: 5 } }]
		);

		await built.service.confirm(CHANGE);

		expect(built.creditLineService.create).toHaveBeenCalledWith(
			expect.objectContaining({ orderId: ORDER, currency: 'USD', version: 4 })
		);
		expect(built.transactionService.create).toHaveBeenCalledWith(expect.objectContaining({ currency: 'USD' }));
		expect(readers(built).unused).toEqual([]);
	});

	it('does not find an order of another organization, which is the answer for one that does not exist', async () => {
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);
		const built = fixture([lineOf('line-1')], []);

		await expect(
			built.service.create({
				orderId: ORDER,
				changeType: OrderChangeType.EDIT,
				actions: [{ action: OrderChangeActionType.NOTE_ADD, details: { title: 'note' } }]
			} as never)
		).rejects.toThrow(/ORDER_NOT_FOUND/);
	});
});
