/**
 * Three module boundaries are doubled here, for the same reason and in the same way.
 *
 * `@gauzy/core` boots the whole application graph from its barrel, and `@gauzy/plugin-cart`'s barrel
 * re-exports the cart plugin class, which imports the catalogue plugin, which imports the rest of the
 * marketplace — so reading one totals function would otherwise load every package on the platform.
 * Both seams are therefore doubled at the module boundary, exactly as the docs package's service
 * specs do, and **the services under test are the real ones**, including the totals writer the change
 * path ends in.
 */
jest.mock('@gauzy/plugin-cart', () => ({
	TotalsCalculator: jest.requireActual('@gauzy/plugin-cart/src/lib/totals/totals-calculator').TotalsCalculator
}));

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

		async update(id: any, partial: any): Promise<any> {
			return this.typeOrmRepository.update(id, partial);
		}
	}

	class TenantAwareCrudService extends CrudService {
		async findAll(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}

		async find(options: any = {}): Promise<any> {
			return this.typeOrmRepository.find(options);
		}

		async findOneByIdString(id: any, options: any = {}): Promise<any> {
			if (!id) {
				throw new NotFoundException('The requested record was not found');
			}

			const record = await this.typeOrmRepository.findOne({
				...options,
				where: { ...(options.where ?? {}), id }
			});

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
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
			if (typeof id === 'string') {
				await this.findOneByIdString(id);
			} else if (id && typeof id === 'object' && !('version' in id)) {
				// The base service reads a criteria object before writing with it, except when the criteria
				// names a version: that column is the write's precondition and the statement evaluates it,
				// which is what makes a write that lost a race a conflict rather than a missing record.
				await this.findOneByWhereOptions(id);
			}

			return this.typeOrmRepository.update(id, partial);
		}

		async delete(criteria: any): Promise<any> {
			return this.typeOrmRepository.delete(criteria);
		}
	}

	return {
		// The statement helpers are pure and dialect-driven; loading the real module here would pull
		// `@gauzy/config` and the request context into a suite that doubles the barrel on purpose.
		quoteIdentifier: (identifier: string) => `"${identifier}"`,
		prepareSQLQuery: (query: string) => query,
		...jest.requireActual('@gauzy/core/src/lib/money/decimal'),
		CrudService,
		TenantAwareCrudService,
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
		commitVersionedUpdate: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.commitVersionedUpdate,
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.versionExpectationOf,
		// The comparison a service makes before it writes a child row, and the refusal it raises, are the
		// kernel's own: a doubled comparison would agree with the service by construction, and what this
		// suite asserts is that a stale expectation is refused before an action is applied.
		matchesExpectation: jest.requireActual('@gauzy/core/src/lib/concurrency/version.util').matchesExpectation,
		parseEntityVersion: jest.requireActual('@gauzy/core/src/lib/concurrency/version.util').parseEntityVersion,
		ApiException: jest.requireActual('@gauzy/core/src/lib/core/errors/api-exception').ApiException,
		ApiErrorCode: jest.requireActual('@gauzy/core/src/lib/core/errors/api-error-codes').ApiErrorCode,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		},
		AdjustmentService: class {},
		TaxLineService: class {},
		SequenceService: class {},
	// Added when core grew this export: the double has to carry it, or the code under
	// test calls nothing and the suite fails for a reason that is not its own.
	};
});

import { NotFoundException } from '@nestjs/common';
import {
	AdjustmentOwnerType,
	AddressType,
	FulfillmentStatus,
	OrderChangeActionType,
	OrderChangeStatus,
	OrderChangeType,
	OrderPaymentStatus,
	OrderStatus,
	OrderTransactionType,
	TaxLineOwnerType
} from '@gauzy/contracts';
import { OrderAddressService } from '../order-address/order-address.service';
import { OrderChangeActionService } from '../order-change-action/order-change-action.service';
import { OrderCreditLineService } from '../order-credit-line/order-credit-line.service';
import { OrderHistoryService } from '../order-history/order-history.service';
import { OrderLineService } from '../order-line/order-line.service';
import { OrderShippingMethodService } from '../order-shipping-method/order-shipping-method.service';
import { OrderSummaryService } from '../order-summary/order-summary.service';
import { OrderTotalsService } from '../order-totals/order-totals.service';
import { OrderTransactionService } from '../order-transaction/order-transaction.service';
import { OrderChangeService } from './order-change.service';

/**
 * Post-placement modifications of an order.
 *
 * Every change to a placed order — a line, a price, a quantity, an address, a delivery choice, a
 * credit — is one `order_change` with ordered actions, and the properties the domain requires of that
 * are the ones this suite pins:
 *
 * - **exclusivity**: at most one change per order holds the slot, and a second one is refused with
 *   the id of the one in flight rather than being quietly queued (doc 10 §6.4);
 * - **the money moves by the documented amount**: confirming an `ITEM_ADD`, an `ITEM_UPDATE`, a
 *   `SHIPPING_ADD` or a `SHIPPING_UPDATE` moves the order's `grandTotal` by exactly the delta the
 *   action describes, through the real totals chain (doc 10 §6.3);
 * - **the record is written**: every action ends `applied` with the instant it was applied, the
 *   change's `priceChange` is the signed sum of its actions, and the order's timeline carries the
 *   request and the confirmation (doc 10 §6.6);
 * - **a change that cannot be applied leaves the order alone**: a refusal inside the action loop
 *   stops before the status write and before the recomputation;
 * - **an action this package does not own is refused, not skipped**, because silently ignoring it
 *   would let an operator believe a shipment had been created.
 *
 * One case pins the credit arithmetic: a credit reduces what the customer owes **exactly once**, which
 * is what the sign of its ledger row decides (doc 07 §6.1 steps 11–14, doc 10 §8.6).
 */

