/**
 * The order a subscription cycle bills, raised through the ordinary order path.
 *
 * Two module boundaries are doubled here, for the reason the order service's own suite states: the
 * `@gauzy/core` barrel boots the whole application graph, and the cart package's barrel re-exports the
 * cart plugin class, which imports the catalogue plugin and the rest of the marketplace — so reading
 * one order would otherwise load every package on the platform. The order package's own services are
 * therefore the **real** ones, over one in-memory datastore: the real `OrderService` numbers, places,
 * confirms and totals the order, and the real `OrderTotalsService` reads the adjustment and tax
 * ledgers the provider wrote. Only the capabilities of other domains — the cart, the pricing
 * preference chain, the tax calculation, the numbering sequence and the idempotency store — are
 * doubles, because each has its own suite.
 *
 * The suite pins the properties the cycle depends on:
 *
 * - the order it receives is the order package's own — numbered by the sequence service, placed and
 *   confirmed, with its lines carrying the titles and tax categories the catalogue states
 *   (doc 10 §3.4, §4.1; doc 11 §10.5);
 * - the channel is the originating order's, and the organization's default when the subscription
 *   names no originating order, because a renewal has no request behind it to state one;
 * - the plan discount is a `PROMOTION` ledger row allocated across the lines by largest remainder, and
 *   the tax is rated on the *discounted* base (doc 07 §4.8, §10.6; doc 11 §10.10);
 * - a cycle is reported settled only when the order's own ledger says money was captured, so a cycle
 *   that was merely invoiced is never recorded as paid;
 * - a request the capability cannot serve is refused with a named code, and a key that already raised
 *   an order for another request can never raise a second one.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	/** The caller's scope, which the base service stamps onto every row it creates. */
	const scope = {
		currentUser: () => null,
		currentUserId: () => null,
		currentTenantId: () => '00000000-0000-4000-8000-000000000001',
		currentOrganizationId: () => '00000000-0000-4000-8000-000000000002',
		currentEmployeeId: () => null,
		getLanguageCode: () => 'en-US',
		hasPermission: () => false
	};

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
		constructor(typeOrmRepository: any, mikroOrmRepository?: any) {
			super(typeOrmRepository, mikroOrmRepository);
		}

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

		async create(entity: any): Promise<any> {
			// The scope is stamped here because the real base service stamps it: a row created outside
			// the caller's tenant and organization is a row the caller's own scoped reads cannot find.
			return this.typeOrmRepository.save(
				this.typeOrmRepository.create({
					tenantId: scope.currentTenantId(),
					organizationId: scope.currentOrganizationId(),
					...entity
				})
			);
		}

		async update(id: any, partial: any): Promise<any> {
			return this.typeOrmRepository.update(id, partial);
		}

		async delete(criteria: any): Promise<any> {
			return this.typeOrmRepository.delete(criteria);
		}
	}

	/**
	 * The catalogue's product, with the platform's own translation rule.
	 *
	 * A product's name is a row of `product_translation`, and `translate` merges the row for the
	 * language asked for onto the product. The real method mutates; this copy returns the merged row,
	 * which is the same answer to the same question.
	 */
	class Product {
		name?: string;
		translations?: Array<Record<string, unknown>>;

		translate(languageCode: string): Product {
			const translation = (this.translations ?? []).find((row) => row['languageCode'] === languageCode);

			return translation ? ({ ...this, ...translation } as Product) : this;
		}
	}

	return {
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
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		isValidDecimalString: jest.requireActual('@gauzy/core/src/lib/money/decimal').isValidDecimalString,
		normalizeDecimalString: jest.requireActual('@gauzy/core/src/lib/money/decimal').normalizeDecimalString,
		compareDecimalStrings: jest.requireActual('@gauzy/core/src/lib/money/decimal').compareDecimalStrings,
		addDecimalStrings: jest.requireActual('@gauzy/core/src/lib/money/decimal').addDecimalStrings,
		RequestContext: scope,
		Product,
		ProductTranslation: class {},
		ProductVariant: class {},
		ChannelService: class {},
		AdjustmentService: class {},
		TaxLineService: class {},
		IdempotencyService: class {},
		SequenceService: class {}
	};
});

