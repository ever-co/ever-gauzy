/**
 * Which ORM the service reads and writes through, and which dialect its statements are written for.
 *
 * Both are configured per case, and both are doubled **faithfully**, because they are what the counter
 * cases are about: `getORMType` answers whatever the case configured, and the dialect helpers are the
 * kernel's own (`packages/core/src/lib/database/database.helper.ts`) reading the dialect the case
 * configured — identifiers in backticks on MySQL, a named parameter as `$n` on Postgres and `?`
 * everywhere else.
 */
const mockOrm = { type: 'typeorm' };
const mockDialect = { type: 'better-sqlite3' };

/** The dialect probes the kernel's statement helpers read, answering for the dialect the case chose. */
jest.mock(
	'@gauzy/config',
	() => ({
		isMySQL: () => mockDialect.type === 'mysql',
		isPostgres: () => mockDialect.type === 'postgres'
	})
);

/**
 * One module boundary is doubled here, for the same reason and in the same way as the package's
 * other suites: `@gauzy/core` boots the whole application graph from its barrel — configuration,
 * the ORM, the job registry, the module scanner — none of which a read of two columns needs and
 * none of which is available outside a running application. The service under test is the real one,
 * and so are the two entities it reads through, which is why the store below answers with the
 * numbers a `numeric(20,6)` column reads back as rather than with a text value the transformer would
 * never produce.
 */
jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	// The kernel's own statement helpers, reading the dialect through the `@gauzy/config` double above.
	const statements = jest.requireActual('@gauzy/core/src/lib/database/database.helper');
	const decimal = jest.requireActual('@gauzy/core/src/lib/money/decimal');

	return {
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
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
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		// The decimal kernel, whole: the counter's delta is read at the column's scale before it is sent,
		// and a double that omitted a helper would make the code under test call nothing — which fails the
		// suite for a reason that is not its own.
		addDecimalStrings: decimal.addDecimalStrings,
		// The order's own derivation reads the counters these cases move, and subtracts on its digits.
		subtractDecimalStrings: decimal.subtractDecimalStrings,
		compareDecimalStrings: decimal.compareDecimalStrings,
		normalizeDecimalString: decimal.normalizeDecimalString,
		formatDecimalUnits: decimal.formatDecimalUnits,
		toUnitsAtScale: decimal.toUnitsAtScale,
		STORAGE_SCALE: decimal.STORAGE_SCALE,
		MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
		getORMType: () => mockOrm.type,
		quoteIdentifier: statements.quoteIdentifier,
		toPositionalStatement: statements.toPositionalStatement,
		readAffectedRows: statements.readAffectedRows,
		// The double answers with the fixture's scope, which is what a request-scoped read resolves to.
		// A case that is about tenancy re-points it with a spy, so the scope is never a constant of this
		// specification.
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

import { NotFoundException } from '@nestjs/common';
import { FulfillmentStatus, OrderStatus } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { OrderStateMachine } from '../order-state-machine/order-state-machine';
import { OrderLineFulfillmentService } from './order-line-fulfillment.service';

/**
 * The SQLite binding, required rather than imported.
 *
 * It is a native module, and this repository reaches it the same way everywhere: nothing loads a
 * native binding at module-parse time. The two members used here are typed locally.
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
 * The fulfilled quantities of an order, as a package that does not own the order reads them.
 *
 * What this suite is about is the *answer*, not the query: a caller measures a request against the
 * number reported here, so the cases below assert the three things that would make the answer
 * wrong rather than merely inconvenient.
 *
 * - **The ceiling is what was fulfilled, never what was ordered.** A partially fulfilled line
 *   reports the part that left, and the ordered quantity appears nowhere in the report.
 * - **A line with nothing fulfilled on it is absent.** Absence is the caller's answer to "may this
 *   be acted on?", so a never-fulfilled line — and a line whose fulfilments were all cancelled —
 *   must not be reported as a zero the caller would have to interpret.
 * - **Both numbers are exact.** The quantity is the column's exact decimal text and the price is
 *   the snapshot the line was sold at, at the storage scale, so a comparison at the ceiling and a
 *   multiplication into an amount are both exact.
 *
 * Tenancy is asserted as well, because a read that answered across organizations would be a data
 * leak rather than a bug in a feature: the order is read inside the caller's scope, and a foreign
 * order is not found at all — its lines are never even read.
 *
 * **The store is a real SQLite database.** The counter moves are statements, and what they are
 * about — the addition, the floor and the write happening in one statement the database serialises —
 * is a property of the statement rather than of the service's JavaScript. The two repositories of
 * each ORM are doubles that read the same in-memory tables, and the write goes through the connection
 * double of the configured ORM onto those tables, so every counter assertion below reads what the
 * statement actually left in the row.
 */

const TENANT = 'tenant-1';
const ORG = 'organization-1';
const OTHER_TENANT = 'tenant-2';
const OTHER_ORG = 'organization-2';
const ORDER = 'order-1';
const OTHER_ORDER = 'order-2';

/** The price the fixture's lines were sold at, as the numeric transformer reads a `numeric(20,6)`. */
const SOLD_AT = 12.5;
const SECOND_SOLD_AT = 19.99;

type Row = Record<string, unknown>;

/** One `order_line` row, as this service reads it. */
interface ILineRow {
	id: string;
	orderId: string;
	tenantId?: string;
	organizationId?: string;
	variantId?: string;
	position?: number;
	fulfilledQuantity?: number;
	returnRequestedQuantity?: number;
	returnReceivedQuantity?: number;
	returnDismissedQuantity?: number;
	writtenOffQuantity?: number;
	unitPrice?: number;
	deletedAt?: string;
}

/** The columns of the two tables, as the migration names them and in the order the fixture writes. */
const ORDER_COLUMNS = ['id', 'tenantId', 'organizationId', 'currency', 'channelId', 'deletedAt'];
const LINE_COLUMNS = [
	'id',
	'orderId',
	'tenantId',
	'organizationId',
	'variantId',
	'position',
	'fulfilledQuantity',
	'returnRequestedQuantity',
	'returnReceivedQuantity',
	'returnDismissedQuantity',
	'writtenOffQuantity',
	'unitPrice',
	'deletedAt'
];

/**
 * @returns An empty store with the two tables the service reads and writes, typed as the migration
 * types them — the counters `numeric(20,6) NOT NULL DEFAULT 0`, which is what SQLite rounds and floors.
 */
function createStore(): ISqliteDatabase {
	const db = new Sqlite(':memory:');

	db.exec(
		`CREATE TABLE "order" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar, "organizationId" varchar, ` +
			`"currency" varchar, "channelId" varchar, "deletedAt" datetime)`
	);
	db.exec(
		`CREATE TABLE "order_line" ("id" varchar PRIMARY KEY NOT NULL, "orderId" varchar NOT NULL, "tenantId" varchar, ` +
			`"organizationId" varchar, "variantId" varchar, "position" integer NOT NULL DEFAULT (0), ` +
			`"fulfilledQuantity" numeric(20,6) NOT NULL DEFAULT (0), "returnRequestedQuantity" numeric(20,6) NOT NULL DEFAULT (0), ` +
			`"returnReceivedQuantity" numeric(20,6) NOT NULL DEFAULT (0), "returnDismissedQuantity" numeric(20,6) NOT NULL DEFAULT (0), ` +
			`"writtenOffQuantity" numeric(20,6) NOT NULL DEFAULT (0), ` +
			`"unitPrice" numeric(20,6) NOT NULL DEFAULT (0), "deletedAt" datetime)`
	);

	return db;
}

/**
 * @param db The store.
 * @param table The table.
 * @param columns Its columns.
 * @param row The row to insert; a member it does not carry takes the column's default.
 */
function insert(db: ISqliteDatabase, table: string, columns: string[], row: Row): void {
	const present = columns.filter((column) => row[column] !== undefined);

	db.prepare(
		`INSERT INTO "${table}" (${present.map((column) => `"${column}"`).join(', ')}) ` +
			`VALUES (${present.map(() => '?').join(', ')})`
	).run(...present.map((column) => row[column]));
}

/**
 * Reads rows by equality, the way both ORMs read a criteria object.
 *
 * A member whose value is `undefined` is dropped from the condition, which is what TypeORM does with it,
 * and a soft-deleted row is never answered, which is what both ORMs' soft-delete filters do.
 *
 * @param db The store.
 * @param table The table.
 * @param where The criteria.
 * @param orderBy The column to order by, when there is one.
 * @returns The matching rows.
 */
function select(db: ISqliteDatabase, table: string, where: Row = {}, orderBy?: string): Row[] {
	const criteria = Object.entries(where ?? {}).filter(([, value]) => value !== undefined);
	const clause = criteria.map(([column]) => `"${column}" = ?`).concat(['"deletedAt" IS NULL']).join(' AND ');

	return db
		.prepare(`SELECT * FROM "${table}" WHERE ${clause}${orderBy ? ` ORDER BY "${orderBy}" ASC` : ''}`)
		.all(...criteria.map(([, value]) => value));
}

/** Gives the event loop a turn, so two calls in flight interleave at their reads as they would on a pool. */
const yieldTurn = () => new Promise<void>((resolve) => setImmediate(resolve));

/** One statement a connection double was handed. */
interface IStatement {
	orm: string;
	sql: string;
	parameters: unknown[];
	structured?: boolean;
	method?: string;
}

/**
 * @param db The store.
 * @param table The table this repository reads.
 * @param statements Where the statements its connection runs are recorded.
 * @returns A TypeORM repository double over the store, and the options it was asked with.
 */
function typeOrmRepository(db: ISqliteDatabase, table: string, statements: IStatement[]) {
	const options: Array<Record<string, unknown>> = [];

	/**
	 * A query runner over the store, answering exactly as TypeORM's better-sqlite3 runner answers.
	 *
	 * That includes the trap: **unstructured**, the runner answers the connection's `lastInsertRowid`
	 * for an `UPDATE`, a number that has nothing to do with the statement. A service that read an
	 * affected-row count out of it would read a refusal as a move that landed, and the floor cases below
	 * would say so.
	 */
	const runner = {
		released: 0,
		query: async (sql: string, parameters: unknown[] = [], structured?: boolean) => {
			statements.push({ orm: 'typeorm', sql, parameters, structured });

			const statement = db.prepare(sql);
			// Postgres placeholders are `$1…$n`; SQLite reads `$1` as a parameter named `1`.
			const result =
				mockDialect.type === 'postgres'
					? statement.run(Object.fromEntries(parameters.map((value, index) => [String(index + 1), value])))
					: statement.run(...parameters);

			return structured ? { affected: result.changes, raw: result.lastInsertRowid } : result.lastInsertRowid;
		},
		release: async () => {
			runner.released += 1;
		}
	};

	return {
		options,
		runner,
		manager: { queryRunner: undefined, dataSource: { createQueryRunner: () => runner } },
		find: async (stated: Record<string, unknown> = {}) => {
			options.push(stated);
			await yieldTurn();

			const order = stated.order as Record<string, string> | undefined;

			return select(db, table, stated.where as Row, order ? Object.keys(order)[0] : undefined);
		},
		findOne: async (stated: Record<string, unknown> = {}) => {
			options.push(stated);
			await yieldTurn();

			return select(db, table, stated.where as Row)[0] ?? null;
		}
	};
}

/**
 * @param db The store.
 * @param table The table this repository reads.
 * @param statements Where the statements its connection runs are recorded.
 * @returns A MikroORM repository double over the store, and the criteria it was asked with.
 */
function mikroOrmRepository(db: ISqliteDatabase, table: string, statements: IStatement[]) {
	const criteria: Array<Record<string, unknown>> = [];

	return {
		criteria,
		find: async (where: Row, options: { orderBy?: Record<string, string> } = {}) => {
			criteria.push(where);
			await yieldTurn();

			return select(db, table, where, options.orderBy ? Object.keys(options.orderBy)[0] : undefined);
		},
		findOne: async (where: Row) => {
			criteria.push(where);
			await yieldTurn();

			return select(db, table, where)[0] ?? null;
		},
		// MikroORM's `execute` inlines the values into its `?` placeholders before the driver sees the
		// statement, and in `run` mode answers `{ affectedRows }` on every driver; binding them here is
		// the same statement.
		getEntityManager: () => ({
			getConnection: () => ({
				execute: async (sql: string, parameters: unknown[] = [], method?: string) => {
					statements.push({ orm: 'mikro-orm', sql, parameters, method });

					const result = db.prepare(sql).run(...parameters);

					return { affectedRows: result.changes, insertId: result.lastInsertRowid };
				}
			})
		})
	};
}

/** Every store a case opened, closed once the case is over. */
const stores: ISqliteDatabase[] = [];

/**
 * @param lines The order's lines.
 * @param order The order header the read is scoped to.
 * @returns The service, wired to the doubles of both ORMs over one store, and the doubles themselves.
 */
function fixture(lines: ILineRow[], order: Row = {}) {
	const db = createStore();
	const statements: IStatement[] = [];

	insert(db, 'order', ORDER_COLUMNS, {
		id: ORDER,
		tenantId: TENANT,
		organizationId: ORG,
		currency: 'USD',
		channelId: 'channel-1',
		...order
	});
	insert(db, 'order', ORDER_COLUMNS, {
		id: OTHER_ORDER,
		tenantId: TENANT,
		organizationId: ORG,
		currency: 'USD',
		channelId: 'channel-1'
	});

	for (const row of lines) {
		insert(db, 'order_line', LINE_COLUMNS, row as unknown as Row);
	}

	const orders = typeOrmRepository(db, 'order', statements);
	const orderLines = typeOrmRepository(db, 'order_line', statements);
	const mikroOrders = mikroOrmRepository(db, 'order', statements);
	const mikroOrderLines = mikroOrmRepository(db, 'order_line', statements);

	stores.push(db);

	return {
		db,
		orders,
		orderLines,
		mikroOrders,
		mikroOrderLines,
		statements,
		/** The counters of one line, as the store holds them now. */
		counters: (id: string) => db.prepare(`SELECT * FROM "order_line" WHERE "id" = ?`).all(id)[0],
		service: new OrderLineFulfillmentService(
			orders as never,
			orderLines as never,
			mikroOrders as never,
			mikroOrderLines as never
		)
	};
}

/**
 * The tenancy cases below re-point `RequestContext` with a spy, and a spy on a module-level object
 * outlives the case that set it: without this, everything after the first tenancy case runs scoped to
 * whichever organization that case named, and a later case fails for a reason that is not its own. The
 * ORM and the dialect are put back for the same reason.
 */
afterEach(() => {
	jest.restoreAllMocks();
	mockOrm.type = 'typeorm';
	mockDialect.type = 'better-sqlite3';

	for (const db of stores.splice(0)) {
		db.close();
	}
});

/** A line that shipped in full. */
const line = (overrides: Partial<ILineRow> & { id: string }): ILineRow => ({
	orderId: ORDER,
	tenantId: TENANT,
	organizationId: ORG,
	position: 0,
	fulfilledQuantity: 0,
	unitPrice: SOLD_AT,
	...overrides
});

describe('OrderLineFulfillmentService — the ceiling a post-purchase flow is measured against', () => {
	it('reports what each line fulfilled, at the price it was sold at', async () => {
		const { service } = fixture([
			line({ id: 'line-1', variantId: 'variant-1', fulfilledQuantity: 5 }),
			line({ id: 'line-2', fulfilledQuantity: 2.675, unitPrice: SECOND_SOLD_AT, position: 1 })
		]);

		const fulfilled = await service.getFulfilledLines(ORDER);

		expect(fulfilled).toEqual([
			{ orderLineId: 'line-1', variantId: 'variant-1', fulfilledQuantity: '5', unitPrice: '12.500000' },
			{ orderLineId: 'line-2', fulfilledQuantity: '2.675', unitPrice: '19.990000' }
		]);
		// A line that names no variant reports no variant rather than an empty one, so a caller
		// branching on the variant's presence is not fooled by a falsy string.
		expect('variantId' in fulfilled[1]).toBe(false);
	});

	it('reports the fulfilled part of a partially fulfilled line, never the ordered quantity', async () => {
		// The boundary this port exists for: ten were ordered, four left the building, and a return may
		// cover four. The ordered quantity is deliberately not part of the answer.
		const { service } = fixture([line({ id: 'line-1', fulfilledQuantity: 4 })]);

		const [reported] = await service.getFulfilledLines(ORDER);

		expect(reported.fulfilledQuantity).toBe('4');
		expect(Object.keys(reported)).not.toContain('quantity');
	});

	it('reports an exact decimal for a quantity and a price that a float would round', async () => {
		// `2.675` and `1234.567891` are the shapes a binary float cannot hold exactly; both are
		// reported as the decimal text the column holds, which is what the caller compares and
		// multiplies with.
		const { service } = fixture([line({ id: 'line-1', fulfilledQuantity: 2.675, unitPrice: 1234.567891 })]);

		const [reported] = await service.getFulfilledLines(ORDER);

		expect(reported.fulfilledQuantity).toBe('2.675');
		expect(reported.unitPrice).toBe('1234.567891');
		expect(typeof reported.unitPrice).toBe('string');
	});

	it('leaves out a line that was never fulfilled, and keeps the sibling that shipped', async () => {
		// The control is the sibling: the report is filtered on what was fulfilled, not on whether the
		// line exists, so a caller asking about the missing line is told it was never fulfilled.
		const { service } = fixture([
			line({ id: 'line-shipped', fulfilledQuantity: 1 }),
			line({ id: 'line-never-shipped', fulfilledQuantity: 0, position: 1 })
		]);

		const fulfilled = await service.getFulfilledLines(ORDER);

		expect(fulfilled.map((entry) => entry.orderLineId)).toEqual(['line-shipped']);
	});

	it('leaves out a line whose fulfilments were all cancelled', async () => {
		// Cancelling a fulfilment returns its quantity to the order line, so a line whose only shipment
		// was cancelled has nothing outstanding to act on — and no ceiling to measure a return against.
		const { service } = fixture([line({ id: 'line-1', fulfilledQuantity: 0 })]);

		expect(await service.getFulfilledLines(ORDER)).toEqual([]);
	});

	it('answers with nothing at all for an order that has no lines', async () => {
		const { service } = fixture([]);

		expect(await service.getFulfilledLines(ORDER)).toEqual([]);
	});

	it('scopes the read to the caller and does not find an order of another organization', async () => {
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);
		const { service, orderLines } = fixture([line({ id: 'line-1', fulfilledQuantity: 5 })]);

		await expect(service.getFulfilledLines(ORDER)).rejects.toBeInstanceOf(NotFoundException);
		// The lines are not read at all: a foreign order's quantities never leave the database.
		expect(orderLines.options).toEqual([]);
	});

	it('scopes the read to the caller and does not find an order of another tenant', async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(OTHER_TENANT);
		const { service, orderLines } = fixture([line({ id: 'line-1', fulfilledQuantity: 5 })]);

		await expect(service.getFulfilledLines(ORDER)).rejects.toThrow(/ORDER_NOT_FOUND/);
		expect(orderLines.options).toEqual([]);
	});

	it('reads only the lines of the named order', async () => {
		const { service, orderLines } = fixture([
			line({ id: 'line-1', fulfilledQuantity: 5 }),
			line({ id: 'line-of-another-order', orderId: OTHER_ORDER, fulfilledQuantity: 5 })
		]);

		const fulfilled = await service.getFulfilledLines(ORDER);

		expect(fulfilled.map((entry) => entry.orderLineId)).toEqual(['line-1']);
		// The order, the tenant and the organization are stated in SQL rather than filtered afterwards.
		expect(orderLines.options[0]).toMatchObject({
			where: { orderId: ORDER, tenantId: TENANT, organizationId: ORG }
		});
	});

	it('refuses to answer when no order was named', async () => {
		const { service, orders } = fixture([line({ id: 'line-1', fulfilledQuantity: 5 })]);

		await expect(service.getFulfilledLines(undefined as never)).rejects.toThrow(/ORDER_FULFILLMENT_ORDER_REQUIRED/);
		expect(orders.options).toEqual([]);
	});

	it('reads through the MikroORM repositories when MikroORM is the configured ORM', async () => {
		// Under `DB_ORM=mikro-orm` the TypeORM entity carries no columns — `@MultiORMColumn` emits the
		// decorator of the configured ORM alone — so a read through the TypeORM repository would filter on
		// columns its metadata does not have. The report is the same; only the repository answering it moves.
		mockOrm.type = 'mikro-orm';
		const { service, orders, orderLines, mikroOrders, mikroOrderLines } = fixture([
			line({ id: 'line-1', variantId: 'variant-1', fulfilledQuantity: 5 })
		]);

		expect(await service.getFulfilledLines(ORDER)).toEqual([
			{ orderLineId: 'line-1', variantId: 'variant-1', fulfilledQuantity: '5', unitPrice: '12.500000' }
		]);
		expect(orders.options).toEqual([]);
		expect(orderLines.options).toEqual([]);
		expect(mikroOrders.criteria).toEqual([{ id: ORDER, tenantId: TENANT, organizationId: ORG }]);
		expect(mikroOrderLines.criteria).toEqual([{ orderId: ORDER, tenantId: TENANT, organizationId: ORG }]);
	});
});