/** The tables these packages own, as plain arrays. */
type TableName =
	| 'order'
	| 'order_line'
	| 'order_shipping_method'
	| 'order_address'
	| 'order_credit_line'
	| 'order_transaction'
	| 'order_history'
	| 'order_summary'
	| 'order_change'
	| 'order_change_action';

const TABLES: TableName[] = [
	'order',
	'order_line',
	'order_shipping_method',
	'order_address',
	'order_credit_line',
	'order_transaction',
	'order_history',
	'order_summary',
	'order_change',
	'order_change_action'
];

/** The relation of a table, the table it points at and the foreign key that joins them. */
const RELATIONS: Record<string, Record<string, { table: TableName; foreignKey: string }>> = {
	order_change: { actions: { table: 'order_change_action', foreignKey: 'changeId' } },
	order: {
		lines: { table: 'order_line', foreignKey: 'orderId' },
		shippingMethods: { table: 'order_shipping_method', foreignKey: 'orderId' },
		addresses: { table: 'order_address', foreignKey: 'orderId' },
		creditLines: { table: 'order_credit_line', foreignKey: 'orderId' },
		transactions: { table: 'order_transaction', foreignKey: 'orderId' }
	}
};

/**
 * An in-memory stand-in for one table's TypeORM repository.
 *
 * @param tables The whole datastore, so a relation can be joined.
 * @param tableName The table this repository writes.
 */