jest.mock('@gauzy/plugin-cart', () => ({
	CommerceCartService: class {},
	TotalsCalculator: jest.requireActual('@gauzy/plugin-cart/src/lib/totals/totals-calculator').TotalsCalculator
}));
jest.mock('@gauzy/plugin-pricing', () => ({ PricePreferenceService: class {} }));
jest.mock('@gauzy/plugin-tax', () => ({ TaxRateService: class {} }));

import {
	AdjustmentOwnerType,
	AdjustmentType,
	CommerceCartStatus,
	IdempotencyOutcome,
	OrderStatus,
	OrderTransactionType,
	TaxLineOwnerType
} from '@gauzy/contracts';
import { Product } from '@gauzy/core';
import { OrderAddressService } from '../order-address/order-address.service';
import { OrderCreditLineService } from '../order-credit-line/order-credit-line.service';
import { OrderHistoryService } from '../order-history/order-history.service';
import { OrderLineService } from '../order-line/order-line.service';
import { OrderService } from '../order/order.service';
import { OrderShippingMethodService } from '../order-shipping-method/order-shipping-method.service';
import { OrderSummaryService } from '../order-summary/order-summary.service';
import { OrderTotalsService } from '../order-totals/order-totals.service';
import { OrderTransactionService } from '../order-transaction/order-transaction.service';
import { SubscriptionOrderService } from './subscription-order.service';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const ORIGIN_ORDER = '00000000-0000-4000-8000-0000000000aa';
const CHANNEL = '00000000-0000-4000-8000-0000000000c1';
const REGION = '00000000-0000-4000-8000-0000000000e1';
const CUSTOMER = '00000000-0000-4000-8000-0000000000f1';
const SUBSCRIPTION = '00000000-0000-4000-8000-000000000011';
const BILLING = '00000000-0000-4000-8000-000000000021';
const VARIANT = '00000000-0000-4000-8000-0000000000d1';
const TAXED_VARIANT = '00000000-0000-4000-8000-0000000000d2';
const PRODUCT = '00000000-0000-4000-8000-0000000000b1';
const CATEGORY = '00000000-0000-4000-8000-000000000050';
const HOLDER = '00000000-0000-4000-8000-0000000000a1';
const INSTRUMENT = '00000000-0000-4000-8000-000000000091';

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
	| 'order_change_action'
	| 'adjustment'
	| 'tax_line';

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
	'order_change_action',
	'adjustment',
	'tax_line'
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

/** One `product_variant` row. */
const variantRow = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	productId: PRODUCT,
	taxCategoryId: null,
	requiresShipping: false,
	barcode: 'BC-1',
	weight: 0,
	internalReference: 'COAT-L',
	...overrides
});

/** One `product` row, with the translation its name is resolved from. */
const productRow = () => ({
	id: PRODUCT,
	tenantId: TENANT,
	organizationId: ORG,
	code: 'COAT',
	translations: [{ languageCode: 'en-US', name: 'Wool Coat' }]
});

/** The order the subscription was sold in, and the facts a renewal reuses from it. */
const originOrderRow = () => ({
	id: ORIGIN_ORDER,
	tenantId: TENANT,
	organizationId: ORG,
	number: 'ORD-000001',
	channelId: CHANNEL,
	regionId: REGION,
	customerId: CUSTOMER,
	email: 'buyer@example.com',
	locale: 'en-US',
	currency: 'USD',
	currencyDecimals: 2,
	status: OrderStatus.CONFIRMED
});

/**
 * The world the provider runs in: the real order package's services over one in-memory datastore, and
 * one double per capability that belongs to another domain.
 *
 * @param options.variants The catalogue's variants.
 * @param options.originOrder The order the subscription was sold in, or null when it names none.
 * @param options.defaultChannel The organization's default channel, or null when it has none.
 * @param options.taxInclusive What the pricing preference chain answers.
 * @param options.taxDrafts What the tax capability returns for a line.
 * @param options.storedKey A key the idempotency store already holds.
 */
