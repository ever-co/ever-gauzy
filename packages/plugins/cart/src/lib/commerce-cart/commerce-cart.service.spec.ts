/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a cart service needs and none of which is available
 * outside a running application. The seam is therefore doubled at the module boundary, exactly as
 * the docs package's service specs do, and the *services under test are the real ones*: only the base
 * CRUD class, the request context and the two core money ledgers are substituted.
 *
 * The base class double mirrors `CrudService` / `TenantAwareCrudService` where the behaviour is
 * observable to a caller — a lookup by a missing id raises `NotFoundException`, `update` resolves the
 * row before it writes, `findAll` answers with `{ items, total }` — without any tenant merging, which
 * is the part that needs a request context.
 */
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

		get tableName(): string {
			return this.typeOrmRepository.metadata?.tableName;
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

		async save(entity: any): Promise<any> {
			return this.typeOrmRepository.save(entity);
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

		async count(options?: any): Promise<number> {
			return this.typeOrmRepository.count(options);
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

import { AdjustmentOwnerType, CommerceCartStatus, CommerceCheckoutSessionStatus, TaxLineOwnerType } from '@gauzy/contracts';
import { CommerceCartService } from './commerce-cart.service';
import { CommerceCartLineService } from '../commerce-cart-line/commerce-cart-line.service';
import { CommerceCartPromotionService } from '../commerce-cart-promotion/commerce-cart-promotion.service';
import { CommerceCartShippingMethodService } from '../commerce-cart-shipping-method/commerce-cart-shipping-method.service';
import { CommerceCheckoutSessionService } from '../commerce-checkout-session/commerce-checkout-session.service';
import { cartCheckoutRegistry } from '../checkout/cart-checkout.registry';

/**
 * The cart aggregate.
 *
 * Everything a buyer does to a cart before paying for it goes through `CommerceCartService`, and the
 * two things that must never be wrong about it are its *lines* and its *totals*: a cart that keeps a
 * line it should have merged charges a different price than the one the buyer was shown, and a cart
 * whose total columns disagree with its ledgers is a wrong charge waiting for checkout.
 *
 * The suite therefore pins, per case, the property the domain requires:
 *
 * - a line added twice for the same variant at the same price is one line (doc 10 §2.7's merge
 *   equality), and a line at a *different* price is not merged;
 * - a quantity of zero or below is refused and the cart is left exactly as it was;
 * - removing the last line leaves an empty, still-valid cart rather than one that has to be repaired;
 * - the stored totals are the exact decimal sum of already-rounded components, with the discount
 *   allocation summing back to the whole it came from (`I1`, `I8`, `I12`);
 * - a promotion applied twice is one promotion, so the discount moves the total once;
 * - a quantity the stock capability cannot serve is refused while the buyer can still change it, and
 *   a cart validated on an installation that has no such capability still sells (doc 10 §2.5 step 10);
 * - a completed checkout cannot be completed again — the checkout handler is invoked exactly once,
 *   which is the property that stands between a retry and a double charge.
 */

/** The tables this package owns, as plain arrays. */
interface ITables {
	commerce_cart: any[];
	commerce_cart_line: any[];
	commerce_cart_shipping_method: any[];
	commerce_cart_promotion: any[];
	commerce_checkout_session: any[];
}

/** The relation of a table, the table it points at and the foreign key that joins them. */
const RELATIONS: Record<string, Record<string, { table: keyof ITables; foreignKey: string }>> = {
	commerce_cart: {
		lines: { table: 'commerce_cart_line', foreignKey: 'cartId' },
		shippingMethods: { table: 'commerce_cart_shipping_method', foreignKey: 'cartId' },
		promotions: { table: 'commerce_cart_promotion', foreignKey: 'cartId' },
		checkoutSessions: { table: 'commerce_checkout_session', foreignKey: 'cartId' }
	}
};

/**
 * An in-memory stand-in for one table's TypeORM repository.
 *
 * It implements the `where` the services state — equality, with an `undefined` leaf dropped the way
 * TypeORM drops it — and the `relations` they ask for, because a read that returned no lines would
 * make every totals case below vacuous.
 *
 * @param tables The whole datastore, so a relation can be joined.
 * @param tableName The table this repository writes.
 */
function repository(tables: ITables, tableName: keyof ITables) {
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

/**
 * What the stock capability reports for a variant it was not given a level for.
 *
 * Comfortable on purpose: a case that is not about stock must not be decided by it, so only the cases
 * that state a level of their own are.
 */
const DEFAULT_STOCK_LEVEL = 10;

/** One variant's level in the stock capability double. */
type StockLevel = number | { sellableQuantity: number; allowBackorder?: boolean; backorderLimit?: number };

/**
 * Builds the cart service over real line, promotion, shipping and checkout-session services, all of
 * them wired to the same in-memory datastore.
 *
 * The core `adjustment` and `tax_line` ledgers are the one piece that has no owner in this package —
 * the tax package writes tax lines and the promotion package writes adjustments — so they are a
 * double here. Their contract is exactly `findByOwner(ownerType, ownerId)`, and the adjustment double
 * is deliberately *derived from the cart's own promotion rows*: `commerce_cart_promotion` is the
 * snapshot of what the promotion engine applied, and the engine is what turns each applied promotion
 * into one signed adjustment on the line it targeted. Every promotion in this fixture targets the
 * cart's first line. Holding the promotion set and its ledger apart is precisely what would make a
 * "the same promotion applied twice" case unable to fail.
 *
 * The stock capability is reached through the optional `CART_STOCK_AVAILABILITY` port, and the fixture
 * is where an installation either has it or does not: `stock: false` registers no capability at all —
 * the package sold on its own, where the ladder reports `STOCK` as skipped — while a level map states
 * what may be sold, per variant.
 *
 * @param options.stock Per-variant levels, overriding `DEFAULT_STOCK_LEVEL`; `false` for an
 * installation with no stock capability registered.
 */
function cartFixture(options: { stock?: Record<string, StockLevel> | false } = {}) {
	const tables: ITables = {
		commerce_cart: [],
		commerce_cart_line: [],
		commerce_cart_shipping_method: [],
		commerce_cart_promotion: [],
		commerce_checkout_session: []
	};
	const ledger = {
		adjustments: [] as Array<{ ownerType: string; ownerId: string; amount: number; isTaxInclusive?: boolean }>,
		taxLines: [] as Array<{ ownerType: string; ownerId: string; amount: number }>,
		/** Records a row the way the tax package would. */
		recordTax(ownerType: string, ownerId: string, amount: number) {
			ledger.taxLines.push({ ownerType, ownerId, amount });
		},
		/** Records a row the way the promotion package would. */
		recordAdjustment(ownerType: string, ownerId: string, amount: number, isTaxInclusive = false) {
			ledger.adjustments.push({ ownerType, ownerId, amount, isTaxInclusive });
		}
	};

	const adjustmentService = {
		findByOwner: async (ownerType: string, ownerId: string) => [
			...ledger.adjustments.filter((row) => row.ownerType === ownerType && row.ownerId === ownerId),
			// What the promotion engine applied to this owner: one signed row per applied promotion,
			// on the line the promotion targeted.
			...tables.commerce_cart_promotion
				.filter(() => String(tables.commerce_cart_line[0]?.id ?? '') === String(ownerId))
				.map((row) => ({
					ownerId,
					amount: -Number(row.amount),
					isTaxInclusive: Boolean(row.isTaxInclusive),
					metadata: undefined
				}))
		]
	};
	const taxLineService = {
		findByOwner: async (ownerType: string, ownerId: string) =>
			ledger.taxLines.filter((row) => row.ownerType === ownerType && row.ownerId === ownerId)
	};

	const lineService = new CommerceCartLineService(
		repository(tables, 'commerce_cart_line') as never,
		{} as never
	);
	const shippingMethodService = new CommerceCartShippingMethodService(
		repository(tables, 'commerce_cart_shipping_method') as never,
		{} as never
	);
	const promotionService = new CommerceCartPromotionService(
		repository(tables, 'commerce_cart_promotion') as never,
		{} as never
	);
	const checkoutSessionService = new CommerceCheckoutSessionService(
		repository(tables, 'commerce_checkout_session') as never,
		{} as never
	);
	const stockPort =
		options.stock === false
			? undefined
			: {
					availabilityOf: async ({ variantId }: { variantId: string }) => {
						const level = options.stock?.[variantId] ?? DEFAULT_STOCK_LEVEL;

						return typeof level === 'number'
							? { sellableQuantity: level, allowBackorder: false }
							: { allowBackorder: false, ...level };
					}
				};
	const service = new CommerceCartService(
		repository(tables, 'commerce_cart') as never,
		{} as never,
		lineService,
		shippingMethodService,
		promotionService,
		checkoutSessionService,
		adjustmentService as never,
		taxLineService as never,
		stockPort as never
	);

	return {
		service,
		tables,
		ledger,
		lineService,
		shippingMethodService,
		promotionService,
		checkoutSessionService,
		stockPort
	};
}

/** How many times a checkout handler was asked to place the order. */
let checkoutCalls = 0;

/** Registers the checkout handler the order package would register at bootstrap. */
function registerCheckoutHandler(result: { orderId: string; orderNumber: string } = { orderId: 'order-1', orderNumber: 'ORD-1' }) {
	cartCheckoutRegistry.register({
		key: 'order',
		complete: async () => {
			checkoutCalls++;

			return result;
		}
	});

	return result;
}

beforeEach(() => {
	checkoutCalls = 0;
});

describe('CommerceCartService — lines', () => {
	it('adds a line, snapshots it and re-prices the cart from it', async () => {
		const { service, tables } = cartFixture();
		const cart = await service.create({ channelId: 'channel-1', currency: 'USD' });

		const priced = await service.addLine(cart.id, {
			variantId: 'variant-1',
			title: 'Analytical Engine',
			quantity: 2,
			unitPrice: 19.99
		});

		expect(tables.commerce_cart_line).toHaveLength(1);
		expect(tables.commerce_cart_line[0]).toMatchObject({
			cartId: cart.id,
			variantId: 'variant-1',
			quantity: 2,
			unitPrice: 19.99,
			// The pre-discount price is snapshotted so the cart can explain its own discount later.
			originalUnitPrice: 19.99,
			isTaxInclusive: false,
			isDiscountable: true,
			requiresShipping: true,
			position: 0
		});
		expect(priced.itemSubtotal).toBe(39.98);
		expect(priced.grandTotal).toBe(39.98);
		expect(priced.status).toBe(CommerceCartStatus.ACTIVE);
		expect(priced.metadata?.lastRecalculationReason).toBe('LINE_ADDED');
	});

	it('merges a second line for the same variant and price into the first', async () => {
		const { service, tables } = cartFixture();
		const cart = await service.create({ channelId: 'channel-1', currency: 'USD' });
		const attributes = { variantId: 'variant-1', title: 'Analytical Engine', unitPrice: 19.99 };

		await service.addLine(cart.id, { ...attributes, quantity: 1 });
		const merged = await service.addLine(cart.id, { ...attributes, quantity: 2 });

		expect(tables.commerce_cart_line).toHaveLength(1);
		expect(tables.commerce_cart_line[0].quantity).toBe(3);
		expect(merged.itemSubtotal).toBe(59.97);
	});

	it('keeps a line for the same variant at another price as its own line', async () => {
		// A price is part of the identity of a line: merging across prices would silently charge the
		// cheaper of the two for every unit. This is the control for the merge above.
		const { service, tables } = cartFixture();
		const cart = await service.create({ channelId: 'channel-1', currency: 'USD' });

		await service.addLine(cart.id, { variantId: 'variant-1', title: 'A', quantity: 1, unitPrice: 19.99 });
		const priced = await service.addLine(cart.id, {
			variantId: 'variant-1',
			title: 'A',
			quantity: 1,
			unitPrice: 14.99
		});

		expect(tables.commerce_cart_line).toHaveLength(2);
		expect(priced.itemSubtotal).toBe(34.98);
	});

	it('changes a line quantity and re-prices the cart', async () => {
		const { service, tables } = cartFixture();
		const cart = await service.create({ channelId: 'channel-1', currency: 'USD' });
		await service.addLine(cart.id, { variantId: 'variant-1', title: 'A', quantity: 1, unitPrice: 19.99 });

		const priced = await service.updateLine(cart.id, tables.commerce_cart_line[0].id, { quantity: 5 });

		expect(tables.commerce_cart_line[0].quantity).toBe(5);
		expect(priced.itemSubtotal).toBe(99.95);
		expect(priced.metadata?.lastRecalculationReason).toBe('LINE_UPDATED');
	});

	it('refuses a quantity of zero or below and leaves the cart exactly as it was', async () => {
		const { service, tables } = cartFixture();
		const cart = await service.create({ channelId: 'channel-1', currency: 'USD' });
		await service.addLine(cart.id, { variantId: 'variant-1', title: 'A', quantity: 2, unitPrice: 10 });
		const lineId = tables.commerce_cart_line[0].id;

		await expect(service.updateLine(cart.id, lineId, { quantity: 0 })).rejects.toThrow(
			/CART_LINE_QUANTITY_INVALID/
		);
		await expect(service.updateLine(cart.id, lineId, { quantity: -1 })).rejects.toThrow(
			/CART_LINE_QUANTITY_INVALID/
		);
		await expect(
			service.addLine(cart.id, { variantId: 'variant-2', title: 'B', quantity: 0, unitPrice: 10 })
		).rejects.toThrow(/CART_LINE_QUANTITY_INVALID/);
		await expect(
			service.addLine(cart.id, { variantId: 'variant-2', title: 'B', quantity: -3, unitPrice: 10 })
		).rejects.toThrow(/CART_LINE_QUANTITY_INVALID/);

		// Nothing was written by a refused mutation: the line, its quantity and the cart's total.
		expect(tables.commerce_cart_line).toHaveLength(1);
		expect(tables.commerce_cart_line[0].quantity).toBe(2);
		expect((await service.findOneByIdString(cart.id)).itemSubtotal).toBe(20);
	});

	it('refuses a line with no variant and a line with no resolved price', async () => {
		const { service } = cartFixture();
		const cart = await service.create({ channelId: 'channel-1', currency: 'USD' });

		await expect(service.addLine(cart.id, { title: 'A', quantity: 1, unitPrice: 10 })).rejects.toThrow(
			/CART_LINE_VARIANT_REQUIRED/
		);
		// The price is resolved by the pricing package; a cart that invented one would be a second
		// price resolver.
		await expect(
			service.addLine(cart.id, { variantId: 'variant-1', title: 'A', quantity: 1 })
		).rejects.toThrow(/CART_LINE_PRICE_REQUIRED/);
	});

	// Doc 10 §2.5 step 10 (`STOCK`) is one of the twenty-two steps of the checkout validation ladder:
	// "for each line: `sellableQuantity + (allowBackorder ? backorderLimit : 0) >= quantity`", failing
	// with `CART_INSUFFICIENT_STOCK` / `CART_BACKORDER_LIMIT_EXCEEDED`. The availability belongs to the
	// inventory package, which this package must not read, so it is asked for through an optional port:
	// a cart that cannot be reserved is refused here rather than accepted and left to fail inside the
	// checkout operation's stock reservation, after the buyer believed the order was placed.
	it('refuses a quantity above what the stock capability reports as available', async () => {
		const { service } = cartFixture();
		const cart = await service.create({ channelId: 'channel-1', currency: 'USD' });

		await service.addLine(cart.id, { variantId: 'variant-1', title: 'A', quantity: 1, unitPrice: 10 });

		await expect(
			service.addLine(cart.id, { variantId: 'variant-2', title: 'B', quantity: 500, unitPrice: 10 })
		).rejects.toMatchObject({ response: { code: 'CART_INSUFFICIENT_STOCK' } });
	});

	it('holds a merged line to the same stock limit as a new one', async () => {
		// The quantity that has to be available is the one the cart would hold afterwards: a line that
		// merges into an existing one asks for the sum of the two, and a guard that measured only the
		// quantity being added would let a cart build past the limit one unit at a time.
		const { service, tables } = cartFixture({ stock: { 'variant-1': 3 } });
		const cart = await service.create({ channelId: 'channel-1', currency: 'USD' });
		const line = { variantId: 'variant-1', title: 'A', unitPrice: 10 };

		await service.addLine(cart.id, { ...line, quantity: 2 });

		await expect(service.addLine(cart.id, { ...line, quantity: 2 })).rejects.toMatchObject({
			response: { code: 'CART_INSUFFICIENT_STOCK', details: { requestedQuantity: 4, sellableQuantity: 3 } }
		});
		expect(tables.commerce_cart_line).toHaveLength(1);
		expect(tables.commerce_cart_line[0].quantity).toBe(2);
	});

	it('refuses a line past the backorder limit with the code that names the limit', async () => {
		const { service } = cartFixture({
			stock: { 'variant-1': { sellableQuantity: 2, allowBackorder: true, backorderLimit: 5 } }
		});
		const cart = await service.create({ channelId: 'channel-1', currency: 'USD' });

		// `2 + 5 >= 7`: within what may be sold.
		await service.addLine(cart.id, { variantId: 'variant-1', title: 'A', quantity: 7, unitPrice: 10 });

		// `2 + 5 < 8`: on hand and the backorder allowance together do not cover it.
		await expect(
			service.addLine(cart.id, { variantId: 'variant-1', title: 'A', quantity: 1, unitPrice: 10 })
		).rejects.toMatchObject({
			response: {
				code: 'CART_BACKORDER_LIMIT_EXCEEDED',
				details: { requestedQuantity: 8, sellableQuantity: 2, backorderLimit: 5 }
			}
		});
	});

	it('validates and completes a cart when no stock capability is registered', async () => {
		// The other half of the seam: this package is complete without the inventory package, and an
		// installation that runs it alone must still sell. The ladder reports `STOCK` as skipped rather
		// than failed, so the verdict is decided by the steps this package owns.
		const fixture = cartFixture({ stock: false });
		const cart = await fixture.service.create({
			channelId: 'channel-1',
			currency: 'USD',
			email: 'buyer@example.com'
		});

		await fixture.service.addLine(cart.id, {
			variantId: 'variant-1',
			title: 'A parcel',
			quantity: 500,
			unitPrice: 20,
			requiresShipping: false
		});

		const verdict = await fixture.service.validate(cart.id);

		expect(verdict.errors).toEqual([]);
		expect(verdict.steps.find((step) => step.step === 'STOCK')).toEqual({ step: 'STOCK', status: 'SKIPPED' });

		registerCheckoutHandler();
		const completed = await fixture.service.complete(cart.id, { idempotencyKey: 'key-1' });

		expect(completed.cart.status).toBe(CommerceCartStatus.COMPLETED);
		expect(checkoutCalls).toBe(1);
	});

	it('leaves an empty but valid cart when the last line is removed', async () => {
		const { service, tables } = cartFixture();
		const cart = await service.create({ channelId: 'channel-1', currency: 'USD' });
		await service.addLine(cart.id, { variantId: 'variant-1', title: 'A', quantity: 1, unitPrice: 19.99 });
		await service.addLine(cart.id, { variantId: 'variant-2', title: 'B', quantity: 1, unitPrice: 5 });

		for (const line of [...tables.commerce_cart_line]) {
			await service.removeLine(cart.id, line.id);
		}

		const emptied = await service.findOneWithContent(cart.id);

		expect(tables.commerce_cart_line).toHaveLength(0);
		expect(emptied.lines).toEqual([]);
		expect(emptied.status).toBe(CommerceCartStatus.ACTIVE);
		expect(emptied.itemSubtotal).toBe(0);
		expect(emptied.discountTotal).toBe(0);
		expect(emptied.taxTotal).toBe(0);
		expect(emptied.grandTotal).toBe(0);

		// Empty is a validation verdict, not a broken cart: the ladder says so and the cart is still
		// readable and still mutable.
		const verdict = await service.validate(cart.id);

		expect(verdict.valid).toBe(false);
		expect(verdict.errors.map((error) => error.code)).toContain('CART_EMPTY');
	});

	it('refuses a line that belongs to another cart', async () => {
		const { service, tables } = cartFixture();
		const mine = await service.create({ channelId: 'channel-1', currency: 'USD' });
		const other = await service.create({ channelId: 'channel-1', currency: 'USD' });
		await service.addLine(other.id, { variantId: 'variant-1', title: 'A', quantity: 1, unitPrice: 10 });
		const foreign = tables.commerce_cart_line[0];

		await expect(service.updateLine(mine.id, foreign.id, { quantity: 9 })).rejects.toThrow(
			/CART_LINE_NOT_FOUND/
		);
		await expect(service.removeLine(mine.id, foreign.id)).rejects.toThrow(/CART_LINE_NOT_FOUND/);
		expect(tables.commerce_cart_line).toHaveLength(1);
		expect(tables.commerce_cart_line[0].quantity).toBe(1);
	});

	it('refuses to mutate a cart that is no longer active', async () => {
		const { service, tables } = cartFixture();
		const cart = await service.create({ channelId: 'channel-1', currency: 'USD' });
		await service.addLine(cart.id, { variantId: 'variant-1', title: 'A', quantity: 1, unitPrice: 10 });
		tables.commerce_cart[0].status = CommerceCartStatus.COMPLETED;

		await expect(
			service.addLine(cart.id, { variantId: 'variant-2', title: 'B', quantity: 1, unitPrice: 10 })
		).rejects.toThrow(/CART_STATUS_INVALID/);
		await expect(service.removeLine(cart.id, tables.commerce_cart_line[0].id)).rejects.toThrow(
			/CART_STATUS_INVALID/
		);
	});
});

describe('CommerceCartService — money', () => {
	it('stores the exact totals chain of the cart, not a rounded summary of it', async () => {
		const { service, tables, ledger } = cartFixture();
		const cart = await service.create({ channelId: 'channel-1', currency: 'USD' });
		await service.addLine(cart.id, { variantId: 'v1', title: 'A', quantity: 2, unitPrice: 19.99 });
		await service.addLine(cart.id, { variantId: 'v2', title: 'B', quantity: 1, unitPrice: 5 });
		await service.setShippingMethod(cart.id, { name: 'Flat', amount: 5 });

		const [first, second] = tables.commerce_cart_line;
		const [shipping] = tables.commerce_cart_shipping_method;

		ledger.recordTax(TaxLineOwnerType.CART_LINE, first.id, 2.9);
		ledger.recordTax(TaxLineOwnerType.CART_LINE, second.id, 0.36);
		ledger.recordTax(TaxLineOwnerType.CART_SHIPPING, shipping.id, 0.36);
		ledger.recordAdjustment(AdjustmentOwnerType.CART_LINE, first.id, -4);
		ledger.recordAdjustment(AdjustmentOwnerType.CART_SHIPPING, shipping.id, -1);

		const priced = await service.recalculate(cart.id, 'MANUAL');

		expect(priced.itemSubtotal).toBe(44.98);
		expect(priced.itemDiscountTotal).toBe(4);
		expect(priced.itemTaxTotal).toBe(3.26);
		expect(priced.shippingSubtotal).toBe(5);
		expect(priced.shippingDiscountTotal).toBe(1);
		expect(priced.shippingTaxTotal).toBe(0.36);
		expect(priced.discountTotal).toBe(5);
		expect(priced.taxTotal).toBe(3.26);
		// `itemSubtotal - discountTotal + taxTotal + shippingSubtotal + shippingTaxTotal`, exactly.
		expect(priced.grandTotal).toBe(48.6);
		expect(priced.discountTotal).toBe(priced.itemDiscountTotal + priced.shippingDiscountTotal);
	});

	it('stores a total that binary floating point could not hold', async () => {
		// Control: ten lines of `0.07` sum to `0.7000000000000001` as doubles. A stored total that is
		// a float accumulation is a wrong cent the moment it is rounded, taxed or split.
		const { service } = cartFixture();
		const cart = await service.create({ channelId: 'channel-1', currency: 'USD' });

		for (let index = 0; index < 10; index++) {
			await service.addLine(cart.id, {
				variantId: `variant-${index}`,
				title: `Line ${index}`,
				quantity: 1,
				unitPrice: 0.07
			});
		}

		const priced = await service.findOneByIdString(cart.id);

		expect(priced.itemSubtotal).toBe(0.7);
		expect(priced.grandTotal).toBe(0.7);

		const naive = Array.from({ length: 10 }).reduce<number>((sum) => sum + 0.07, 0);
		expect(naive).not.toBe(0.7);
	});

	it('allocates an order-level discount across lines so the stored discount is the whole', async () => {
		// `I12`: the parts of an allocation sum back to the whole. 33.33 / 33.33 / 33.34 do not divide
		// a 10.00 discount evenly, so an implementation that rounded each part independently would
		// store 9.99 and quietly under-refund the buyer.
		const { service, tables, ledger } = cartFixture();
		const { Money } = jest.requireActual('@gauzy/core/src/lib/money/money');
		const cart = await service.create({ channelId: 'channel-1', currency: 'USD' });

		await service.addLine(cart.id, { variantId: 'v1', title: 'A', quantity: 1, unitPrice: 33.33 });
		await service.addLine(cart.id, { variantId: 'v2', title: 'B', quantity: 1, unitPrice: 33.33 });
		await service.addLine(cart.id, { variantId: 'v3', title: 'C', quantity: 1, unitPrice: 33.34 });

		const parts = Money.of(10, 'USD', 2).allocate([33.33, 33.33, 33.34]);

		tables.commerce_cart_line.forEach((line: any, index: number) => {
			ledger.recordAdjustment(AdjustmentOwnerType.CART_LINE, line.id, -Number(parts[index].toStorageString()));
		});

		const priced = await service.recalculate(cart.id, 'MANUAL');

		expect(parts.map((part: any) => Number(part.toStorageString()))).toEqual([3.33, 3.33, 3.34]);
		expect(priced.itemSubtotal).toBe(100);
		expect(priced.discountTotal).toBe(10);
		expect(priced.grandTotal).toBe(90);
	});

	it('records a promotion applied twice once, so the discount moves the total once', async () => {
		const { service, tables } = cartFixture();
		const cart = await service.create({ channelId: 'channel-1', currency: 'USD' });
		await service.addLine(cart.id, { variantId: 'v1', title: 'A', quantity: 2, unitPrice: 20 });
		const promotion = { promotionId: 'promo-1', code: 'TENOFF', amount: 4 };

		const once = await service.applyPromotion(cart.id, promotion);

		expect(tables.commerce_cart_promotion).toHaveLength(1);
		expect(once.discountTotal).toBe(4);
		expect(once.grandTotal).toBe(36);

		const twice = await service.applyPromotion(cart.id, promotion);

		// One promotion row, and the discount is the promotion's amount rather than the sum of two
		// applications. A second row would be a second adjustment on the line and the buyer would be
		// discounted twice for one promotion.
		expect(tables.commerce_cart_promotion).toHaveLength(1);
		expect(tables.commerce_cart_promotion[0].amount).toBe(4);
		expect(twice.discountTotal).toBe(4);
		expect(twice.grandTotal).toBe(36);
		expect(twice.metadata?.lastRecalculationReason).toBe('PROMOTION_CHANGED');

		// Control: a second promotion row on the same line would be a second adjustment, and this is
		// the same cart totalling 32 — exactly what the duplicate guard above prevents.
		tables.commerce_cart_promotion.push({
			...tables.commerce_cart_promotion[0],
			id: 'commerce_cart_promotion-duplicate'
		});

		const doubled = await service.recalculate(cart.id, 'MANUAL');

		expect(doubled.discountTotal).toBe(8);
		expect(doubled.grandTotal).toBe(32);
	});

	it('leaves the total alone when no promotion matches the cart', async () => {
		// A promotion whose discount is attributed to a line this cart does not have cannot move its
		// total: the chain only reads the ledger rows owned by the cart's own lines.
		const { service, tables, ledger } = cartFixture();
		const cart = await service.create({ channelId: 'channel-1', currency: 'USD' });
		await service.addLine(cart.id, { variantId: 'v1', title: 'A', quantity: 1, unitPrice: 20 });

		ledger.recordAdjustment(AdjustmentOwnerType.CART_LINE, 'a-line-of-another-cart', -4);
		const priced = await service.recalculate(cart.id, 'MANUAL');

		expect(priced.discountTotal).toBe(0);
		expect(priced.grandTotal).toBe(20);
		expect(tables.commerce_cart_line).toHaveLength(1);
	});

	it('removes an applied promotion and rebuilds the total without it', async () => {
		const { service } = cartFixture();
		const cart = await service.create({ channelId: 'channel-1', currency: 'USD' });
		await service.addLine(cart.id, { variantId: 'v1', title: 'A', quantity: 2, unitPrice: 20 });

		await service.applyPromotion(cart.id, { code: 'TENOFF', amount: 4 });
		const removed = await service.removePromotion(cart.id, 'TENOFF');

		expect(removed.discountTotal).toBe(0);
		expect(removed.grandTotal).toBe(40);
	});

	it('refreshes the cart lifetime on every write, from the documented default TTLs', async () => {
		const { service, tables } = cartFixture();
		const anonymous = await service.create({ channelId: 'channel-1', currency: 'USD' });
		const known = await service.create({ channelId: 'channel-1', currency: 'USD', customerId: 'customer-1' });
		const hours = (cart: any) =>
			(new Date(cart.expiresAt).getTime() - new Date(cart.lastActivityAt).getTime()) / 3_600_000;

		expect(hours(anonymous)).toBeCloseTo(168, 5);
		expect(hours(known)).toBeCloseTo(720, 5);
		expect(new Date(tables.commerce_cart[0].expiresAt).getTime()).toBeGreaterThan(Date.now());
	});
});

describe('CommerceCartService — checkout', () => {
	/** A cart that passes the strict ladder: one digital line, a contact and a currency. */
	async function completableCart(fixture: ReturnType<typeof cartFixture>) {
		const cart = await fixture.service.create({
			channelId: 'channel-1',
			currency: 'USD',
			email: 'buyer@example.com'
		});

		await fixture.service.addLine(cart.id, {
			variantId: 'variant-1',
			title: 'A download',
			quantity: 1,
			unitPrice: 20,
			requiresShipping: false
		});

		return fixture.service.findOneWithContent(cart.id);
	}

	it('records the steps a checkout session walked through, append-only', async () => {
		const fixture = cartFixture();
		const cart = await completableCart(fixture);
		const session = await fixture.checkoutSessionService.create({
			cartId: cart.id,
			status: CommerceCheckoutSessionStatus.STARTED
		});

		await fixture.checkoutSessionService.completeStep(session.id, 'CART', { locale: 'en' });
		const progressed = await fixture.checkoutSessionService.completeStep(
			session.id,
			'ADDRESSES',
			{ countryCode: 'GB' }
		);

		expect(progressed.completedSteps).toEqual(['CART', 'ADDRESSES']);
		expect(progressed.step).toBe('ADDRESSES');
		expect(progressed.status).toBe(CommerceCheckoutSessionStatus.IN_PROGRESS);
		expect(progressed.data).toEqual({ locale: 'en', countryCode: 'GB' });

		// Re-completing a step does not duplicate the path, so `completedSteps` stays a description of
		// what happened rather than a count of how many times it was asked for.
		const repeated = await fixture.checkoutSessionService.completeStep(session.id, 'CART');
		expect(repeated.completedSteps).toEqual(['CART', 'ADDRESSES']);

		const open = await fixture.checkoutSessionService.findOpenForCart(cart.id);
		expect(open?.id).toBe(session.id);
	});

	it('completes a cart once and closes its checkout session', async () => {
		const fixture = cartFixture();
		const cart = await completableCart(fixture);
		const session = await fixture.checkoutSessionService.create({
			cartId: cart.id,
			status: CommerceCheckoutSessionStatus.IN_PROGRESS
		});
		const expected = registerCheckoutHandler();

		const result = await fixture.service.complete(cart.id, { idempotencyKey: 'key-1' });

		expect(result.orderId).toBe(expected.orderId);
		expect(result.orderNumber).toBe(expected.orderNumber);
		expect(result.cart.status).toBe(CommerceCartStatus.COMPLETED);
		expect(result.cart.orderId).toBe(expected.orderId);
		expect(result.cart.completedAt).toBeInstanceOf(Date);
		expect(checkoutCalls).toBe(1);

		const closed = await fixture.checkoutSessionService.findOneByIdString(session.id);
		expect(closed.status).toBe(CommerceCheckoutSessionStatus.COMPLETED);
		expect(await fixture.checkoutSessionService.findOpenForCart(cart.id)).toBeNull();
	});

	it('refuses a second completion of the same cart and never reaches the handler again', async () => {
		// The property that stands between a retried request and a double charge. The cart is already
		// `COMPLETED`, and the refusal is the code that names what happened — `CART_ALREADY_COMPLETED`
		// (doc 06, 409; doc 10 §3.3) — rather than the ladder's generic status refusal, because the
		// caller's next move is to read the order the cart points at.
		const fixture = cartFixture();
		const cart = await completableCart(fixture);
		registerCheckoutHandler();

		const first = await fixture.service.complete(cart.id, { idempotencyKey: 'key-1' });

		await expect(fixture.service.complete(cart.id, { idempotencyKey: 'key-2' })).rejects.toMatchObject({
			response: { code: 'CART_ALREADY_COMPLETED', details: { cartId: cart.id, orderId: first.orderId } }
		});
		expect(checkoutCalls).toBe(1);

		const stored = await fixture.service.findOneByIdString(cart.id);
		expect(stored.status).toBe(CommerceCartStatus.COMPLETED);
		// The order the cart points at is the one that was actually placed, not a second one.
		expect(stored.orderId).toBe(first.orderId);
	});

	it('refuses to complete a cart the ladder rejects, before any handler runs', async () => {
		const fixture = cartFixture();
		const cart = await fixture.service.create({
			channelId: 'channel-1',
			currency: 'USD',
			email: 'buyer@example.com'
		});
		registerCheckoutHandler();

		// Empty.
		await expect(fixture.service.complete(cart.id)).rejects.toMatchObject({
			response: { code: 'CART_EMPTY' }
		});
		expect(checkoutCalls).toBe(0);

		// A shippable line with no delivery choice: the ladder's own step order decides which error is
		// reported first, so the reported code is a property of the ladder and not of this call site.
		await fixture.service.addLine(cart.id, {
			variantId: 'variant-1',
			title: 'A parcel',
			quantity: 1,
			unitPrice: 20
		});

		await expect(fixture.service.complete(cart.id)).rejects.toMatchObject({
			response: { code: 'CART_SHIPPING_METHOD_REQUIRED' }
		});
		expect(checkoutCalls).toBe(0);
	});

	it('says so loudly when no checkout handler is registered', async () => {
		const fixture = cartFixture();
		const cart = await completableCart(fixture);

		// The registry is a module-level singleton with no `unregister`, because in production it is
		// written once at bootstrap. An installation that loads the cart package without the order
		// package has nothing registered at all, and the cart must say so rather than silently never
		// becoming an order.
		(cartCheckoutRegistry as unknown as { handlers: Map<string, unknown> }).handlers.clear();

		expect(cartCheckoutRegistry.resolve()).toBeNull();
		await expect(fixture.service.complete(cart.id)).rejects.toThrow(/CHECKOUT_HANDLER_MISSING/);

		const untouched = await fixture.service.findOneByIdString(cart.id);
		expect(untouched.status).toBe(CommerceCartStatus.ACTIVE);
		expect(untouched.orderId).toBeUndefined();
	});

	it('marks an uncompleted cart abandoned and refuses to abandon a completed one', async () => {
		const fixture = cartFixture();
		const cart = await completableCart(fixture);

		const abandoned = await fixture.service.abandon(cart.id);
		expect(abandoned.status).toBe(CommerceCartStatus.ABANDONED);
		expect(abandoned.abandonedAt).toBeInstanceOf(Date);

		registerCheckoutHandler();
		await fixture.service.complete(cart.id);

		await expect(fixture.service.abandon(cart.id)).rejects.toThrow(/CART_STATUS_INVALID/);
	});
});

describe('CommerceCartService — merge', () => {
	it('moves the source lines into the target and leaves the source empty and merged', async () => {
		const fixture = cartFixture();
		const target = await fixture.service.create({ channelId: 'channel-1', currency: 'USD' });
		const source = await fixture.service.create({ channelId: 'channel-1', currency: 'USD' });

		await fixture.service.addLine(target.id, { variantId: 'v1', title: 'A', quantity: 1, unitPrice: 19.99 });
		await fixture.service.addLine(source.id, { variantId: 'v1', title: 'A', quantity: 2, unitPrice: 19.99 });
		await fixture.service.addLine(source.id, { variantId: 'v2', title: 'B', quantity: 1, unitPrice: 5 });

		const merged = await fixture.service.merge(target.id, source.id);

		// Target wins: the matching line is merged into it and the new one is moved.
		expect(merged.metadata?.mergedFromCartIds).toEqual([source.id]);

		const content = await fixture.service.findOneWithContent(target.id);
		expect(content.lines).toHaveLength(2);
		expect(content.lines?.[0].quantity).toBe(3);
		expect(content.itemSubtotal).toBe(64.97);

		const emptied = await fixture.service.findOneByIdString(source.id);
		expect(emptied.status).toBe(CommerceCartStatus.MERGED);
		expect(emptied.metadata?.mergedIntoCartId).toBe(target.id);
		expect(
			fixture.tables.commerce_cart_line.filter((line: any) => line.cartId === source.id)
		).toHaveLength(0);
	});

	it('refuses to merge a cart into itself and refuses to merge a completed source', async () => {
		const fixture = cartFixture();
		const cart = await fixture.service.create({ channelId: 'channel-1', currency: 'USD' });
		const other = await fixture.service.create({ channelId: 'channel-1', currency: 'USD' });

		await expect(fixture.service.merge(cart.id, cart.id)).rejects.toThrow(/CART_MERGE_INVALID/);

		fixture.tables.commerce_cart.find((row: any) => row.id === other.id).status =
			CommerceCartStatus.COMPLETED;

		await expect(fixture.service.merge(cart.id, other.id)).rejects.toThrow(/CART_MERGE_INVALID/);
	});
});