/**
 * The two return counters' writer: what came back, and what is asked back.
 *
 * `order_line.returnReceivedQuantity` is one of the five sums `deriveFulfillmentStatus` reads to decide
 * `PARTIALLY_RETURNED` against `RETURNED`, and `order_line.returnRequestedQuantity` is what doc 10
 * invariant I-12 bounds it by. What the cases below pin is the arithmetic and the refusals, because both
 * are what keeps the order's cache equal to the goods it describes:
 *
 * - **the counter is moved, not set, and in one statement.** A delivery adds its delta to what earlier
 *   deliveries recorded *inside the database*, so two deliveries in flight at once both land — the lost
 *   update a read-then-write-back produced is the case this block was rewritten around;
 * - **a negative delta moves it back**, which is what the receipt's compensation sends;
 * - **it never goes below zero**, because a negative counter is not a state the column can be in and a
 *   compensation that overshot would otherwise write one — and the floor is part of the statement, so
 *   it holds on SQLite too, where a `numeric` with a fraction is a binary float;
 * - **a call is all or nothing**, so a caller that sees it fail has nothing of it to undo;
 * - **the scope is checked by the write itself**, so a foreign order or a line of another order is
 *   refused rather than quietly missed;
 * - **the statement is the dialect's and the connection is the ORM's**, which is asserted by running
 *   the statement each combination produces against the store.
 */
