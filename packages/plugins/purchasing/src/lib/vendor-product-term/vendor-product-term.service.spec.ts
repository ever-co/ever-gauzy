/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a term service needs and none of which is available
 * outside a running application. The seam is therefore doubled at the module boundary, exactly as the
 * catalogue and inventory packages' service specs do, and **the service under test is the real one**,
 * with the platform's real money layer behind it.
 *
 * The platform entities the service resolves a supplier, a variant and a cost price through are the
 * only pieces substituted by the mock: they are identity, not behaviour — the service uses them to
 * name a table.
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

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
	Organization,
	OrganizationVendor,
	ProductVariant,
	ProductVariantPrice,
	RequestContext
} from '@gauzy/core';
import { PurchaseOrderLine } from '../purchase-order-line/purchase-order-line.entity';
import { VendorTermStatus } from '../purchasing.types';
import { VendorProductTermService } from './vendor-product-term.service';

/**
 * The negotiated agreements with the organization's suppliers, and the resolution that prices an order
 * line from them.
 *
 * Doc 05 §16.5 states the two rules this suite is built around, and both are stated as authoritative
 * there:
 *
 * - **the precedence: term row → vendor row → organization setting → none.** "`leadTimeDays`,
 *   `minimumOrderAmount` and `currency` on `organization_vendor` are read only when the winning term
 *   row does not carry its own."
 * - **I-82: for one `(organizationId, vendorId, variantId, currency)`, two `ACTIVE` rows whose windows
 *   overlap may not have overlapping quantity bands** — "a row's band is `[minQuantity, next higher
 *   minQuantity)`, open-ended at the top; the service refuses with `VENDOR_TERM_OVERLAP`". The band's
 *   upper bound is another row's lower bound, so the database cannot state it and the service must.
 *
 * The resolution order of §16.5 is pinned case by case: candidates are the `ACTIVE` rows whose window
 * contains the date and whose break the quantity reaches, ordered by `priority`, then by `minQuantity`
 * descending, then by cost, then by id; a missing term is a **warning** (`VENDOR_TERM_NOT_FOUND`) and
 * never a refusal; and a term stated in another currency is refused with
 * `PRICE_EXCHANGE_RATE_MISSING` "rather than converted at an assumed 1:1 — inventing a rate would be
 * worse than refusing, because the wrong price is then snapshotted onto a placed order".
 *
 * The service is constructed directly over in-memory tables. The doubles state the `where` the service
 * states, because a double that returned every row regardless would make both rules above vacuous.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const VENDOR = 'vendor-1';
const OTHER_VENDOR = 'vendor-2';
const VARIANT = 'variant-1';
const OTHER_VARIANT = 'variant-2';

type Row = Record<string, any>;

interface ITables {
	vendor_product_term: Row[];
	organization_vendor: Row[];
	product_variant: Row[];
	product_variant_price: Row[];
	organization: Row[];
	purchase_order_line: Row[];
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

			if (expected instanceof Date || row[field] instanceof Date) {
				return new Date(expected as never).getTime() === new Date(row[field] ?? 0).getTime();
			}

			return same(row[field], expected);
		});

	return {
		rows,
		all: () => tables[tableName],
		find: async (options: any = {}) => rows().filter((row) => matches(row, options.where)),
		findOne: async (options: any = {}) => rows().find((row) => matches(row, options.where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = rows().filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async (options: any = {}) => rows().filter((row) => matches(row, options.where)).length,
		create: (partial: any) => ({ ...partial }),
		save: async (entity: any) => {
			if (entity.id) {
				const index = tables[tableName].findIndex((row) => same(row.id, entity.id));

				if (index >= 0) {
					tables[tableName][index] = { ...tables[tableName][index], ...entity };

					return tables[tableName][index];
				}
			}

			const created = { id: `${String(tableName)}-new-${++sequence}`, ...entity };

			tables[tableName].push(created);

			return created;
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

/** One `vendor_product_term` row, as the service reads it. */
const termRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	vendorId: VENDOR,
	variantId: VARIANT,
	currency: 'USD',
	unitCost: '4.200000',
	minQuantity: '0.000000',
	priority: 100,
	status: VendorTermStatus.ACTIVE,
	...overrides
});

/**
 * Builds the term service over one in-memory store.
 *
 * @param options.terms The terms the fixture starts with.
 * @param options.usedByOrderLines The order lines that name a term, so the retirement case is reachable.
 * @param options.vendor What the supplier master states.
 * @param options.organization What the organization states.
 * @param options.variantCost The variant's own cost price, when it has one.
 */
