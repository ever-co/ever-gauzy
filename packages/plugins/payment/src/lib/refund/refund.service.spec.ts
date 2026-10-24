/**
 * Two module boundaries are doubled here, for the same reason.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the job
 * registry, the module scanner — none of which a refund service needs and none of which is available
 * outside a running application; its nested `uuid` is ESM-only, so reading one entity would fail under
 * jest. `@gauzy/config` reads the process environment at import time. Both are therefore doubled at the
 * module boundary, and **the services under test are the real ones**: the refund service, the refund-line
 * service it writes its breakdown through, the capture service it reads the refundable figure from and
 * the collection service it moves — all over one shared in-memory datastore. Only the base CRUD class,
 * the request context, the entity base classes and the two ORM constants are substituted, and the money
 * kernel is pulled through the seam with `requireActual`.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class CrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}

		async findAll(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}

		async find(options: any = {}): Promise<any> {
			return this.typeOrmRepository.find(options);
		}

		async findOneByWhereOptions(where: any): Promise<any> {
			const record = await this.typeOrmRepository.findOneBy(where);

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async update(id: any, partial: any): Promise<any> {
			return this.typeOrmRepository.update(id, partial);
		}

		async delete(criteria: any): Promise<any> {
			return this.typeOrmRepository.delete(criteria);
		}

		/** The kernel's recoverable retirement: the row is read inside the criteria it is handed and stamped. */
		async softRemove(id: any, options: any = {}): Promise<any> {
			const record = await this.typeOrmRepository.findOneBy({ ...(options?.where ?? {}), id });

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return this.typeOrmRepository.save({ ...record, deletedAt: new Date() });
		}
	}

	return {
		CrudService,
		TenantAwareCrudService: CrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		JsonArrayColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		// The affected-row reader is the platform's own, pulled through the seam rather than written
		// again here: an approval decides whether its compare-and-swap was refused from whatever the
		// driver answered the `UPDATE` with, and a double that understood a different set of shapes
		// would pass this suite while the four supported drivers disagreed with it.
		readAffectedRows: jest.requireActual('@gauzy/core/src/lib/database/database.helper').readAffectedRows,
		BaseEvent: class {},
		EventBus: class {},
		Payment: class Payment {},
		Integration: class Integration {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

jest.mock('@gauzy/config', () => ({
	isMySQL: () => false,
	isPostgres: () => false,
	DatabaseTypeEnum: {
		mongodb: 'mongodb',
		sqlite: 'sqlite',
		betterSqlite3: 'better-sqlite3',
		postgres: 'postgres',
		mysql: 'mysql'
	}
}));

import { AsyncLocalStorage } from 'node:async_hooks';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { Payment, RequestContext } from '@gauzy/core';
import { RefundStatus } from '../payment.types';
import { PaymentRefundedEvent, RefundCreatedEvent } from '../events';
import { PaymentCapture } from '../payment-capture/payment-capture.entity';
import { PaymentCaptureService } from '../payment-capture/payment-capture.service';
import { PaymentCollection } from '../payment-collection/payment-collection.entity';
import { PaymentCollectionService } from '../payment-collection/payment-collection.service';
import { RefundLine } from '../refund-line/refund-line.entity';
import { RefundLineService } from '../refund-line/refund-line.service';
import { RefundReason } from '../refund-reason/refund-reason.entity';
import { Refund } from './refund.entity';
import { RefundService } from './refund.service';

/**
 * Money given back (doc 10 §9.2–§9.5).
 *
 * Two reconciliation rules of the money specification are enforced in the transaction that writes the
 * refund, and the suite attacks them from both sides:
 *
 * ```
 * payment.refundedAmount <= payment.capturedAmount
 * Σ refund.amount where status = 'SUCCEEDED' (per payment) <= Σ payment_capture.amount (per payment)
 * ```
 *
 * - **the refundable figure is derived, never trusted.** It is the captures of the payment minus the
 *   refunds that already succeeded, read from their own tables rather than from a counter, so a
 *   counter that drifted cannot authorise money that never came in;
 * - **a refund is an intention until it succeeds.** Recording one writes a `PENDING` row and moves
 *   nothing; approving it moves the payment and its collection; cancelling or failing it leaves both
 *   untouched, and the money is refundable again. That is what keeps "the register counts what went
 *   back" a fact rather than a hope;
 * - **the status moves once.** A refund that has reached a terminal status is refused with
 *   `REFUND_ALREADY_SETTLED`, whatever operation asks — approve, cancel, fail or update;
 * - **the breakdown is written with the refund, in one transaction**, so a refund can never be stored
 *   without the lines that explain it and no reader can observe a refund whose lines sum to more than
 *   it gives back;
 * - **the order line's register moves through a port, and nothing in that report may fail the refund**:
 *   the money has already gone back at the provider, so a refused report is logged under a named code
 *   and the remaining lines are still reported.
 *
 * The service is constructed directly over one shared in-memory datastore, and the datastore models the
 * transaction: `transaction` snapshots every table and restores it when the work throws, so "the
 * refused breakdown left no refund behind" is asserted against state and not against a call log.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const ORDER = '00000000-0000-4000-8000-000000000010';
const PAYMENT = 'payment-1';
const COLLECTION = 'collection-1';
const LINE_ONE = 'order-line-1';
const LINE_TWO = 'order-line-2';

type Row = Record<string, any>;

/** The tables this suite drives, as plain arrays. */
interface ITables {
	refund: Row[];
	refund_line: Row[];
	payment: Row[];
	payment_capture: Row[];
	payment_collection: Row[];
	order_line: Row[];
	refund_reason: Row[];
	/**
	 * The other packages' documents a refund names, read by table name. A fixture that leaves one out models an
	 * installation that does not register that table (the order or the returns package is not installed).
	 */
	order?: Row[];
	order_return?: Row[];
	order_claim?: Row[];
}

/** The entity classes the services hand to their transaction manager, resolved to tables. */
const ENTITY_TABLES = new Map<unknown, keyof ITables>([
	[Refund, 'refund'],
	[RefundLine, 'refund_line'],
	[Payment, 'payment'],
	[PaymentCollection, 'payment_collection'],
	[RefundReason, 'refund_reason'],
	// The ceiling is re-read on the writing transaction's own manager (#10889), captures included.
	[PaymentCapture, 'payment_capture']
]);

/**
 * An in-memory stand-in for the datastore the services write through: one TypeORM repository per table,
 * and the transaction manager they share.
 *
 * @param tables The whole datastore.
 * @param dialect The database type the shared data source reports (`options.type`).
 */
function datastore(tables: ITables, dialect = 'postgres') {
	let sequence = 0;
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where).every(([field, expected]) => {
			// A missing column and a null column are the same thing to the database, and TypeORM drops
			// an `undefined` member from the condition rather than matching nothing.
			if (expected === undefined) {
				return true;
			}

			// A compare-and-swap on a running total states `IS NULL` for a column it read as absent,
			// because `= NULL` matches nothing in SQL. The double has to make the same distinction, or a
			// criteria the database would honour would silently match nothing here.
			if (expected instanceof FindOperator && expected.type === 'isNull') {
				return row[field] === null || row[field] === undefined;
			}

			return String(row[field] ?? '') === String(expected ?? '');
		});
	const identify = (criteria: any) => (typeof criteria === 'string' ? criteria : (criteria?.id ?? undefined));
	const tableOf = (entity: unknown): keyof ITables => {
		const table = ENTITY_TABLES.get(entity);

		if (!table) {
			throw new Error('the in-memory double was handed an entity it does not know');
		}

		return table;
	};
	const snapshot = (): Record<string, Row[]> =>
		Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))]));
	const restore = (copy: Record<string, Row[]>) => {
		for (const [table, rows] of Object.entries(copy)) {
			(tables as unknown as Record<string, Row[]>)[table] = rows;
		}
	};
	const save = (table: keyof ITables, entity: Row) => {
		const rows = tables[table];

		if (entity.id) {
			const index = rows.findIndex((row) => row.id === entity.id);

			if (index >= 0) {
				rows[index] = { ...rows[index], ...entity };

				return rows[index];
			}
		}

		const created = { id: `${String(table)}-${++sequence}`, ...entity };

		rows.push(created);

		return created;
	};

	/** The transaction manager: the services write their rows through this and nothing else. */
	/**
	 * The transactions in flight and the order lock (review R3-08r1). Each transaction runs in its own async
	 * context, so the row lock a `pessimistic_write` read takes is held by that transaction until it ends, and a
	 * second transaction asking for it waits — which is what a `SELECT … FOR UPDATE` does on PostgreSQL and MySQL.
	 * A transaction keeps the rows as they were when it first locked or wrote, rather than when it began, so one
	 * that waited for the lock and is then refused rolls back to what the lock holder committed, not over it.
	 */
	const transactions = new AsyncLocalStorage<{ id: number; copy?: Record<string, Row[]> }>();
	let transactionSequence = 0;
	let lockHolder: number | undefined;
	let lockWaiters: Array<() => void> = [];
	const locks: Array<{ transaction: number }> = [];
	const touch = () => {
		const transaction = transactions.getStore();

		if (transaction && !transaction.copy) {
			transaction.copy = snapshot();
		}
	};
	const acquireLock = async () => {
		const transaction = transactions.getStore();

		if (!transaction) {
			throw new Error('a pessimistic lock was taken outside a transaction');
		}

		while (lockHolder !== undefined && lockHolder !== transaction.id) {
			await new Promise<void>((resolve) => lockWaiters.push(resolve));
		}

		lockHolder = transaction.id;
		locks.push({ transaction: transaction.id });
		touch();
	};
	const releaseLock = (id: number) => {
		if (lockHolder === id) {
			lockHolder = undefined;

			const waiting = lockWaiters;

			lockWaiters = [];
			waiting.forEach((resolve) => resolve());
		}
	};

	const manager: any = {
		transaction: async (run: (transactional: any) => Promise<any>) => {
			const transaction = { id: ++transactionSequence } as { id: number; copy?: Record<string, Row[]> };

			return transactions.run(transaction, async () => {
				try {
					return await run(manager);
				} catch (error) {
					if (transaction.copy) {
						restore(transaction.copy);
					}

					throw error;
				} finally {
					releaseLock(transaction.id);
				}
			});
		},
		create: (_entity: unknown, partial: Row) => ({ ...partial }),
		save: async (entity: unknown, rowOrRows: any) => {
			touch();

			const list = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
			const saved = list.map((row) => save(tableOf(entity), row));

			return Array.isArray(rowOrRows) ? saved : saved[0];
		},
		find: async (entity: unknown, options: any = {}) =>
			tables[tableOf(entity)].filter((row) => matches(row, options.where)),
		findOne: async (entity: unknown, options: any = {}) =>
			tables[tableOf(entity)].find((row) => matches(row, options.where)) ?? null,
		// A conditional write states its WHOLE criteria, the running totals it read among them, so a
		// double that matched on the id alone would report a lost race as a write that landed.
		update: async (entity: unknown, criteria: any, partial: Row) => {
			touch();

			const table = tableOf(entity);
			const where = typeof criteria === 'string' ? { id: criteria } : (criteria ?? {});
			const index = tables[table].findIndex((row) => matches(row, where));

			if (index >= 0) {
				Object.assign(tables[table][index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		/**
		 * Whether the installation registers a table. A document table the fixture left out is one whose
		 * package is not installed, and the refund service then has nothing to check an identifier against.
		 */
		dataSource: {
			// The dialect the refund service locks on: a row-locking one by default, so the order lock is taken.
			options: { type: dialect },
			hasMetadata: (name: string) => Array.isArray((tables as unknown as Record<string, unknown>)[name])
		},
		/**
		 * The raw reads this domain makes by table name: the order lines a breakdown cites, and the order,
		 * return or claim a refund names. The conditions the service states are applied — the ids, the
		 * soft-delete filter of the line read and the caller's own tenant and organization.
		 */
		createQueryBuilder: (entity?: unknown) => {
			const conditions: Array<{ sql: string; params: Row }> = [];
			let fromTable = entity ? String(ENTITY_TABLES.get(entity) ?? 'unknown') : 'order_line';
			let locked = false;
			const builder: any = {
				select: () => builder,
				addSelect: () => builder,
				orderBy: () => builder,
				setLock: (mode: string) => {
					locked = mode === 'pessimistic_write';

					return builder;
				},
				from: (table: string) => {
					fromTable = table;

					return builder;
				},
				where: (sql: string, params: Row = {}) => {
					conditions.push({ sql, params });

					return builder;
				},
				andWhere: (sql: string, params: Row = {}) => {
					conditions.push({ sql, params });

					return builder;
				},
				getRawMany: async () => {
					const parameters = conditions.reduce<Row>((all, one) => ({ ...all, ...one.params }), {});

					if (locked) {
						// The order lock, held by this transaction until it commits or rolls back. A `FOR UPDATE` that
						// matches no row locks nothing — on the order row or on the payment rows alike — and the double
						// says so, because that is the gap an order with no payment rows used to fall through (#10906).
						const matched =
							fromTable === 'order'
								? ((tables as unknown as Record<string, Row[]>).order ?? []).filter(
										(row) => row.id === parameters.orderId
									)
								: tables.payment.filter((row) => row.orderId === parameters.orderId);
						const scoped = matched
							.filter((row) => row.tenantId === parameters.tenantId)
							.filter((row) => row.organizationId === parameters.organizationId);

						if (scoped.length) {
							await acquireLock();
						}

						return scoped.map((row) => ({ id: row.id }));
					}

					if (fromTable !== 'order_line') {
						return ((tables as unknown as Record<string, Row[]>)[fromTable] ?? [])
							.filter((row) => row.id === parameters.refundSubjectId)
							.filter((row) => row.tenantId === parameters.tenantId)
							.filter((row) => row.organizationId === parameters.organizationId)
							.map((row) => ({ id: row.id, orderId: row.orderId ?? null }));
					}

					return tables.order_line
						.filter((line) => (parameters.orderLineIds ?? []).includes(line.id))
						.filter((line) => !line.deletedAt)
						.filter((line) => !parameters.tenantId || line.tenantId === parameters.tenantId)
						.filter(
							(line) => !parameters.organizationId || line.organizationId === parameters.organizationId
						)
						.map((line) => ({ id: line.id }));
				}
			};

			return builder;
		}
	};

	/** One table's TypeORM repository, as the base CRUD class reads it. */
	const repository = (table: keyof ITables) => ({
		manager,
		metadata: { tableName: table, hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => tables[table].filter((row) => matches(row, options.where)),
		findOne: async (options: any = {}) => tables[table].find((row) => matches(row, options.where)) ?? null,
		findOneBy: async (where: Row) => tables[table].find((row) => matches(row, where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = tables[table].filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async () => tables[table].length,
		create: (partial: Row) => ({ ...partial }),
		save: async (entity: Row) => save(table, entity),
		// TypeORM applies the WHOLE criteria it was handed, not the id alone. The running total an
		// approval predicates its compare-and-swap on is part of that criteria, so a double that matched
		// on the id only would answer one affected row for a statement the database would have matched
		// nothing with — which is to say it would report a lost race as a write that landed.
		update: async (criteria: any, partial: Row) => {
			const where = typeof criteria === 'string' ? { id: criteria } : (criteria ?? {});
			const index = tables[table].findIndex((row) => matches(row, where));

			if (index >= 0) {
				Object.assign(tables[table][index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		delete: async (criteria: any) => {
			const index = tables[table].findIndex((row) => row.id === identify(criteria));

			if (index >= 0) {
				tables[table].splice(index, 1);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	});

	return { repository, manager, locks };
}

/** One core `payment` row, as the refund service reads it. */
const paymentRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	orderId: ORDER,
	paymentCollectionId: COLLECTION,
	amount: '100',
	currency: 'USD',
	status: 'CAPTURED',
	authorizedAmount: '100',
	capturedAmount: '100',
	refundedAmount: '0',
	canceledAmount: '0',
	...overrides
});

/** One `payment_collection` row, as the composed collection service reads it. */
const collectionRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	orderId: ORDER,
	amount: '100',
	currency: 'USD',
	status: 'COMPLETED',
	authorizedAmount: '100',
	capturedAmount: '100',
	refundedAmount: '0',
	canceledAmount: '0',
	...overrides
});

/** One capture row: what a refund is measured against. */
const captureRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	paymentId: PAYMENT,
	amount: '100',
	currency: 'USD',
	capturedAt: new Date('2026-01-02T10:00:00.000Z'),
	...overrides
});

/** One `refund` row, as the service reads it. */
const refundRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	orderId: ORDER,
	paymentId: PAYMENT,
	amount: '40',
	currency: 'USD',
	status: RefundStatus.PENDING,
	...overrides
});

/** One `refund_line` row. */
const lineRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	refundId: 'refund-seeded',
	orderLineId: LINE_ONE,
	quantity: '1',
	amount: '40',
	currency: 'USD',
	...overrides
});

/** A port double, so a case can state what the register does with a report. */
function orderLineRegister(behaviour: (report: any) => void = () => undefined) {
	const reports: any[] = [];

	return {
		reports,
		port: {
			recordRefund: async (report: any) => {
				behaviour(report);
				reports.push(report);

				return { id: report.orderLineId, refundedQuantity: report.quantity, refundedAmount: report.amount };
			}
		}
	};
}

/**
 * Builds the refund service over one in-memory datastore, composing the real refund-line, capture and
 * collection services over the same rows.
 *
 * @param options The rows the fixture starts with, and the register the refund reports to.
 */
function refundFixture(
	options: {
		payments?: Row[];
		captures?: Row[];
		collections?: Row[];
		refunds?: Row[];
		lines?: Row[];
		orderLines?: Row[];
		reasons?: Row[];
		orders?: Row[];
		returns?: Row[];
		claims?: Row[];
		withPort?: boolean;
		port?: { recordRefund: (report: any) => Promise<any> };
		/** The order's money ledger, as the payment side reports to it (Q7-W1b). */
		orderLedger?: any;
		/** The database type the data source reports; a row-locking `postgres` when not stated. */
		dialect?: string;
	} = {}
) {
	const tables: ITables = {
		refund: options.refunds ?? [],
		refund_line: options.lines ?? [],
		payment: options.payments ?? [paymentRow(PAYMENT)],
		payment_capture: options.captures ?? [captureRow('capture-1')],
		payment_collection: options.collections ?? [collectionRow(COLLECTION)],
		order_line: options.orderLines ?? [
			{ id: LINE_ONE, tenantId: TENANT, organizationId: ORG, quantity: '2', unitPrice: '50' },
			{ id: LINE_TWO, tenantId: TENANT, organizationId: ORG, quantity: '1', unitPrice: '10' }
		],
		refund_reason: options.reasons ?? [],
		...(options.orders ? { order: options.orders } : {}),
		...(options.returns ? { order_return: options.returns } : {}),
		...(options.claims ? { order_claim: options.claims } : {})
	};
	const store = datastore(tables, options.dialect);
	const published: any[] = [];
	const eventBus = {
		publish: async (event: any) => {
			published.push(event);

			return event;
		}
	};
	const collectionService = new PaymentCollectionService(
		store.repository('payment_collection') as never,
		{} as never
	);
	const captureService = new PaymentCaptureService(
		store.repository('payment_capture') as never,
		{} as never,
		store.repository('payment') as never,
		collectionService,
		eventBus as never
	);
	const refundLineService = new RefundLineService(store.repository('refund_line') as never, {} as never);
	const port = options.port ?? (options.withPort ? orderLineRegister().port : undefined);
	const service = new RefundService(
		store.repository('refund') as never,
		{} as never,
		store.repository('payment') as never,
		captureService,
		collectionService,
		refundLineService,
		eventBus as never,
		port as never,
		options.orderLedger
	);

	return {
		service,
		tables,
		published,
		port,
		locks: store.locks,
		payment: (id: string = PAYMENT) => tables.payment.find((row) => row.id === id),
		collection: (id: string = COLLECTION) => tables.payment_collection.find((row) => row.id === id),
		linesOf: (refundId: string) => tables.refund_line.filter((row) => row.refundId === refundId)
	};
}

/** A refund to record, so a case states only what it is about. */
const refundInput = (overrides: Row = {}) => ({
	orderId: ORDER,
	paymentId: PAYMENT,
	amount: '40',
	currency: 'USD',
	...overrides
});

describe('RefundService — recording a refund moves nothing (doc 10 §9.1, §9.3)', () => {
	let consoleLog: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('records a pending refund and announces it, leaving the money where it is', async () => {
		const fixture = refundFixture();

		const refund = await fixture.service.createRefund(refundInput() as never);

		expect(refund).toMatchObject({
			orderId: ORDER,
			paymentId: PAYMENT,
			amount: '40',
			currency: 'USD',
			status: RefundStatus.PENDING,
			tenantId: TENANT,
			organizationId: ORG
		});
		// An intention is not a movement: neither the payment nor its collection has given anything back.
		expect(fixture.payment().refundedAmount).toBe('0');
		expect(fixture.collection().refundedAmount).toBe('0');
		expect(await fixture.service.sumSucceededForPayment(PAYMENT)).toBe('0');

		expect(fixture.published).toHaveLength(1);
		expect(fixture.published[0]).toBeInstanceOf(RefundCreatedEvent);
		expect(fixture.published[0]).toMatchObject({
			refundId: refund.id,
			orderId: ORDER,
			amount: '40',
			currency: 'USD',
			organizationId: ORG,
			// The tenant the refund was written under: a subscription delivers the event to that tenant only.
			tenantId: TENANT
		});
		expect(consoleLog).not.toHaveBeenCalled();
	});

	it('refuses a refund that names no payment, no return and no claim', async () => {
		// An unattributed refund is a movement nobody can explain later — on the attributed path too.
		const fixture = refundFixture();

		await expect(
			fixture.service.createAttributedRefund({ orderId: ORDER, amount: '40', currency: 'USD' } as never)
		).rejects.toThrow(/REFUND_NOT_ALLOWED/);
		// The refund API refuses it earlier still: it names no payment (review R3-08).
		await expect(
			fixture.service.createRefund({ orderId: ORDER, amount: '40', currency: 'USD' } as never)
		).rejects.toThrow(/REFUND_PAYMENT_REQUIRED/);
		expect(fixture.tables.refund).toEqual([]);
	});

	it('accepts a refund attributed to a return or a claim with no payment at all — on the path those flows use', async () => {
		// `createAttributedRefund` is what `ReturnRefundService` records through, after measuring the amount
		// and requiring REFUNDS_APPROVE; the refund API itself refuses a refund that names no payment (R3-08).
		const fixture = refundFixture();

		const refund = await fixture.service.createAttributedRefund({
			orderId: ORDER,
			returnId: 'return-1',
			amount: '40',
			currency: 'USD'
		} as never);

		expect(refund).toMatchObject({ returnId: 'return-1', status: RefundStatus.PENDING });
		expect(fixture.payment().refundedAmount).toBe('0');
	});

	it('refuses an amount that is not a positive exact decimal, and a request with no currency', async () => {
		const fixture = refundFixture();

		await expect(fixture.service.createRefund(refundInput({ amount: '0' }) as never)).rejects.toThrow(
			/REFUND_AMOUNT_INVALID/
		);
		await expect(fixture.service.createRefund(refundInput({ amount: '-40' }) as never)).rejects.toThrow(
			/REFUND_AMOUNT_INVALID/
		);
		await expect(
			fixture.service.createAttributedRefund({ orderId: ORDER, returnId: 'return-1', amount: '40' } as never)
		).rejects.toThrow(/PAYMENT_CURRENCY_INVALID/);
		expect(fixture.tables.refund).toEqual([]);
	});

	it('refuses a refund in a currency the payment is not in', async () => {
		const fixture = refundFixture();

		await expect(fixture.service.createRefund(refundInput({ currency: 'EUR' }) as never)).rejects.toThrow(
			/does not match payment currency/
		);
		expect(fixture.tables.refund).toEqual([]);
	});

	it('accepts a refund that reaches what was captured and refuses one cent past it', async () => {
		// Doc 10 §9.5 rule (5): Σ succeeded refunds of a payment <= Σ captures of that payment. The
		// figure is read from the captures table rather than from the payment's own counter.
		const fixture = refundFixture();

		const exact = await fixture.service.createRefund(refundInput({ amount: '100' }) as never);

		expect(exact).toMatchObject({ amount: '100' });

		await expect(fixture.service.createRefund(refundInput({ amount: '100.01' }) as never)).rejects.toThrow(
			/REFUND_AMOUNT_EXCEEDS_CAPTURED/
		);
		expect(fixture.tables.refund).toHaveLength(1);
	});

	it('refuses a refund against a payment nothing was captured for', async () => {
		const fixture = refundFixture({
			payments: [paymentRow(PAYMENT, { capturedAmount: '0', status: 'AUTHORIZED' })],
			captures: []
		});

		await expect(fixture.service.createRefund(refundInput({ amount: '0.01' }) as never)).rejects.toThrow(
			/REFUND_AMOUNT_EXCEEDS_CAPTURED/
		);
		expect(fixture.tables.refund).toEqual([]);
	});

	it('reports a payment of another organization as missing', async () => {
		const fixture = refundFixture({ payments: [paymentRow(PAYMENT, { organizationId: OTHER_ORG })] });

		await expect(fixture.service.createRefund(refundInput() as never)).rejects.toBeInstanceOf(NotFoundException);
		expect(fixture.tables.refund).toEqual([]);
	});

	// The amount is one figure and is refused the same way on every path: the refundable check reads the
	// request through the same conversion the rest of the request is read with, so a malformed amount is
	// the documented `PAYMENT_AMOUNT_INVALID` whether or not a payment is named, rather than the money
	// kernel's own error escaping as a server fault on the path that names one.
	it('refuses a malformed amount with PAYMENT_AMOUNT_INVALID whatever else it names', async () => {
		const fixture = refundFixture();

		await expect(fixture.service.createRefund(refundInput({ amount: 'forty' }) as never)).rejects.toThrow(
			/PAYMENT_AMOUNT_INVALID/
		);
		expect(fixture.tables.refund).toEqual([]);
	});

	it('refuses a malformed amount with PAYMENT_AMOUNT_INVALID when no payment is named', async () => {
		// The same refusal on the path that has no payment to check the request against: one vocabulary
		// for one mistake, whichever way the refund is attributed.
		const fixture = refundFixture();

		await expect(
			fixture.service.createAttributedRefund({
				orderId: ORDER,
				returnId: 'return-1',
				amount: 'forty',
				currency: 'USD'
			} as never)
		).rejects.toThrow(/PAYMENT_AMOUNT_INVALID/);
	});
});

describe('RefundService — the breakdown is written with the refund, in one transaction (doc 05 §12.8)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('writes one row per line it was given, at the refund’s own amount and currency', async () => {
		const fixture = refundFixture();

		const refund = await fixture.service.createRefund(
			refundInput({
				amount: '60',
				lines: [
					{ orderLineId: LINE_ONE, quantity: '1', amount: '50' },
					{ orderLineId: LINE_TWO, quantity: '1', amount: '10' }
				]
			}) as never
		);

		const lines = fixture.linesOf(refund.id);

		expect(lines).toHaveLength(2);
		expect(lines[0]).toMatchObject({
			refundId: refund.id,
			orderLineId: LINE_ONE,
			quantity: '1',
			amount: '50',
			currency: 'USD',
			tenantId: TENANT,
			organizationId: ORG
		});
		// The breakdown accounts for the refund exactly: 50 + 10 of the 60 it gives back.
		expect(lines.reduce((sum, line) => sum + Math.round(Number(line.amount) * 100), 0)).toBe(6000);
		expect((await fixture.service.findRefundLines(refund.id)).map((line) => line.legacy)).toEqual([false, false]);
	});

	it('leaves no refund behind when a line of the breakdown is refused', async () => {
		// The refund and its lines are one unit of work: a breakdown nobody can reconcile must not leave a
		// refund that was recorded without one.
		const fixture = refundFixture();

		await expect(
			fixture.service.createRefund(
				refundInput({
					amount: '60',
					lines: [
						{ orderLineId: LINE_ONE, quantity: '1', amount: '50' },
						{ orderLineId: LINE_TWO, quantity: '1', amount: '11' }
					]
				}) as never
			)
		).rejects.toThrow(/REFUND_LINE_OVER_REFUND/);

		expect(fixture.tables.refund).toEqual([]);
		expect(fixture.tables.refund_line).toEqual([]);
		expect(fixture.published).toEqual([]);
	});

	it('refuses a breakdown that cites an order line this organization does not have', async () => {
		const fixture = refundFixture();

		await expect(
			fixture.service.createRefund(
				refundInput({
					amount: '60',
					lines: [{ orderLineId: 'no-such-line', quantity: '1', amount: '50' }]
				}) as never
			)
		).rejects.toThrow(/REFUND_LINE_ORDER_LINE_NOT_FOUND/);
		expect(fixture.tables.refund).toEqual([]);
	});
});

