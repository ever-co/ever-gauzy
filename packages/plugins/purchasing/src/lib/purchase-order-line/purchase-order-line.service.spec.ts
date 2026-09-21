/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a line service needs and none of which is available
 * outside a running application. The seam is therefore doubled at the module boundary, exactly as the
 * catalogue and inventory packages' service specs do, and **the services under test are the real
 * ones**: the line service and the real term service it prices through, with the platform's real money
 * layer and the real quantity helpers behind them.
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

		async find(options: any = {}): Promise<any> {
			return this.typeOrmRepository.find(options);
		}

		async paginate(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
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
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async update(id: any, partial: any): Promise<any> {
			return this.typeOrmRepository.update(id, partial);
		}

		async delete(criteria: any): Promise<any> {
			return this.typeOrmRepository.delete(criteria);
		}

		async softDelete(criteria: any): Promise<any> {
			return this.typeOrmRepository.softDelete(criteria);
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
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		JsonColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		BaseEvent: class {},
		EventBus: class {},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		Organization: class Organization {},
		OrganizationVendor: class OrganizationVendor {},
		ProductVariant: class ProductVariant {},
		ProductVariantPrice: class ProductVariantPrice {},
		SequenceService: class SequenceService {},
		TenantSettingService: class TenantSettingService {},
		Warehouse: class Warehouse {},
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

import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
	Organization,
	OrganizationVendor,
	ProductVariant,
	ProductVariantPrice,
	RequestContext
} from '@gauzy/core';
import { PurchaseBillingPolicy, PurchasingCodes } from '../purchasing.types';
import { VendorProductTermService } from '../vendor-product-term/vendor-product-term.service';
import { PurchaseOrder } from '../purchase-order/purchase-order.entity';
import { PurchaseOrderLine } from './purchase-order-line.entity';
import { PurchaseOrderLineService } from './purchase-order-line.service';

/**
 * The lines of a purchase order, and the three quantities the match is kept over.
 *
 * Doc 05 §16.2 states the rules this suite is built around:
 *
 * - **the money is derived, never stated.** "`total` is recomputed from the other columns on every
 *   write and never set independently", and the header formula "`subtotal − discountTotal + taxTotal +
 *   shippingTotal`" holds by construction rather than by convention;
 * - **the three-way match (I-81).** "`billedQuantity` equals the Σ of its bill lines' quantities and
 *   never exceeds what the policy allows (`quantity` under `ON_ORDERED`, `receivedQuantity` under
 *   `ON_RECEIVED`), with the service refusing an excess as `PURCHASE_LINE_OVERBILLED`; every bill
 *   line's purchase line belongs to the invoice's own `vendorId` (`PURCHASE_BILL_VENDOR_MISMATCH`)";
 * - **the remainder is derived at read, never stored**: "`toBillQuantity` is **derived at read, never
 *   stored**";
 * - **`billedQuantity` is a cache re-derived from the bill lines, never incremented** — "a bill that is
 *   voided, corrected or re-issued has to leave the cache equal to the sum of the bills that stand";
 * - **one line per `(order, variant, expected date)`**, the tuple doc 05 §16.2 widens deliberately so a
 *   split commitment is expressible while a same-date double entry is still refused.
 *
 * The service is constructed directly over in-memory tables, with the real term service behind the
 * pricing so a case about where a price came from is a statement about the agreement rather than about
 * a stub.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const ORDER = 'purchase-order-1';
const VENDOR = 'vendor-1';
const VARIANT = 'variant-1';
const OTHER_VARIANT = 'variant-2';

type Row = Record<string, any>;

interface ITables {
	purchase_order_line: Row[];
	purchase_order: Row[];
	vendor_product_term: Row[];
	organization_vendor: Row[];
	product_variant: Row[];
	product_variant_price: Row[];
	organization: Row[];
}

/**
 * The in-memory stand-in for one table's TypeORM repository.
 *
 * @param tables The whole datastore.
 * @param tableName The table this repository writes.
 */
function repository(tables: ITables, tableName: keyof ITables) {
	let sequence = 0;
	const rows = () => tables[tableName].filter((row) => !row.deletedAt);
	const same = (left: unknown, right: unknown) => String(left ?? '') === String(right ?? '');
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where ?? {}).every(([field, expected]) => {
			// TypeORM drops an `undefined` member from the condition rather than matching nothing.
			if (expected === undefined) {
				return true;
			}

			// A condition stated as a list is an `In`, which is how a set of ids is read.
			if (Array.isArray(expected)) {
				return expected.some((candidate) => same(row[field], candidate));
			}

			if (expected instanceof Date || row[field] instanceof Date) {
				return new Date(expected as never).getTime() === new Date(row[field] ?? 0).getTime();
			}

			return same(row[field], expected);
		});

	const sorted = (found: Row[], order?: Record<string, 'ASC' | 'DESC'>) => {
		const columns = Object.keys(order ?? {});

		if (!columns.length) {
			return found;
		}

		return [...found].sort((left, right) => {
			for (const column of columns) {
				if (left[column] === right[column]) {
					continue;
				}

				const direction = order?.[column] === 'DESC' ? -1 : 1;

				return (left[column] > right[column] ? 1 : -1) * direction;
			}

			return 0;
		});
	};

	return {
		rows,
		all: () => tables[tableName],
		// A read hands back a detached entity: only `save` writes, which is what makes "the refusal wrote
		// nothing" an assertion about the store rather than about an object the service mutated in passing.
		find: async (options: any = {}) =>
			sorted(
				rows()
					.filter((row) => matches(row, options.where))
					.map((row) => ({ ...row })),
				options.order
			),
		findOne: async (options: any = {}) => {
			const found = rows().find((row) => matches(row, options.where));

			return found ? { ...found } : null;
		},
		findAndCount: async (options: any = {}) => {
			const items = rows().filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async (options: any = {}) => rows().filter((row) => matches(row, options.where)).length,
		create: (partial: any) => ({ ...partial }),
		save: async (rowOrRows: any) => {
			const list = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];

			for (const entity of list) {
				if (entity.id) {
					const index = tables[tableName].findIndex((row) => same(row.id, entity.id));

					if (index >= 0) {
						tables[tableName][index] = { ...tables[tableName][index], ...entity };
						continue;
					}
				}

				// Generated ids carry an infix, so one can never collide with an id a fixture seeded.
				entity.id = `${String(tableName)}-new-${++sequence}`;
				tables[tableName].push(entity);
			}

			return Array.isArray(rowOrRows) ? list : list[0];
		},
		update: async (criteria: any, partial: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = tables[tableName].findIndex((row) => same(row.id, id));

			if (index >= 0) {
				Object.assign(tables[tableName][index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		softDelete: async (criteria: any) => {
			const where = typeof criteria === 'string' ? { id: criteria } : criteria;
			const matching = tables[tableName].filter((row) => matches(row, where));

			for (const row of matching) {
				row.deletedAt = new Date();
			}

			return { affected: matching.length };
		},
		delete: async (criteria: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = tables[tableName].findIndex((row) => same(row.id, id));

			if (index >= 0) {
				tables[tableName].splice(index, 1);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	};
}

/** One `purchase_order_line` row, as the service reads it. */
const lineRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	purchaseOrderId: ORDER,
	variantId: VARIANT,
	quantity: '10.000000',
	conversionFactor: '1',
	receivedQuantity: '0',
	damagedQuantity: '0',
	billedQuantity: '0',
	unitCost: '4.000000',
	discountTotal: '0',
	total: '0',
	createdAt: `2026-01-01T00:00:0${id.length % 10}.000Z`,
	...overrides
});

/** One `purchase_order` row, as the bill-vendor check reads it. */
const orderRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	number: `PO-${id}`,
	vendorId: VENDOR,
	warehouseId: 'warehouse-1',
	currency: 'USD',
	status: 'DRAFT',
	version: 1,
	...overrides
});

/**
 * Builds the line service — and the real term service behind its pricing — over one in-memory store.
 *
 * @param options.lines The lines the fixture starts with.
 * @param options.orders The orders the fixture starts with.
 * @param options.terms The terms the fixture starts with.
 * @param options.variantCost Whether the unit carries a cost price of its own.
 */
function lineFixture(
	options: {
		lines?: Row[];
		orders?: Row[];
		terms?: Row[];
		variantCost?: Row | null;
	} = {}
) {
	const tables: ITables = {
		purchase_order_line: [...(options.lines ?? [])],
		purchase_order: [...(options.orders ?? [orderRow(ORDER)])],
		vendor_product_term: [...(options.terms ?? [])],
		organization_vendor: [
			{ id: VENDOR, tenantId: TENANT, organizationId: ORG, name: 'Supplier', currency: 'USD', isActive: true }
		],
		product_variant: [
			{ id: VARIANT, tenantId: TENANT, organizationId: ORG },
			{ id: OTHER_VARIANT, tenantId: TENANT, organizationId: ORG }
		],
		product_variant_price:
			options.variantCost === null
				? []
				: [
						{
							id: 'cost-1',
							tenantId: TENANT,
							organizationId: ORG,
							productVariant: { id: VARIANT },
							unitCost: '3.500000',
							unitCostCurrency: 'USD',
							...(options.variantCost ?? {})
						}
				  ],
		organization: [{ id: ORG, tenantId: TENANT, currency: 'USD' }]
	};
	const termRepository = repository(tables, 'vendor_product_term');
	const manager = {
		connection: { options: { type: 'postgres' } },
		findOne: async (entity: unknown, findOptions: any = {}) => {
			if (entity === OrganizationVendor) {
				return repository(tables, 'organization_vendor').findOne(findOptions);
			}
			if (entity === ProductVariant) {
				return repository(tables, 'product_variant').findOne(findOptions);
			}
			if (entity === ProductVariantPrice) {
				const wanted = findOptions.where?.productVariant?.id;

				return (
					tables.product_variant_price.find(
						(row) => String(row.productVariant?.id ?? '') === String(wanted ?? '')
					) ?? null
				);
			}
			if (entity === Organization) {
				return repository(tables, 'organization').findOne(findOptions);
			}
			if (entity === PurchaseOrder) {
				return repository(tables, 'purchase_order').findOne(findOptions);
			}

			throw new Error('the in-memory double was handed an entity it does not know');
		},
		count: async (entity: unknown, findOptions: any = {}) => {
			if (entity !== PurchaseOrderLine) {
				throw new Error('the in-memory double was handed an entity it does not know');
			}

			return repository(tables, 'purchase_order_line').count(findOptions);
		}
	};

	Object.assign(termRepository, { manager });

	const termService = new VendorProductTermService(termRepository as never, {} as never);
	const lineRepository = repository(tables, 'purchase_order_line');

	Object.assign(lineRepository, { manager });

	const service = new PurchaseOrderLineService(lineRepository as never, {} as never, termService);

	return {
		service,
		termService,
		tables,
		line: (id: string) => tables.purchase_order_line.find((row) => row.id === id),
		live: () => tables.purchase_order_line.filter((row) => !row.deletedAt)
	};
}

describe('PurchaseOrderLineService — the money is derived, never stated (doc 05 §16.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('computes a line as the table’s own formula states it', async () => {
		// `total = quantity × unitCost − discountTotal + tax`, with the tax applied to the **discounted**
		// net rather than to the gross — which is the difference that shows up on every taxed order.
		const fixture = lineFixture();

		const amounts = fixture.service.computeLineAmounts(
			{ quantity: '4', unitCost: '19.99', discountTotal: '9.96', taxRate: '0.2' },
			'USD'
		);

		expect(amounts).toEqual({ net: '79.960000', discount: '9.960000', tax: '14.000000', total: '84.000000' });
	});

	it('computes an order as the documented header formula, from its lines and its freight', async () => {
		const fixture = lineFixture();

		const totals = fixture.service.computeOrderTotals(
			[
				{ quantity: '2', unitCost: '10', taxRate: '0.1', discountTotal: '1' },
				{ quantity: '3', unitCost: '5', taxRate: '0.1', discountTotal: '0' }
			],
			'USD',
			'7.5'
		);

		// net 35.00 less 1.00, tax on 19.00 + 15.00, plus 7.50 of freight.
		expect(totals).toEqual({
			subtotal: '35.000000',
			discountTotal: '1.000000',
			taxTotal: '3.400000',
			shippingTotal: '7.500000',
			grandTotal: '44.900000'
		});
		expect(totals.grandTotal).toBe('44.900000');
	});

	it('holds the header formula over a line set whose parts do not add up in binary floating point', async () => {
		// `8.115 × 3` is exactly `24.345`, which rounds half-up to `24.35`; in IEEE-754 the product is
		// `24.344999999999999`. The control below is the naive answer, asserted so this cannot pass by luck.
		const fixture = lineFixture();

		const totals = fixture.service.computeOrderTotals([{ quantity: '3', unitCost: '8.115' }], 'USD');

		expect((8.115 * 3).toFixed(2)).toBe('24.34');
		expect(totals.subtotal).toBe('24.350000');
		expect(totals.grandTotal).toBe('24.350000');
	});

	it('totals an order with no lines at zero, freight included', async () => {
		const fixture = lineFixture();

		expect(fixture.service.computeOrderTotals([], 'USD', '4')).toEqual({
			subtotal: '0.000000',
			discountTotal: '0.000000',
			taxTotal: '0.000000',
			shippingTotal: '4.000000',
			grandTotal: '4.000000'
		});
	});

	it('writes each stored line’s own total from its columns', async () => {
		const fixture = lineFixture({
			lines: [lineRow('line-1', { quantity: '2.000000', unitCost: '10.000000', taxRate: '0.5' })]
		});

		const written = await fixture.service.writeLineTotals(fixture.live() as never, 'USD');

		expect(written[0]).toMatchObject({ total: '30.000000' });
		expect(fixture.line('line-1')?.total).toBe('30.000000');
	});

	it('rewrites the totals of a whole order from the lines it holds', async () => {
		const fixture = lineFixture({
			lines: [
				lineRow('line-1', { quantity: '2.000000', unitCost: '10.000000', total: '0' }),
				lineRow('line-2', { variantId: OTHER_VARIANT, quantity: '1.000000', unitCost: '5.000000', total: '0' })
			]
		});

		const written = await fixture.service.rewriteLineTotals(ORDER, 'USD');

		expect(written.map((line) => line.total)).toEqual(['20.000000', '5.000000']);
	});

	it('totals a stored line set, which is how a recomputation after a receipt reads', async () => {
		const fixture = lineFixture({
			lines: [
				lineRow('line-1', { quantity: '2.000000', unitCost: '10.000000', discountTotal: '2.000000', taxRate: '0.1' })
			]
		});

		expect(fixture.service.computeTotalsForLines(fixture.live() as never, 'USD', '1')).toEqual({
			subtotal: '20.000000',
			discountTotal: '2.000000',
			taxTotal: '1.800000',
			shippingTotal: '1.000000',
			grandTotal: '20.800000'
		});
	});
});