function world(
	options: {
		variants?: any[];
		originOrder?: boolean;
		defaultChannel?: boolean;
		taxInclusive?: boolean;
		taxDrafts?: boolean;
		storedKey?: { key: string; requestHash?: string; body?: unknown; status?: string };
	} = {}
) {
	const tables: Record<string, any[]> = {};
	for (const table of TABLES) {
		tables[table] = [];
	}

	if (options.originOrder !== false) {
		tables.order.push(originOrderRow());
	}

	const repo = (table: TableName) => repository(tables, table);
	const typeOrmOrderRepository = repo('order');
	const lineService = new OrderLineService(repo('order_line') as never, {} as never, typeOrmOrderRepository as never);
	const adjustmentRows: any[] = tables.adjustment;
	const taxRows: any[] = tables.tax_line;

	const totalsService = new OrderTotalsService(
		typeOrmOrderRepository as never,
		lineService as never,
		new OrderShippingMethodService(repo('order_shipping_method') as never, {} as never) as never,
		new OrderCreditLineService(repo('order_credit_line') as never, {} as never) as never,
		new OrderTransactionService(repo('order_transaction') as never, {} as never) as never,
		new OrderSummaryService(repo('order_summary') as never, {} as never) as never,
		{
			findByOwner: async (ownerType: string, ownerId: string) =>
				adjustmentRows.filter((row) => row.ownerType === ownerType && row.ownerId === ownerId)
		} as never,
		{
			findByOwner: async (ownerType: string, ownerId: string) =>
				taxRows.filter((row) => row.ownerType === ownerType && row.ownerId === ownerId)
		} as never,
		// The aggregate's version-predicated write resolves the order's writer by token. The order
		// service is built below, so the lookup answers the resolved instance when a write runs.
		{ get: () => orderService } as never
	);

	const allocate = jest.fn(async () => ({ formatted: 'ORD-000900', value: 900, key: 'ORDER' }));
	const orderService = new OrderService(
		typeOrmOrderRepository as never,
		{} as never,
		totalsService,
		lineService,
		new OrderAddressService(repo('order_address') as never, {} as never),
		new OrderShippingMethodService(repo('order_shipping_method') as never, {} as never),
		new OrderHistoryService(repo('order_history') as never, {} as never),
		{ findOpenForOrder: jest.fn(async () => []) } as never,
		{ allocate } as never
	);

	/** The carts the provider built, keyed by id. */
	const carts = new Map<string, any>();
	let cartSequence = 0;
	const cartService = {
		carts,
		create: jest.fn(async (entity: any) => {
			const cart = {
				id: `cart-${++cartSequence}`,
				status: CommerceCartStatus.ACTIVE,
				version: 1,
				currencyDecimals: 2,
				...entity
			};

			carts.set(cart.id, cart);

			return cart;
		}),
		addLine: jest.fn(async (cartId: string, line: any) => {
			const cart = carts.get(cartId);

			cart.lines = [...(cart.lines ?? []), { id: `cart-line-${(cart.lines ?? []).length + 1}`, ...line }];
			cart.shippingMethods = [];

			return cart;
		}),
		findOneWithContent: jest.fn(async (id: string) => carts.get(id)),
		update: jest.fn(async (id: string, partial: any) => Object.assign(carts.get(id), partial))
	};

	const channelService = {
		findChannel: jest.fn(async (id: string) =>
			id === CHANNEL ? { id: CHANNEL, code: 'storefront', defaultRegionId: REGION, defaultLocale: 'en-US' } : null
		),
		findDefaultChannel: jest.fn(async () =>
			options.defaultChannel === false
				? null
				: { id: 'channel-default', code: 'default', defaultRegionId: REGION, defaultLocale: 'en-US' }
		)
	};

	/** The keys the store holds, which is what makes a retry return the first attempt's answer. */
	const keys = new Map<string, any>();
	const idempotencyService = {
		keys,
		claim: jest.fn(async (input: any) => {
			const existing = keys.get(input.key);

			if (existing) {
				if (existing.requestHash && existing.requestHash !== input.requestHash) {
					return { outcome: IdempotencyOutcome.REUSED_KEY, record: existing };
				}

				return {
					outcome: IdempotencyOutcome.REPLAYED,
					record: existing,
					response: { status: 201, body: existing.responseBody }
				};
			}

			const record = { id: `key-${keys.size + 1}`, ...input };

			keys.set(input.key, record);

			return { outcome: IdempotencyOutcome.CLAIMED, record };
		}),
		complete: jest.fn(async (record: any, completion: any) => {
			Object.assign(keys.get(record.key) ?? record, completion);

			return record;
		})
	};

	const adjustmentService = {
		append: jest.fn(async (input: any) => {
			const row = { id: `adjustment-${adjustmentRows.length + 1}`, ...input };

			adjustmentRows.push(row);

			return row;
		}),
		findByOwner: async (ownerType: string, ownerId: string) =>
			adjustmentRows.filter((row) => row.ownerType === ownerType && row.ownerId === ownerId)
	};

	/** What the tax capability was asked, so the base each line was rated on is asserted. */
	const taxRequests: any[] = [];
	const taxRateService = {
		requests: taxRequests,
		calculate: jest.fn(async (request: any) => {
			taxRequests.push(request);

			return {
				currency: request.currency,
				netTotal: '0',
				taxTotal: '0',
				grossTotal: '0',
				lines: (request.lines ?? []).map((line: any) => ({
					referenceId: line.referenceId,
					taxCategoryId: line.taxCategoryId,
					currency: request.currency,
					netAmount: line.amount,
					taxAmount: options.taxDrafts === false ? '0' : '2',
					grossAmount: String(Number(line.amount) + (options.taxDrafts === false ? 0 : 2)),
					taxLines:
						options.taxDrafts === false
							? []
							: [
									{
										taxRateId: 'rate-1',
										code: 'GST',
										name: 'GST',
										rate: '0.05',
										isCompound: false,
										isInclusive: false,
										baseAmount: line.amount,
										amount: '2',
										quantity: line.quantity,
										currency: request.currency,
										metadata: { jurisdiction: 'ON' }
									}
							  ]
				}))
			};
		})
	};

	const taxLineService = {
		append: jest.fn(async (input: any) => {
			const row = { id: `tax-line-${taxRows.length + 1}`, ...input };

			taxRows.push(row);

			return row;
		}),
		findByOwner: async (ownerType: string, ownerId: string) =>
			taxRows.filter((row) => row.ownerType === ownerType && row.ownerId === ownerId)
	};

	const pricePreferenceService = {
		resolveTaxInclusivity: jest.fn(async () => (options.taxInclusive === true ? true : null))
	};

	const variants = options.variants ?? [variantRow(VARIANT, { taxCategoryId: CATEGORY })];
	const typeOrmProductVariantRepository = {
		findOne: async (query: any) => variants.find((row) => row.id === query.where.id) ?? null
	};
	const typeOrmProductRepository = {
		// The row is a `Product` instance: its name is resolved through the entity's own `translate`,
		// which is the platform's rule rather than this suite's.
		findOne: async (query: any) =>
			query.where.id === PRODUCT ? Object.assign(new Product(), productRow()) : null
	};

	const service = new SubscriptionOrderService(
		orderService,
		totalsService,
		lineService,
		new OrderCreditLineService(repo('order_credit_line') as never, {} as never),
		cartService as never,
		channelService as never,
		idempotencyService as never,
		adjustmentService as never,
		taxLineService as never,
		taxRateService as never,
		pricePreferenceService as never,
		typeOrmOrderRepository as never,
		typeOrmProductVariantRepository as never,
		typeOrmProductRepository as never
	);

	return {
		service,
		tables,
		carts,
		keys,
		allocate,
		orderService,
		totalsService,
		cartService,
		channelService,
		adjustmentService,
		taxLineService,
		taxRateService,
		pricePreferenceService,
		orders: () => tables.order.filter((row: any) => row.id !== ORIGIN_ORDER),
		lines: () => tables.order_line,
		order: () => tables.order.find((row: any) => row.id !== ORIGIN_ORDER)
	};
}

