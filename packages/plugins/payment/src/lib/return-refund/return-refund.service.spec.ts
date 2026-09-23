/**
 * Two module boundaries are doubled here, for the same reason as the package's other suites.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which recording a refund needs and none of which is available
 * outside a running application; its nested `uuid` is ESM-only, so reading one entity would fail under
 * jest. `@gauzy/config` reads the process environment at import time. Both are therefore doubled at the
 * module boundary, and **the services under test are the real ones**: the refund entry point, the
 * refund service it records and settles through, the capture service it measures the refundable figure
 * with, the reason service it validates the governed reason against and the collection service the
 * settlement moves — all over one shared in-memory datastore. Only the base CRUD class, the request
 * context, the entity base classes and the two ORM constants are substituted, and the money kernel is
 * pulled through the seam with `requireActual`.
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

		async findOneOrFailByWhereOptions(options: any): Promise<any> {
			const record = await this.typeOrmRepository.findOneBy(options);

			return record ? { success: true, record } : { success: false };
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
		compareDecimalStrings: jest.requireActual('@gauzy/core/src/lib/money/decimal').compareDecimalStrings,
		// The affected-row reader is the platform's own, pulled through the seam rather than written
		// again here: the approval this entry point settles through decides whether its compare-and-swap
		// was refused from whatever the driver answered the `UPDATE` with, and a double that understood
		// a different set of shapes would pass this suite while the four supported drivers disagreed.
		readAffectedRows: jest.requireActual('@gauzy/core/src/lib/database/database.helper').readAffectedRows,
		BaseEvent: class {},
		EventBus: class {},
		Payment: class Payment {},
		Integration: class Integration {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			// The scope the fixture's rows are stamped with. A case about tenancy re-points it with a spy,
			// so the scope is never a constant of this specification.
			currentTenantId: () => '00000000-0000-4000-8000-000000000001',
			currentOrganizationId: () => '00000000-0000-4000-8000-000000000002',
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

jest.mock(
	'@gauzy/config',
	() => ({
		isMySQL: () => false,
		isPostgres: () => false,
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

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { Payment, RequestContext } from '@gauzy/core';
import { PaymentCapture } from '../payment-capture/payment-capture.entity';
import { PaymentCaptureService } from '../payment-capture/payment-capture.service';
import { PaymentCollectionService } from '../payment-collection/payment-collection.service';
import { RefundStatus } from '../payment.types';
import { RefundLine } from '../refund-line/refund-line.entity';
import { RefundLineService } from '../refund-line/refund-line.service';
import { RefundReasonService } from '../refund-reason/refund-reason.service';
import { Refund } from '../refund/refund.entity';
import { RefundService } from '../refund/refund.service';
import { ReturnRefundService } from './return-refund.service';

/**
 * The money a return or a claim pays back, as the flow that decided on it asks for it.
 *
 * What this suite is about is what the entry point *decides*, since that is what the caller cannot:
 *
 * - **A refund is recorded and settled.** The answer is the stored refund's own identifier — the
 *   caller's payload reports it, so an answer that named the row some other way would report nothing
 *   for a refund that was written — and the amount is read back from the row at the storage scale
 *   rather than echoed from the request.
 * - **A refund always cites something.** A return is the caller's own reference and is passed through;
 *   a request that names none is attributed to the payment recorded against the order whose captured
 *   money can still cover the amount. When nothing can carry it and nothing is named, the refund is
 *   refused and **nothing is written** — an unattributed refund is a movement nobody can explain
 *   later.
 * - **The spend is measured, never assumed.** The figure a payment can still give back is its captures
 *   less the refunds that already succeeded against it, so no entry point can pay back more than was
 *   collected through that payment; a return whose money arrived by means no payment row records is
 *   still recorded against the return it came from. That escape is for an order the platform recorded
 *   no money for — **not** for one being over-refunded: a refund attributed to a return rather than to
 *   a payment is one the refund service's own ceiling never sees, so an order that did capture money is
 *   measured here against what all of its payments can still give back between them.
 * - **The scope is the caller's.** A payment or a reason of another organization is not attributed and
 *   not cited, and a request that would do so is refused rather than written.
 *
 * The entry point is constructed over one in-memory datastore shared with the real refund, capture,
 * collection, line and reason services, so every assertion below is against state rather than against
 * a call log.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const ORDER = '00000000-0000-4000-8000-000000000010';
const RETURN = '00000000-0000-4000-8000-000000000020';
const EXCHANGE = '00000000-0000-4000-8000-000000000030';
const CLAIM = '00000000-0000-4000-8000-000000000040';
const REASON = 'refund-reason-1';
const PAYMENT = 'payment-1';
const SECOND_PAYMENT = 'payment-2';
const COLLECTION = 'collection-1';

type Row = Record<string, any>;

/** The tables this suite drives, as plain arrays. */
interface ITables {
	refund: Row[];
	refund_line: Row[];
	payment: Row[];
	payment_capture: Row[];
	payment_collection: Row[];
	refund_reason: Row[];
}