describe('OrderLineFulfillmentService — moving the return counters', () => {
	it('adds the delivery to what earlier deliveries recorded, exactly, in one statement', async () => {
		const { service, orderLines, statements, counters } = fixture([line({ id: 'line-1', returnReceivedQuantity: 2 })]);

		await service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-1', quantityDelta: '3' }]);

		// Corrected with C7: this case asserted `update('line-1', { returnReceivedQuantity: '5' })` — an
		// absolute value computed in JavaScript from a read of the row, which is exactly the lost update
		// two concurrent receipts produced. The sum is now what the one relative statement left in the row.
		expect(counters('line-1')).toMatchObject({ returnReceivedQuantity: 5 });
		expect(statements).toHaveLength(1);
		expect(statements[0].sql).toBe(
			'UPDATE "order_line" SET "returnReceivedQuantity" = ROUND("returnReceivedQuantity" + CAST(? AS DECIMAL(20,6)), 6) ' +
				'WHERE "id" = ? AND "orderId" = ? AND "tenantId" = ? AND "organizationId" = ? ' +
				'AND "deletedAt" IS NULL AND ROUND("returnReceivedQuantity" + CAST(? AS DECIMAL(20,6)), 6) >= 0'
		);
		expect(statements[0].parameters).toEqual(['3.000000', 'line-1', ORDER, TENANT, ORG, '3.000000']);
		// The count is read from the runner's structured result, which is the only shape that carries it on
		// every driver; the runner the service borrowed is given back.
		expect(statements[0].structured).toBe(true);
		expect(orderLines.runner.released).toBe(1);
		// And the line is never read before it is written: there is no value to write back.
		expect(orderLines.options).toEqual([]);
	});

	it('lands both of two receipts of one line that are in flight at the same moment', async () => {
		// The failure scenario of C7: returns R1 (one unit) and R2 (two units) of the same line are received
		// at once. Both calls read before either writes — the doubles yield a turn at every read — so a
		// read-then-write-back ended at 1 or 2. One relative statement per move ends at 3.
		const { service, counters } = fixture([line({ id: 'line-1', returnReceivedQuantity: 0 })]);

		await Promise.all([
			service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-1', quantityDelta: '1' }]),
			service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-1', quantityDelta: '2' }])
		]);

		expect(counters('line-1')).toMatchObject({ returnReceivedQuantity: 3 });
	});

	it('moves the counter back when a receipt is undone', async () => {
		const { service, counters } = fixture([line({ id: 'line-1', returnReceivedQuantity: 5 })]);

		await service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-1', quantityDelta: '-2' }]);

		// Corrected with C7: asserted on the row the statement moved rather than on an absolute write.
		expect(counters('line-1')).toMatchObject({ returnReceivedQuantity: 3 });
	});

	it('moves several lines in one call, and only the lines it was given', async () => {
		const { service, counters } = fixture([
			line({ id: 'line-1', returnReceivedQuantity: 0.5, position: 1 }),
			line({ id: 'line-2', returnReceivedQuantity: 1, position: 2 }),
			line({ id: 'line-3', returnReceivedQuantity: 0, position: 3 })
		]);

		await service.recordReturnReceipt(ORDER, [
			{ orderLineId: 'line-1', quantityDelta: '0.25' },
			{ orderLineId: 'line-2', quantityDelta: '1' }
		]);

		expect(counters('line-1')).toMatchObject({ returnReceivedQuantity: 0.75 });
		expect(counters('line-2')).toMatchObject({ returnReceivedQuantity: 2 });
		expect(counters('line-3')).toMatchObject({ returnReceivedQuantity: 0 });
	});

	it('empties a counter exactly, on the dialect that holds a fraction as a binary float', async () => {
		// SQLite keeps `0.3` as a double, and `0.3 − 0.1 − 0.2` is `-2.8e-17` there: an unrounded floor
		// would refuse the move that empties a counter holding exactly what is being taken back.
		const { service, counters } = fixture([line({ id: 'line-1', returnReceivedQuantity: 0.3 })]);

		await service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-1', quantityDelta: '-0.1' }]);
		await service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-1', quantityDelta: '-0.2' }]);

		expect(counters('line-1')).toMatchObject({ returnReceivedQuantity: 0 });
	});

	it('refuses a move that would leave a line having received less than nothing', async () => {
		const { service, counters } = fixture([line({ id: 'line-1', returnReceivedQuantity: 1 })]);

		await expect(
			service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-1', quantityDelta: '-2' }])
		).rejects.toThrow(/ORDER_LINE_RECEIPT_BELOW_ZERO/);
		// The refusal is the point: the statement changed no row, so the counter never reaches the invalid
		// state.
		expect(counters('line-1')).toMatchObject({ returnReceivedQuantity: 1 });
	});

	it('undoes the moves of a call that landed before one of its moves was refused', async () => {
		// A call is all or nothing: the first move landed and the second was refused, so the first is
		// reversed before the refusal is raised. The caller that sees the call fail has nothing of it to
		// undo — which is what lets the receipt's compensation undo only the steps it knows landed.
		const { service, counters } = fixture([
			line({ id: 'line-1', returnReceivedQuantity: 1, position: 1 }),
			line({ id: 'line-2', returnReceivedQuantity: 1, position: 2 })
		]);

		await expect(
			service.recordReturnReceipt(ORDER, [
				{ orderLineId: 'line-1', quantityDelta: '2' },
				{ orderLineId: 'line-2', quantityDelta: '-5' }
			])
		).rejects.toThrow(/ORDER_LINE_RECEIPT_BELOW_ZERO/);

		expect(counters('line-1')).toMatchObject({ returnReceivedQuantity: 1 });
		expect(counters('line-2')).toMatchObject({ returnReceivedQuantity: 1 });
	});

	it('refuses a delta the column cannot hold exactly, before anything is written', async () => {
		const { service, statements } = fixture([line({ id: 'line-1', returnReceivedQuantity: 1 })]);

		await expect(
			service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-1', quantityDelta: '0.0000001' }])
		).rejects.toThrow(/ORDER_LINE_QUANTITY_NOT_EXACT/);
		expect(statements).toEqual([]);
	});

	it('refuses an order of another organization, and writes no line of it', async () => {
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);
		const { service, statements, counters } = fixture([line({ id: 'line-1', returnReceivedQuantity: 1 })]);

		await expect(
			service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-1', quantityDelta: '1' }])
		).rejects.toThrow(/ORDER_NOT_FOUND/);
		expect(statements).toEqual([]);
		expect(counters('line-1')).toMatchObject({ returnReceivedQuantity: 1 });
	});

	it('refuses a line that belongs to another order', async () => {
		const { service, counters } = fixture([
			line({ id: 'line-1', returnReceivedQuantity: 1 }),
			line({ id: 'line-of-another-order', orderId: OTHER_ORDER, returnReceivedQuantity: 1 })
		]);

		await expect(
			service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-of-another-order', quantityDelta: '1' }])
		).rejects.toThrow(/ORDER_LINE_NOT_FOUND/);
		expect(counters('line-of-another-order')).toMatchObject({ returnReceivedQuantity: 1 });
	});

	it('refuses a line of the order that carries another organization, because the write is scoped too', async () => {
		// The statement is predicated on the order's tenant and organization, not only on its id: a row
		// that names the order but another organization is not moved, whatever reached it.
		const { service, counters } = fixture([
			line({ id: 'line-foreign', organizationId: OTHER_ORG, returnReceivedQuantity: 1 })
		]);

		await expect(
			service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-foreign', quantityDelta: '1' }])
		).rejects.toThrow(/ORDER_LINE_NOT_FOUND/);
		expect(counters('line-foreign')).toMatchObject({ returnReceivedQuantity: 1 });
	});

	it('refuses to move anything when no order was named', async () => {
		const { service, statements } = fixture([line({ id: 'line-1', returnReceivedQuantity: 1 })]);

		await expect(
			service.recordReturnReceipt(undefined as never, [{ orderLineId: 'line-1', quantityDelta: '1' }])
		).rejects.toThrow(/ORDER_FULFILLMENT_ORDER_REQUIRED/);
		expect(statements).toEqual([]);
	});

	it('writes nothing for a delivery that moved nothing', async () => {
		// A receipt whose lines all state the quantity they already held is not an error; it is a
		// statement that nothing arrived, and the counter is left alone rather than written with its
		// own value — which would be a write on a row a concurrent delivery may be holding.
		const { service, orderLines, statements } = fixture([line({ id: 'line-1', returnReceivedQuantity: 2 })]);

		await service.recordReturnReceipt(ORDER, []);
		await service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-1', quantityDelta: '0' }]);

		expect(statements).toEqual([]);
		expect(orderLines.options).toEqual([]);
	});

	it('moves the requested counter by the same statement, and leaves the received one alone', async () => {
		// I-12 bounds what came back by what was asked back, so the returns flow moves this counter when a
		// return's lines are written and moves it back when the return is withdrawn.
		const { service, counters } = fixture([line({ id: 'line-1', returnReceivedQuantity: 1 })]);

		await service.recordReturnRequest(ORDER, [{ orderLineId: 'line-1', quantityDelta: '2' }]);

		expect(counters('line-1')).toMatchObject({ returnRequestedQuantity: 2, returnReceivedQuantity: 1 });

		await service.recordReturnRequest(ORDER, [{ orderLineId: 'line-1', quantityDelta: '-2' }]);

		expect(counters('line-1')).toMatchObject({ returnRequestedQuantity: 0, returnReceivedQuantity: 1 });
	});

	it('refuses a request move below zero with a code of its own', async () => {
		const { service, counters } = fixture([line({ id: 'line-1', returnRequestedQuantity: 1 })]);

		await expect(
			service.recordReturnRequest(ORDER, [{ orderLineId: 'line-1', quantityDelta: '-1.5' }])
		).rejects.toThrow(/ORDER_LINE_RETURN_REQUEST_BELOW_ZERO/);
		expect(counters('line-1')).toMatchObject({ returnRequestedQuantity: 1 });
	});

	it('writes the statement MySQL reads: identifiers in backticks, values bound', async () => {
		// Written with double quotes, MySQL reads `"returnReceivedQuantity"` as the *string*
		// `returnReceivedQuantity`, coerces it to 0 and assigns the delta over the counter. SQLite accepts
		// backticks too, so the store below runs the MySQL spelling as written.
		mockDialect.type = 'mysql';
		const { service, statements, counters } = fixture([line({ id: 'line-1', returnReceivedQuantity: 2 })]);

		await service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-1', quantityDelta: '1' }]);

		expect(statements[0].sql).toContain(
			'UPDATE `order_line` SET `returnReceivedQuantity` = ROUND(`returnReceivedQuantity` + CAST(? AS DECIMAL(20,6)), 6)'
		);
		expect(statements[0].sql).not.toContain('"');
		expect(counters('line-1')).toMatchObject({ returnReceivedQuantity: 3 });
	});

	it('binds the Postgres placeholders TypeORM hands to the driver untouched', async () => {
		mockDialect.type = 'postgres';
		const { service, statements, counters } = fixture([line({ id: 'line-1', returnReceivedQuantity: 2 })]);

		await service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-1', quantityDelta: '1' }]);

		// Six occurrences, six placeholders: the delta is bound twice, once to move and once to floor.
		expect(statements[0].sql).toContain('CAST($1 AS DECIMAL(20,6))');
		expect(statements[0].sql).toContain('CAST($6 AS DECIMAL(20,6)), 6) >= 0');
		expect(statements[0].parameters).toHaveLength(6);
		expect(counters('line-1')).toMatchObject({ returnReceivedQuantity: 3 });
	});

	it('moves the counter through the MikroORM connection, with the placeholders it binds, on every dialect', async () => {
		// MikroORM inlines the values into `?` itself before the driver sees the statement, on Postgres as
		// everywhere else — a `$1` handed to it would reach the database unbound. The reads go through the
		// MikroORM repositories, and the TypeORM connection is never touched.
		mockOrm.type = 'mikro-orm';
		mockDialect.type = 'postgres';
		const { service, statements, counters, orders, orderLines, mikroOrders } = fixture([
			line({ id: 'line-1', returnReceivedQuantity: 2, returnRequestedQuantity: 3 })
		]);

		await service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-1', quantityDelta: '1' }]);
		await expect(
			service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-1', quantityDelta: '-9' }])
		).rejects.toThrow(/ORDER_LINE_RECEIPT_BELOW_ZERO/);

		expect(statements.map((statement) => [statement.orm, statement.method])).toEqual([
			['mikro-orm', 'run'],
			['mikro-orm', 'run']
		]);
		expect(statements[0].sql).not.toMatch(/\$\d/);
		expect(statements[0].parameters).toEqual(['1.000000', 'line-1', ORDER, TENANT, ORG, '1.000000']);
		expect(counters('line-1')).toMatchObject({ returnReceivedQuantity: 3, returnRequestedQuantity: 3 });
		expect(orders.options).toEqual([]);
		expect(orderLines.options).toEqual([]);
		expect(orderLines.runner.released).toBe(0);
		expect(mikroOrders.criteria[0]).toEqual({ id: ORDER, tenantId: TENANT, organizationId: ORG });
	});

	it('moves the requested counter through the MikroORM connection, all or nothing, in the MySQL spelling', async () => {
		// The requested counter is the same statement on the other column, so it is pinned on the other ORM
		// and the other quoting too: two lines raised in one call, then a call whose second move would take
		// a line below zero, which must leave the first line where it was. SQLite reads backticks, so the
		// MySQL spelling runs against the store as written.
		mockOrm.type = 'mikro-orm';
		mockDialect.type = 'mysql';
		const { service, statements, counters, orderLines } = fixture([
			line({ id: 'line-1', position: 1 }),
			line({ id: 'line-2', position: 2 })
		]);

		await service.recordReturnRequest(ORDER, [
			{ orderLineId: 'line-1', quantityDelta: '2' },
			{ orderLineId: 'line-2', quantityDelta: '0.5' }
		]);

		expect(counters('line-1')).toMatchObject({ returnRequestedQuantity: 2, returnReceivedQuantity: 0 });
		expect(counters('line-2')).toMatchObject({ returnRequestedQuantity: 0.5 });
		expect(statements[0].sql).toBe(
			'UPDATE `order_line` SET `returnRequestedQuantity` = ROUND(`returnRequestedQuantity` + CAST(? AS DECIMAL(20,6)), 6) ' +
				'WHERE `id` = ? AND `orderId` = ? AND `tenantId` = ? AND `organizationId` = ? ' +
				'AND `deletedAt` IS NULL AND ROUND(`returnRequestedQuantity` + CAST(? AS DECIMAL(20,6)), 6) >= 0'
		);

		await expect(
			service.recordReturnRequest(ORDER, [
				{ orderLineId: 'line-1', quantityDelta: '-1' },
				{ orderLineId: 'line-2', quantityDelta: '-1' }
			])
		).rejects.toThrow(/ORDER_LINE_RETURN_REQUEST_BELOW_ZERO/);

		// The first move landed and was reversed when the second was refused.
		expect(counters('line-1')).toMatchObject({ returnRequestedQuantity: 2 });
		expect(counters('line-2')).toMatchObject({ returnRequestedQuantity: 0.5 });
		expect(statements.every((statement) => statement.orm === 'mikro-orm' && statement.method === 'run')).toBe(true);
		expect(orderLines.options).toEqual([]);
	});
});