/** One cycle's request, as the subscription domain states it. */
const cycleRequest = (overrides: Record<string, unknown> = {}) => ({
	subscriptionId: SUBSCRIPTION,
	billingId: BILLING,
	customerId: CUSTOMER,
	originOrderId: ORIGIN_ORDER,
	currency: 'USD',
	periodStart: new Date('2026-02-01T00:00:00.000Z'),
	periodEnd: new Date('2026-03-01T00:00:00.000Z'),
	firstCycle: false,
	lines: [{ variantId: VARIANT, quantity: '1.000000', unitPrice: '19.990000' }],
	amount: '19.990000',
	idempotencyKey: 'cycle-1',
	paymentAccountHolderId: HOLDER,
	paymentMethodTokenId: INSTRUMENT,
	...overrides
});

describe('SubscriptionOrderService — the order a cycle raises (doc 11 §10.5, doc 10 §3.4)', () => {
	it('numbers, places and confirms the order through the order package’s own path', async () => {
		const fixture = world({ variants: [variantRow(VARIANT, { taxCategoryId: null })] });

		const result = await fixture.service.raiseSubscriptionOrder(cycleRequest() as never);

		// Document numbering is the kernel's: a counter of this package's own would be a second answer
		// to a question the sequence service already answers.
		expect(fixture.allocate).toHaveBeenCalledWith('ORDER', { channelId: CHANNEL });
		expect(fixture.order()).toMatchObject({
			number: 'ORD-000900',
			channelId: CHANNEL,
			regionId: REGION,
			customerId: CUSTOMER,
			email: 'buyer@example.com',
			currency: 'USD',
			currencyDecimals: 2,
			status: OrderStatus.CONFIRMED,
			isDraft: false,
			source: 'SUBSCRIPTION',
			parentOrderId: ORIGIN_ORDER,
			grandTotal: 19.99
		});
		expect(fixture.order().metadata).toMatchObject({
			subscriptionId: SUBSCRIPTION,
			billingId: BILLING,
			paymentAccountHolderId: HOLDER,
			paymentMethodTokenId: INSTRUMENT
		});
		// The placement and the confirmation each leave their timeline entry, written by the order
		// service rather than by the caller.
		expect(fixture.tables.order_history.map((row: any) => row.action)).toEqual(
			expect.arrayContaining(['ORDER_PLACED', 'ORDER_CONFIRMED'])
		);
		expect(result).toEqual({
			orderId: 'order-new-1',
			grandTotal: '19.990000',
			currency: 'USD',
			paid: false
		});
	});

	it('titles the line the way the catalogue names it, and carries the variant’s own facts', async () => {
		const fixture = world();

		await fixture.service.raiseSubscriptionOrder(cycleRequest() as never);

		expect(fixture.lines()).toHaveLength(1);
		expect(fixture.lines()[0]).toMatchObject({
			variantId: VARIANT,
			productId: PRODUCT,
			title: 'Wool Coat — COAT-L',
			quantity: 1,
			unitPrice: 19.99,
			originalUnitPrice: 19.99,
			taxCategoryId: CATEGORY,
			requiresShipping: false,
			isTaxInclusive: false,
			position: 0
		});
	});
	it('carries the price’s tax basis from the pricing capability’s own preference chain', async () => {
		const fixture = world({ taxInclusive: true });

		await fixture.service.raiseSubscriptionOrder(cycleRequest() as never);

		expect(fixture.pricePreferenceService.resolveTaxInclusivity).toHaveBeenCalledWith({
			currency: 'USD',
			regionId: REGION,
			channelCode: 'storefront'
		});
		expect(fixture.lines()[0].isTaxInclusive).toBe(true);
	});

	it('builds a cart for the cycle, hands it to the order path and leaves it completed', async () => {
		const fixture = world();

		await fixture.service.raiseSubscriptionOrder(cycleRequest() as never);

		// A cycle is documented as "build cart → checkout", and the cart is what the order records as
		// its origin (`order.cartId`) — which is why it is a row and not an in-memory request.
		expect(fixture.cartService.create).toHaveBeenCalledTimes(1);
		expect(fixture.cartService.create.mock.calls[0][0]).toMatchObject({
			channelId: CHANNEL,
			regionId: REGION,
			customerId: CUSTOMER,
			currency: 'USD'
		});
		expect(fixture.cartService.addLine).toHaveBeenCalledTimes(1);
		expect(fixture.order().cartId).toBe('cart-1');
	});

	it('raises the renewal in the organization’s default channel when the subscription names no origin', async () => {
		const fixture = world({ originOrder: false });

		const result = await fixture.service.raiseSubscriptionOrder(
			cycleRequest({ originOrderId: undefined }) as never
		);

		expect(fixture.channelService.findDefaultChannel).toHaveBeenCalled();
		expect(fixture.order()).toMatchObject({ channelId: 'channel-default', regionId: REGION });
		expect(fixture.order().parentOrderId ?? null).toBeNull();
		expect(result.orderId).toBe(fixture.order().id);
	});

	it('refuses a cycle that names no origin and an organization that has no default channel', async () => {
		const fixture = world({ originOrder: false, defaultChannel: false });

		await expect(
			fixture.service.raiseSubscriptionOrder(cycleRequest({ originOrderId: undefined }) as never)
		).rejects.toThrow(/ORDER_CHANNEL_REQUIRED/);
		expect(fixture.orders()).toHaveLength(0);
	});

	it('refuses a variant the catalogue cannot describe, and raises no order for it', async () => {
		const fixture = world({ variants: [] });

		await expect(fixture.service.raiseSubscriptionOrder(cycleRequest() as never)).rejects.toThrow(
			/ORDER_SUBSCRIPTION_VARIANT_NOT_FOUND/
		);
		expect(fixture.orders()).toHaveLength(0);
	});

	it('refuses a cycle whose lines do not produce the amount it states', async () => {
		// The order would otherwise be raised for one amount while the billing row recorded another,
		// which is a customer charged something nobody decided.
		const fixture = world();

		await expect(
			fixture.service.raiseSubscriptionOrder(cycleRequest({ amount: '17.990000' }) as never)
		).rejects.toThrow(/ORDER_SUBSCRIPTION_AMOUNT_MISMATCH/);
		expect(fixture.orders()).toHaveLength(0);
	});

	it('refuses an amount that is not an exact decimal, and a request with no key', async () => {
		const fixture = world();

		await expect(
			fixture.service.raiseSubscriptionOrder(cycleRequest({ amount: 'nineteen' }) as never)
		).rejects.toThrow(/ORDER_SUBSCRIPTION_AMOUNT_INVALID/);
		await expect(
			fixture.service.raiseSubscriptionOrder(cycleRequest({ idempotencyKey: undefined }) as never)
		).rejects.toThrow(/ORDER_SUBSCRIPTION_KEY_REQUIRED/);
	});
});