function repository(tables: Record<string, any[]>, tableName: TableName) {
	let sequence = 0;
	const rows = () => tables[tableName];
	const matches = (row: any, where: any): boolean =>
		Object.entries(where ?? {}).every(
			([field, expected]) => expected === undefined || String(row[field] ?? '') === String(expected)
		);
	const attach = (row: any, relations?: string[]) => {
		const resolved: any = { ...row };

		for (const relation of relations ?? []) {
			const link = RELATIONS[tableName]?.[relation];

			if (link) {
				resolved[relation] = tables[link.table].filter((child) => child[link.foreignKey] === row.id);
			}
		}

		return resolved;
	};

	return {
		rows,
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) =>
			rows()
				.filter((row) => matches(row, options.where))
				.map((row) => attach(row, options.relations)),
		findOne: async (options: any = {}) => {
			const row = rows().find((candidate) => matches(candidate, options.where));

			return row ? attach(row, options.relations) : null;
		},
		findOneBy: async (where: any) => rows().find((candidate) => matches(candidate, where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = rows()
				.filter((row) => matches(row, options.where))
				.map((row) => attach(row, options.relations));

			return [items, items.length];
		},
		count: async () => rows().length,
		create: (partial: any) => ({ ...partial }),
		save: async (entity: any) => {
			if (entity.id) {
				const index = rows().findIndex((row) => row.id === entity.id);

				if (index >= 0) {
					rows()[index] = { ...rows()[index], ...entity };

					return rows()[index];
				}
			}

			// Generated ids carry an infix, so one can never collide with an id a fixture seeded.
			const created = { id: `${tableName}-new-${++sequence}`, ...entity };

			rows().push(created);

			return created;
		},
		update: async (criteria: any, partial: any) => {
			const index = rows().findIndex((row) =>
				matches(row, typeof criteria === 'string' ? { id: criteria } : criteria)
			);

			if (index >= 0) {
				Object.assign(rows()[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		delete: async (criteria: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => row.id === id);

			if (index >= 0) {
				rows().splice(index, 1);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	};
}

/** One line of an order, with every counter the totals writer sums. */
const line = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	orderId: 'order-1',
	title: `Line ${id}`,
	quantity: 1,
	unitPrice: 0,
	originalUnitPrice: 0,
	isTaxInclusive: false,
	isDiscountable: true,
	requiresShipping: true,
	fulfilledQuantity: 0,
	shippedQuantity: 0,
	deliveredQuantity: 0,
	returnRequestedQuantity: 0,
	returnReceivedQuantity: 0,
	returnDismissedQuantity: 0,
	writtenOffQuantity: 0,
	...overrides
});

/**
 * Builds the change service over the real line, shipping, address, credit, transaction, history,
 * summary and totals services, all of them wired to one in-memory datastore.
 *
 * The core `adjustment` and `tax_line` ledgers belong to the promotion and tax packages, so they are
 * the only doubles: `findByOwner(ownerType, ownerId)` and nothing else.
 *
 * @param seeds The rows the order starts with.
 */
function orderFixture(seeds: { lines?: any[]; shippingMethods?: any[]; order?: Record<string, unknown> } = {}) {
	const tables: Record<string, any[]> = {};
	for (const table of TABLES) {
		tables[table] = [];
	}

	tables.order.push({
		id: 'order-1',
		channelId: 'channel-1',
		currency: 'USD',
		currencyDecimals: 2,
		status: OrderStatus.CONFIRMED,
		paymentStatus: OrderPaymentStatus.NOT_PAID,
		fulfillmentStatus: FulfillmentStatus.NOT_FULFILLED,
		version: 1,
		...seeds.order
	});
	tables.order_line.push(...(seeds.lines ?? []));
	tables.order_shipping_method.push(...(seeds.shippingMethods ?? []));

	const adjustments: any[] = [];
	const taxLines: any[] = [];
	const ledger = (rows: any[]) => ({
		findByOwner: async (ownerType: string, ownerId: string) =>
			rows.filter((row) => row.ownerType === ownerType && row.ownerId === ownerId)
	});
	const repo = (table: TableName) => repository(tables, table);
	const typeOrmOrderRepository = repo('order');
	// The order aggregate's version-predicated write resolves the service that owns the row by token,
	// so the fixture offers the totals writer the same two calls the real order service offers it.
	const orderWriter = {
		update: async (criteria: any, partial: any) => typeOrmOrderRepository.update(criteria, partial),
		findOneByIdString: async (id: any) => typeOrmOrderRepository.findOne({ where: { id } })
	};

	const totalsService = new OrderTotalsService(
		typeOrmOrderRepository as never,
		new OrderLineService(repo('order_line') as never, {} as never, {} as never) as never,
		new OrderShippingMethodService(repo('order_shipping_method') as never, {} as never) as never,
		new OrderCreditLineService(repo('order_credit_line') as never, {} as never) as never,
		new OrderTransactionService(repo('order_transaction') as never, {} as never) as never,
		new OrderSummaryService(repo('order_summary') as never, {} as never) as never,
		ledger(adjustments) as never,
		ledger(taxLines) as never,
		{ get: () => orderWriter } as never
	);
	const service = new OrderChangeService(
		repo('order_change') as never,
		{} as never,
		typeOrmOrderRepository as never,
		new OrderChangeActionService(repo('order_change_action') as never, {} as never),
		new OrderLineService(repo('order_line') as never, {} as never, {} as never),
		new OrderShippingMethodService(repo('order_shipping_method') as never, {} as never),
		new OrderAddressService(repo('order_address') as never, {} as never),
		new OrderCreditLineService(repo('order_credit_line') as never, {} as never),
		new OrderTransactionService(repo('order_transaction') as never, {} as never),
		new OrderHistoryService(repo('order_history') as never, {} as never),
		totalsService
	);

	return { service, totalsService, tables, adjustments, taxLines, order: tables.order[0] };
}

/** The timeline of the fixture order. */
const timelineOf = (fixture: ReturnType<typeof orderFixture>) =>
	fixture.tables.order_history.map((entry: any) => entry.action);

describe('OrderChangeService — the money a change moves (doc 10 §6.3, §6.6)', () => {
	it('adds a line and moves the grand total by exactly what the action describes', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });

		await fixture.totalsService.recompute('order-1', 'PLACED');
		expect(fixture.order.grandTotal).toBe(20);

		const change = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: [
				{
					action: OrderChangeActionType.ITEM_ADD,
					amount: 20,
					details: { title: 'An extra unit', quantity: 2, unitPrice: 10 }
				}
			]
		} as never);

		const applied = await fixture.service.confirm(change.id);

		expect(fixture.tables.order_line).toHaveLength(2);
		// `+ round(unitPrice * quantity)`: 20 + 20.
		expect(fixture.order.itemSubtotal).toBe(40);
		expect(fixture.order.grandTotal).toBe(40);
		// The change records the delta it applied, so an operator reads it without replaying actions.
		expect(applied.change.priceChange).toBe(20);
		expect(applied.change.status).toBe(OrderChangeStatus.APPLIED);
	});

	it('changes a line quantity and re-prices the order from the new quantity', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });

		await fixture.totalsService.recompute('order-1', 'PLACED');

		const change = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: [
				{
					action: OrderChangeActionType.ITEM_UPDATE,
					referenceId: 'L1',
					amount: 40,
					details: { orderLineId: 'L1', quantity: 3 }
				}
			]
		} as never);

		await fixture.service.confirm(change.id);

		// The unit price is not touched: an edit changes what was asked for, not what it costs.
		expect(fixture.tables.order_line[0]).toMatchObject({ quantity: 3, unitPrice: 20 });
		expect(fixture.order.grandTotal).toBe(60);
	});

	it('adds and then re-prices a delivery choice', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });

		await fixture.totalsService.recompute('order-1', 'PLACED');

		const added = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: [{ action: OrderChangeActionType.SHIPPING_ADD, details: { name: 'Flat', amount: 5 } }]
		} as never);

		await fixture.service.confirm(added.id);
		expect(fixture.order.shippingSubtotal).toBe(5);
		expect(fixture.order.grandTotal).toBe(25);

		const methodId = fixture.tables.order_shipping_method[0].id;
		const repriced = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: [
				{
					action: OrderChangeActionType.SHIPPING_UPDATE,
					referenceId: methodId,
					details: { orderShippingMethodId: methodId, amount: 8 }
				}
			]
		} as never);

		await fixture.service.confirm(repriced.id);

		expect(fixture.tables.order_shipping_method).toHaveLength(1);
		expect(fixture.order.shippingSubtotal).toBe(8);
		expect(fixture.order.grandTotal).toBe(28);
	});

	it('removes a delivery choice and takes its amount off the total', async () => {
		const fixture = orderFixture({
			lines: [line('L1', { quantity: 1, unitPrice: 20 })],
			shippingMethods: [{ id: 'S1', orderId: 'order-1', name: 'Flat', amount: 5, isTaxInclusive: false }]
		});

		await fixture.totalsService.recompute('order-1', 'PLACED');
		expect(fixture.order.grandTotal).toBe(25);

		const change = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: [
				{
					action: OrderChangeActionType.SHIPPING_REMOVE,
					referenceId: 'S1',
					details: { orderShippingMethodId: 'S1' }
				}
			]
		} as never);

		await fixture.service.confirm(change.id);

		expect(fixture.tables.order_shipping_method).toHaveLength(0);
		expect(fixture.order.shippingSubtotal).toBe(0);
		expect(fixture.order.grandTotal).toBe(20);
	});

	it('returns a line that a change created, leaving the total where it started', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });

		await fixture.totalsService.recompute('order-1', 'PLACED');

		const added = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: [
				{ action: OrderChangeActionType.ITEM_ADD, details: { title: 'Extra', quantity: 1, unitPrice: 5 } }
			]
		} as never);

		await fixture.service.confirm(added.id);
		expect(fixture.order.grandTotal).toBe(25);

		const createdLineId = fixture.tables.order_line[1].id;
		const removed = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: [
				{
					action: OrderChangeActionType.ITEM_REMOVE,
					referenceId: createdLineId,
					details: { orderLineId: createdLineId }
				}
			]
		} as never);

		await fixture.service.confirm(removed.id);

		expect(fixture.tables.order_line).toHaveLength(1);
		expect(fixture.order.grandTotal).toBe(20);
	});

	it('refuses to remove a line that has been fulfilled', async () => {
		const fixture = orderFixture({
			lines: [line('L1', { quantity: 3, unitPrice: 20, fulfilledQuantity: 1 })]
		});

		await fixture.totalsService.recompute('order-1', 'PLACED');

		const change = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: [
				{
					action: OrderChangeActionType.ITEM_REMOVE,
					referenceId: 'L1',
					details: { orderLineId: 'L1' }
				}
			]
		} as never);

		await expect(fixture.service.confirm(change.id)).rejects.toMatchObject({
			response: {
				code: 'ORDER_CHANGE_NOT_APPLICABLE',
				details: { orderLineId: 'L1', fulfilledQuantity: 1 }
			}
		});

		// A change that cannot be applied leaves the order alone: the line is still there, the change
		// is still pending, and nothing was recomputed on the strength of an action that never ran.
		expect(fixture.tables.order_line).toHaveLength(1);
		expect((await fixture.service.findOneByIdString(change.id)).status).toBe(OrderChangeStatus.PENDING);
		expect(fixture.order.grandTotal).toBe(60);
	});

	it('refuses an action that targets a line of another order', async () => {
		const fixture = orderFixture({
			lines: [line('L1', { quantity: 1, unitPrice: 20 }), line('L2', { orderId: 'order-2', quantity: 1, unitPrice: 20 })]
		});

		await fixture.totalsService.recompute('order-1', 'PLACED');

		const change = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: [
				{
					action: OrderChangeActionType.ITEM_UPDATE,
					referenceId: 'L2',
					details: { orderLineId: 'L2', quantity: 9 }
				}
			]
		} as never);

		// A change cannot reach across aggregates: the line is another order's, whatever its id says.
		await expect(fixture.service.confirm(change.id)).rejects.toThrow(/ORDER_LINE_NOT_FOUND/);
		expect(fixture.tables.order_line[1].quantity).toBe(1);
		expect(fixture.order.grandTotal).toBe(20);
	});

	it('refuses an action that names no line at all', async () => {
		const withoutReference = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });

		await withoutReference.totalsService.recompute('order-1', 'PLACED');

		const change = await withoutReference.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: [{ action: OrderChangeActionType.ITEM_UPDATE, details: { quantity: 9 } }]
		} as never);

		// The action carries no reference, so it is refused before any lookup happens.
		await expect(withoutReference.service.confirm(change.id)).rejects.toThrow(/ORDER_CHANGE_ACTION_INVALID/);

		const missing = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });

		await missing.totalsService.recompute('order-1', 'PLACED');

		const dangling = await missing.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: [
				{
					action: OrderChangeActionType.ITEM_UPDATE,
					referenceId: 'no-such-line',
					details: { orderLineId: 'no-such-line', quantity: 9 }
				}
			]
		} as never);

		// A line that does not exist is this service's own answer to give: the lookup reports nothing
		// rather than throwing its generic not-found, so the refusal is the documented 404
		// `ORDER_LINE_NOT_FOUND`, naming the order and the line (doc 06).
		const refusal = await missing.service.confirm(dangling.id).catch((error) => error);

		expect(refusal).toBeInstanceOf(NotFoundException);
		expect(refusal.message).toContain('ORDER_LINE_NOT_FOUND');
		expect(missing.order.grandTotal).toBe(20);
	});

	it('applies a credit line as one credit and one ledger row', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 100 })] });

		await fixture.totalsService.recompute('order-1', 'PLACED');

		const change = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.CREDIT,
			actions: [
				{
					action: OrderChangeActionType.CREDIT_LINE_ADD,
					amount: 5,
					details: { amount: 5, description: 'Goodwill', referenceType: 'manual' }
				}
			]
		} as never);

		await fixture.service.confirm(change.id);

		expect(fixture.tables.order_credit_line).toHaveLength(1);
		expect(fixture.tables.order_credit_line[0].amount).toBe(5);
		expect(fixture.tables.order_transaction).toHaveLength(1);
		// The ledger row is the *movement*, and a credit is money given back rather than money
		// received: `CREDIT` is a negative row (doc 10 §8.6). It therefore cannot be summed into
		// `paidTotal`, which takes only positive rows of the paid kinds (doc 07 §6.1 step 12) — the
		// credit line above is what reduces what the customer owes.
		expect(fixture.tables.order_transaction[0]).toMatchObject({ amount: -5, type: OrderTransactionType.CREDIT });
		expect(fixture.order.creditTotal).toBe(5);
	});

	// A credit is applied once and counted once. It is written twice — the credit line, which is what
	// `creditTotal` sums (doc 07 §6.1 step 11), and a ledger row recording the movement — but the
	// ledger row is negative (doc 10 §8.6), so `paidTotal` (step 12, positive rows only) leaves it out
	// and `outstandingTotal = grandTotal - creditTotal - paidTotal + refundedTotal` (step 14) subtracts
	// the credit exactly once. Written positive, the same 5.00 was subtracted twice: a 100.00 order
	// reported 90.00 outstanding, and a credit covering the order reported a negative outstanding
	// amount with `isPaymentSettled()` true.
	it('reduces the outstanding amount by the credit exactly once', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 100 })] });

		await fixture.totalsService.recompute('order-1', 'PLACED');

		const change = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.CREDIT,
			actions: [{ action: OrderChangeActionType.CREDIT_LINE_ADD, amount: 5, details: { amount: 5 } }]
		} as never);

		await fixture.service.confirm(change.id);

		expect(fixture.order.creditTotal).toBe(5);
		expect(fixture.order.paidTotal).toBe(0);
		expect(fixture.order.outstandingTotal).toBe(95);
	});

	it('accumulates partial quantities on a line, reaching the target exactly once', async () => {
		// The order line is the only place this package keeps a partial quantity, so this is where
		// "half the line, then the other half" is decided: the parts must add to the whole exactly, not
		// overshoot it and not overwrite each other.
		const fixture = orderFixture({ lines: [line('L1', { quantity: 5, unitPrice: 20 })] });

		await fixture.totalsService.recompute('order-1', 'PLACED');

		const writeOff = async (quantity: number) => {
			const change = await fixture.service.create({
				orderId: 'order-1',
				changeType: OrderChangeType.EDIT,
				actions: [
					{
						action: OrderChangeActionType.WRITE_OFF_ITEM,
						referenceId: 'L1',
						details: { orderLineId: 'L1', quantity }
					}
				]
			} as never);

			return fixture.service.confirm(change.id);
		};

		await writeOff(3);

		expect(fixture.tables.order_line[0].writtenOffQuantity).toBe(3);
		// Two of the five units are still owed.
		expect(await fixture.totalsService.hasOpenShippableLines(fixture.order as never)).toBe(true);
		expect(fixture.order.fulfillmentStatus).toBe(FulfillmentStatus.NOT_FULFILLED);

		await writeOff(2);

		expect(fixture.tables.order_line[0].writtenOffQuantity).toBe(5);
		// `netTarget = 5 - 5 = 0`: every unit is accounted for, exactly once.
		expect(await fixture.totalsService.hasOpenShippableLines(fixture.order as never)).toBe(false);
		expect(fixture.order.fulfillmentStatus).toBe(FulfillmentStatus.FULFILLED);
		// Giving a unit up decides that it is not owed; it does not change what the order cost.
		expect(fixture.order.grandTotal).toBe(100);
	});

	it('accumulates partial return requests on a line without touching the money', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 4, unitPrice: 20 })] });

		await fixture.totalsService.recompute('order-1', 'PLACED');

		const request = async (quantity: number) => {
			const change = await fixture.service.create({
				orderId: 'order-1',
				changeType: OrderChangeType.RETURN,
				actions: [
					{
						action: OrderChangeActionType.ITEM_RETURN,
						referenceId: 'L1',
						details: { orderLineId: 'L1', quantity }
					}
				]
			} as never);

			return fixture.service.confirm(change.id);
		};

		await request(1);
		await request(2);

		// The second request adds to the first rather than replacing it.
		expect(fixture.tables.order_line[0].returnRequestedQuantity).toBe(3);
		// A requested return is not a refund: the refund happens when the units are received, which is
		// the returns package's step, so the order's money has not moved yet.
		expect(fixture.order.grandTotal).toBe(80);
		expect(fixture.order.refundedTotal).toBe(0);
	});

	it('records a note on the order timeline without touching the totals', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });

		await fixture.totalsService.recompute('order-1', 'PLACED');

		const change = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: [
				{
					action: OrderChangeActionType.NOTE_ADD,
					details: { title: 'Called the buyer', description: 'Confirmed the address' }
				}
			]
		} as never);

		await fixture.service.confirm(change.id);

		// The note is written while the action runs, so it lands on the timeline *before* the change's
		// own confirmation — the timeline reads as a record of what happened, in the order it happened.
		expect(timelineOf(fixture)).toEqual(['CHANGE_REQUESTED', 'NOTE_ADDED', 'CHANGE_CONFIRMED']);
		expect(fixture.order.grandTotal).toBe(20);
	});

	it('updates the mutable order properties through a change', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });

		await fixture.totalsService.recompute('order-1', 'PLACED');

		const change = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: [
				{
					action: OrderChangeActionType.UPDATE_ORDER_PROPERTIES,
					details: { email: 'buyer@example.com', note: 'Leave at reception' }
				}
			]
		} as never);

		await fixture.service.confirm(change.id);

		expect(fixture.order).toMatchObject({ email: 'buyer@example.com', note: 'Leave at reception' });
	});

	it('writes the new address when the order has none and updates it when it has', async () => {
		const fixture = orderFixture({
			lines: [line('L1', { quantity: 1, unitPrice: 20 })],
			order: {}
		});

		await fixture.totalsService.recompute('order-1', 'PLACED');

		const create = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: [
				{
					action: OrderChangeActionType.ADDRESS_UPDATE,
					details: { type: AddressType.SHIPPING, address: { city: 'London' } }
				}
			]
		} as never);

		await fixture.service.confirm(create.id);
		expect(fixture.tables.order_address).toHaveLength(1);
		expect(fixture.tables.order_address[0]).toMatchObject({ type: AddressType.SHIPPING, city: 'London' });

		const update = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: [
				{
					action: OrderChangeActionType.ADDRESS_UPDATE,
					details: { type: AddressType.SHIPPING, address: { city: 'Cambridge' } }
				}
			]
		} as never);

		await fixture.service.confirm(update.id);
		// One address per type: a second update replaces it rather than stacking a second row.
		expect(fixture.tables.order_address).toHaveLength(1);
		expect(fixture.tables.order_address[0].city).toBe('Cambridge');
	});
});