/**
 * The order change's two counters: what a return will not bring back, and what the order gave up shipping.
 *
 * `DISMISS_ITEM_RETURN` and `WRITE_OFF_ITEM` are the only writers of `returnDismissedQuantity` and
 * `writtenOffQuantity`, and they used to read the line and write back a sum computed in JavaScript. They
 * are now the same statement the return counters are moved by, so what is pinned here is that the closed
 * set reaches both columns and nothing else, with a refusal of its own for each, on every spelling and
 * through both ORMs' connections.
 */
describe('OrderLineFulfillmentService — moving the dismissed and written-off counters', () => {
	it('moves the dismissed counter by one relative statement, and no other counter', async () => {
		const { service, statements, counters, orderLines } = fixture([
			line({ id: 'line-1', returnRequestedQuantity: 3, returnDismissedQuantity: 1, writtenOffQuantity: 2 })
		]);

		await service.recordReturnDismissal(ORDER, [{ orderLineId: 'line-1', quantityDelta: '1.5' }]);

		expect(counters('line-1')).toMatchObject({
			returnDismissedQuantity: 2.5,
			returnRequestedQuantity: 3,
			writtenOffQuantity: 2
		});
		expect(statements).toHaveLength(1);
		expect(statements[0].sql).toBe(
			'UPDATE "order_line" SET "returnDismissedQuantity" = ROUND("returnDismissedQuantity" + CAST(? AS DECIMAL(20,6)), 6) ' +
				'WHERE "id" = ? AND "orderId" = ? AND "tenantId" = ? AND "organizationId" = ? ' +
				'AND "deletedAt" IS NULL AND ROUND("returnDismissedQuantity" + CAST(? AS DECIMAL(20,6)), 6) >= 0'
		);
		expect(statements[0].parameters).toEqual(['1.500000', 'line-1', ORDER, TENANT, ORG, '1.500000']);
		// The line is never read before it is written: there is no value to write back.
		expect(orderLines.options).toEqual([]);
	});

	it('moves the written-off counter, and lands both of two write-offs in flight at once', async () => {
		const { service, counters } = fixture([line({ id: 'line-1', writtenOffQuantity: 0 })]);

		await Promise.all([
			service.recordWriteOff(ORDER, [{ orderLineId: 'line-1', quantityDelta: '1' }]),
			service.recordWriteOff(ORDER, [{ orderLineId: 'line-1', quantityDelta: '2' }])
		]);

		expect(counters('line-1')).toMatchObject({ writtenOffQuantity: 3, returnDismissedQuantity: 0 });
	});

	it('refuses each counter below zero with a code of its own, and leaves it where it was', async () => {
		const { service, counters } = fixture([
			line({ id: 'line-1', returnDismissedQuantity: 1, writtenOffQuantity: 1 })
		]);

		await expect(
			service.recordReturnDismissal(ORDER, [{ orderLineId: 'line-1', quantityDelta: '-2' }])
		).rejects.toThrow(/ORDER_LINE_RETURN_DISMISSAL_BELOW_ZERO/);
		await expect(
			service.recordWriteOff(ORDER, [{ orderLineId: 'line-1', quantityDelta: '-1.000001' }])
		).rejects.toThrow(/ORDER_LINE_WRITE_OFF_BELOW_ZERO/);

		expect(counters('line-1')).toMatchObject({ returnDismissedQuantity: 1, writtenOffQuantity: 1 });
	});

	it('refuses a line of the order that carries another organization, because the write is scoped too', async () => {
		const { service, counters } = fixture([
			line({ id: 'line-foreign', organizationId: OTHER_ORG, writtenOffQuantity: 1 })
		]);

		await expect(
			service.recordWriteOff(ORDER, [{ orderLineId: 'line-foreign', quantityDelta: '1' }])
		).rejects.toThrow(/ORDER_LINE_NOT_FOUND/);
		expect(counters('line-foreign')).toMatchObject({ writtenOffQuantity: 1 });
	});

	it('writes both counters in the MySQL spelling and binds the Postgres placeholders', async () => {
		mockDialect.type = 'mysql';
		const mysql = fixture([line({ id: 'line-1', returnDismissedQuantity: 1 })]);

		await mysql.service.recordReturnDismissal(ORDER, [{ orderLineId: 'line-1', quantityDelta: '1' }]);

		expect(mysql.statements[0].sql).toContain(
			'UPDATE `order_line` SET `returnDismissedQuantity` = ROUND(`returnDismissedQuantity` + CAST(? AS DECIMAL(20,6)), 6)'
		);
		expect(mysql.statements[0].sql).not.toContain('"');
		expect(mysql.counters('line-1')).toMatchObject({ returnDismissedQuantity: 2 });

		mockDialect.type = 'postgres';
		const postgres = fixture([line({ id: 'line-1', writtenOffQuantity: 1 })]);

		await postgres.service.recordWriteOff(ORDER, [{ orderLineId: 'line-1', quantityDelta: '1' }]);

		expect(postgres.statements[0].sql).toContain(
			'SET "writtenOffQuantity" = ROUND("writtenOffQuantity" + CAST($1 AS DECIMAL(20,6)), 6)'
		);
		expect(postgres.statements[0].sql).toContain('CAST($6 AS DECIMAL(20,6)), 6) >= 0');
		expect(postgres.counters('line-1')).toMatchObject({ writtenOffQuantity: 2 });
	});

	it('moves both counters through the MikroORM connection, all or nothing, and never through TypeORM', async () => {
		mockOrm.type = 'mikro-orm';
		mockDialect.type = 'postgres';
		const { service, statements, counters, orders, orderLines } = fixture([
			line({ id: 'line-1', position: 1, writtenOffQuantity: 1 }),
			line({ id: 'line-2', position: 2, writtenOffQuantity: 0 })
		]);

		await service.recordReturnDismissal(ORDER, [{ orderLineId: 'line-1', quantityDelta: '0.5' }]);
		await expect(
			service.recordWriteOff(ORDER, [
				{ orderLineId: 'line-1', quantityDelta: '1' },
				{ orderLineId: 'line-2', quantityDelta: '-1' }
			])
		).rejects.toThrow(/ORDER_LINE_WRITE_OFF_BELOW_ZERO/);

		// The first write-off landed and was reversed when the second was refused.
		expect(counters('line-1')).toMatchObject({ returnDismissedQuantity: 0.5, writtenOffQuantity: 1 });
		expect(counters('line-2')).toMatchObject({ writtenOffQuantity: 0 });
		expect(statements.every((statement) => statement.orm === 'mikro-orm' && statement.method === 'run')).toBe(true);
		expect(statements.some((statement) => /\$\d/.test(statement.sql))).toBe(false);
		expect(orders.options).toEqual([]);
		expect(orderLines.options).toEqual([]);
	});
});