function termFixture(
	options: {
		terms?: Row[];
		usedByOrderLines?: Row[];
		vendor?: Row | null;
		organization?: Row | null;
		variantCost?: Row | null;
	} = {}
) {
	const tables: ITables = {
		vendor_product_term: [...(options.terms ?? [])],
		organization_vendor: [
			options.vendor === null
				? undefined
				: {
						id: VENDOR,
						tenantId: TENANT,
						organizationId: ORG,
						name: 'Supplier',
						currency: 'USD',
						isActive: true,
						...(options.vendor ?? {})
				  },
			{ id: OTHER_VENDOR, tenantId: TENANT, organizationId: ORG, name: 'Other supplier', isActive: true }
		].filter(Boolean) as Row[],
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
							unitCost: '6.500000',
							unitCostCurrency: 'USD',
							...(options.variantCost ?? {})
						}
				  ],
		organization: [
			options.organization === null
				? undefined
				: { id: ORG, tenantId: TENANT, currency: 'EUR', ...(options.organization ?? {}) }
		].filter(Boolean) as Row[],
		purchase_order_line: [...(options.usedByOrderLines ?? [])]
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
				// The cost-price read is stated as a relation, which the double resolves the way the ORM
				// would: by the variant the row points at.
				const wanted = findOptions.where?.productVariant?.id;

				return (
					tables.product_variant_price.find(
						(row) =>
							String(row.productVariant?.id ?? '') === String(wanted ?? '') &&
							String(row.tenantId ?? '') === String(findOptions.where?.tenantId ?? '') &&
							String(row.organizationId ?? '') === String(findOptions.where?.organizationId ?? '')
					) ?? null
				);
			}
			if (entity === Organization) {
				return repository(tables, 'organization').findOne(findOptions);
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

	const service = new VendorProductTermService(termRepository as never, {} as never);

	return {
		service,
		tables,
		term: (id: string) => tables.vendor_product_term.find((row) => row.id === id),
		live: () => tables.vendor_product_term.filter((row) => !row.deletedAt)
	};
}