describe('SubscriptionOrderService — what the cycle states beside the lines (doc 07 §4.8, doc 11 §10.10)', () => {
	it('records the plan discount as a ledger row and rates the line on the discounted base', async () => {
		const fixture = world();

		await fixture.service.raiseSubscriptionOrder(
			cycleRequest({ discountAmount: '2.000000', amount: '17.990000' }) as never
		);

		const line = fixture.lines()[0];

		expect(fixture.tables.adjustment).toEqual([
			expect.objectContaining({
				ownerType: AdjustmentOwnerType.ORDER_LINE,
				ownerId: line.id,
				type: AdjustmentType.PROMOTION,
				amount: '-2.000000',
				currency: 'USD',
				referenceType: 'subscription',
				isTaxInclusive: false
			})
		]);
		// The tax is asked for the base the line is actually charged on, which is the rule the money
		// specification states: `baseAmount` is the owner's net after discount.
		expect(fixture.taxRateService.requests[0].lines).toEqual([
			expect.objectContaining({ referenceId: line.id, taxCategoryId: CATEGORY, amount: '17.990000', quantity: '1' })
		]);
		// And the totals writer, which reads the ledgers, folds both into the order.
		expect(fixture.order()).toMatchObject({ itemSubtotal: 19.99, itemDiscountTotal: 2, taxTotal: 2, grandTotal: 19.99 });
	});

	it('splits a discount across the lines by largest remainder, so the parts sum to the whole', async () => {
		const fixture = world({
			variants: [variantRow(VARIANT, { taxCategoryId: null }), variantRow(TAXED_VARIANT, { taxCategoryId: null })]
		});

		await fixture.service.raiseSubscriptionOrder(
			cycleRequest({
				lines: [
					{ variantId: VARIANT, quantity: '1.000000', unitPrice: '10.000000' },
					{ variantId: TAXED_VARIANT, quantity: '1.000000', unitPrice: '20.000000' }
				],
				discountAmount: '1.000000',
				amount: '29.000000'
			}) as never
		);

		const shares = fixture.tables.adjustment.map((row: any) => Number(row.amount));

		expect(shares).toHaveLength(2);
		expect(shares.reduce((total: number, part: number) => total + part, 0)).toBeCloseTo(-1, 6);
		// Two thirds of a minor unit cannot be written, so the minor units left over go to the parts
		// with the largest remainder rather than being dropped.
		expect(shares).toEqual([-0.33, -0.67]);
	});

	it('writes the tax breakdown into the platform’s ledger against the order’s own lines', async () => {
		const fixture = world();

		await fixture.service.raiseSubscriptionOrder(cycleRequest() as never);

		const line = fixture.lines()[0];

		expect(fixture.taxLineService.append).toHaveBeenCalledTimes(1);
		expect(fixture.tables.tax_line[0]).toMatchObject({
			ownerType: TaxLineOwnerType.ORDER_LINE,
			ownerId: line.id,
			name: 'GST',
			rate: '0.05',
			baseAmount: '19.990000',
			amount: '2',
			currency: 'USD'
		});
		// The tax the capability returned is the tax the order carries: the totals writer read the
		// ledger this provider wrote, and the order was recomputed after it.
		expect(fixture.order().taxTotal).toBe(2);
		expect(fixture.order().grandTotal).toBe(21.99);
	});

	it('rates no line and writes no tax line when no rate matches the catalogue', async () => {
		const fixture = world({ taxDrafts: false });

		await fixture.service.raiseSubscriptionOrder(cycleRequest() as never);

		expect(fixture.taxRateService.requests[0]).toMatchObject({ allowUntaxedCatalog: true, currency: 'USD' });
		expect(fixture.tables.tax_line).toHaveLength(0);
		expect(fixture.order()).toMatchObject({ taxTotal: 0, grandTotal: 19.99 });
	});

	it('does not rate a line that carries no tax category', async () => {
		// A catalogue line names the category it is sold in; a line that names none — a fee, a
		// proration — has no category to resolve and is not rated at all.
		const fixture = world({ variants: [variantRow(VARIANT, { taxCategoryId: null })] });

		await fixture.service.raiseSubscriptionOrder(cycleRequest() as never);

		expect(fixture.taxRateService.calculate).not.toHaveBeenCalled();
		expect(fixture.order()).toMatchObject({ taxTotal: 0, grandTotal: 19.99 });
	});

	it('charges the setup fee as a line of its own and carries a deferred credit as a credit line', async () => {
		const fixture = world({ variants: [variantRow(VARIANT, { taxCategoryId: null })] });

		await fixture.service.raiseSubscriptionOrder(
			cycleRequest({ setupFee: '5.000000', creditAmount: '-3.000000', amount: '19.990000' }) as never
		);

		const titles = fixture.lines().map((line: any) => line.title);

		expect(titles).toEqual(['Wool Coat — COAT-L', 'Setup fee']);
		expect(fixture.lines()[1]).toMatchObject({ unitPrice: 5, isDiscountable: false, requiresShipping: false });
		// A credit is not a discount: it is value the customer already holds, so it reduces what is
		// outstanding rather than the grand total.
		expect(fixture.tables.order_credit_line[0]).toMatchObject({
			amount: 3,
			currency: 'USD',
			referenceType: 'subscription'
		});
		expect(fixture.order()).toMatchObject({ grandTotal: 24.99, creditTotal: 3, outstandingTotal: 21.99 });
	});

	it('carries the cycle’s note where an order records what has no column of its own', async () => {
		const fixture = world();

		await fixture.service.raiseSubscriptionOrder(cycleRequest({ note: 'Renewal of the February period.' }) as never);

		expect(fixture.order().metadata.note).toBe('Renewal of the February period.');
	});
});