describe('RefundService — approving, cancelling and failing (doc 10 §9.4, §9.5)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('approves a pending refund and moves the payment, its status and the collection with it', async () => {
		const fixture = refundFixture();
		const refund = await fixture.service.createRefund(refundInput({ amount: '40' }) as never);

		fixture.published.length = 0;

		const approved = await fixture.service.approveRefund(refund.id, 'goodwill');

		expect(approved).toMatchObject({
			status: RefundStatus.SUCCEEDED,
			note: 'goodwill'
		});
		expect(approved.refundedAt).toBeInstanceOf(Date);
		expect(fixture.payment()).toMatchObject({
			refundedAmount: '40',
			status: 'PARTIALLY_REFUNDED'
		});
		expect(fixture.collection()).toMatchObject({ refundedAmount: '40' });

		expect(fixture.published).toHaveLength(1);
		expect(fixture.published[0]).toBeInstanceOf(PaymentRefundedEvent);
		expect(fixture.published[0]).toMatchObject({
			refundId: refund.id,
			paymentId: PAYMENT,
			amount: '40',
			currency: 'USD',
			tenantId: TENANT
		});
	});

	// Q7-W1b. A succeeded refund is a negative row on the order's money ledger; a refund that names only the
	// payment is the payment's order's (Greptile on #10897).
	it('tells the order its money went back, through the payment when the refund names no order', async () => {
		const orderLedger = { mirror: jest.fn(async (_fact: any, _label?: string) => ({ recorded: true })) };
		const fixture = refundFixture({
			orderLedger,
			refunds: [refundRow('by-payment', { amount: '40', orderId: undefined })]
		});

		await fixture.service.approveRefund('by-payment');

		expect(orderLedger.mirror).toHaveBeenCalledTimes(1);
		expect(orderLedger.mirror.mock.calls[0][0]).toMatchObject({
			orderId: ORDER,
			type: 'REFUND',
			amount: '40',
			currency: 'USD',
			referenceType: 'REFUND',
			referenceId: 'by-payment',
			paymentId: PAYMENT
		});
	});

	it('derives the payment as REFUNDED when everything that was taken is given back', async () => {
		const fixture = refundFixture();
		const refund = await fixture.service.createRefund(refundInput({ amount: '100' }) as never);

		await fixture.service.approveRefund(refund.id);

		expect(fixture.payment()).toMatchObject({ refundedAmount: '100', status: 'REFUNDED' });
	});

	it('refuses every move on a refund that has already settled', async () => {
		// The status moves once: an approved refund is a record, and a cancellation of it would be a
		// second, quieter way to say the money came back.
		const fixture = refundFixture({
			refunds: [refundRow('settled', { amount: '40', status: RefundStatus.SUCCEEDED })]
		});

		await expect(fixture.service.approveRefund('settled')).rejects.toThrow(/REFUND_ALREADY_SETTLED/);
		await expect(fixture.service.cancelRefund('settled', 'changed my mind')).rejects.toThrow(
			/REFUND_ALREADY_SETTLED/
		);
		await expect(fixture.service.failRefund('settled', 'declined')).rejects.toThrow(/REFUND_ALREADY_SETTLED/);
		await expect(fixture.service.updateRefund('settled', { note: 'x' } as never)).rejects.toThrow(
			/REFUND_ALREADY_SETTLED/
		);
		expect(fixture.tables.refund[0].status).toBe(RefundStatus.SUCCEEDED);
		expect(fixture.payment().refundedAmount).toBe('0');
	});

	it('cancels a pending refund, leaving the payment, the collection and the refundable figure untouched', async () => {
		const fixture = refundFixture();
		const refund = await fixture.service.createRefund(refundInput({ amount: '100' }) as never);

		const cancelled = await fixture.service.cancelRefund(refund.id, 'customer changed their mind');

		expect(cancelled).toMatchObject({ status: RefundStatus.CANCELED, reason: 'customer changed their mind' });
		expect(cancelled.refundedAt).toBeNull();
		expect(fixture.payment().refundedAmount).toBe('0');
		expect(fixture.collection().refundedAmount).toBe('0');
		expect(await fixture.service.sumSucceededForPayment(PAYMENT)).toBe('0');

		// The money that was never given back is refundable again.
		const second = await fixture.service.createRefund(refundInput({ amount: '100' }) as never);

		expect(second.status).toBe(RefundStatus.PENDING);
	});

	it('records a refused refund without writing any ledger row', async () => {
		const fixture = refundFixture();
		const refund = await fixture.service.createRefund(refundInput({ amount: '40' }) as never);

		const failed = await fixture.service.failRefund(refund.id, 'PROVIDER_REFUND_DECLINED');

		expect(failed).toMatchObject({
			status: RefundStatus.FAILED,
			metadata: { lastError: 'PROVIDER_REFUND_DECLINED' }
		});
		expect(fixture.payment().refundedAmount).toBe('0');
		expect(fixture.published).toHaveLength(1);
	});

	it('updates the descriptive fields of a pending refund and nothing that means something', async () => {
		const fixture = refundFixture();
		const refund = await fixture.service.createRefund(refundInput({ amount: '40' }) as never);

		const updated = await fixture.service.updateRefund(refund.id, {
			status: RefundStatus.SUCCEEDED,
			amount: '100',
			currency: 'EUR',
			paymentId: 'another-payment',
			lines: [{ orderLineId: LINE_ONE, quantity: '1', amount: '100' }],
			note: 'operator note'
		} as never);

		expect(updated).toMatchObject({
			status: RefundStatus.PENDING,
			amount: '40',
			currency: 'USD',
			paymentId: PAYMENT,
			note: 'operator note'
		});
		expect(fixture.linesOf(refund.id)).toEqual([]);
	});

	it('moves the register of a refunded amount once, whatever else is queued', async () => {
		// Two refunds of the whole captured amount may both be *recorded* — a pending refund is an
		// intention, and cancelling one is what makes room for the other — but only one of them can ever
		// move money, because Σ succeeded <= Σ captured (doc 10 §9.5).
		//
		// An approval measures against the other pending intentions as well as against what has already
		// succeeded, which is the correction this rule needed: measuring only against the succeeded
		// refunds admits both of them, because neither has succeeded when either is approved, and the
		// payment then reports one refund while two are SUCCEEDED and twice the captured money has gone
		// back. So while both are queued neither may be approved — the queue is resolved by withdrawing
		// one, not by whichever approval happens to arrive first.
		const fixture = refundFixture();
		const first = await fixture.service.createRefund(refundInput({ amount: '100' }) as never);
		const second = await fixture.service.createRefund(refundInput({ amount: '100' }) as never);

		await expect(fixture.service.approveRefund(first.id)).rejects.toThrow(/REFUND_AMOUNT_EXCEEDS_CAPTURED/);
		expect(fixture.payment().refundedAmount).toBe('0');
		expect(fixture.tables.refund.map((row) => row.status)).toEqual([RefundStatus.PENDING, RefundStatus.PENDING]);

		await fixture.service.cancelRefund(second.id, 'recorded twice');

		await fixture.service.approveRefund(first.id);

		expect(fixture.payment()).toMatchObject({ refundedAmount: '100', status: 'REFUNDED' });
		expect(fixture.tables.refund[1].status).toBe(RefundStatus.CANCELED);
		expect(await fixture.service.sumSucceededForPayment(PAYMENT)).toBe('100');

		// And the ceiling still holds against a refund recorded after the money went back: what already
		// succeeded leaves nothing to give, so the third request is refused where it is written rather
		// than where it is approved.
		await expect(fixture.service.createRefund(refundInput({ amount: '0.01' }) as never)).rejects.toThrow(
			/REFUND_AMOUNT_EXCEEDS_CAPTURED/
		);
		expect(fixture.tables.refund).toHaveLength(2);
	});

	it('refuses an approval whose payment was refunded between the ceiling being measured and the row being written', async () => {
		// The payment row is written with an absolute new `refundedAmount` computed from the figure this
		// approval read, so the write has to be conditional on the payment still holding that figure.
		// Written unconditionally, an approval that lost the race silently overwrote the winner's total
		// and the payment reported one refund while two had succeeded.
		//
		// The other writer is reproduced here by moving the payment between the read and the write, which
		// is the only ordering a single-threaded suite can state. The interleaving is real: the read is
		// `findPaymentOrFail`, the write is the compare-and-swap a few lines later, and any other approval
		// that commits in between takes this branch.
		const fixture = refundFixture({ refunds: [refundRow('mine', { amount: '40' })] });
		const captureService = (fixture.service as never as { paymentCaptureService: PaymentCaptureService })
			.paymentCaptureService;
		const read = captureService.findPaymentOrFail.bind(captureService);
		jest.spyOn(captureService, 'findPaymentOrFail').mockImplementation(async (paymentId) => {
			// The read hands back a detached row, which is what a read from a database hands back: the
			// object the caller reasons about does not follow the table afterwards.
			const payment = { ...(await read(paymentId)) } as never;

			// The other approval lands, taking the payment's refunded total to 10.
			fixture.payment().refundedAmount = '10';

			return payment;
		});

		const refusal = await fixture.service
			.approveRefund('mine')
			.then(() => undefined)
			.catch((thrown) => thrown);

		expect(refusal).toBeInstanceOf(ConflictException);
		expect(String(refusal.message)).toContain('REFUND_APPROVAL_CONFLICT');
		// The refusal names the figure it reasoned about, so the caller can tell a lost race from a
		// request that was always too large and knows to read the payment again.
		expect(refusal.getResponse()).toMatchObject({
			code: 'REFUND_APPROVAL_CONFLICT',
			details: { paymentId: PAYMENT, refundId: 'mine', refundedAmount: '0' }
		});

		// Nothing of the refused approval stands: the payment keeps the winner's total and the refund is
		// still an intention, so the caller may approve it again once it has read the payment.
		expect(fixture.payment().refundedAmount).toBe('10');
		expect(fixture.tables.refund[0].status).toBe(RefundStatus.PENDING);
		expect(fixture.collection().refundedAmount).toBe('0');
	});

	it('re-checks the ceiling on approval against the captures, not against the authorisation', async () => {
		// 100 was authorised but only 40 was ever taken, so 40 is what may go back — whatever the amount
		// recorded on the refund while it was pending.
		const fixture = refundFixture({
			payments: [
				paymentRow(PAYMENT, { capturedAmount: '40', refundedAmount: '0', status: 'PARTIALLY_CAPTURED' })
			],
			captures: [captureRow('capture-1', { amount: '40' })],
			refunds: [refundRow('too-big', { amount: '60' })]
		});

		await expect(fixture.service.approveRefund('too-big')).rejects.toThrow(/REFUND_AMOUNT_EXCEEDS_CAPTURED/);
		expect(fixture.tables.refund[0].status).toBe(RefundStatus.PENDING);
		expect(fixture.payment().refundedAmount).toBe('0');
	});

	it('sums only the succeeded refunds of one payment, exactly', async () => {
		const fixture = refundFixture({
			refunds: [
				refundRow('a', { amount: '0.1', status: RefundStatus.SUCCEEDED }),
				refundRow('b', { amount: '0.2', status: RefundStatus.SUCCEEDED }),
				refundRow('c', { amount: '10', status: RefundStatus.PENDING }),
				refundRow('d', { amount: '10', status: RefundStatus.FAILED }),
				refundRow('e', { amount: '10', status: RefundStatus.CANCELED }),
				refundRow('f', { amount: '5', status: RefundStatus.SUCCEEDED, paymentId: 'payment-2' }),
				refundRow('g', { amount: '5', status: RefundStatus.SUCCEEDED, organizationId: OTHER_ORG })
			]
		});

		// `0.1 + 0.2` is `0.30000000000000004` in a double and `0.3` through the money kernel (doc 07 §1.2).
		expect(await fixture.service.sumSucceededForPayment(PAYMENT)).toBe('0.3');
		expect(0.1 + 0.2).not.toBe(0.3);
	});

	it('reports an unknown refund, and another organization’s refund, as missing', async () => {
		const fixture = refundFixture({ refunds: [refundRow('theirs', { organizationId: OTHER_ORG })] });

		await expect(fixture.service.findRefundOrFail('nope')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.approveRefund('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findRefunds()).resolves.toMatchObject({ total: 0 });
	});
});