describe('VendorProductTermService — writing a term (doc 05 §16.5)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('writes a term with its price, its break and its window, inheriting the supplier’s currency', async () => {
		const fixture = termFixture();

		const created = await fixture.service.create({
			vendorId: VENDOR,
			variantId: VARIANT,
			unitCost: '4.20',
			minQuantity: '500',
			leadTimeDays: 3,
			overReceiptTolerancePercent: '0.02',
			discountPercent: '0.05',
			packSize: '12',
			packLabel: 'case'
		});

		expect(created).toMatchObject({
			vendorId: VENDOR,
			variantId: VARIANT,
			currency: 'USD',
			unitCost: '4.200000',
			minQuantity: '500.000000',
			leadTimeDays: 3,
			overReceiptTolerancePercent: '0.020000',
			discountPercent: '0.050000',
			packSize: '12.000000',
			packLabel: 'case',
			// The explicit tie-break before price, defaulted so a price never depends on row order.
			priority: 100,
			status: VendorTermStatus.ACTIVE,
			tenantId: TENANT,
			organizationId: ORG
		});
	});

	it('refuses a term that names no supplier or no unit', async () => {
		const fixture = termFixture();

		await expect(fixture.service.create({ variantId: VARIANT, unitCost: '1' } as never)).rejects.toThrow(
			/VENDOR_TERM_VENDOR_REQUIRED/
		);
		await expect(fixture.service.create({ vendorId: VENDOR, unitCost: '1' } as never)).rejects.toThrow(
			/VENDOR_TERM_VARIANT_REQUIRED/
		);
		expect(fixture.live()).toEqual([]);
	});

	it('refuses a supplier that does not exist, and one that is archived or inactive', async () => {
		const unknown = termFixture({ vendor: null });
		const inactive = termFixture({ vendor: { isActive: false } });
		const archived = termFixture({ vendor: { isArchived: true } });

		await expect(
			unknown.service.create({ vendorId: VENDOR, variantId: VARIANT, unitCost: '1' } as never)
		).rejects.toBeInstanceOf(NotFoundException);
		for (const fixture of [inactive, archived]) {
			await expect(
				fixture.service.create({ vendorId: VENDOR, variantId: VARIANT, unitCost: '1' } as never)
			).rejects.toThrow(/VENDOR_TERM_VENDOR_INACTIVE/);
		}
		expect(inactive.live()).toEqual([]);
	});

	it('refuses a unit the organization does not carry', async () => {
		const fixture = termFixture();

		await expect(
			fixture.service.create({ vendorId: VENDOR, variantId: 'no-such-variant', unitCost: '1' } as never)
		).rejects.toThrow(/VENDOR_TERM_VARIANT_NOT_FOUND/);
	});

	it('refuses a term that states no price at all, and a container price with no container size', async () => {
		// A term is a statement about what a unit costs; a row without one would price a line at nothing.
		const fixture = termFixture();

		await expect(
			fixture.service.create({ vendorId: VENDOR, variantId: VARIANT } as never)
		).rejects.toThrow(/VENDOR_TERM_PRICE_REQUIRED/);
		await expect(
			fixture.service.create({ vendorId: VENDOR, variantId: VARIANT, packPrice: '10.80' } as never)
		).rejects.toThrow(/VENDOR_TERM_PACK_SIZE_REQUIRED/);
		expect(fixture.live()).toEqual([]);
	});

	it('derives the price of one base unit from the container price, rounded half-up at six decimals', async () => {
		// Doc 05 §16.5: "`unitCost` is obtained as `packPrice / packSize`, rounded HALF-UP to six decimals,
		// so the platform's own total stays authoritative and recomputable from the row."
		const fixture = termFixture();
		const exact = await fixture.service.create({
			vendorId: VENDOR,
			variantId: VARIANT,
			packPrice: '10.80',
			packSize: '12'
		});
		const recurring = await fixture.service.create({
			vendorId: VENDOR,
			variantId: OTHER_VARIANT,
			packPrice: '10.00',
			packSize: '12'
		});

		expect(exact.unitCost).toBe('0.900000');
		// 10/12 is 0.8333…; the sixth decimal rounds half-up and the series is not carried into the row.
		expect(recurring.unitCost).toBe('0.833333');
	});

	it('refuses a window that ends before it starts, at the boundary', async () => {
		const fixture = termFixture();
		const startsAt = new Date('2026-01-01T00:00:00.000Z');

		await expect(
			fixture.service.create({
				vendorId: VENDOR,
				variantId: VARIANT,
				unitCost: '1',
				startsAt,
				endsAt: new Date(startsAt.getTime() - 1)
			} as never)
		).rejects.toThrow(/VENDOR_TERM_WINDOW_INVALID/);
		// A window of zero length prices nothing either.
		await expect(
			fixture.service.create({
				vendorId: VENDOR,
				variantId: VARIANT,
				unitCost: '1',
				startsAt,
				endsAt: new Date(startsAt)
			} as never)
		).rejects.toThrow(/VENDOR_TERM_WINDOW_INVALID/);
		expect(fixture.live()).toEqual([]);
	});

	it('refuses a term with no currency to inherit', async () => {
		// "A price without its currency is not a price": the chain is the supplier's purchase currency,
		// then the organization's base currency, and a tenant that states neither is a configuration fault
		// worth naming.
		const fixture = termFixture({ vendor: { currency: undefined }, organization: { currency: undefined } });

		await expect(
			fixture.service.create({ vendorId: VENDOR, variantId: VARIANT, unitCost: '1' } as never)
		).rejects.toThrow(/VENDOR_TERM_CURRENCY_REQUIRED/);
	});

	it('inherits the organization’s base currency when the supplier states none', async () => {
		const fixture = termFixture({ vendor: { currency: undefined } });

		const created = await fixture.service.create({ vendorId: VENDOR, variantId: VARIANT, unitCost: '1' });

		expect(created.currency).toBe('EUR');
	});

	it('refuses a term written with no organization in context', async () => {
		const fixture = termFixture();

		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(null);

		await expect(
			fixture.service.create({ vendorId: VENDOR, variantId: VARIANT, unitCost: '1' } as never)
		).rejects.toThrow(/VENDOR_TERM_ORGANIZATION_REQUIRED/);
	});
});

