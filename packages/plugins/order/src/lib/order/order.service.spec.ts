/**
 * Three module boundaries are doubled here, for the same reason and in the same way.
 *
 * `@gauzy/core` boots the whole application graph from its barrel, and `@gauzy/plugin-cart`'s barrel
 * re-exports the cart plugin class, which imports the catalogue plugin, which imports the rest of the
 * marketplace — so reading one totals function would otherwise load every package on the platform.
 * Both seams are therefore doubled at the module boundary, exactly as the docs package's service
 * specs do, and **the service under test is the real one**, including the totals writer every
 * lifecycle move ends in.
 */
jest.mock('@gauzy/plugin-cart', () => ({
	TotalsCalculator: jest.requireActual('@gauzy/plugin-cart/src/lib/totals/totals-calculator').TotalsCalculator
}));

jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class TenantAwareCrudService {
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
			}

			return this.typeOrmRepository.update(id, partial);
		}

		async delete(criteria: any): Promise<any> {
			return this.typeOrmRepository.delete(criteria);
		}
	}

	return {
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
		SequenceService: class {}
	};
});

import {
	AddressType,
	CommerceCartStatus,
	FulfillmentStatus,
	OrderChangeStatus,
	OrderPaymentStatus,
	OrderStatus,
	OrderTransactionType
} from '@gauzy/contracts';
import { OrderAddressService } from '../order-address/order-address.service';
import { OrderHistoryService } from '../order-history/order-history.service';
import { OrderLineService } from '../order-line/order-line.service';
import { OrderShippingMethodService } from '../order-shipping-method/order-shipping-method.service';
import { OrderSummaryService } from '../order-summary/order-summary.service';
import { OrderTotalsService } from '../order-totals/order-totals.service';
import { OrderTransactionService } from '../order-transaction/order-transaction.service';
import { OrderCreditLineService } from '../order-credit-line/order-credit-line.service';
import { OrderService } from './order.service';

/**
 * The order aggregate's lifecycle.
 *
 * Everything an order may have done to it goes through this service, and each move is a status
 * transition followed by one recomputation — never two writes that a reader could observe apart. The
 * suite pins the properties the specification fixes:
 *
 * - a draft is numbered by the platform's sequence service and is the only status in which the order
 *   itself is freely editable (doc 10 §4.4, §7.1);
 * - placing, confirming, cancelling and archiving each move the order exactly one step and record it
 *   on the timeline (doc 10 §5.2, §5.4);
 * - **a cancelled order is terminal**: it refuses to be placed, confirmed or completed, so a late
 *   authorisation or capture cannot drive it back into the fulfilment path (doc 10 §5.2, §13.1);
 * - a placed order is changed through an order change, and an update that tries to edit one directly
 *   is refused **with the endpoint that would have accepted it** (doc 10 §6.1);
 * - an order completes only when every shippable line is fulfilled, the money side is settled and no
 *   change is open.
 *
 * One case pins the checkout path itself: a completed cart becomes a **confirmed** order, through the
 * two documented steps — `create-order` inserts it as `DRAFT` (doc 10 §3.4 step 4) and `commit-order`
 * places it as `PENDING` (step 8) — because `DRAFT -> CONFIRMED` is not a move §5.2 contains.
 */

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