describe('OrderChangeService — the record a change leaves (doc 10 §6.6)', () => {
	it('marks every action applied, with the instant it was applied', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });

		await fixture.totalsService.recompute('order-1', 'PLACED');

		const change = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: [
				{ action: OrderChangeActionType.ITEM_UPDATE, referenceId: 'L1', details: { orderLineId: 'L1', note: 'gift' } },
				{ action: OrderChangeActionType.SHIPPING_ADD, details: { name: 'Flat', amount: 5 } }
			]
		} as never);

		// Submitted order is preserved as `ordering`, which is the order the actions run in.
		expect(fixture.tables.order_change_action.map((action: any) => action.ordering)).toEqual([0, 1]);
		expect(fixture.tables.order_change_action.every((action: any) => action.applied === false)).toBe(true);

		const applied = await fixture.service.confirm(change.id);

		expect(fixture.tables.order_change_action.every((action: any) => action.applied === true)).toBe(true);
		expect(fixture.tables.order_change_action.every((action: any) => action.appliedAt instanceof Date)).toBe(true);
		// A stable order, so a reader can see what the change did in the sequence it did it.
		expect(applied.change.actions?.map((action: any) => action.ordering)).toEqual([0, 1]);
	});

	it('records the request and the confirmation on the order timeline', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });

		await fixture.totalsService.recompute('order-1', 'PLACED');

		const change = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: [{ action: OrderChangeActionType.ITEM_ADD, details: { title: 'X', quantity: 1, unitPrice: 1 } }]
		} as never);

		expect(timelineOf(fixture)).toEqual(['CHANGE_REQUESTED']);

		await fixture.service.confirm(change.id);

		expect(timelineOf(fixture)).toEqual(['CHANGE_REQUESTED', 'CHANGE_CONFIRMED']);

		for (const entry of fixture.tables.order_history) {
			expect(entry.orderId).toBe('order-1');
			expect(entry.metadata).toMatchObject({ changeId: change.id, changeType: OrderChangeType.EDIT });
		}
	});

	it('bumps the order version once, through the totals writer, and leaves the change announcing it', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });

		await fixture.totalsService.recompute('order-1', 'PLACED');

		const change = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: [{ action: OrderChangeActionType.ITEM_ADD, details: { title: 'X', quantity: 1, unitPrice: 1 } }]
		} as never);

		// The change announces the version it will produce: the order stands at version 2 after
		// placement, so applying this change commits version 3.
		expect(change.version).toBe(fixture.order.version + 1);

		await fixture.service.confirm(change.id);

		// One committed version, and one summary row describing it.
		expect(fixture.order.version).toBe(3);
		expect(fixture.tables.order_summary.map((summary: any) => summary.version)).toEqual([2, 3]);
		expect(fixture.tables.order_summary[1].reason).toBe('CHANGE_CONFIRMED');

		// The change's version is not a lock and is never incremented: it still says which order version
		// the change produced, which is the one fact the column is named for and the one the index over
		// it answers. A change has no version of its own — the order's is the aggregate's lock.
		expect(fixture.tables.order_change[0].version).toBe(change.version);
		expect(fixture.tables.order_change[0].version).toBe(fixture.order.version);
	});

	it('refuses a decision based on an order version that has moved on, and writes nothing', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });

		await fixture.totalsService.recompute('order-1', 'PLACED');

		const change = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: [{ action: OrderChangeActionType.ITEM_ADD, details: { title: 'X', quantity: 1, unitPrice: 1 } }]
		} as never);
		const readAt = fixture.order.version;

		// Another caller moved the order on — a payment reconciled, a line fulfilled — while this one
		// still held the version it read. The decision is refused by the order's own conditional update,
		// which is the aggregate's lock, and the refusal happens before the change is written.
		await fixture.totalsService.recompute('order-1', 'PAYMENT_RECONCILED');

		await expect(
			fixture.service.decline(change.id, 'Out of policy', { wildcard: false, versions: [readAt] })
		).rejects.toMatchObject({ code: 'ENTITY_VERSION_CONFLICT', status: 409 });

		expect(fixture.tables.order_change[0].status).toBe(OrderChangeStatus.PENDING);
		expect(fixture.tables.order_change[0].declinedAt).toBeUndefined();

		// The version the caller actually holds is accepted: the change is written under the order write
		// that proved it.
		const declined = await fixture.service.decline(change.id, 'Out of policy', {
			wildcard: false,
			versions: [fixture.order.version]
		});

		expect(declined.status).toBe(OrderChangeStatus.DECLINED);
		expect(fixture.order.version).toBe(readAt + 2);
	});

	it('refuses a confirmation based on a stale order version before it applies anything', async () => {
		// `confirm` applies every action and only then reaches the version-predicated write of the order,
		// so a refusal that arrives from that write arrives *after* the change has landed. The check is
		// therefore made first, and this case is what holds it there.
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });

		await fixture.totalsService.recompute('order-1', 'PLACED');

		const change = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: [{ action: OrderChangeActionType.ITEM_ADD, details: { title: 'X', quantity: 1, unitPrice: 1 } }]
		} as never);
		const readAt = fixture.order.version;
		const linesBefore = fixture.tables.order_line.length;

		// Another caller moved the order on while this one still held the version it read.
		await fixture.totalsService.recompute('order-1', 'PAYMENT_RECONCILED');

		await expect(fixture.service.confirm(change.id, { wildcard: false, versions: [readAt] })).rejects.toMatchObject({
			code: 'ENTITY_VERSION_CONFLICT',
			status: 409
		});

		// Control: the action was not applied, the line it would have added is not there, and the change
		// is still open — a caller told nothing happened must not be reading half an applied change.
		expect(fixture.tables.order_line).toHaveLength(linesBefore);
		expect(fixture.tables.order_change[0].status).toBe(OrderChangeStatus.PENDING);
		expect(fixture.tables.order_change_action[0].applied).toBe(false);
	});

	it('refuses to apply a change twice, and refuses one that was declined', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });

		await fixture.totalsService.recompute('order-1', 'PLACED');

		const applied = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: [{ action: OrderChangeActionType.ITEM_ADD, details: { title: 'X', quantity: 1, unitPrice: 1 } }]
		} as never);

		await fixture.service.confirm(applied.id);
		await expect(fixture.service.confirm(applied.id)).rejects.toThrow(/ORDER_CHANGE_ALREADY_APPLIED/);
		// The second attempt did not add a second line.
		expect(fixture.tables.order_line).toHaveLength(2);

		const declined = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.RETURN,
			actions: [{ action: OrderChangeActionType.ITEM_RETURN, referenceId: 'L1', details: { orderLineId: 'L1', quantity: 1 } }]
		} as never);

		await fixture.service.decline(declined.id, 'Out of policy');
		await expect(fixture.service.confirm(declined.id)).rejects.toThrow(/ORDER_CHANGE_NOT_APPLICABLE/);
		expect(fixture.tables.order_change[1].metadata).toMatchObject({ declineReason: 'Out of policy' });
	});
});

