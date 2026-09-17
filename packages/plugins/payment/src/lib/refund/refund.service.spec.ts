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

jest.mock(
	'@gauzy/config',
	() => ({
		isMySQL: () => false,
		DatabaseTypeEnum: {
			mongodb: 'mongodb',
			sqlite: 'sqlite',
			betterSqlite3: 'better-sqlite3',
			postgres: 'postgres',
			mysql: 'mysql'
		}
	}),
	{ virtual: true }
);

import { NotFoundException } from '@nestjs/common';
import { RequestContext } from '@gauzy/core';
import { RefundStatus } from '../payment.types';
import { PaymentRefundedEvent, RefundCreatedEvent } from '../events';
import { PaymentCaptureService } from '../payment-capture/payment-capture.service';
import { PaymentCollectionService } from '../payment-collection/payment-collection.service';
import { RefundLine } from '../refund-line/refund-line.entity';
import { RefundLineService } from '../refund-line/refund-line.service';
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
}

/** The entity classes the services hand to their transaction manager, resolved to tables. */
const ENTITY_TABLES = new Map<unknown, keyof ITables>([
	[Refund, 'refund'],
	[RefundLine, 'refund_line']
]);

/**
 * An in-memory stand-in for the datastore the services write through: one TypeORM repository per table,
 * and the transaction manager they share.
 *
 * @param tables The whole datastore.
 */
function datastore(tables: ITables) {
	let sequence = 0;
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where).every(([field, expected]) => {
			// A missing column and a null column are the same thing to the database, and TypeORM drops
			// an `undefined` member from the condition rather than matching nothing.
			if (expected === undefined) {
				return true;
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
	const manager: any = {
		transaction: async (run: (transactional: any) => Promise<any>) => {
			const copy = snapshot();

			try {
				return await run(manager);
			} catch (error) {
				restore(copy);
				throw error;
			}
		},
		create: (_entity: unknown, partial: Row) => ({ ...partial }),
		save: async (entity: unknown, rowOrRows: any) => {
			const list = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
			const saved = list.map((row) => save(tableOf(entity), row));

			return Array.isArray(rowOrRows) ? saved : saved[0];
		},
		find: async (entity: unknown, options: any = {}) =>
			tables[tableOf(entity)].filter((row) => matches(row, options.where)),
		findOne: async (entity: unknown, options: any = {}) =>
			tables[tableOf(entity)].find((row) => matches(row, options.where)) ?? null,
		/**
		 * The one raw read this domain makes: the order lines a breakdown cites, read by name inside the
		 * writing transaction. The conditions the service states are applied — the ids, the soft-delete
		 * filter and the caller's own tenant and organization.
		 */
		createQueryBuilder: () => {
			const conditions: Array<{ sql: string; params: Row }> = [];
			const builder: any = {
				select: () => builder,
				from: () => builder,
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
		update: async (criteria: any, partial: Row) => {
			const index = tables[table].findIndex((row) => row.id === identify(criteria));

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

	return { repository, manager };
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
		withPort?: boolean;
		port?: { recordRefund: (report: any) => Promise<any> };
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
		]
	};
	const store = datastore(tables);
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
		port as never
	);

	return {
		service,
		tables,
		published,
		port,
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
			organizationId: ORG
		});
		expect(consoleLog).not.toHaveBeenCalled();
	});

	it('refuses a refund that names no payment, no return and no claim', async () => {
		// An unattributed refund is a movement nobody can explain later.
		const fixture = refundFixture();

		await expect(
			fixture.service.createRefund({ orderId: ORDER, amount: '40', currency: 'USD' } as never)
		).rejects.toThrow(/REFUND_NOT_ALLOWED/);
		expect(fixture.tables.refund).toEqual([]);
	});

	it('accepts a refund attributed to a return or a claim with no payment at all', async () => {
		const fixture = refundFixture();

		const refund = await fixture.service.createRefund({
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
			fixture.service.createRefund({ orderId: ORDER, returnId: 'return-1', amount: '40' } as never)
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

	// The defect: the amount is validated twice and only the second validation is a refusal. With a
	// `paymentId` named, `assertRefundable` runs first and calls `Money.of` on the raw request amount, so
	// a malformed amount raises the money kernel's own `Error` — an unhandled 500 rather than the
	// documented `PAYMENT_AMOUNT_INVALID` the same request is refused with when no payment is named
	// (`refund.service.ts`, the `await this.assertRefundable(payment, input.amount, currency)` call on
	// line 124, which precedes the `this.toMoney(input.amount, currency)` on line 131 that is the one
	// written to convert the failure).
	it.failing('[DEFECT] refuses a malformed amount with PAYMENT_AMOUNT_INVALID whatever else it names', async () => {
		const fixture = refundFixture();

		await expect(fixture.service.createRefund(refundInput({ amount: 'forty' }) as never)).rejects.toThrow(
			/PAYMENT_AMOUNT_INVALID/
		);
		expect(fixture.tables.refund).toEqual([]);
	});

	it('refuses a malformed amount with PAYMENT_AMOUNT_INVALID when no payment is named', async () => {
		// What the same request is refused with on the path that has no payment to check it against, and
		// the reason the case above is a defect rather than an unstated behaviour: the vocabulary exists.
		const fixture = refundFixture();

		await expect(
			fixture.service.createRefund({ orderId: ORDER, returnId: 'return-1', amount: 'forty', currency: 'USD' } as never)
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
				refundInput({ amount: '60', lines: [{ orderLineId: 'no-such-line', quantity: '1', amount: '50' }] }) as never
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
			currency: 'USD'
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
		// Two refunds of the whole captured amount may both be recorded — a pending refund is an
		// intention — but only one of them can succeed, because Σ succeeded <= Σ captured (doc 10 §9.5).
		const fixture = refundFixture();
		const first = await fixture.service.createRefund(refundInput({ amount: '100' }) as never);
		const second = await fixture.service.createRefund(refundInput({ amount: '100' }) as never);

		await fixture.service.approveRefund(first.id);

		expect(fixture.payment()).toMatchObject({ refundedAmount: '100', status: 'REFUNDED' });

		await expect(fixture.service.approveRefund(second.id)).rejects.toThrow(/REFUND_AMOUNT_EXCEEDS_CAPTURED/);
		expect(fixture.tables.refund[1].status).toBe(RefundStatus.PENDING);
		expect(fixture.payment().refundedAmount).toBe('100');
		expect(await fixture.service.sumSucceededForPayment(PAYMENT)).toBe('100');
	});

	it('re-checks the ceiling on approval against the captures, not against the authorisation', async () => {
		// 100 was authorised but only 40 was ever taken, so 40 is what may go back — whatever the amount
		// recorded on the refund while it was pending.
		const fixture = refundFixture({
			payments: [paymentRow(PAYMENT, { capturedAmount: '40', refundedAmount: '0', status: 'PARTIALLY_CAPTURED' })],
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