const RELATIONS: Record<string, Record<string, { table: TableName; foreignKey: string }>> = {
	order: {
		lines: { table: 'order_line', foreignKey: 'orderId' },
		shippingMethods: { table: 'order_shipping_method', foreignKey: 'orderId' },
		addresses: { table: 'order_address', foreignKey: 'orderId' },
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
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => row.id === id);

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
 * Builds the order service over the real line, shipping, address, history, summary and totals
 * services, all wired to one in-memory datastore.
 *
 * Two collaborators are doubles rather than real services because they belong to other domains: the
 * numbering sequence is a kernel capability, and the open-change lookup is answered by the change
 * service, which has its own suite.
 *
 * @param seeds The rows the order starts with.
 */
function orderFixture(seeds: { lines?: any[]; order?: Record<string, unknown> } = {}) {
	const tables: Record<string, any[]> = {};
	for (const table of TABLES) {
		tables[table] = [];
	}

	tables.order.push({
		id: 'order-1',
		number: 'ORD-000123',
		displayId: 'ORD-000123',
		channelId: 'channel-1',
		currency: 'USD',
		currencyDecimals: 2,
		status: OrderStatus.PENDING,
		paymentStatus: OrderPaymentStatus.NOT_PAID,
		fulfillmentStatus: FulfillmentStatus.NOT_FULFILLED,
		version: 1,
		...seeds.order
	});
	tables.order_line.push(...(seeds.lines ?? []));

	const repo = (table: TableName) => repository(tables, table);
	const typeOrmOrderRepository = repo('order');
	const totalsService = new OrderTotalsService(
		typeOrmOrderRepository as never,
		new OrderLineService(repo('order_line') as never, {} as never) as never,
		new OrderShippingMethodService(repo('order_shipping_method') as never, {} as never) as never,
		new OrderCreditLineService(repo('order_credit_line') as never, {} as never) as never,
		new OrderTransactionService(repo('order_transaction') as never, {} as never) as never,
		new OrderSummaryService(repo('order_summary') as never, {} as never) as never,
		{ findByOwner: async () => [] } as never,
		{ findByOwner: async () => [] } as never
	);
	const allocate = jest.fn(async () => ({ formatted: 'ORD-000124', value: 124, key: 'ORDER' }));
	const openChanges: any[] = [];
	const sequenceService = { allocate };
	const changeService = { findOpenForOrder: jest.fn(async () => openChanges) };
	const service = new OrderService(
		typeOrmOrderRepository as never,
		{} as never,
		totalsService,
		new OrderLineService(repo('order_line') as never, {} as never),
		new OrderAddressService(repo('order_address') as never, {} as never),
		new OrderShippingMethodService(repo('order_shipping_method') as never, {} as never),
		new OrderHistoryService(repo('order_history') as never, {} as never),
		changeService as never,
		sequenceService as never
	);

	return { service, totalsService, tables, order: tables.order[0], allocate, openChanges, changeService };
}

/** The timeline of the fixture order. */
const timelineOf = (fixture: ReturnType<typeof orderFixture>) =>
	fixture.tables.order_history.map((entry: any) => entry.action);

describe('OrderService — creating and numbering (doc 10 §4.4, §7.1)', () => {
	it('allocates the number from the platform sequence and starts the order as a draft', async () => {
		const fixture = orderFixture();

		const created = await fixture.service.create({ channelId: 'channel-1', currency: 'USD' } as never);

		// Document numbering is a kernel capability shared with returns, purchase orders and payment
		// collections; a bespoke counter here would be a second answer to the same question.
		expect(fixture.allocate).toHaveBeenCalledWith('ORDER', { channelId: 'channel-1' });
		expect(created.number).toBe('ORD-000124');
		expect(created).toMatchObject({ status: OrderStatus.DRAFT, isDraft: true, currencyDecimals: 2 });
		expect(created.version).toBe(2);
	});

	it('takes a caller-supplied number instead of allocating one', async () => {
		// Control: the numbering sequence is a finite, gap-tolerant resource; consuming one for a
		// number the caller already stated would burn it for nothing.
		const fixture = orderFixture();

		const created = await fixture.service.create({
			channelId: 'channel-1',
			currency: 'USD',
			number: 'MANUAL-7'
		} as never);

		expect(fixture.allocate).not.toHaveBeenCalled();
		expect(created).toMatchObject({ number: 'MANUAL-7', displayId: 'MANUAL-7' });
	});

	it('refuses an order with no channel and an order with no currency', async () => {
		const fixture = orderFixture();

		await expect(fixture.service.create({ currency: 'USD' } as never)).rejects.toThrow(
			/ORDER_CHANNEL_REQUIRED/
		);
		await expect(fixture.service.create({ channelId: 'channel-1' } as never)).rejects.toThrow(
			/ORDER_CURRENCY_REQUIRED/
		);
	});

	it('refuses to build an order from a cart that already became one', async () => {
		const fixture = orderFixture();

		await expect(
			fixture.service.createFromCart({
				id: 'cart-1',
				channelId: 'channel-1',
				currency: 'USD',
				status: CommerceCartStatus.COMPLETED,
				orderId: 'order-9'
			} as never)
		).rejects.toThrow(/CART_ALREADY_COMPLETED/);
		expect(fixture.tables.order).toHaveLength(1);
	});

	// The checkout path, end to end: the documented route out of a cart is `DRAFT` (create-order,
	// doc 10 §3.4 step 4) then `PENDING` with its `placedAt` (commit-order, step 8), and only then the
	// `PENDING -> CONFIRMED` row of the transition table (§5.2). `DRAFT -> CONFIRMED` is a move the
	// table does not contain, so a checkout that asked for it failed — after having written the draft
	// order, its lines and its addresses — on every attempt.
	it('places an order from a completed cart, confirmed and carrying the cart lines', async () => {
		const fixture = orderFixture();

		const order = await fixture.service.createFromCart({
			id: 'cart-1',
			channelId: 'channel-1',
			currency: 'USD',
			currencyDecimals: 2,
			customerId: 'customer-1',
			email: 'buyer@example.com',
			status: CommerceCartStatus.ACTIVE,
			lines: [{ productId: 'p1', variantId: 'v1', title: 'A', quantity: 2, unitPrice: 20 }]
		} as never);

		expect(order.status).toBe(OrderStatus.CONFIRMED);
		expect(order.isDraft).toBe(false);
		expect(order.cartId).toBe('cart-1');
		expect(order.grandTotal).toBe(40);
		expect(fixture.tables.order_line).toHaveLength(1);
		expect(timelineOf(fixture)).toContain('ORDER_PLACED');
		// The placement is recorded once: the move through `PENDING` is what writes it.
		expect(timelineOf(fixture).filter((action: string) => action === 'ORDER_PLACED')).toHaveLength(1);
	});

	it('copies the cart address snapshots onto the order, one row per type', async () => {
		const fixture = orderFixture();

		// The snapshot is written while the order is built, and each one is written under its own
		// address type so a later update replaces the right one.
		const order = await fixture.service.createFromCart({
			id: 'cart-1',
			channelId: 'channel-1',
			currency: 'USD',
			currencyDecimals: 2,
			status: CommerceCartStatus.ACTIVE,
			shippingAddressSnapshot: { city: 'London' },
			billingAddressSnapshot: { city: 'Cambridge' },
			lines: [{ productId: 'p1', variantId: 'v1', title: 'A', quantity: 1, unitPrice: 20 }]
		} as never);

		const addresses = fixture.tables.order_address;
		expect(addresses.map((address: any) => address.type)).toEqual([AddressType.SHIPPING, AddressType.BILLING]);
		expect(addresses[0].city).toBe('London');
		expect(addresses[1].city).toBe('Cambridge');
		expect(addresses.every((address: any) => address.orderId === order.id)).toBe(true);
	});

	it('answers whether a cart may become an order, from its own status', () => {
		const fixture = orderFixture();
		const statuses: Record<string, boolean> = {
			[CommerceCartStatus.ACTIVE]: true,
			[CommerceCartStatus.ABANDONED]: true,
			[CommerceCartStatus.COMPLETED]: false,
			[CommerceCartStatus.MERGED]: false,
			[CommerceCartStatus.EXPIRED]: false
		};

		for (const status of Object.keys(statuses)) {
			expect({ status, allowed: fixture.service.canCreateFromCart({ status } as never) }).toEqual({
				status,
				allowed: statuses[status]
			});
		}
	});
});

describe('OrderService — the lifecycle moves (doc 10 §5.2, §5.4)', () => {
	it('places a draft, timestamping it and recording it on the timeline', async () => {
		const fixture = orderFixture({
			lines: [line('L1', { quantity: 1, unitPrice: 20 })],
			order: { status: OrderStatus.DRAFT, isDraft: true }
		});

		const placed = await fixture.service.place('order-1');

		expect(placed.status).toBe(OrderStatus.PENDING);
		expect(placed.placedAt).toBeInstanceOf(Date);
		expect(placed.isDraft).toBe(false);
		expect(timelineOf(fixture)).toEqual(['ORDER_PLACED']);
		// The totals are recomputed as part of the same move, so the status and the totals cannot be
		// read apart.
		expect(placed.grandTotal).toBe(20);
		expect(fixture.tables.order_summary[fixture.tables.order_summary.length - 1].reason).toBe('PLACED');
	});

	it('refuses to place an order that has nothing on it', async () => {
		const fixture = orderFixture({ order: { status: OrderStatus.DRAFT } });

		await expect(fixture.service.place('order-1')).rejects.toThrow(/ORDER_EMPTY/);
		// The refusal did not move the order.
		expect(fixture.order.status).toBe(OrderStatus.DRAFT);
		expect(timelineOf(fixture)).toEqual([]);
	});

	it('confirms a placed order and records it', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });

		const confirmed = await fixture.service.confirm('order-1', 'STAFF');

		expect(confirmed.status).toBe(OrderStatus.CONFIRMED);
		expect(timelineOf(fixture)).toEqual(['ORDER_CONFIRMED']);
	});

	it('confirms only the money states the specification names', async () => {
		// §5.2 confirms out of `AUTHORIZED`, `CAPTURED` or `NOT_PAID` and nothing else, so the money
		// state the guard reads has to be the order's real one. The row's stored `paymentStatus` is
		// deliberately left at `NOT_PAID` in every fixture below: a confirmation that trusted it
		// instead of the ledger would confirm an order whose capture is still partial.
		const captured = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });
		captured.tables.order_transaction.push({
			orderId: 'order-1',
			amount: 20,
			type: OrderTransactionType.CAPTURE
		});

		const authorised = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });
		authorised.tables.order_transaction.push({
			orderId: 'order-1',
			amount: 20,
			type: OrderTransactionType.AUTHORIZATION
		});

		const partlyCaptured = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });
		partlyCaptured.tables.order_transaction.push({
			orderId: 'order-1',
			amount: 5,
			type: OrderTransactionType.CAPTURE
		});

		expect((await captured.service.confirm('order-1', 'SYSTEM')).status).toBe(OrderStatus.CONFIRMED);
		expect((await authorised.service.confirm('order-1', 'SYSTEM')).status).toBe(OrderStatus.CONFIRMED);

		await expect(partlyCaptured.service.confirm('order-1', 'SYSTEM')).rejects.toMatchObject({
			response: {
				code: 'ORDER_STATUS_TRANSITION_INVALID',
				details: { from: OrderStatus.PENDING, to: OrderStatus.CONFIRMED }
			}
		});
		expect(partlyCaptured.order.status).toBe(OrderStatus.PENDING);
		expect(partlyCaptured.tables.order_history).toEqual([]);
	});

	it('refuses to confirm while a change is open on the order', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });

		fixture.openChanges.push({ id: 'change-1', status: OrderChangeStatus.REQUESTED });

		// The refusal names the code and the set the caller could have asked for instead, because an
		// error that only says "no" cannot be acted on.
		await expect(fixture.service.confirm('order-1', 'STAFF')).rejects.toMatchObject({
			response: {
				code: 'ORDER_STATUS_TRANSITION_INVALID',
				details: { from: OrderStatus.PENDING, to: OrderStatus.CONFIRMED, allowed: [OrderStatus.CONFIRMED, OrderStatus.REQUIRES_ACTION, OrderStatus.CANCELED] }
			}
		});
		expect(fixture.order.status).toBe(OrderStatus.PENDING);
	});

	it('cancels an unshipped order with a reason and then archives it', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });

		const cancelled = await fixture.service.cancel('order-1', 'Customer changed their mind');

		expect(cancelled.status).toBe(OrderStatus.CANCELED);
		expect(cancelled.canceledAt).toBeInstanceOf(Date);
		expect(cancelled.cancelReason).toBe('Customer changed their mind');
		expect(fixture.tables.order_history[0]).toMatchObject({
			action: 'ORDER_CANCELED',
			metadata: { reason: 'Customer changed their mind' }
		});

		// Archival is the only move a cancelled order has left, and it is a staff or system move.
		const archived = await fixture.service.archive('order-1');

		expect(archived.status).toBe(OrderStatus.ARCHIVED);
		expect(archived.isArchived).toBe(true);
		expect(archived.archivedAt).toBeInstanceOf(Date);
	});

	it('refuses to cancel an order anything has shipped from', async () => {
		// Once something is on its way the only ways back are a return and a claim, so a cancellation
		// here would void a sale the customer is about to receive.
		for (const fulfillmentStatus of [FulfillmentStatus.PARTIALLY_FULFILLED, FulfillmentStatus.FULFILLED]) {
			const fixture = orderFixture({
				lines: [line('L1', { quantity: 1, unitPrice: 20 })],
				order: { status: OrderStatus.PROCESSING, fulfillmentStatus }
			});

			await expect(fixture.service.cancel('order-1')).rejects.toMatchObject({
				response: {
					code: 'ORDER_STATUS_TRANSITION_INVALID',
					details: { from: OrderStatus.PROCESSING, to: OrderStatus.CANCELED }
				}
			});
			expect({ fulfillmentStatus, status: fixture.order.status }).toEqual({
				fulfillmentStatus,
				status: OrderStatus.PROCESSING
			});
		}
	});

	it('refuses every further move of a cancelled order', async () => {
		// The property a late authorisation or capture must not be able to break: a cancelled order is
		// terminal, and the automatic completion path is the one a capture would trigger.
		const fixture = orderFixture({
			lines: [line('L1', { quantity: 1, unitPrice: 20 })],
			order: { status: OrderStatus.CANCELED, fulfillmentStatus: FulfillmentStatus.CANCELED }
		});
		fixture.tables.order_transaction.push({
			orderId: 'order-1',
			amount: 20,
			type: OrderTransactionType.CAPTURE
		});

		await expect(fixture.service.place('order-1')).rejects.toMatchObject({
			response: { code: 'ORDER_STATUS_TRANSITION_INVALID', details: { from: OrderStatus.CANCELED } }
		});
		await expect(fixture.service.confirm('order-1', 'STAFF')).rejects.toMatchObject({
			response: { code: 'ORDER_STATUS_TRANSITION_INVALID', details: { from: OrderStatus.CANCELED } }
		});

		const afterCapture = await fixture.service.completeIfSettled('order-1');

		// Everything is paid and nothing has to ship, and the order still does not complete.
		expect(await fixture.totalsService.isPaymentSettled(fixture.order as never)).toBe(true);
		expect(afterCapture.status).toBe(OrderStatus.CANCELED);
		expect(fixture.tables.order_summary).toEqual([]);
	});

	it('completes an order whose lines are fulfilled and whose money has settled', async () => {
		const fixture = orderFixture({
			lines: [line('L1', { quantity: 2, unitPrice: 20, fulfilledQuantity: 2 })],
			order: { status: OrderStatus.PROCESSING }
		});
		fixture.tables.order_transaction.push({
			orderId: 'order-1',
			amount: 40,
			type: OrderTransactionType.CAPTURE
		});

		const completed = await fixture.service.completeIfSettled('order-1');

		expect(completed.status).toBe(OrderStatus.COMPLETED);
		expect(completed.completedAt).toBeInstanceOf(Date);
		expect(timelineOf(fixture)).toEqual(['ORDER_COMPLETED']);
	});

	it('leaves an order that is not yet completable exactly where it is', async () => {
		const openLine = orderFixture({
			lines: [line('L1', { quantity: 2, unitPrice: 20, fulfilledQuantity: 1 })],
			order: { status: OrderStatus.PROCESSING }
		});
		openLine.tables.order_transaction.push({
			orderId: 'order-1',
			amount: 40,
			type: OrderTransactionType.CAPTURE
		});

		const unpaid = orderFixture({
			lines: [line('L1', { quantity: 2, unitPrice: 20, fulfilledQuantity: 2 })],
			order: { status: OrderStatus.PROCESSING }
		});
		const changeOpen = orderFixture({
			lines: [line('L1', { quantity: 2, unitPrice: 20, fulfilledQuantity: 2 })],
			order: { status: OrderStatus.PROCESSING }
		});
		changeOpen.tables.order_transaction.push({
			orderId: 'order-1',
			amount: 40,
			type: OrderTransactionType.CAPTURE
		});
		changeOpen.openChanges.push({ id: 'change-1', status: OrderChangeStatus.REQUESTED });

		expect((await openLine.service.completeIfSettled('order-1')).status).toBe(OrderStatus.PROCESSING);
		expect((await unpaid.service.completeIfSettled('order-1')).status).toBe(OrderStatus.PROCESSING);
		expect((await changeOpen.service.completeIfSettled('order-1')).status).toBe(OrderStatus.PROCESSING);

		for (const fixture of [openLine, unpaid, changeOpen]) {
			expect(fixture.tables.order_history).toEqual([]);
		}
	});
});