/**
 * Retiring a refund (`DELETE /refunds/:id`, `DELETE /refunds/:id/soft`, `softDeleteRefund`).
 *
 * A retired refund drops out of every read, and the refundable figure — the captures minus
 * `sumSucceededForPayment` — is one of them. Retiring a `SUCCEEDED` refund therefore made the money it gave
 * back refundable a second time, and `DELETE /refunds/:id` used to go further and erase the row. A
 * `PENDING` refund may still be in flight at the provider, and `cancelRefund` is what withdraws it. Only a
 * refund that moved no money — `FAILED` or `CANCELED` — can be retired, and it is kept, not erased.
 */
describe('RefundService — retiring a refund never reopens money that went back (13 §11.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses to retire a succeeded refund, which would make its money refundable again', async () => {
		const fixture = refundFixture({
			refunds: [refundRow('settled', { amount: '100', status: RefundStatus.SUCCEEDED })]
		});

		await expect(fixture.service.softRemove('settled')).rejects.toThrow(/REFUND_NOT_RETIRABLE/);

		expect(fixture.tables.refund[0].deletedAt).toBeUndefined();
		expect(await fixture.service.sumSucceededForPayment(PAYMENT)).toBe('100');
		// The capture is fully refunded, so a second refund of the same money is still refused.
		await expect(fixture.service.createRefund(refundInput({ amount: '1' }) as never)).rejects.toThrow(
			/REFUND_AMOUNT_EXCEEDS_CAPTURED/
		);
	});

	it('refuses to retire a pending refund, which is withdrawn by cancelling it', async () => {
		const fixture = refundFixture({ refunds: [refundRow('pending')] });

		await expect(fixture.service.softRemove('pending')).rejects.toThrow(/REFUND_NOT_RETIRABLE/);
		expect(fixture.tables.refund[0].deletedAt).toBeUndefined();
	});

	it.each([RefundStatus.FAILED, RefundStatus.CANCELED])(
		'retires a %s refund by stamping it, and keeps the row',
		async (status) => {
			const fixture = refundFixture({ refunds: [refundRow('done', { status })] });

			const retired = await fixture.service.softRemove('done');

			expect(retired.deletedAt).toBeInstanceOf(Date);
			expect(fixture.tables.refund).toHaveLength(1);
			expect(fixture.tables.refund[0]).toMatchObject({ id: 'done', status });
		}
	);

	it('reports another organization’s refund as missing rather than retiring it', async () => {
		const fixture = refundFixture({
			refunds: [refundRow('theirs', { status: RefundStatus.CANCELED, organizationId: OTHER_ORG })]
		});

		await expect(fixture.service.softRemove('theirs')).rejects.toBeInstanceOf(NotFoundException);
		expect(fixture.tables.refund[0].deletedAt).toBeUndefined();
	});
});