describe('VendorProductTermService — the quantity band one live row may claim (I-82)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a band another live row of the same supplier, unit and currency already claims', async () => {
		// "The database cannot state it (the band's upper bound is another row's lower bound), so the
		// service checks it on every write."
		const fixture = termFixture({ terms: [termRow('rival', { minQuantity: '500.000000' })] });

		await expect(
			fixture.service.create({ vendorId: VENDOR, variantId: VARIANT, unitCost: '3.90', minQuantity: '500' } as never)
		).rejects.toThrow(/VENDOR_TERM_OVERLAP/);
		expect(fixture.live()).toHaveLength(1);
	});

	it('accepts a different break, a different unit, a different supplier and a different currency', async () => {
		// Controls for the refusal above: the band is claimed per group, and a group is the four keys the
		// invariant names.
		const fixture = termFixture({ terms: [termRow('rival', { minQuantity: '500.000000' })] });

		const otherBreak = await fixture.service.create({
			vendorId: VENDOR,
			variantId: VARIANT,
			unitCost: '3.90',
			minQuantity: '100'
		});
		const otherUnit = await fixture.service.create({
			vendorId: VENDOR,
			variantId: OTHER_VARIANT,
			unitCost: '3.90',
			minQuantity: '500'
		});
		const otherSupplier = await fixture.service.create({
			vendorId: OTHER_VENDOR,
			variantId: VARIANT,
			unitCost: '3.90',
			minQuantity: '500'
		});
		const otherCurrency = await fixture.service.create({
			vendorId: VENDOR,
			variantId: VARIANT,
			currency: 'EUR',
			unitCost: '3.90',
			minQuantity: '500'
		});

		expect([otherBreak, otherUnit, otherSupplier, otherCurrency]).toHaveLength(4);
		expect(fixture.live()).toHaveLength(5);
	});

	it('does not treat a draft or a retired row as a rival', async () => {
		// "`DRAFT` and `INACTIVE` rows are not candidates for pricing and are therefore not part of the
		// check."
		const fixture = termFixture({
			terms: [
				termRow('draft', { minQuantity: '500.000000', status: VendorTermStatus.DRAFT }),
				termRow('retired', { minQuantity: '500.000000', status: VendorTermStatus.INACTIVE })
			]
		});

		await expect(
			fixture.service.create({ vendorId: VENDOR, variantId: VARIANT, unitCost: '3.90', minQuantity: '500' } as never)
		).resolves.toMatchObject({ minQuantity: '500.000000' });
	});

	it('does not treat a row whose window never overlaps as a rival, at the exact boundary', async () => {
		// Two windows overlap when they cover a common instant, and a window that closes exactly when the
		// other opens covers the same instant only at that point — which the rule counts as an overlap.
		const startsAt = new Date('2026-06-01T00:00:00.000Z');
		const touching = termFixture({
			terms: [termRow('rival', { minQuantity: '500.000000', endsAt: new Date(startsAt) })]
		});
		const apart = termFixture({
			terms: [termRow('rival', { minQuantity: '500.000000', endsAt: new Date(startsAt.getTime() - 1) })]
		});

		await expect(
			touching.service.create({ vendorId: VENDOR, variantId: VARIANT, unitCost: '3.90', minQuantity: '500', startsAt } as never)
		).rejects.toThrow(/VENDOR_TERM_OVERLAP/);
		await expect(
			apart.service.create({ vendorId: VENDOR, variantId: VARIANT, unitCost: '3.90', minQuantity: '500', startsAt } as never)
		).resolves.toMatchObject({ startsAt });
	});

	it('checks the band again on an amendment, excluding the row being amended', async () => {
		const fixture = termFixture({ terms: [termRow('term-1', { minQuantity: '500.000000' })] });

		// Restating its own break is not an overlap with itself.
		await expect(
			fixture.service.update('term-1', { minQuantity: '500', unitCost: '3.90' })
		).resolves.toMatchObject({ unitCost: '3.90' });

		// But a second row claiming the same break is.
		await fixture.service.create({ vendorId: VENDOR, variantId: VARIANT, unitCost: '4.50', minQuantity: '1000' });

		await expect(fixture.service.update('term-1', { minQuantity: '1000' })).rejects.toThrow(
			/VENDOR_TERM_OVERLAP/
		);
		expect(fixture.term('term-1')).toMatchObject({ minQuantity: '500.000000' });
	});

	it('lets a row be retired out of the way of a new one', async () => {
		// The band is claimed by *live* rows, so moving a row to `INACTIVE` is what frees its break —
		// which is exactly how a renegotiation is recorded without deleting what an order was priced on.
		const fixture = termFixture({ terms: [termRow('old', { minQuantity: '500.000000' })] });

		await fixture.service.update('old', { status: VendorTermStatus.INACTIVE });

		await expect(
			fixture.service.create({ vendorId: VENDOR, variantId: VARIANT, unitCost: '3.90', minQuantity: '500' } as never)
		).resolves.toMatchObject({ minQuantity: '500.000000' });
	});
});