describe('OrderService — what an update may change (doc 10 §6.1)', () => {
	it('refuses an edit of a placed order and names the endpoint that would accept it', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });

		await expect(
			fixture.service.updateMutable('order-1', { currency: 'EUR', note: 'x' } as never)
		).rejects.toMatchObject({
			response: {
				code: 'ORDER_IMMUTABLE',
				details: { fields: ['currency'], changeEndpoint: 'POST /api/orders/order-1/changes' }
			}
		});

		// Nothing was written, not even the field that was legal.
		expect(fixture.order).toMatchObject({ currency: 'USD' });
		expect(fixture.order.note).toBeUndefined();
	});

	it('changes the contact details a placed order may still carry', async () => {
		const fixture = orderFixture({ lines: [line('L1', { quantity: 1, unitPrice: 20 })] });

		const updated = await fixture.service.updateMutable('order-1', {
			email: 'buyer@example.com',
			phone: '+44 20 7946 0000',
			note: 'Leave at reception',
			metadata: { source: 'web' }
		} as never);

		expect(updated).toMatchObject({
			email: 'buyer@example.com',
			phone: '+44 20 7946 0000',
			note: 'Leave at reception',
			metadata: { source: 'web' }
		});
	});

	it('lets a draft be edited in place, because it has not been placed', async () => {
		// Control: the same field the case above refused is legal on a draft, which is the whole point
		// of the draft status.
		const fixture = orderFixture({
			lines: [line('L1', { quantity: 1, unitPrice: 20 })],
			order: { status: OrderStatus.DRAFT, isDraft: true }
		});

		const updated = await fixture.service.updateMutable('order-1', { currency: 'EUR' } as never);

		expect(updated.currency).toBe('EUR');
	});
});