describe('PurchaseOrderLineService — the three-way match (I-81, doc 05 §16.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('counts the damaged units as delivered under ON_RECEIVED, because the supplier will invoice them', async () => {
		// The corrected contract. `damagedQuantity` is documented on the entity as "counted against the
		// ordered quantity exactly like a good unit, because the supplier delivered it and the
		// organization paid for it", and every other consumer treats the pair together. The billable
		// basis did not: ten units delivered as eight good and two broken measured as eight billable, so
		// the supplier's invoice for the ten the organization is liable for was refused as over-billing
		// and could not be posted at all. Recovering the value of the two is a debit note against a bill
		// that exists, which is a different document from the one this refused.
		const fixture = lineFixture({
			lines: [
				lineRow('line-1', {
					quantity: '10.000000',
					receivedQuantity: '8.000000',
					damagedQuantity: '2.000000',
					billedQuantity: '0'
				})
			]
		});
		const line = fixture.line('line-1') as never;

		expect(fixture.service.toBillQuantity(line, PurchaseBillingPolicy.ON_RECEIVED)).toBe('10.000000');
		// The control: counting the good units alone gave 8, and the supplier's invoice for 10 was refused.
		expect(fixture.service.toBillQuantity(line, PurchaseBillingPolicy.ON_RECEIVED)).not.toBe('8.000000');
		await expect(
			fixture.service.assertNotOverbilled('line-1', '10.000000', PurchaseBillingPolicy.ON_RECEIVED)
		).resolves.toMatchObject({ id: 'line-1' });
		// And the ceiling still holds: what did not arrive at all is still not billable.
		await expect(
			fixture.service.assertNotOverbilled('line-1', '10.000001', PurchaseBillingPolicy.ON_RECEIVED)
		).rejects.toThrow(new RegExp(PurchasingCodes.PURCHASE_LINE_OVERBILLED));
		// `ON_ORDERED` is measured against what was ordered and is untouched by the disposition.
		expect(fixture.service.toBillQuantity(line, PurchaseBillingPolicy.ON_ORDERED)).toBe('10.000000');
	});

	it('derives what is still billable from the policy, and never stores it', async () => {
		// `ON_ORDERED ? quantity − billedQuantity : (receivedQuantity + damagedQuantity) − billedQuantity`,
		// "derived at read, never stored" — a stored remainder is exactly what goes stale when a receipt
		// is reversed. This line has nothing damaged, so the two readings of the received basis agree.
		const fixture = lineFixture({
			lines: [lineRow('line-1', { quantity: '10.000000', receivedQuantity: '6.000000', billedQuantity: '4.000000' })]
		});
		const line = fixture.line('line-1') as never;

		expect(fixture.service.toBillQuantity(line, PurchaseBillingPolicy.ON_ORDERED)).toBe('6.000000');
		expect(fixture.service.toBillQuantity(line, PurchaseBillingPolicy.ON_RECEIVED)).toBe('2.000000');
		expect('toBillQuantity' in (fixture.line('line-1') as Row)).toBe(false);
	});

	it('floors what is billable at zero when the line is already billed past its policy', async () => {
		const fixture = lineFixture({
			lines: [lineRow('line-1', { quantity: '10.000000', receivedQuantity: '2.000000', billedQuantity: '4.000000' })]
		});

		expect(fixture.service.toBillQuantity(fixture.line('line-1') as never, PurchaseBillingPolicy.ON_RECEIVED)).toBe(
			'0.000000'
		);
	});

	it('accepts a bill for exactly what is left and refuses one storage unit past it', async () => {
		const fixture = lineFixture({
			lines: [lineRow('line-1', { quantity: '10.000000', receivedQuantity: '5.000000', billedQuantity: '1.000000' })]
		});

		await expect(
			fixture.service.assertNotOverbilled('line-1', '4.000000', PurchaseBillingPolicy.ON_RECEIVED)
		).resolves.toMatchObject({ id: 'line-1' });

		await expect(
			fixture.service.assertNotOverbilled('line-1', '4.000001', PurchaseBillingPolicy.ON_RECEIVED)
		).rejects.toThrow(new RegExp(PurchasingCodes.PURCHASE_LINE_OVERBILLED));

		// The same bill fits under the other policy, which is the whole reason the policy is stated.
		await expect(
			fixture.service.assertNotOverbilled('line-1', '9.000000', PurchaseBillingPolicy.ON_ORDERED)
		).resolves.toMatchObject({ id: 'line-1' });
	});

	it('re-derives the billed cache from the bill lines that stand, never by incrementing it', async () => {
		// A bill that was voided, corrected or re-issued leaves the cache equal to the sum of the bills that
		// remain — which an increment cannot express.
		const fixture = lineFixture({ lines: [lineRow('line-1', { billedQuantity: '9.000000' })] });

		const afterVoiding = await fixture.service.recomputeBilledQuantity('line-1', ['3', '1']);

		expect(afterVoiding.billedQuantity).toBe('4.000000');

		const afterReissue = await fixture.service.recomputeBilledQuantity('line-1', ['3', '1', '6']);

		expect(afterReissue.billedQuantity).toBe('10.000000');
		expect(fixture.line('line-1')?.billedQuantity).toBe('10.000000');
	});

	it('zeroes the cache when nothing is billed against the line any more', async () => {
		const fixture = lineFixture({ lines: [lineRow('line-1', { billedQuantity: '9.000000' })] });

		await expect(fixture.service.recomputeBilledQuantity('line-1', [])).resolves.toMatchObject({
			billedQuantity: '0.000000'
		});
	});

	it('matches a bill to the order’s own supplier, and refuses another supplier’s line', async () => {
		// "Matching one supplier's line against another's order would pay the wrong party and hide the real
		// bill that has not arrived."
		const fixture = lineFixture({
			lines: [lineRow('line-1')],
			orders: [orderRow(ORDER, { vendorId: VENDOR }), orderRow('order-of-another', { vendorId: 'vendor-9' })]
		});

		await expect(fixture.service.assertBillVendorMatches('line-1', VENDOR)).resolves.toMatchObject({
			id: 'line-1'
		});
		await expect(fixture.service.assertBillVendorMatches('line-1', 'vendor-9')).rejects.toThrow(
			new RegExp(PurchasingCodes.PURCHASE_BILL_VENDOR_MISMATCH)
		);
	});

	it('refuses a line or an order the caller cannot read', async () => {
		const fixture = lineFixture({ lines: [lineRow('line-1')], orders: [] });

		await expect(fixture.service.assertNotOverbilled('gone', '1', PurchaseBillingPolicy.ON_ORDERED)).rejects.toBeInstanceOf(
			NotFoundException
		);
		await expect(fixture.service.assertBillVendorMatches('line-1', VENDOR)).rejects.toThrow(
			/PURCHASE_ORDER_NOT_FOUND/
		);
	});
});