/**
 * Which counter a damaged unit belongs on, decided by the derivation that reads the counters.
 *
 * The returns flow moves `returnReceivedQuantity` by every unit a delivery brought, sound and damaged
 * alike. These cases pin that choice against `OrderStateMachine.deriveFulfillmentStatus` itself rather
 * than against a restatement of it: the counters are moved through the service onto the store, read back
 * as the store holds them, and handed to the order's own derivation. Two alternatives are measured beside
 * the one taken, because each is what a reader would reach for:
 *
 * - **moving the sound units only** — the defect — leaves a line of two that came back as one sound and
 *   one broken unit `PARTIALLY_RETURNED`, while the return itself says everything arrived;
 * - **moving the broken units onto `returnDismissedQuantity`** — the counter `DISMISS_ITEM_RETURN`
 *   moves — takes them off what the order owes instead of recording that they came back, so a delivery
 *   that was all broken leaves the order `FULFILLED`, as though nothing had been returned at all.
 */
describe('OrderLineFulfillmentService — the counter the derivation reads for a damaged unit', () => {
	/**
	 * @param row One line as the store holds it now.
	 * @param ordered What the line was ordered for; the store's fixture does not carry the column.
	 * @returns The status the order's own derivation answers for an order of that one line.
	 */
	const derive = (row: Record<string, unknown>, ordered: string): FulfillmentStatus =>
		OrderStateMachine.deriveFulfillmentStatus({
			orderStatus: OrderStatus.PROCESSING,
			orderedQuantity: ordered,
			writtenOffQuantity: '0',
			dismissedQuantity: String(row['returnDismissedQuantity'] ?? 0),
			fulfilledQuantity: String(row['fulfilledQuantity'] ?? 0),
			receivedReturnQuantity: String(row['returnReceivedQuantity'] ?? 0)
		});

	it('answers RETURNED for a line of two that came back as one sound and one broken unit', async () => {
		// The failure scenario of C6, on the order's side: the returns flow now states the delivery as two
		// units that came back, and the derivation answers what the return itself says.
		const { service, counters } = fixture([line({ id: 'line-1', fulfilledQuantity: 2 })]);

		expect(derive(counters('line-1'), '2')).toBe(FulfillmentStatus.FULFILLED);

		await service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-1', quantityDelta: '2.000000' }]);

		expect(derive(counters('line-1'), '2')).toBe(FulfillmentStatus.RETURNED);
	});

	it('answered PARTIALLY_RETURNED when only the sound unit moved the counter, which was the defect', async () => {
		const { service, counters } = fixture([line({ id: 'line-1', fulfilledQuantity: 2 })]);

		await service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-1', quantityDelta: '1' }]);

		expect(derive(counters('line-1'), '2')).toBe(FulfillmentStatus.PARTIALLY_RETURNED);
	});

	it('would answer FULFILLED for a delivery that was all broken, had the broken units been dismissed', async () => {
		// Why the dismissed counter is not where a broken unit goes: the derivation subtracts it from what
		// the order owes, so two broken units that physically came back would leave nothing owed and nothing
		// returned. The same delivery on the received counter answers RETURNED.
		const dismissed = fixture([line({ id: 'line-1', fulfilledQuantity: 2, returnDismissedQuantity: 2 })]);
		const received = fixture([line({ id: 'line-2', fulfilledQuantity: 2 })]);

		await received.service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-2', quantityDelta: '2' }]);

		expect(derive(dismissed.counters('line-1'), '2')).toBe(FulfillmentStatus.FULFILLED);
		expect(derive(received.counters('line-2'), '2')).toBe(FulfillmentStatus.RETURNED);
	});
});