describe('RefundService — the report to the order line register (doc 10 §9.2, §12)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('reports what each line was paid back, once the refund has succeeded', async () => {
		const register = orderLineRegister();
		const fixture = refundFixture({
			withPort: true,
			port: register.port,
			refunds: [refundRow('r1', { amount: '60' })],
			lines: [
				lineRow('l1', { refundId: 'r1', orderLineId: LINE_ONE, quantity: '1', amount: '50' }),
				lineRow('l2', { refundId: 'r1', orderLineId: LINE_TWO, quantity: '1', amount: '10' })
			]
		});

		await fixture.service.approveRefund('r1');

		expect(register.reports).toEqual([
			{ orderLineId: LINE_ONE, quantity: '1', amount: '50', currency: 'USD' },
			{ orderLineId: LINE_TWO, quantity: '1', amount: '10', currency: 'USD' }
		]);
		expect(fixture.tables.refund[0].status).toBe(RefundStatus.SUCCEEDED);
	});

	it('has no register to move when the refund names no order line', async () => {
		const register = orderLineRegister();
		const fixture = refundFixture({ withPort: true, port: register.port });

		const refund = await fixture.service.createRefund(refundInput({ amount: '40' }) as never);

		await fixture.service.approveRefund(refund.id);

		expect(register.reports).toEqual([]);
		expect(fixture.tables.refund[0].status).toBe(RefundStatus.SUCCEEDED);
	});

	it('keeps the refund standing when the register refuses one line, and still reports the others', async () => {
		// The money has already moved at the provider and the refund is already SUCCEEDED, so a report that
		// threw would tell the caller the refund failed when it did not, and the caller would retry a refund
		// that has already gone back. One line the register cannot move is no reason to leave the others
		// unmirrored.
		const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
		const register = orderLineRegister((report) => {
			if (report.orderLineId === LINE_ONE) {
				throw new Error('the line has not been invoiced enough');
			}
		});
		const fixture = refundFixture({
			withPort: true,
			port: register.port,
			refunds: [refundRow('r1', { amount: '60' })],
			lines: [
				lineRow('l1', { refundId: 'r1', orderLineId: LINE_ONE, quantity: '1', amount: '50' }),
				lineRow('l2', { refundId: 'r1', orderLineId: LINE_TWO, quantity: '1', amount: '10' })
			]
		});

		const approved = await fixture.service.approveRefund('r1');

		expect(approved.status).toBe(RefundStatus.SUCCEEDED);
		expect(register.reports.map((report) => report.orderLineId)).toEqual([LINE_TWO]);
		expect(fixture.published.some((event) => event instanceof PaymentRefundedEvent)).toBe(true);
		expect(consoleLog.mock.calls.map((call) => String(call[0])).join('\n')).toContain(
			'PAYMENT_ORDER_LINE_REFUND_FAILED'
		);
	});

	it('reports the lines it could not mirror when the register is not registered at all', async () => {
		const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined);
		const fixture = refundFixture({
			refunds: [refundRow('r1', { amount: '60' })],
			lines: [lineRow('l1', { refundId: 'r1', orderLineId: LINE_ONE, quantity: '1', amount: '60' })]
		});

		const approved = await fixture.service.approveRefund('r1');

		expect(approved.status).toBe(RefundStatus.SUCCEEDED);
		expect(consoleLog.mock.calls.map((call) => String(call[0])).join('\n')).toContain(
			'PAYMENT_ORDER_LINE_REFUND_UNAVAILABLE'
		);
	});

	it('answers the lines of a refund through the line service, rows first and the legacy array otherwise', async () => {
		const fixture = refundFixture({
			refunds: [
				refundRow('r1', { amount: '60' }),
				refundRow('legacy', {
					amount: '60',
					metadata: { lineRefunds: [{ orderLineId: LINE_TWO, quantity: '2', amount: '60' }] }
				})
			],
			lines: [lineRow('l1', { refundId: 'r1', orderLineId: LINE_ONE, quantity: '1', amount: '60' })]
		});

		expect((await fixture.service.findRefundLines('r1')).map((line) => line.legacy)).toEqual([false]);
		expect(await fixture.service.findRefundLines('legacy')).toEqual([
			expect.objectContaining({ orderLineId: LINE_TWO, quantity: '2', amount: '60', legacy: true })
		]);
	});
});