/** The entity classes the services hand to their transaction manager, resolved to tables. */
const ENTITY_TABLES = new Map<unknown, keyof ITables>([
	[Refund, 'refund'],
	[RefundLine, 'refund_line'],
	// The capture and the payment it moves are written in one transaction, so the manager has to know
	// both: a capture row that outlived a refused compare-and-swap on the payment would be a ledger
	// entry for money the payment does not account for.
	[PaymentCapture, 'payment_capture'],
	[Payment, 'payment']
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
		// TypeORM applies the WHOLE criteria it was handed, not the id alone. The running total a
		// compare-and-swap predicates its statement on is part of that criteria, so a double that matched
		// on the id only would report a lost race as a successful write.
		update: async (entity: unknown, criteria: any, partial: Row) => {
			const where = typeof criteria === 'string' ? { id: criteria } : (criteria ?? {});
			const rows = tables[tableOf(entity)];
			const index = rows.findIndex((row) => matches(row, where));

			if (index >= 0) {
				Object.assign(rows[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
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

	return { repository, manager };
}

/** One core `payment` row: what the order's money came in on. */
const paymentRow = (id: string, overrides: Row = {}): Row => ({
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

/** One `payment_capture` row: what a refund is measured against. */
const captureRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	paymentId: PAYMENT,
	amount: '100',
	currency: 'USD',
	capturedAt: new Date('2026-01-02T10:00:00.000Z'),
	...overrides
});

/** One `payment_collection` row. */
const collectionRow = (id: string, overrides: Row = {}): Row => ({
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

/** One `refund_reason` row: the governed reason a refund may cite. */
const reasonRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	code: 'damaged',
	label: 'Arrived damaged',
	...overrides
});

/**
 * @param options The rows the fixture starts with.
 * @returns The entry point, wired to the real services over one datastore, and the tables themselves.
 */
function fixture(
	options: {
		payments?: Row[];
		captures?: Row[];
		collections?: Row[];
		refunds?: Row[];
		reasons?: Row[];
	} = {}
) {
	const tables: ITables = {
		refund: options.refunds ?? [],
		refund_line: [],
		payment: options.payments ?? [paymentRow(PAYMENT)],
		payment_capture: options.captures ?? [captureRow('capture-1')],
		payment_collection: options.collections ?? [collectionRow(COLLECTION)],
		refund_reason: options.reasons ?? [reasonRow(REASON)]
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
	const refundService = new RefundService(
		store.repository('refund') as never,
		{} as never,
		store.repository('payment') as never,
		captureService,
		collectionService,
		refundLineService,
		eventBus as never
	);
	const reasonService = new RefundReasonService(store.repository('refund_reason') as never, {} as never);
	const service = new ReturnRefundService(
		refundService,
		captureService,
		reasonService,
		store.repository('payment') as never
	);

	return { service, tables, published };
}

describe('ReturnRefundService — the money a return or a claim pays back', () => {
	afterEach(() => jest.restoreAllMocks());

	it('records and settles the refund a return pays back, and answers with the stored identifier', async () => {
		const { service, tables, published } = fixture({});

		const refund = await service.createRefund({
			orderId: ORDER,
			returnId: RETURN,
			amount: '25',
			currency: 'USD',
			reasonId: REASON,
			note: 'customer returned two units'
		});

		expect(refund).toEqual({ refundId: 'refund-1', amount: '25.000000', currency: 'USD' });
		expect(tables.refund).toHaveLength(1);
		expect(tables.refund[0]).toMatchObject({
			id: 'refund-1',
			tenantId: TENANT,
			organizationId: ORG,
			orderId: ORDER,
			returnId: RETURN,
			paymentId: PAYMENT,
			reasonId: REASON,
			amount: '25',
			currency: 'USD',
			status: RefundStatus.SUCCEEDED,
			note: 'customer returned two units'
		});
		expect(tables.refund[0].refundedAt).toBeInstanceOf(Date);
		// The settled refund is what moves the money on the payment's own ledger and on its collection,
		// which is the whole reason the entry point composes the domain's transitions rather than writing
		// a status itself.
		expect(tables.payment[0]).toMatchObject({ refundedAmount: '25', status: 'PARTIALLY_REFUNDED' });
		expect(tables.payment_collection[0]).toMatchObject({ refundedAmount: '25' });
		// The entry point carries no per-line breakdown, so a refund of a whole amount writes no line —
		// and the register it would have moved is the order package's.
		expect(tables.refund_line).toEqual([]);
		expect(published).toHaveLength(2);
	});

	it('attributes a refund that names no return to the payment the order was settled by', async () => {
		// This is the path a claim takes: a complaint about an order rather than about a return, which
		// names no payment of its own.
		const { service, tables } = fixture({});

		const refund = await service.createRefund({
			orderId: ORDER,
			amount: '40',
			currency: 'USD',
			note: 'claim settled in money'
		});

		expect(refund.refundId).toBe('refund-1');
		expect(refund.amount).toBe('40.000000');
		expect(tables.refund[0]).toMatchObject({
			orderId: ORDER,
			paymentId: PAYMENT,
			status: RefundStatus.SUCCEEDED
		});
		expect(tables.refund[0].returnId).toBeUndefined();
		expect(tables.payment[0]).toMatchObject({ refundedAmount: '40' });
	});

	it('answers the stored amount at the storage scale, never an echo of the request', async () => {
		const { service, tables } = fixture({});

		const refund = await service.createRefund({
			orderId: ORDER,
			returnId: RETURN,
			amount: '10.005',
			currency: 'USD'
		});

		expect(refund.amount).toBe('10.005000');
		expect(tables.refund[0].amount).toBe('10.005');
	});

	it('attributes the payment with the most left to give, and never more than was captured', async () => {
		// Two payments settled the order. The refund of 80 fits inside the second one and not the first,
		// so the second is named — which is also what keeps the answer exact rather than nominal.
		const { service, tables } = fixture({
			payments: [paymentRow(PAYMENT), paymentRow(SECOND_PAYMENT)],
			captures: [
				captureRow('capture-1', { amount: '40' }),
				captureRow('capture-2', { paymentId: SECOND_PAYMENT, amount: '100' })
			]
		});

		await service.createRefund({ orderId: ORDER, returnId: RETURN, amount: '80', currency: 'USD' });

		expect(tables.refund[0]).toMatchObject({ paymentId: SECOND_PAYMENT, amount: '80' });
	});

	it('refuses a refund no payment can carry and no return explains, and writes nothing', async () => {
		// Nothing explains this refund: no payment of the order can carry it, and no return and no claim
		// is named. The order's money was never recorded by the payment package at all, so there is no
		// captured figure to measure the amount against and the missing attribution is what refuses it.
		const unrecorded = fixture({ payments: [], captures: [] });

		await expect(
			unrecorded.service.createRefund({ orderId: ORDER, amount: '500', currency: 'USD' })
		).rejects.toThrow(/REFUND_PAYMENT_UNAVAILABLE/);
		expect(unrecorded.tables.refund).toEqual([]);

		// An order that *did* capture money is refused earlier and by a different name: 500 is past what
		// its payments can give back between them, which is an over-refund whatever it is attributed to.
		const captured = fixture({});

		await expect(
			captured.service.createRefund({ orderId: ORDER, amount: '500', currency: 'USD' })
		).rejects.toThrow(/REFUND_AMOUNT_EXCEEDS_CAPTURED/);
		expect(captured.tables.refund).toEqual([]);
		expect(captured.tables.payment[0]).toMatchObject({ refundedAmount: '0' });
	});

	it('records a return refund that no payment can carry, against the return it came from', async () => {
		// A return's money may have arrived by means no payment row records — a transfer, a store credit —
		// so the return is what explains the refund, and there is no captured figure on the order for the
		// ceiling to be read from.
		const { service, tables } = fixture({ payments: [], captures: [] });

		const refund = await service.createRefund({
			orderId: ORDER,
			returnId: RETURN,
			amount: '500',
			currency: 'USD'
		});

		expect(refund).toEqual({ refundId: 'refund-1', amount: '500.000000', currency: 'USD' });
		expect(tables.refund[0]).toMatchObject({ returnId: RETURN, status: RefundStatus.SUCCEEDED });
		expect(tables.refund[0].paymentId).toBeUndefined();
	});

	it('records a claim refund that no payment can carry, against the claim it came from', async () => {
		// A claim is the third flow that can owe money back, and it explains the refund on its own for
		// the same reason a return does: the money may have arrived by means no payment row records.
		// Without this the claim path could only ever refund an order the payment package had processed.
		const { service, tables } = fixture({ payments: [], captures: [] });

		const refund = await service.createRefund({
			orderId: ORDER,
			claimId: CLAIM,
			amount: '500',
			currency: 'USD'
		});

		expect(refund).toEqual({ refundId: 'refund-1', amount: '500.000000', currency: 'USD' });
		expect(tables.refund[0]).toMatchObject({ claimId: CLAIM, status: RefundStatus.SUCCEEDED });
		expect(tables.refund[0].paymentId).toBeUndefined();
	});

	it('refuses a return or a claim refund past what the order captured, however it is explained', async () => {
		// The two escapes above are for an order whose money the platform never recorded, not for one
		// being over-refunded. A refund that names no payment is a refund `assertRefundable` never sees,
		// because that ceiling runs only on the path that has a payment — which is how a return for one
		// $20 item could be refunded for 100000, repeatedly, with nothing anywhere to stop it. An order
		// that has captured money is therefore measured against what its payments can still give back
		// between them, and the refusal carries that figure.
		const { service, tables } = fixture({});

		const refusal = await service
			.createRefund({ orderId: ORDER, returnId: RETURN, amount: '100000', currency: 'USD' })
			.then(() => undefined)
			.catch((thrown) => thrown);

		expect(refusal).toBeInstanceOf(BadRequestException);
		expect(refusal.getResponse()).toMatchObject({
			code: 'REFUND_AMOUNT_EXCEEDS_CAPTURED',
			details: { orderId: ORDER, requested: '100000', refundable: '100', currency: 'USD' }
		});
		await expect(
			service.createRefund({ orderId: ORDER, claimId: CLAIM, amount: '100000', currency: 'USD' })
		).rejects.toThrow(/REFUND_AMOUNT_EXCEEDS_CAPTURED/);
		expect(tables.refund).toEqual([]);
		expect(tables.payment[0]).toMatchObject({ refundedAmount: '0' });

		// The ceiling is the figure, not a smaller one: the return refund that reaches exactly what the
		// order can still give back is recorded and settled.
		const exact = await service.createRefund({
			orderId: ORDER,
			returnId: RETURN,
			amount: '100',
			currency: 'USD'
		});

		expect(exact.amount).toBe('100.000000');
		expect(tables.payment[0]).toMatchObject({ refundedAmount: '100', status: 'REFUNDED' });
	});

	it('refuses a refund on an order that has no payment at all, and writes nothing', async () => {
		// A payment recorded without captures — the shape a manual or offline payment takes — is nothing to
		// give back from, and the refusal names that rather than reporting the capability as missing.
		const { service, tables } = fixture({
			payments: [paymentRow(PAYMENT, { capturedAmount: '0', authorizedAmount: '0' })],
			captures: []
		});

		await expect(
			service.createRefund({ orderId: ORDER, amount: '25', currency: 'USD' })
		).rejects.toBeInstanceOf(BadRequestException);
		expect(tables.refund).toEqual([]);
	});

	it('does not attribute a payment that settles in another currency', async () => {
		const { service, tables } = fixture({
			payments: [paymentRow(PAYMENT, { currency: 'EUR' })],
			captures: [captureRow('capture-1', { currency: 'EUR' })]
		});

		// A return refund is still recorded — the return explains it — and the euro payment is not named,
		// because measuring a dollar amount against a euro figure would compare two unlike things.
		await service.createRefund({ orderId: ORDER, returnId: RETURN, amount: '25', currency: 'USD' });

		expect(tables.refund[0]).toMatchObject({ currency: 'USD', status: RefundStatus.SUCCEEDED });
		expect(tables.refund[0].paymentId).toBeUndefined();
	});

	it('keeps the exchange reference a refund was caused by', async () => {
		// The refund table has no column for the exchange, and the reference belongs to the payload its own
		// entity documents for identifiers its columns do not name.
		const { service, tables } = fixture({});

		await service.createRefund({
			orderId: ORDER,
			returnId: RETURN,
			exchangeId: EXCHANGE,
			amount: '15',
			currency: 'USD'
		});

		expect(tables.refund[0].metadata).toEqual({ exchangeId: EXCHANGE });
	});

	it('cites the governed reason it was given, and refuses one that is not the caller\'s', async () => {
		const mine = fixture({});

		await mine.service.createRefund({
			orderId: ORDER,
			returnId: RETURN,
			amount: '15',
			currency: 'USD',
			reasonId: REASON
		});

		expect(mine.tables.refund[0]).toMatchObject({ reasonId: REASON });

		const theirs = fixture({ reasons: [reasonRow(REASON, { organizationId: OTHER_ORG })] });

		await expect(
			theirs.service.createRefund({
				orderId: ORDER,
				returnId: RETURN,
				amount: '15',
				currency: 'USD',
				reasonId: REASON
			})
		).rejects.toBeInstanceOf(NotFoundException);
		expect(theirs.tables.refund).toEqual([]);
	});

	it('scopes the payment read to the caller and attributes nothing of another organization', async () => {
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);
		const { service, tables } = fixture({ payments: [paymentRow(PAYMENT)] });

		await expect(
			service.createRefund({ orderId: ORDER, amount: '25', currency: 'USD' })
		).rejects.toThrow(/REFUND_PAYMENT_UNAVAILABLE/);
		expect(tables.refund).toEqual([]);
	});

	it('refuses an amount that is not a monetary value and a currency that is not a code', async () => {
		const { service, tables } = fixture({});

		await expect(
			service.createRefund({ orderId: ORDER, returnId: RETURN, amount: 'twenty', currency: 'USD' })
		).rejects.toThrow(/PAYMENT_AMOUNT_INVALID/);
		await expect(
			service.createRefund({ orderId: ORDER, returnId: RETURN, amount: '25', currency: '' })
		).rejects.toThrow(/PAYMENT_CURRENCY_INVALID/);
		expect(tables.refund).toEqual([]);
	});

	it('refuses a refund that names no order', async () => {
		const { service, tables } = fixture({});

		await expect(service.createRefund({ amount: '25', currency: 'USD' } as never)).rejects.toThrow(
			/REFUND_ORDER_REQUIRED/
		);
		expect(tables.refund).toEqual([]);
	});
});