describe('VendorProductTermService — retiring a term a placed order used (doc 05 §16.5)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('deletes a term nothing has used', async () => {
		const fixture = termFixture({ terms: [termRow('unused')] });

		await fixture.service.delete('unused');

		expect(fixture.live()).toEqual([]);
		expect(fixture.tables.vendor_product_term).toEqual([]);
	});

	it('retires a term a placed order used instead of deleting it, so the order stays explainable', async () => {
		// "A term a placed order used is never deleted — its `status` moves to `INACTIVE` — so history
		// stays readable" and `purchase_order_line.vendorTermId` keeps pointing at something.
		const fixture = termFixture({
			terms: [termRow('used', { unitCost: '4.200000' })],
			usedByOrderLines: [{ id: 'po-line-1', tenantId: TENANT, organizationId: ORG, vendorTermId: 'used' }]
		});

		const retired = await fixture.service.delete('used');

		expect(retired).toMatchObject({ id: 'used', status: VendorTermStatus.INACTIVE, unitCost: '4.200000' });
		expect(fixture.tables.vendor_product_term).toHaveLength(1);

		// And it is no longer a candidate for pricing, which is what retirement means.
		const afterRetirement = await fixture.service.resolve({
			vendorId: VENDOR,
			variantId: VARIANT,
			quantity: '1',
			currency: 'USD'
		});

		expect(afterRetirement.term).toBeUndefined();
		expect(afterRetirement.warnings).toEqual(['VENDOR_TERM_NOT_FOUND']);
		expect(afterRetirement.source).toBe('VARIANT_COST_PRICE');
	});

	it('refuses to retire a term that is not the caller’s', async () => {
		const fixture = termFixture({ terms: [termRow('theirs', { organizationId: OTHER_ORG })] });

		await expect(fixture.service.delete('theirs')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('VendorProductTermService — the bulk write of a product-wide agreement', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('writes one row per unit, and amends the row whose business key already exists', async () => {
		// A catalogue-wide price is one row per variant, and writing it twice must amend rather than add a
		// second row claiming the same band.
		const fixture = termFixture();
		const first = await fixture.service.bulkUpsert([
			{ vendorId: VENDOR, variantId: VARIANT, unitCost: '4.20', minQuantity: '0' },
			{ vendorId: VENDOR, variantId: OTHER_VARIANT, unitCost: '5.10', minQuantity: '0' }
		]);

		expect(first).toHaveLength(2);
		expect(fixture.live()).toHaveLength(2);

		const second = await fixture.service.bulkUpsert([
			{ vendorId: VENDOR, variantId: VARIANT, unitCost: '3.95', minQuantity: '0' },
			{ vendorId: VENDOR, variantId: OTHER_VARIANT, unitCost: '5.10', minQuantity: '0' }
		]);

		expect(second[0]).toMatchObject({ id: first[0].id, unitCost: '3.95' });
		expect(fixture.live()).toHaveLength(2);
	});

	it('refuses an empty bulk write', async () => {
		const fixture = termFixture();

		await expect(fixture.service.bulkUpsert([])).rejects.toBeInstanceOf(BadRequestException);
	});
});

describe('VendorProductTermService — resolving the price of a quantity (doc 05 §16.5)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('picks the best break the quantity actually reaches', async () => {
		// "Order by `priority`, then `minQuantity` descending (the best break the quantity actually
		// reaches)" — a quantity of 500 earns the 500 break and not the 1000 one.
		const fixture = termFixture({
			terms: [
				termRow('base', { minQuantity: '0.000000', unitCost: '5.000000' }),
				termRow('five-hundred', { minQuantity: '500.000000', unitCost: '4.200000', leadTimeDays: 3 }),
				termRow('one-thousand', { minQuantity: '1000.000000', unitCost: '3.900000', leadTimeDays: 10 })
			]
		});

		const at500 = await fixture.service.resolve({
			vendorId: VENDOR,
			variantId: VARIANT,
			quantity: '500',
			currency: 'USD'
		});
		const at999 = await fixture.service.resolve({
			vendorId: VENDOR,
			variantId: VARIANT,
			quantity: '999.999999',
			currency: 'USD'
		});
		const at1000 = await fixture.service.resolve({
			vendorId: VENDOR,
			variantId: VARIANT,
			quantity: '1000',
			currency: 'USD'
		});

		expect(at500).toMatchObject({ unitCost: '4.200000', leadTimeDays: 3, source: 'TERM', warnings: [] });
		expect(at500.term?.id).toBe('five-hundred');
		expect(at999.term?.id).toBe('five-hundred');
		expect(at1000).toMatchObject({ unitCost: '3.900000', leadTimeDays: 10 });
	});

	it('lets the explicit tie-break decide between two rows that both match, before the price does', async () => {
		// "Without it a line's price depends on row-insertion order, and a non-deterministic price is worse
		// than a missing one."
		const fixture = termFixture({
			terms: [
				termRow('cheap-but-lower-priority', { minQuantity: '0.000000', unitCost: '1.000000', priority: 200 }),
				termRow('dear-but-higher-priority', { minQuantity: '0.000000', unitCost: '9.000000', priority: 10 })
			]
		});

		const resolution = await fixture.service.resolve({
			vendorId: VENDOR,
			variantId: VARIANT,
			quantity: '1',
			currency: 'USD'
		});

		expect(resolution.term?.id).toBe('dear-but-higher-priority');
		expect(resolution.unitCost).toBe('9.000000');
	});

	it('breaks a tie on priority and break by the lower cost', async () => {
		const fixture = termFixture({
			terms: [
				termRow('dear', { minQuantity: '0.000000', unitCost: '9.000000', priority: 100 }),
				termRow('cheap', { minQuantity: '0.000000', unitCost: '1.000000', priority: 100 })
			]
		});

		expect(
			(
				await fixture.service.resolve({
					vendorId: VENDOR,
					variantId: VARIANT,
					quantity: '1',
					currency: 'USD'
				})
			).term?.id
		).toBe('cheap');
	});

	it('leaves out a row whose window does not contain the date, and one that is not active', async () => {
		const fixture = termFixture({
			terms: [
				termRow('closed', {
					minQuantity: '0.000000',
					unitCost: '1.000000',
					endsAt: new Date('2026-01-01T00:00:00.000Z')
				}),
				termRow('draft', { minQuantity: '0.000000', unitCost: '2.000000', status: VendorTermStatus.DRAFT }),
				termRow('live', {
					minQuantity: '0.000000',
					unitCost: '3.000000',
					startsAt: new Date('2026-01-01T00:00:00.000Z')
				})
			]
		});

		const duringTheWindow = await fixture.service.resolve({
			vendorId: VENDOR,
			variantId: VARIANT,
			quantity: '1',
			currency: 'USD',
			date: new Date('2026-03-01T00:00:00.000Z')
		});
		const beforeItOpened = await fixture.service.resolve({
			vendorId: VENDOR,
			variantId: VARIANT,
			quantity: '1',
			currency: 'USD',
			date: new Date('2025-12-31T00:00:00.000Z')
		});

		expect(duringTheWindow.term?.id).toBe('live');
		// The retired-by-date row is the only candidate before the live one opens, and the draft is never
		// one at all.
		expect(beforeItOpened.term?.id).toBe('closed');
	});

	it('treats both bounds of a validity window as inclusive', async () => {
		// A null bound is open-ended, and a stated one contains the instant it names: the row that closes
		// exactly when the next one opens is still a candidate at that instant, and stops being one a
		// millisecond later.
		const fixture = termFixture({
			terms: [
				termRow('closing', {
					minQuantity: '0.000000',
					unitCost: '1.000000',
					endsAt: new Date('2026-01-01T00:00:00.000Z')
				}),
				termRow('opening', {
					minQuantity: '0.000000',
					unitCost: '3.000000',
					startsAt: new Date('2026-01-01T00:00:00.000Z')
				})
			]
		});

		const atTheBoundary = await fixture.service.resolve({
			vendorId: VENDOR,
			variantId: VARIANT,
			quantity: '1',
			currency: 'USD',
			date: new Date('2026-01-01T00:00:00.000Z')
		});
		const afterTheBoundary = await fixture.service.resolve({
			vendorId: VENDOR,
			variantId: VARIANT,
			quantity: '1',
			currency: 'USD',
			date: new Date('2026-01-01T00:00:00.001Z')
		});

		// Both rows are candidates at the shared instant, and the cost tie-break picks the one that closed.
		expect(atTheBoundary.term?.id).toBe('closing');
		expect(afterTheBoundary.term?.id).toBe('opening');
	});

	it('falls through to the unit’s own cost price with a warning when no term matches', async () => {
		// "A missing term is a **warning** (`VENDOR_TERM_NOT_FOUND`) on the response, never a refusal — an
		// order may be raised against a vendor we have no standing agreement with."
		const fixture = termFixture({ variantCost: { unitCost: '6.500000', unitCostCurrency: 'USD' } });

		const resolution = await fixture.service.resolve({
			vendorId: VENDOR,
			variantId: VARIANT,
			quantity: '1',
			currency: 'USD'
		});

		expect(resolution).toMatchObject({
			source: 'VARIANT_COST_PRICE',
			unitCost: '6.500000',
			currency: 'USD',
			warnings: ['VENDOR_TERM_NOT_FOUND']
		});
		expect(resolution.term).toBeUndefined();
	});

	it('answers nothing at all when there is neither a term nor a cost price', async () => {
		const fixture = termFixture({ variantCost: null });

		await expect(
			fixture.service.resolve({ vendorId: VENDOR, variantId: VARIANT, quantity: '1', currency: 'USD' })
		).resolves.toMatchObject({ source: 'NONE', unitCost: '0', warnings: ['VENDOR_TERM_NOT_FOUND'] });
	});

	it('ignores a cost price stated in another currency, rather than treating it as the order’s', async () => {
		const fixture = termFixture({ variantCost: { unitCost: '6.500000', unitCostCurrency: 'GBP' } });

		await expect(
			fixture.service.resolve({ vendorId: VENDOR, variantId: VARIANT, quantity: '1', currency: 'USD' })
		).resolves.toMatchObject({ source: 'NONE', unitCost: '0' });
	});

	it('refuses a winning term stated in another currency rather than assuming a rate', async () => {
		// Doc 05 §16.5 step 4: "A missing rate is `PRICE_EXCHANGE_RATE_MISSING`, never an implicit 1:1."
		const fixture = termFixture({ terms: [termRow('euro-term', { currency: 'EUR', unitCost: '3.500000' })] });

		await expect(
			fixture.service.resolve({ vendorId: VENDOR, variantId: VARIANT, quantity: '1', currency: 'USD' })
		).rejects.toThrow(/PRICE_EXCHANGE_RATE_MISSING/);
	});

	it('reports the lead time, the container and the supplier’s floor from the rows the precedence names', async () => {
		// Term → vendor → nothing: the winning row's own lead time wins, and the vendor's floor is reported
		// as it stands rather than inferred.
		const fixture = termFixture({
			terms: [
				termRow('with-lead-time', {
					minQuantity: '0.000000',
					unitCost: '4.200000',
					leadTimeDays: 3,
					packSize: '12.000000',
					packLabel: 'case',
					vendorProductCode: 'SUP-1',
					vendorProductName: 'Their name',
					overReceiptTolerancePercent: '0.020000'
				}),
				termRow('without-lead-time', { id: 'no-lead', minQuantity: '100.000000', unitCost: '4.000000' })
			],
			vendor: { leadTimeDays: 21, minimumOrderAmount: '250.000000' }
		});

		const winner = await fixture.service.resolve({
			vendorId: VENDOR,
			variantId: VARIANT,
			quantity: '1',
			currency: 'USD'
		});
		const fallthrough = await fixture.service.resolve({
			vendorId: VENDOR,
			variantId: VARIANT,
			quantity: '150',
			currency: 'USD'
		});

		expect(winner).toMatchObject({
			leadTimeDays: 3,
			packSize: '12.000000',
			packLabel: 'case',
			vendorProductCode: 'SUP-1',
			vendorProductName: 'Their name',
			overReceiptTolerancePercent: '0.020000',
			minimumOrderAmount: '250.000000'
		});
		// The row that states no lead time of its own inherits the supplier's, which is what makes the
		// precedence a chain rather than a fallback to nothing.
		expect(fallthrough).toMatchObject({ leadTimeDays: 21, minimumOrderAmount: '250.000000' });
	});

	it('refuses a resolution that names no supplier or no unit', async () => {
		const fixture = termFixture();

		await expect(
			fixture.service.resolve({ vendorId: undefined as never, variantId: VARIANT, quantity: '1', currency: 'USD' })
		).rejects.toThrow(/VENDOR_TERM_CONTEXT_INCOMPLETE/);
		await expect(
			fixture.service.resolve({ vendorId: VENDOR, variantId: undefined as never, quantity: '1', currency: 'USD' })
		).rejects.toThrow(/VENDOR_TERM_CONTEXT_INCOMPLETE/);
	});

	it('does not read another organization’s terms', async () => {
		const fixture = termFixture({
			terms: [termRow('theirs', { organizationId: OTHER_ORG, minQuantity: '0.000000', unitCost: '0.010000' })]
		});

		const resolution = await fixture.service.resolve({
			vendorId: VENDOR,
			variantId: VARIANT,
			quantity: '1',
			currency: 'USD'
		});

		expect(resolution.term).toBeUndefined();
		expect(resolution.source).toBe('VARIANT_COST_PRICE');
	});
});