/**
 * The payment, its collection and the refund's own status are one write (PR #10254 review, the sibling of
 * "Capture totals can disagree").
 *
 * An approval used to move the payment, then move the collection by a read-and-replace of its total,
 * then mark the refund succeeded, as three separate writes. A collection that refused the refund left
 * the payment already moved and the refund still pending; the total it replaced could lose an overlapping
 * approval's increment.
 */
describe('RefundService — an approval moves the payment, the collection and the refund together', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('rolls the payment back and leaves the refund pending when the collection refuses it', async () => {
		// The payment captured 100 and may give 40 back, but its collection recorded only 20 as captured
		// (its own ceiling): the collection's refusal has to take the payment's movement with it.
		const fixture = refundFixture({
			collections: [collectionRow(COLLECTION, { capturedAmount: '20' })],
			refunds: [refundRow('mine', { amount: '40' })]
		});

		await expect(fixture.service.approveRefund('mine')).rejects.toThrow(/REFUND_AMOUNT_EXCEEDS_CAPTURED/);

		expect(fixture.payment()).toMatchObject({ refundedAmount: '0', status: 'CAPTURED' });
		expect(fixture.collection().refundedAmount).toBe('0');
		expect(fixture.tables.refund[0].status).toBe(RefundStatus.PENDING);
		expect(fixture.published).toEqual([]);
	});

	it('moves nothing when the refund stopped being pending between the read and the write', async () => {
		// Another approval, a cancellation or a failure of the same refund landed first: the status write
		// is conditional on PENDING, and its refusal rolls the money back.
		const fixture = refundFixture({ refunds: [refundRow('mine', { amount: '40' })] });
		const read = fixture.service.findRefundOrFail.bind(fixture.service);
		let reads = 0;

		jest.spyOn(fixture.service, 'findRefundOrFail').mockImplementation(async (id) => {
			const refund = { ...(await read(id)) } as never;

			if (++reads === 1) {
				fixture.tables.refund[0].status = RefundStatus.CANCELED;
			}

			return refund;
		});

		await expect(fixture.service.approveRefund('mine')).rejects.toThrow(/REFUND_ALREADY_SETTLED/);

		expect(fixture.payment().refundedAmount).toBe('0');
		expect(fixture.collection().refundedAmount).toBe('0');
		expect(fixture.tables.refund[0].status).toBe(RefundStatus.CANCELED);
	});
});