describe('OrderChangeService — exclusivity and validation (doc 10 §6.2, §6.4)', () => {
	it('refuses a second change while one holds the order', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });
		const action = [{ action: OrderChangeActionType.ITEM_ADD, details: { title: 'X', quantity: 1, unitPrice: 1 } }];

		const first = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: action
		} as never);

		await expect(
			fixture.service.create({ orderId: 'order-1', changeType: OrderChangeType.EDIT, actions: action } as never)
		).rejects.toMatchObject({
			response: {
				code: 'ORDER_CHANGE_IN_PROGRESS',
				details: { changeId: first.id, status: OrderChangeStatus.PENDING }
			}
		});
		expect(fixture.tables.order_change).toHaveLength(1);
	});

	it('releases the slot when a change is applied, declined or cancelled', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });
		const request = () =>
			fixture.service.create({
				orderId: 'order-1',
				changeType: OrderChangeType.EDIT,
				actions: [{ action: OrderChangeActionType.NOTE_ADD, details: { title: 'note' } }]
			} as never);

		const applied = await request();
		await fixture.service.confirm(applied.id);
		const declined = await request();
		await fixture.service.decline(declined.id);
		const cancelled = await request();
		await fixture.service.cancel(cancelled.id);

		expect(fixture.tables.order_change.map((change: any) => change.status)).toEqual([
			OrderChangeStatus.APPLIED,
			OrderChangeStatus.DECLINED,
			OrderChangeStatus.CANCELED
		]);
		expect(await fixture.service.findOpenForOrder('order-1')).toEqual([]);
		// The slot is free again.
		await expect(request()).resolves.toMatchObject({ orderId: 'order-1' });
	});

	it('asks for approval on anything that is not a staff edit', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });
		const note = [{ action: OrderChangeActionType.NOTE_ADD, details: { title: 'note' } }];

		const edit = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: note
		} as never);
		await fixture.service.decline(edit.id);

		// A return asks for a decision; a staff edit that holds the permission does not.
		const returned = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.RETURN,
			actions: note
		} as never);
		await fixture.service.decline(returned.id);

		const gated = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			metadata: { requireApproval: true },
			actions: note
		} as never);

		expect(edit.status).toBe(OrderChangeStatus.PENDING);
		expect(returned.status).toBe(OrderChangeStatus.REQUESTED);
		expect(gated.status).toBe(OrderChangeStatus.REQUESTED);
	});

	it('refuses a change with no actions and a change against an archived order', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });

		await expect(
			fixture.service.create({ orderId: 'order-1', changeType: OrderChangeType.EDIT, actions: [] } as never)
		).rejects.toThrow(/ORDER_CHANGE_EMPTY/);

		fixture.order.status = OrderStatus.ARCHIVED;

		await expect(
			fixture.service.create({
				orderId: 'order-1',
				changeType: OrderChangeType.EDIT,
				actions: [{ action: OrderChangeActionType.NOTE_ADD, details: { title: 'note' } }]
			} as never)
		).rejects.toThrow(/ORDER_ARCHIVED/);
	});

	it('refuses a fulfilment action rather than recording one it cannot apply', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 2, unitPrice: 20 })] });

		// The fulfilment package is not installed alongside this one, and an operator who believed a
		// shipment had been created would not ship the order at all.
		await expect(
			fixture.service.create({
				orderId: 'order-1',
				changeType: OrderChangeType.EDIT,
				actions: [
					{
						action: OrderChangeActionType.FULFILLMENT_CREATE,
						referenceId: 'L1',
						details: { lines: [{ orderLineId: 'L1', quantity: 1 }] }
					}
				]
			} as never)
		).rejects.toMatchObject({
			response: {
				code: 'ORDER_CHANGE_ACTION_NOT_SUPPORTED',
				details: { action: OrderChangeActionType.FULFILLMENT_CREATE }
			}
		});

		expect(fixture.tables.order_change).toHaveLength(0);
		expect(fixture.tables.order_change_action).toHaveLength(0);
	});

	it('refuses a change that removes a line and fulfils the same line', async () => {
		// The actions are validated as a **set**, and a self-contradicting set is refused as such
		// before the owner of an action is consulted: "a fulfilment cannot reference a line that the
		// same change removes" is true whoever applies it, so the caller hears about its own change
		// rather than only that the fulfilment package is missing.
		const fixture = orderFixture({ lines: [line('L1', { quantity: 2, unitPrice: 20 })] });

		await expect(
			fixture.service.create({
				orderId: 'order-1',
				changeType: OrderChangeType.EDIT,
				actions: [
					{ action: OrderChangeActionType.ITEM_REMOVE, referenceId: 'L1', details: { orderLineId: 'L1' } },
					{
						action: OrderChangeActionType.FULFILLMENT_CREATE,
						referenceId: 'L1',
						details: { lines: [{ orderLineId: 'L1', quantity: 1 }] }
					}
				]
			} as never)
		).rejects.toMatchObject({
			response: {
				code: 'ORDER_CHANGE_ACTIONS_INCONSISTENT',
				details: { orderLineId: 'L1' }
			}
		});

		// Nothing was recorded against the order, and the line the change would have removed is there.
		expect(fixture.tables.order_change).toHaveLength(0);
		expect(fixture.tables.order_line).toHaveLength(1);
	});

	it('refuses a cancelled order a further fulfilment link', async () => {
		const fixture = orderFixture({
			lines: [line('L1', { quantity: 2, unitPrice: 20 })],
			order: { status: OrderStatus.CANCELED, fulfillmentStatus: FulfillmentStatus.CANCELED }
		});

		await expect(
			fixture.service.create({
				orderId: 'order-1',
				changeType: OrderChangeType.EDIT,
				actions: [
					{
						action: OrderChangeActionType.FULFILLMENT_CREATE,
						referenceId: 'L1',
						details: { lines: [{ orderLineId: 'L1', quantity: 1 }] }
					}
				]
			} as never)
		).rejects.toMatchObject({
			response: {
				code: 'ORDER_CHANGE_ACTION_NOT_SUPPORTED',
				details: { action: OrderChangeActionType.FULFILLMENT_CREATE, owner: '@gauzy/plugin-fulfillment' }
			}
		});

		// Nothing was recorded against the cancelled order, and its state is untouched.
		expect(fixture.tables.order_change).toHaveLength(0);
		expect(fixture.order).toMatchObject({
			status: OrderStatus.CANCELED,
			fulfillmentStatus: FulfillmentStatus.CANCELED
		});
		expect(fixture.tables.order_line[0].fulfilledQuantity).toBe(0);
	});

	it('cancels only the stale changes that still hold the slot', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });
		const note = [{ action: OrderChangeActionType.NOTE_ADD, details: { title: 'note' } }];

		const stale = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: note
		} as never);
		// Requested two days ago: past the 24-hour window the job sweeps at.
		fixture.tables.order_change[0].requestedAt = new Date(Date.now() - 48 * 60 * 60 * 1000);
		await fixture.service.cancel(stale.id);

		const fresh = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: note
		} as never);
		await fixture.service.decline(fresh.id);

		const older = await fixture.service.create({
			orderId: 'order-1',
			changeType: OrderChangeType.EDIT,
			actions: note
		} as never);
		fixture.tables.order_change[2].requestedAt = new Date(Date.now() - 48 * 60 * 60 * 1000);

		const swept = await fixture.service.cancelStaleChanges(24);

		expect(swept).toEqual([older.id]);
		expect(fixture.tables.order_change[2].status).toBe(OrderChangeStatus.CANCELED);
		// A terminal change is never swept, however old it is.
		expect(fixture.tables.order_change[1].status).toBe(OrderChangeStatus.DECLINED);
		expect(await fixture.service.findOpenForOrder('order-1')).toEqual([]);
	});
});