describe('SubscriptionOrderService — what the cycle receives back (doc 11 §10.5)', () => {
	it('answers with the order, its total and its currency, and reports it settled only when money was captured', async () => {
		const fixture = world({ variants: [variantRow(VARIANT, { taxCategoryId: null })] });

		const unsettled = await fixture.service.raiseSubscriptionOrder(cycleRequest() as never);

		// The order path raises the document and takes no money, so a cycle that was merely invoiced is
		// never reported as paid.
		expect(unsettled).toEqual({
			orderId: 'order-new-1',
			grandTotal: '19.990000',
			currency: 'USD',
			paid: false
		});

		// Control: once the payment capability has captured the order's money, a retry of the same
		// attempt reports the cycle settled — the verdict is read from the order's own ledger, and the
		// answer the first attempt stored is deliberately not replayed as the last word on the money.
		fixture.tables.order_transaction.push({
			id: 'transaction-1',
			orderId: unsettled.orderId,
			type: OrderTransactionType.CAPTURE,
			amount: 19.99
		});

		const replayed = await fixture.service.raiseSubscriptionOrder(cycleRequest() as never);

		expect(replayed).toEqual({ ...unsettled, paid: true });
		expect(fixture.orders()).toHaveLength(1);
	});

	it('returns the order a settled key already holds instead of raising a second one', async () => {
		const fixture = world({ variants: [variantRow(VARIANT, { taxCategoryId: null })] });

		const first = await fixture.service.raiseSubscriptionOrder(cycleRequest() as never);
		const second = await fixture.service.raiseSubscriptionOrder(cycleRequest() as never);

		expect(second).toEqual(first);
		expect(fixture.orders()).toHaveLength(1);
		expect(fixture.cartService.create).toHaveBeenCalledTimes(1);
	});

	it('refuses a key that already raised an order for a different request', async () => {
		const fixture = world({ variants: [variantRow(VARIANT, { taxCategoryId: null })] });

		await fixture.service.raiseSubscriptionOrder(cycleRequest() as never);

		await expect(
			fixture.service.raiseSubscriptionOrder(
				cycleRequest({
					lines: [{ variantId: VARIANT, quantity: '2.000000', unitPrice: '19.990000' }],
					amount: '39.980000'
				}) as never
			)
		).rejects.toThrow(/ORDER_SUBSCRIPTION_KEY_REUSED/);
		expect(fixture.orders()).toHaveLength(1);
	});
});