describe('RefundService — what a refund cites is the caller’s, and the order is one ceiling (review R3-08)', () => {
	const OTHER_ORDER = '00000000-0000-4000-8000-000000000011';
	const FOREIGN_ORDER = '00000000-0000-4000-8000-000000000012';
	const SECOND_PAYMENT = 'payment-2';
	const RETURN = 'return-1';
	const CLAIM = 'claim-1';

	/** One document row of another package (order, return or claim), in the caller's organization by default. */
	const documentRow = (id: string, overrides: Row = {}) => ({
		id,
		tenantId: TENANT,
		organizationId: ORG,
		...overrides
	});

	/** The installation registers the order and returns tables: two orders of ours and one of another organization. */
	const registered = (overrides: Row = {}) => ({
		orders: [
			documentRow(ORDER),
			documentRow(OTHER_ORDER),
			documentRow(FOREIGN_ORDER, { organizationId: OTHER_ORG })
		],
		returns: [
			documentRow(RETURN, { orderId: ORDER }),
			documentRow('return-other-order', { orderId: OTHER_ORDER }),
			documentRow('return-foreign', { organizationId: OTHER_ORG, orderId: FOREIGN_ORDER })
		],
		claims: [
			documentRow(CLAIM, { orderId: ORDER }),
			documentRow('claim-other-order', { orderId: OTHER_ORDER }),
			documentRow('claim-foreign', { tenantId: 'another-tenant', orderId: ORDER })
		],
		reasons: [documentRow('reason-ours'), documentRow('reason-foreign', { organizationId: OTHER_ORG })],
		...overrides
	});

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	/** An order paid 10 + 10, which already gave 15 back through a return refund no single payment could carry. */
	const splitOrder = (refunds: Row[] = []) =>
		refundFixture({
			payments: [paymentRow(PAYMENT, { amount: '10' }), paymentRow(SECOND_PAYMENT, { amount: '10' })],
			captures: [
				captureRow('capture-1', { amount: '10' }),
				captureRow('capture-2', { paymentId: SECOND_PAYMENT, amount: '10' })
			],
			refunds: [
				refundRow('return-refund', {
					paymentId: undefined,
					returnId: RETURN,
					amount: '15',
					status: RefundStatus.SUCCEEDED
				}),
				...refunds
			]
		});

	it('counts a refund that names no payment against the order before a payment refunds its own money', async () => {
		const fixture = splitOrder();

		// The failure scenario: each payment's own figure still read 10, so 10 + 15 went back on 20 taken.
		await expect(fixture.service.createRefund(refundInput({ amount: '10' }) as never)).rejects.toThrow(
			/REFUND_AMOUNT_EXCEEDS_CAPTURED/
		);
		expect(fixture.tables.refund).toHaveLength(1);

		// What is left on the order (20 − 15) is still refundable, from either payment.
		const fits = await fixture.service.createRefund(refundInput({ amount: '5' }) as never);

		expect(fits).toMatchObject({ amount: '5', status: RefundStatus.PENDING });
	});

	it('measures an approval against the order too, and a cancelled payment-less refund no longer counts', async () => {
		const fixture = splitOrder([refundRow('pending-on-payment', { amount: '10' })]);

		await expect(fixture.service.approveRefund('pending-on-payment')).rejects.toThrow(
			/REFUND_AMOUNT_EXCEEDS_CAPTURED/
		);
		expect(fixture.payment().refundedAmount).toBe('0');

		// Withdrawn, the return refund moved nothing, and the payment's own money is refundable again.
		fixture.tables.refund[0].status = RefundStatus.CANCELED;

		await expect(fixture.service.approveRefund('pending-on-payment')).resolves.toMatchObject({
			status: RefundStatus.SUCCEEDED
		});
	});

	it('sums only the standing refunds of the order that name no payment, in the currency asked', async () => {
		const unattributed = (id: string, overrides: Row) =>
			refundRow(id, { paymentId: undefined, returnId: RETURN, status: RefundStatus.SUCCEEDED, ...overrides });
		const fixture = refundFixture({
			refunds: [
				unattributed('a', { amount: '3' }),
				unattributed('b', { amount: '2', returnId: undefined, claimId: CLAIM, status: RefundStatus.PENDING }),
				unattributed('c', { amount: '7', status: RefundStatus.CANCELED }),
				unattributed('d', { amount: '9', currency: 'EUR' }),
				refundRow('e', { amount: '11', status: RefundStatus.SUCCEEDED }),
				unattributed('f', { amount: '13', organizationId: OTHER_ORG })
			]
		});

		expect(await fixture.service.sumUnattributedForOrder(ORDER, 'USD')).toBe('5');
	});

	it('refuses an order, a return or a claim of another organization or tenant, on both entry points', async () => {
		const fixture = refundFixture({ ...registered(), payments: [paymentRow(PAYMENT, { orderId: null })] });

		// The payment names no order, so before this any order id at all was written beside it.
		await expect(
			fixture.service.createRefund(refundInput({ orderId: FOREIGN_ORDER }) as never)
		).rejects.toMatchObject({ response: expect.objectContaining({ code: 'REFUND_ORDER_NOT_FOUND' }) });
		await expect(
			fixture.service.createRefund(refundInput({ returnId: 'return-foreign' }) as never)
		).rejects.toMatchObject({ response: expect.objectContaining({ code: 'REFUND_RETURN_NOT_FOUND' }) });
		await expect(
			fixture.service.createAttributedRefund({
				orderId: ORDER,
				claimId: 'claim-foreign',
				amount: '5',
				currency: 'USD'
			} as never)
		).rejects.toMatchObject({ response: expect.objectContaining({ code: 'REFUND_CLAIM_NOT_FOUND' }) });
		await expect(
			fixture.service.createAttributedRefund({
				orderId: ORDER,
				returnId: 'no-such-return',
				amount: '5',
				currency: 'USD'
			} as never)
		).rejects.toMatchObject({ response: expect.objectContaining({ code: 'REFUND_RETURN_NOT_FOUND' }) });

		expect(fixture.tables.refund).toEqual([]);
	});

	it('refuses a return or a claim raised against another order than the refund’s', async () => {
		const fixture = refundFixture(registered());

		await expect(
			fixture.service.createRefund(refundInput({ returnId: 'return-other-order' }) as never)
		).rejects.toMatchObject({ response: expect.objectContaining({ code: 'REFUND_RETURN_ORDER_MISMATCH' }) });
		await expect(
			fixture.service.createAttributedRefund({
				orderId: ORDER,
				claimId: 'claim-other-order',
				amount: '5',
				currency: 'USD'
			} as never)
		).rejects.toMatchObject({ response: expect.objectContaining({ code: 'REFUND_CLAIM_ORDER_MISMATCH' }) });
		expect(fixture.tables.refund).toEqual([]);

		// The control: the caller's own order, return and claim, all of one order, are recorded.
		await expect(
			fixture.service.createRefund(
				refundInput({ returnId: RETURN, claimId: CLAIM, reasonId: 'reason-ours' }) as never
			)
		).resolves.toMatchObject({ returnId: RETURN, claimId: CLAIM, reasonId: 'reason-ours' });
	});

	it('refuses a governed reason of another organization', async () => {
		const fixture = refundFixture(registered());

		await expect(
			fixture.service.createRefund(refundInput({ reasonId: 'reason-foreign' }) as never)
		).rejects.toThrow(/REFUND_REASON_NOT_FOUND/);
		expect(fixture.tables.refund).toEqual([]);
	});

	it('keeps the identifiers as plain attribution where the installation has no order or returns tables', async () => {
		// No order and no returns package: nothing to check against, and no other tenant's row to leak into.
		const fixture = refundFixture();

		await expect(
			fixture.service.createRefund(
				refundInput({ returnId: 'external-return', claimId: 'external-claim' }) as never
			)
		).resolves.toMatchObject({ returnId: 'external-return', claimId: 'external-claim' });
	});

	it('measures a correction against what will be written: a cleared return no longer binds the order', async () => {
		// The payment names no order, so the refund may be corrected to another order of ours — and the return
		// it cited, which belongs to the first order, is cleared in the same request (Greptile, #10854).
		const fixture = refundFixture({ ...registered(), payments: [paymentRow(PAYMENT, { orderId: null })] });
		const refund = await fixture.service.createRefund(refundInput({ returnId: RETURN }) as never);

		await expect(
			fixture.service.updateRefund(refund.id, { orderId: OTHER_ORDER, returnId: null } as never)
		).resolves.toMatchObject({ orderId: OTHER_ORDER, returnId: null });

		// A refund with no payment is explained by its return or claim alone, so both cannot be cleared.
		const attributed = await fixture.service.createAttributedRefund({
			orderId: ORDER,
			returnId: RETURN,
			amount: '5',
			currency: 'USD'
		} as never);

		await expect(fixture.service.updateRefund(attributed.id, { returnId: null } as never)).rejects.toThrow(
			/REFUND_NOT_ALLOWED/
		);
	});

	it('holds a changed attribution to the creation rules, and never moves a refund out of the organization', async () => {
		const fixture = refundFixture(registered());
		const refund = await fixture.service.createRefund(refundInput() as never);
		const refusal = (input: Row) =>
			fixture.service
				.updateRefund(refund.id, input as never)
				.then(() => undefined)
				.catch((thrown) => thrown?.response?.code ?? thrown?.message);

		// The failure scenario: `PUT /refunds/:id` re-pointed a pending refund at any order, return or claim.
		expect(await refusal({ orderId: FOREIGN_ORDER })).toBe('REFUND_ORDER_NOT_FOUND');
		expect(await refusal({ orderId: OTHER_ORDER })).toBe('REFUND_ORDER_MISMATCH');
		expect(await refusal({ returnId: 'return-foreign' })).toBe('REFUND_RETURN_NOT_FOUND');
		expect(await refusal({ claimId: 'claim-other-order' })).toBe('REFUND_CLAIM_ORDER_MISMATCH');
		expect(await refusal({ reasonId: 'reason-foreign' })).toMatch(/REFUND_REASON_NOT_FOUND/);

		const updated = await fixture.service.updateRefund(refund.id, {
			tenantId: 'another-tenant',
			organizationId: OTHER_ORG,
			returnId: RETURN,
			claimId: CLAIM,
			note: 'corrected'
		} as never);

		expect(updated).toMatchObject({
			tenantId: TENANT,
			organizationId: ORG,
			orderId: ORDER,
			returnId: RETURN,
			claimId: CLAIM,
			note: 'corrected'
		});
	});
});