describe('VendorProductTermService — pricing one order line (doc 05 §16.5 step 7)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('snapshots the winning term as provenance and states the lead time it carried', async () => {
		const fixture = termFixture({
			terms: [
				termRow('winner', {
					minQuantity: '0.000000',
					unitCost: '4.200000',
					discountPercent: '0.05',
					leadTimeDays: 3,
					packSize: '12.000000'
				})
			]
		});

		const pricing = await fixture.service.priceLine(
			{ vendorId: VENDOR, variantId: VARIANT, quantity: '100' },
			'USD'
		);

		expect(pricing).toMatchObject({
			vendorTermId: 'winner',
			unitCost: '4.200000',
			// The negotiated fraction is snapshotted as the amount it produces for this quantity.
			discountTotal: '21.000000',
			orderedPackSize: '12.000000',
			leadTimeDays: 3,
			source: 'TERM',
			warnings: []
		});
	});

	it('records a price the caller stated as manual, keeping the supplier’s lead time', async () => {
		// "A caller that states a cost has priced the line by hand, so the term is not its provenance — but
		// the supplier's own lead time still dates it, because the delivery expectation is a fact about the
		// supplier rather than about the price."
		const fixture = termFixture({
			terms: [termRow('ignored', { minQuantity: '0.000000', unitCost: '1.000000', leadTimeDays: 99 })],
			vendor: { leadTimeDays: 21 }
		});

		const pricing = await fixture.service.priceLine(
			{ vendorId: VENDOR, variantId: VARIANT, quantity: '10', unitCost: '7.5', discountTotal: '2' },
			'USD'
		);

		expect(pricing).toMatchObject({
			unitCost: '7.500000',
			discountTotal: '2.000000',
			leadTimeDays: 21,
			source: 'MANUAL',
			warnings: []
		});
		expect(pricing.vendorTermId).toBeUndefined();
	});

	it('refuses a line nothing can price rather than writing it at zero', async () => {
		// "a line with no price at all would post a zero-cost commitment, so it is refused and the caller
		// states one."
		const fixture = termFixture({ variantCost: null });

		await expect(
			fixture.service.priceLine({ vendorId: VENDOR, variantId: VARIANT, quantity: '1' }, 'USD')
		).rejects.toThrow(/VENDOR_TERM_NOT_FOUND/);
	});

	it('prices from the unit’s own cost price with the warning kept on the line', async () => {
		const fixture = termFixture({ variantCost: { unitCost: '6.500000', unitCostCurrency: 'USD' } });

		const pricing = await fixture.service.priceLine(
			{ vendorId: VENDOR, variantId: VARIANT, quantity: '2' },
			'USD'
		);

		expect(pricing).toMatchObject({
			unitCost: '6.500000',
			discountTotal: '0',
			source: 'VARIANT_COST_PRICE',
			warnings: ['VENDOR_TERM_NOT_FOUND']
		});
	});

	it('reads the over-shipment allowance the line’s own provenance negotiated', async () => {
		// The first step of the receipt tolerance chain: "the allowance that applies to it is the one that
		// was negotiated for it, not the one that happens to be reachable today".
		const fixture = termFixture({
			terms: [
				termRow('agreed', { overReceiptTolerancePercent: '0.03' }),
				termRow('silent', { id: 'silent', variantId: OTHER_VARIANT, overReceiptTolerancePercent: undefined })
			]
		});

		expect(await fixture.service.overReceiptTolerancePercentOf('agreed')).toBe('0.030000');
		expect(await fixture.service.overReceiptTolerancePercentOf('silent')).toBeUndefined();
		expect(await fixture.service.overReceiptTolerancePercentOf(undefined)).toBeUndefined();
		expect(await fixture.service.overReceiptTolerancePercentOf('long-gone')).toBeUndefined();
	});
});