describe('SubscriptionOrderService — the proration order (doc 11 §10.8)', () => {
	it('raises one line in the caller’s own words, priced at what is owed', async () => {
		const fixture = world();

		const result = await fixture.service.raiseProrationOrder({
			subscriptionId: SUBSCRIPTION,
			customerId: CUSTOMER,
			currency: 'USD',
			amount: '92.900000',
			description: 'Plan changed to PRO.',
			idempotencyKey: 'proration-1'
		} as never);

		expect(fixture.lines()).toHaveLength(1);
		expect(fixture.lines()[0]).toMatchObject({
			title: 'Plan changed to PRO.',
			quantity: 1,
			unitPrice: 92.9,
			isDiscountable: false,
			requiresShipping: false
		});
		expect(fixture.lines()[0].variantId ?? null).toBeNull();
		expect(fixture.order()).toMatchObject({ grandTotal: 92.9, source: 'SUBSCRIPTION' });
		expect(fixture.order().metadata).toMatchObject({ proration: true, description: 'Plan changed to PRO.' });
		// A proration has no catalogue item behind it and therefore no tax category to rate.
		expect(fixture.taxRateService.calculate).not.toHaveBeenCalled();
		expect(result).toEqual({ orderId: fixture.order().id, grandTotal: '92.900000', currency: 'USD', paid: false });
	});

	it('refuses a proration that states no positive amount', async () => {
		const fixture = world();

		await expect(
			fixture.service.raiseProrationOrder({
				subscriptionId: SUBSCRIPTION,
				customerId: CUSTOMER,
				currency: 'USD',
				amount: '-4.000000',
				description: 'Downgrade.',
				idempotencyKey: 'proration-2'
			} as never)
		).rejects.toThrow(/ORDER_SUBSCRIPTION_PRORATION_AMOUNT_INVALID/);
		expect(fixture.orders()).toHaveLength(0);
	});
});