describe('RefundService — two refunds of one order are measured one after the other (review R3-08r1)', () => {
	const SECOND_PAYMENT = 'payment-2';

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	/** An order paid 10 + 10: 20 to give back between its payments, and no single payment can carry 15. */
	const order = (refunds: Row[] = [], dialect?: string) =>
		refundFixture({
			payments: [paymentRow(PAYMENT, { amount: '10' }), paymentRow(SECOND_PAYMENT, { amount: '10' })],
			captures: [
				captureRow('capture-1', { amount: '10' }),
				captureRow('capture-2', { paymentId: SECOND_PAYMENT, amount: '10' })
			],
			refunds,
			dialect
		});

	/**
	 * Makes the first read of the order's refunds that name no payment slow: what it read is stale by the time its
	 * caller writes, unless the other caller waited for it. That is the window two concurrent requests have.
	 */
	const slowFirstRead = (fixture: ReturnType<typeof order>): Promise<void> => {
		const read = fixture.service.sumUnattributedForOrder.bind(fixture.service);
		let calls = 0;
		let taken: () => void = () => undefined;
		const firstReadTaken = new Promise<void>((resolve) => (taken = resolve));

		jest.spyOn(fixture.service, 'sumUnattributedForOrder').mockImplementation(async (orderId, currency) => {
			const value = await read(orderId, currency);

			if (++calls === 1) {
				taken();
				await new Promise((resolve) => setTimeout(resolve, 25));
			}

			return value;
		});

		return firstReadTaken;
	};

	it('refuses the second of two concurrent return refunds the order cannot carry both of', async () => {
		const fixture = order();

		slowFirstRead(fixture);

		const refund = (returnId: string) =>
			fixture.service.createAttributedRefund({
				orderId: ORDER,
				returnId,
				amount: '15',
				currency: 'USD'
			} as never);

		// The failure scenario: both read the order's headroom (20) before either wrote, and 30 went back on 20 taken.
		const outcomes = await Promise.allSettled([refund('return-a'), refund('return-b')]);

		expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);

		const refused = outcomes.find((outcome) => outcome.status === 'rejected') as PromiseRejectedResult;

		expect(refused.reason.getResponse()).toMatchObject({
			code: 'REFUND_AMOUNT_EXCEEDS_CAPTURED',
			details: { orderId: ORDER, requested: '15', refundable: '5', currency: 'USD' }
		});
		expect(fixture.tables.refund).toHaveLength(1);
		// Each attempt took the order lock inside its own transaction.
		expect(new Set(fixture.locks.map((lock) => lock.transaction)).size).toBe(2);
	});

	it('refuses an approval that would pass on what it read before a return refund of the same order committed', async () => {
		const fixture = order([refundRow('pending-on-payment', { amount: '10' })]);
		const approvalHasRead = slowFirstRead(fixture);

		// The return refund lands while the approval holds a read of the order taken before it.
		const outcomes = await Promise.allSettled([
			fixture.service.approveRefund('pending-on-payment'),
			approvalHasRead.then(() =>
				fixture.service.createAttributedRefund({
					orderId: ORDER,
					returnId: 'return-a',
					amount: '15',
					currency: 'USD'
				} as never)
			)
		]);

		// One of the two is refused: 10 + 15 cannot both go back on 20 taken, whichever lands first.
		expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);

		const refunded = fixture.tables.refund.filter((row) =>
			[RefundStatus.SUCCEEDED, RefundStatus.PENDING].includes(row.status)
		);
		const total = refunded
			.filter((row) => row.id !== 'pending-on-payment' || row.status === RefundStatus.SUCCEEDED)
			.reduce((sum, row) => sum + Number(row.amount), 0);

		expect(total).toBeLessThanOrEqual(20);
	});

	it('counts a refund that names no payment even when it is approved while the order is being read', async () => {
		// Greptile, #10889: read as two statements (succeeded, then pending), a refund that moved from pending to
		// succeeded between them was counted by neither. The order's refunds are one read now.
		const fixture = order([
			refundRow('return-refund', {
				paymentId: undefined,
				returnId: 'return-a',
				amount: '15',
				status: RefundStatus.PENDING
			})
		]);
		const read = fixture.service.find.bind(fixture.service);

		jest.spyOn(fixture.service, 'find').mockImplementation(async (options: any) => {
			const rows = await read(options);

			// The approval lands right after this read.
			fixture.tables.refund[0].status = RefundStatus.SUCCEEDED;

			return rows;
		});

		expect(await fixture.service.sumUnattributedForOrder(ORDER, 'USD')).toBe('15');
	});

	it('takes no row lock on a dialect that has none, and still measures the refund', async () => {
		// A dialect without row locks, stated when the datastore is built (the data source's type is read-only).
		const fixture = order([], 'better-sqlite3');

		await fixture.service.createAttributedRefund({
			orderId: ORDER,
			returnId: 'return-a',
			amount: '15',
			currency: 'USD'
		} as never);
		await expect(
			fixture.service.createAttributedRefund({
				orderId: ORDER,
				returnId: 'return-b',
				amount: '15',
				currency: 'USD'
			} as never)
		).rejects.toThrow(/REFUND_AMOUNT_EXCEEDS_CAPTURED/);
		expect(fixture.locks).toEqual([]);
	});
});