describe('PurchaseOrderLineService — writing a line set (doc 05 §16.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('writes each line with its cost, its provenance and the lead time the agreement carried', async () => {
		// "The line stores it and never re-reads the term afterwards, so a term renegotiated today changes
		// future orders only."
		const fixture = lineFixture({
			terms: [
				{
					id: 'term-1',
					tenantId: TENANT,
					organizationId: ORG,
					vendorId: VENDOR,
					variantId: VARIANT,
					currency: 'USD',
					unitCost: '4.200000',
					minQuantity: '0.000000',
					leadTimeDays: 3,
					priority: 100,
					status: 'ACTIVE'
				}
			]
		});

		const [written] = await fixture.service.replaceLines(ORDER, [{ variantId: VARIANT, quantity: '100' }], {
			vendorId: VENDOR,
			currency: 'USD',
			date: new Date('2026-03-01T00:00:00.000Z')
		});

		expect(written).toMatchObject({
			purchaseOrderId: ORDER,
			variantId: VARIANT,
			unitId: undefined,
			conversionFactor: '1',
			quantity: '100.000000',
			receivedQuantity: '0',
			damagedQuantity: '0',
			billedQuantity: '0',
			unitCost: '4.200000',
			vendorTermId: 'term-1',
			total: '0'
		});
		expect(written.metadata).toMatchObject({ pricing: { source: 'TERM', leadTimeDays: 3, warnings: [] } });
	});

	it('states a line’s own cost as given, and keeps the provenance the caller stated with it', async () => {
		// A line set rewritten as a unit keeps the term its price came from, which is why a caller that
		// states a cost may state its provenance too.
		const fixture = lineFixture();

		const [written] = await fixture.service.replaceLines(
			ORDER,
			[{ variantId: VARIANT, quantity: '2', unitCost: '9.5', vendorTermId: 'term-9', metadata: { note: 'rush' } }],
			{}
		);

		expect(written).toMatchObject({ unitCost: '9.500000', vendorTermId: 'term-9' });
		expect(written.metadata).toMatchObject({ note: 'rush', pricing: { source: 'MANUAL', leadTimeDays: 0 } });
	});

	it('refuses a line set that nothing prices, rather than writing a zero-cost commitment', async () => {
		// Doc 05 §16.5 step 6: a missing term is a warning when something else priced the line, and a
		// refusal when nothing did.
		const fixture = lineFixture({ variantCost: null });

		await expect(
			fixture.service.replaceLines(ORDER, [{ variantId: VARIANT, quantity: '1' }], {
				vendorId: VENDOR,
				currency: 'USD'
			})
		).rejects.toThrow(/VENDOR_TERM_NOT_FOUND/);
		expect(fixture.live()).toEqual([]);
	});

	it('requires a stated cost when the line is written without its order’s supplier', async () => {
		// "a line written without its order's supplier has nothing to price it from, so it has to state its
		// own unit cost."
		const fixture = lineFixture();

		await expect(
			fixture.service.replaceLines(ORDER, [{ variantId: VARIANT, quantity: '1' }], {})
		).rejects.toThrow(new RegExp(PurchasingCodes.PURCHASE_ORDER_LINE_COST_REQUIRED));
		await expect(
			fixture.service.replaceLines(ORDER, [{ variantId: VARIANT, quantity: '1', unitCost: '1' }], {})
		).resolves.toHaveLength(1);
	});

	it('refuses an empty set, a line naming no unit, and a non-positive quantity', async () => {
		const fixture = lineFixture();

		await expect(fixture.service.replaceLines(ORDER, [], {})).rejects.toThrow(/at least one line/);
		await expect(
			fixture.service.replaceLines(ORDER, [{ quantity: '1', unitCost: '1' } as never], {})
		).rejects.toThrow(/must name the variant being bought/);
		for (const quantity of ['0', '-1']) {
			await expect(
				fixture.service.replaceLines(ORDER, [{ variantId: VARIANT, quantity, unitCost: '1' }], {})
			).rejects.toThrow(/non-positive quantity/);
		}
		expect(fixture.live()).toEqual([]);
	});

	it('refuses the same unit twice for one expected date, and accepts it on two dates', async () => {
		// The unique tuple is `(purchaseOrderId, variantId, expectedAt)`: a split commitment is two lines,
		// and the same unit on the same date twice is a double entry.
		const fixture = lineFixture();
		const first = new Date('2026-04-01T00:00:00.000Z');
		const second = new Date('2026-07-01T00:00:00.000Z');

		await expect(
			fixture.service.replaceLines(
				ORDER,
				[
					{ variantId: VARIANT, quantity: '100', unitCost: '4.2', expectedAt: first },
					{ variantId: VARIANT, quantity: '500', unitCost: '3.9', expectedAt: new Date(first) }
				],
				{}
			)
		).rejects.toThrow(/ordered twice on one purchase order for the same expected date/);

		const written = await fixture.service.replaceLines(
			ORDER,
			[
				{ variantId: VARIANT, quantity: '100', unitCost: '4.2', expectedAt: first },
				{ variantId: VARIANT, quantity: '500', unitCost: '3.9', expectedAt: second }
			],
			{}
		);

		expect(written).toHaveLength(2);
	});

	it('replaces the set rather than merging into it, and soft-deletes the lines it dropped', async () => {
		const fixture = lineFixture({ lines: [lineRow('stale', { variantId: OTHER_VARIANT })] });

		const written = await fixture.service.replaceLines(
			ORDER,
			[{ variantId: VARIANT, quantity: '1', unitCost: '1' }],
			{}
		);

		expect(written).toHaveLength(1);
		expect(fixture.line('stale')?.deletedAt).toBeInstanceOf(Date);
		expect(fixture.live()).toHaveLength(1);
	});

	it('adds one line by rewriting the set, and keeps the surviving lines’ own columns', async () => {
		const fixture = lineFixture({
			lines: [lineRow('line-1', { unitCost: '4.200000', vendorTermId: 'term-1', metadata: { keep: true } })]
		});

		const added = await fixture.service.addLine(ORDER, { variantId: OTHER_VARIANT, quantity: '5', unitCost: '2' }, {});

		expect(added).toMatchObject({ variantId: OTHER_VARIANT, quantity: '5.000000', unitCost: '2.000000' });
		expect(fixture.live()).toHaveLength(2);
		expect(fixture.live().find((row) => row.variantId === VARIANT)).toMatchObject({
			unitCost: '4.200000',
			vendorTermId: 'term-1'
		});
	});

	// When the line set is rewritten with the order's own supplier and currency in context — which is how
	// the ordinary amend path and `addLine` are both called — a line that states its own cost is repriced
	// through the term service, and that branch answers without a `vendorTermId`. Every line that was
	// already on the order therefore loses the provenance it was priced with, which is the answer doc 05
	// §16.2 exists to preserve ("'why was this ordered at 4.20?' has an answer once the term is
	// renegotiated") and which `IPurchaseOrderLineInput.vendorTermId` promises is "kept when the caller
	// states the price too". The line service therefore carries the caller's own provenance onto a line
	// its own stated cost priced, while a line the agreement priced keeps the resolution's winner.
	it('keeps a line’s provenance when the set is rewritten with the order in context', async () => {
		const fixture = lineFixture({
			lines: [lineRow('line-1', { unitCost: '4.200000', vendorTermId: 'term-1' })]
		});

		await fixture.service.addLine(ORDER, { variantId: OTHER_VARIANT, quantity: '5', unitCost: '2' }, {
			vendorId: VENDOR,
			currency: 'USD'
		});

		// The set was rewritten, so the surviving line is the new row for the same unit — and it has to
		// carry the same provenance the line it replaced carried.
		expect(fixture.live().find((row) => row.variantId === VARIANT)).toMatchObject({
			unitCost: '4.200000',
			vendorTermId: 'term-1'
		});
	});

	it('still moves a line’s provenance when the rewrite states another one, or none at all', async () => {
		// The other direction, so keeping a line's provenance cannot be done by ignoring the field: a
		// caller that states a different term with its cost moves the line to it, and a caller that
		// states no cost hands the line to the agreement, whose own winner is then what it records.
		const restated = lineFixture({
			lines: [lineRow('line-1', { unitCost: '4.200000', vendorTermId: 'term-1' })]
		});

		const [moved] = await restated.service.replaceLines(
			ORDER,
			[{ variantId: VARIANT, quantity: '10', unitCost: '4.200000', vendorTermId: 'term-2' }],
			{ vendorId: VENDOR, currency: 'USD' }
		);

		expect(moved).toMatchObject({ unitCost: '4.200000', vendorTermId: 'term-2' });

		const repriced = lineFixture({
			lines: [lineRow('line-1', { unitCost: '9.500000', vendorTermId: 'term-9' })],
			terms: [
				{
					id: 'term-1',
					tenantId: TENANT,
					organizationId: ORG,
					vendorId: VENDOR,
					variantId: VARIANT,
					currency: 'USD',
					unitCost: '4.200000',
					minQuantity: '0.000000',
					leadTimeDays: 3,
					priority: 100,
					status: 'ACTIVE'
				}
			]
		});

		const [resolved] = await repriced.service.replaceLines(
			ORDER,
			[{ variantId: VARIANT, quantity: '100' }],
			{ vendorId: VENDOR, currency: 'USD' }
		);

		expect(resolved).toMatchObject({ unitCost: '4.200000', vendorTermId: 'term-1' });
	});

	it('reads a set of lines by their identity, whoever’s order they belong to', async () => {
		const fixture = lineFixture({
			lines: [
				lineRow('line-1'),
				lineRow('line-2', { variantId: OTHER_VARIANT }),
				lineRow('line-3', { purchaseOrderId: 'another-order', tenantId: 'another-tenant' })
			]
		});

		const indexed = await fixture.service.findIndexedByIds(['line-1', 'line-3']);

		expect([...indexed.keys()]).toEqual(['line-1']);
		await expect(fixture.service.findIndexedByIds([])).rejects.toThrow(/no purchase-order line was named/);
	});

	it('reads an order’s lines inside the caller’s organization, oldest first', async () => {
		const fixture = lineFixture({
			lines: [
				lineRow('second', { createdAt: '2026-01-01T00:00:02.000Z' }),
				lineRow('first', { createdAt: '2026-01-01T00:00:01.000Z' }),
				lineRow('theirs', { organizationId: 'another-organization' })
			]
		});

		expect((await fixture.service.findForOrder(ORDER)).map((line) => line.id)).toEqual(['first', 'second']);
		expect([...(await fixture.service.findForOrderIndexed(ORDER)).keys()]).toEqual(['first', 'second']);
		await expect(fixture.service.findScoped('theirs')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('PurchaseOrderLineService — the received counters the receipt service moves', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('applies the signed deltas of a receipt, and of its reversal', async () => {
		// The same path takes the quantity back off, which is what makes a reversal leave the counters where
		// they were rather than needing a second rule.
		const fixture = lineFixture({ lines: [lineRow('line-1')] });

		const afterReceipt = await fixture.service.applyReceiptDeltas(ORDER, [
			{ lineId: 'line-1', receivedQuantity: '8.000000', damagedQuantity: '1.000000' }
		]);

		expect(afterReceipt[0]).toMatchObject({ receivedQuantity: '8.000000', damagedQuantity: '1.000000' });

		const afterReversal = await fixture.service.applyReceiptDeltas(ORDER, [
			{ lineId: 'line-1', receivedQuantity: '-8.000000', damagedQuantity: '-1.000000' }
		]);

		expect(afterReversal[0]).toMatchObject({ receivedQuantity: '0.000000', damagedQuantity: '0.000000' });
	});

	it('refuses a reversal that would take a line below what it has received, and writes nothing', async () => {
		const fixture = lineFixture({ lines: [lineRow('line-1', { receivedQuantity: '3.000000' })] });

		await expect(
			fixture.service.applyReceiptDeltas(ORDER, [
				{ lineId: 'line-1', receivedQuantity: '-4.000000', damagedQuantity: '0' }
			])
		).rejects.toThrow(/below what it has received/);
		expect(fixture.line('line-1')?.receivedQuantity).toBe('3.000000');
	});

	it('refuses a delta naming a line that does not belong to the order', async () => {
		const fixture = lineFixture({ lines: [lineRow('line-1')] });

		await expect(
			fixture.service.applyReceiptDeltas(ORDER, [
				{ lineId: 'a-line-of-another-order', receivedQuantity: '1.000000', damagedQuantity: '0' }
			])
		).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('PurchaseOrderLineService — dating a line from the agreement it was placed under', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('fills the expected date from the lead time the line snapshotted, at the instant it is sent', async () => {
		// `expectedAt = orderedAt + leadTimeDays`, read from the line's own snapshot — "a term renegotiated
		// since the order was raised cannot move a commitment the supplier has already been given".
		const fixture = lineFixture({
			lines: [
				lineRow('with-lead-time', { metadata: { pricing: { leadTimeDays: 3 } } }),
				lineRow('with-none', { variantId: OTHER_VARIANT, metadata: { pricing: { leadTimeDays: 0 } } })
			]
		});
		const orderedAt = new Date('2026-03-01T00:00:00.000Z');

		const written = await fixture.service.applyLeadTimes(ORDER, orderedAt);

		expect(written.map((line) => line.expectedAt)).toEqual([
			new Date('2026-03-04T00:00:00.000Z'),
			new Date('2026-03-01T00:00:00.000Z')
		]);
	});

	it('keeps an expected date the line already states, because a stated date is the commitment', async () => {
		const fixture = lineFixture({
			lines: [
				lineRow('stated', {
					expectedAt: new Date('2026-02-01T00:00:00.000Z'),
					metadata: { pricing: { leadTimeDays: 3 } }
				})
			]
		});

		const written = await fixture.service.applyLeadTimes(ORDER, new Date('2026-03-01T00:00:00.000Z'));

		expect(written[0].expectedAt).toEqual(new Date('2026-02-01T00:00:00.000Z'));
	});
});