describe('RefundService — one standing refund per key, decided under the order lock (review R3-09r2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses the second of two concurrent refunds under one key, naming the first', async () => {
		const fixture = refundFixture();
		const refund = () =>
			fixture.service.createAttributedRefund({
				orderId: ORDER,
				paymentId: PAYMENT,
				claimId: 'claim-1',
				amount: '10',
				currency: 'USD',
				metadata: { idempotencyKey: 'decision-1' }
			} as never);

		const outcomes = await Promise.allSettled([refund(), refund()]);

		expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);

		const refused = outcomes.find((outcome) => outcome.status === 'rejected') as PromiseRejectedResult;

		expect(refused.reason).toBeInstanceOf(ConflictException);
		expect(refused.reason.getResponse()).toMatchObject({
			code: 'REFUND_IDEMPOTENCY_KEY_IN_USE',
			details: { refundId: fixture.tables.refund[0].id }
		});
		expect(fixture.tables.refund).toHaveLength(1);
	});

	it('records a refund under a key that only a withdrawn refund held', async () => {
		const fixture = refundFixture({
			refunds: [
				refundRow('withdrawn', {
					claimId: 'claim-1',
					status: RefundStatus.CANCELED,
					metadata: { idempotencyKey: 'decision-1' }
				})
			]
		});

		await expect(
			fixture.service.createAttributedRefund({
				orderId: ORDER,
				paymentId: PAYMENT,
				claimId: 'claim-1',
				amount: '10',
				currency: 'USD',
				metadata: { idempotencyKey: 'decision-1' }
			} as never)
		).resolves.toMatchObject({ status: RefundStatus.PENDING });
	});
});

describe('RefundService — the order row is the lock, whether or not the order has payments (Greptile, #10906)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses the second of two concurrent keyed refunds of an order that has no payment rows', async () => {
		// No payment row to lock: before, both locked nothing, both read no holder of the key and both wrote.
		const fixture = refundFixture({
			payments: [],
			captures: [],
			orders: [{ id: ORDER, tenantId: TENANT, organizationId: ORG }]
		});
		const refund = () =>
			fixture.service.createAttributedRefund({
				orderId: ORDER,
				claimId: 'claim-1',
				amount: '10',
				currency: 'USD',
				metadata: { idempotencyKey: 'decision-1' }
			} as never);

		const outcomes = await Promise.allSettled([refund(), refund()]);

		expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
		expect(fixture.tables.refund).toHaveLength(1);
	});
});
