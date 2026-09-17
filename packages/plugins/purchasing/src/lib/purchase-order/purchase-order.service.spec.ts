/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a purchase-order service needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary,
 * exactly as the catalogue and inventory packages' service specs do, and **the services under test are
 * the real ones**: the order service and the real line service it derives its money through.
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

import { ConflictException, NotFoundException } from '@nestjs/common';
import {
	Organization,
	OrganizationVendor,
	ProductVariant,
	ProductVariantPrice,
	RequestContext
} from '@gauzy/core';
import { PurchaseOrderStatus } from '../purchasing.types';
import { VendorProductTermService } from '../vendor-product-term/vendor-product-term.service';
import { PurchaseOrderLineService } from '../purchase-order-line/purchase-order-line.service';
import { PurchaseOrderLine } from '../purchase-order-line/purchase-order-line.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { PurchaseOrderService } from './purchase-order.service';

/**
 * Purchase orders: the lifecycle, the approval step and the derivation of the money.
 *
 * Doc 09 §9.2 states the state machine, and the service's own summary states the two rules that are
 * easy to get subtly wrong:
 *
 * - **`CANCELED` is reachable only from `DRAFT` and `SENT`.** "Once goods have arrived, abandoning the
 *   remainder is a closure, not a cancellation, because the receipts that exist have to stay accounted
 *   for";
 * - **`receivedAt` is non-null exactly when the status is `RECEIVED` or `CLOSED`** — "every write that
 *   changes the status writes the timestamp with it, so the two can never disagree";
 * - **three facts are snapshots taken when the order is placed**: the settlement schedule and the
 *   simple form it stood in, the date those produce, and each line's expected date. "A supplier
 *   renegotiated today changes future orders only — a dunning report reads the order, never the
 *   supplier row" (doc 05 §16.1);
 * - **the approval is recorded as a fact, not as a status** — "a draft that is waiting for a decision
 *   is still a draft, and a refused approval has to leave the order where it was".
 *
 * The header formula doc 05 §16.1 states — `subtotal − discountTotal + taxTotal + shippingTotal` — is
 * pinned over more than one line, and the receipt projection is pinned from the lines rather than from
 * the receipts, because that is what makes a reversal leave no trace on the status.
 *
 * The service is constructed directly over in-memory tables, with the real line and term services
 * behind it.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const BUYER = '00000000-0000-4000-8000-000000000050';
const VENDOR = 'vendor-1';
const WAREHOUSE = 'warehouse-1';
const VARIANT = 'variant-1';
const OTHER_VARIANT = 'variant-2';
const DAY = 24 * 60 * 60 * 1000;

type Row = Record<string, any>;

interface ITables {
	purchase_order: Row[];
	purchase_order_line: Row[];
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
		// A read hands back a detached entity: only `save` writes.
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

/** One `purchase_order` row, as the service reads it. */
const orderRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	number: `PO-${id}`,
	vendorId: VENDOR,
	warehouseId: WAREHOUSE,
	status: PurchaseOrderStatus.DRAFT,
	currency: 'USD',
	subtotal: '0',
	discountTotal: '0',
	taxTotal: '0',
	shippingTotal: '0',
	grandTotal: '0',
	version: 1,
	...overrides
});

/** One `purchase_order_line` row, as the service reads it. */
const lineRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	purchaseOrderId: 'order-1',
	variantId: VARIANT,
	quantity: '2.000000',
	conversionFactor: '1',
	receivedQuantity: '0',
	damagedQuantity: '0',
	billedQuantity: '0',
	unitCost: '10.000000',
	discountTotal: '0',
	total: '20.000000',
	createdAt: `2026-01-01T00:00:0${id.length % 10}.000Z`,
	...overrides
});

/**
 * Builds the order service — and the real line and term services behind it — over one in-memory store.
 *
 * @param options.orders The orders the fixture starts with.
 * @param options.lines The lines the fixture starts with.
 * @param options.vendor What the supplier master states.
 * @param options.terms The negotiated terms the fixture starts with.
 * @param options.numberSeries Whether the organization has a `PO` series.
 * @param options.withApproval Whether the platform's approval machinery is registered.
 */
function orderFixture(
	options: {
		orders?: Row[];
		lines?: Row[];
		vendor?: Row | null;
		terms?: Row[];
		numberSeries?: boolean;
		withApproval?: boolean;
	} = {}
) {
	const tables: ITables = {
		purchase_order: [...(options.orders ?? [])],
		purchase_order_line: [...(options.lines ?? [])],
		vendor_product_term: [...(options.terms ?? [])],
		organization_vendor: [
			options.vendor === null
				? undefined
				: {
						id: VENDOR,
						tenantId: TENANT,
						organizationId: ORG,
						name: 'Supplier',
						isActive: true,
						...(options.vendor ?? {})
				  }
		].filter(Boolean) as Row[],
		product_variant: [
			{ id: VARIANT, tenantId: TENANT, organizationId: ORG },
			{ id: OTHER_VARIANT, tenantId: TENANT, organizationId: ORG }
		],
		product_variant_price: [
			{
				id: 'cost-1',
				tenantId: TENANT,
				organizationId: ORG,
				productVariant: { id: VARIANT },
				unitCost: '10.000000',
				unitCostCurrency: 'USD'
			}
		],
		organization: [{ id: ORG, tenantId: TENANT, currency: 'USD' }]
	};
	const managerFor = () => ({
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
	});

	const termRepository = repository(tables, 'vendor_product_term');

	Object.assign(termRepository, { manager: managerFor() });

	const termService = new VendorProductTermService(termRepository as never, {} as never);
	const lineRepository = repository(tables, 'purchase_order_line');

	Object.assign(lineRepository, { manager: managerFor() });

	const lineService = new PurchaseOrderLineService(lineRepository as never, {} as never, termService);
	const orderRepository = repository(tables, 'purchase_order');

	// The order service reads the supplier master through its own repository's manager, exactly as the
	// platform's `assertVendorUsable` does.
	Object.assign(orderRepository, { manager: managerFor() });

	const sequenceCalls: string[] = [];
	const sequenceService = {
		allocate: async (key: string) => {
			sequenceCalls.push(key);

			if (options.numberSeries === false) {
				throw new Error(`no series configured for ${key}`);
			}

			return { formatted: 'PO-000001', key };
		}
	};
	const approvalCalls: Row[] = [];
	const approval =
		options.withApproval === false
			? undefined
			: {
					requestApproval: async (request: Row) => {
						approvalCalls.push(request);

						return { approvalId: `approval-${approvalCalls.length}` };
					}
			  };
	const service = new PurchaseOrderService(
		orderRepository as never,
		{} as never,
		lineService,
		sequenceService as never,
		approval as never
	);

	return {
		service,
		lineService,
		tables,
		sequenceCalls,
		approvalCalls,
		order: (id: string) => tables.purchase_order.find((row) => row.id === id),
		liveLines: (orderId: string = 'order-1') =>
			tables.purchase_order_line.filter((row) => row.purchaseOrderId === orderId && !row.deletedAt)
	};
}

describe('PurchaseOrderService — raising an order (doc 09 §9.2, doc 05 §16.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(BUYER);
	});

	afterEach(() => jest.restoreAllMocks());

	it('raises a draft with its number, its totals and the supplier’s settlement snapshotted', async () => {
		const fixture = orderFixture({
			vendor: { paymentTermId: 'net-30', paymentTermsDays: 30, leadTimeDays: 5 }
		});

		const raisedAt = Date.now();
		const created = await fixture.service.create({
			vendorId: VENDOR,
			warehouseId: WAREHOUSE,
			currency: 'USD',
			lines: [{ variantId: VARIANT, quantity: '2', unitCost: '10' }]
		} as never);

		expect(created).toMatchObject({
			number: 'PO-000001',
			vendorId: VENDOR,
			warehouseId: WAREHOUSE,
			status: PurchaseOrderStatus.DRAFT,
			currency: 'USD',
			// The money is derived from the lines, never accepted from the caller.
			subtotal: '20.000000',
			discountTotal: '0.000000',
			taxTotal: '0.000000',
			shippingTotal: '0.000000',
			grandTotal: '20.000000',
			// The schedule and the simple form it stood in, both snapshotted rather than referenced.
			paymentTermId: 'net-30',
			paymentTermsDaysSnapshot: 30,
			buyerUserId: BUYER,
			version: 1,
			tenantId: TENANT,
			organizationId: ORG
		});
		// The due date those produce, measured from the instant the order was raised.
		expect(new Date(created.dueDate as Date).getTime()).toBeGreaterThanOrEqual(raisedAt + 30 * DAY - 1000);
		expect(new Date(created.dueDate as Date).getTime()).toBeLessThanOrEqual(Date.now() + 30 * DAY + 1000);
		expect(fixture.sequenceCalls).toEqual(['PO']);
		expect(fixture.liveLines(created.id)).toHaveLength(1);
	});

	it('refuses an order that names no supplier, no location or no currency', async () => {
		const fixture = orderFixture();

		await expect(
			fixture.service.create({ warehouseId: WAREHOUSE, currency: 'USD', lines: [] } as never)
		).rejects.toThrow(/PURCHASE_ORDER_VENDOR_REQUIRED/);
		await expect(
			fixture.service.create({ vendorId: VENDOR, currency: 'USD', lines: [] } as never)
		).rejects.toThrow(/PURCHASE_ORDER_WAREHOUSE_REQUIRED/);
		await expect(
			fixture.service.create({ vendorId: VENDOR, warehouseId: WAREHOUSE, lines: [] } as never)
		).rejects.toThrow(/PURCHASE_ORDER_CURRENCY_REQUIRED/);
		expect(fixture.tables.purchase_order).toEqual([]);
		expect(fixture.sequenceCalls).toEqual([]);
	});

	it('refuses a supplier that does not exist, and one that is archived or inactive', async () => {
		const unknown = orderFixture({ vendor: null });
		const archived = orderFixture({ vendor: { isArchived: true } });
		const inactive = orderFixture({ vendor: { isActive: false } });

		await expect(
			unknown.service.create({ vendorId: VENDOR, warehouseId: WAREHOUSE, currency: 'USD', lines: [] } as never)
		).rejects.toBeInstanceOf(NotFoundException);
		for (const fixture of [archived, inactive]) {
			await expect(
				fixture.service.create({ vendorId: VENDOR, warehouseId: WAREHOUSE, currency: 'USD', lines: [] } as never)
			).rejects.toThrow(/PURCHASE_ORDER_VENDOR_INACTIVE/);
		}
	});

	it('names the missing numbering series rather than failing generically', async () => {
		const fixture = orderFixture({ numberSeries: false });

		await expect(
			fixture.service.create({
				vendorId: VENDOR,
				warehouseId: WAREHOUSE,
				currency: 'USD',
				lines: [{ variantId: VARIANT, quantity: '1', unitCost: '1' }]
			} as never)
		).rejects.toThrow(/PURCHASE_ORDER_SEQUENCE_MISSING/);
		expect(fixture.tables.purchase_order).toEqual([]);
	});

	it('takes a settlement the caller states over the supplier’s, and leaves no due date when neither states days', async () => {
		const stated = orderFixture({ vendor: { paymentTermId: 'net-30', paymentTermsDays: 30 } });
		const none = orderFixture({ vendor: { paymentTermsDays: null } });
		const line = [{ variantId: VARIANT, quantity: '1', unitCost: '1' }];

		const withStated = await stated.service.create({
			vendorId: VENDOR,
			warehouseId: WAREHOUSE,
			currency: 'USD',
			paymentTermsDaysSnapshot: 7,
			lines: line
		} as never);
		const withNothing = await none.service.create({
			vendorId: VENDOR,
			warehouseId: WAREHOUSE,
			currency: 'USD',
			lines: line
		} as never);

		expect(withStated.paymentTermsDaysSnapshot).toBe(7);
		// An order with no agreed schedule has no due date rather than one due immediately.
		expect(withNothing.dueDate).toBeUndefined();
		expect(withNothing.paymentTermId).toBeUndefined();
	});

	it('holds the header formula with a discount, a tax rate and freight', async () => {
		const fixture = orderFixture();

		const created = await fixture.service.create({
			vendorId: VENDOR,
			warehouseId: WAREHOUSE,
			currency: 'USD',
			shippingTotal: '7.5',
			lines: [
				{ variantId: VARIANT, quantity: '2', unitCost: '10', discountTotal: '1', taxRate: '0.1' },
				{ variantId: OTHER_VARIANT, quantity: '3', unitCost: '5', taxRate: '0.1' }
			]
		} as never);

		expect(created).toMatchObject({
			subtotal: '35.000000',
			discountTotal: '1.000000',
			taxTotal: '3.400000',
			shippingTotal: '7.500000',
			grandTotal: '44.900000'
		});
		expect(created.grandTotal).toBe('44.900000');
	});

	it('prices a line that states no cost from the standing agreement, and dates it from the same resolution', async () => {
		// "A line that states no price is priced from the standing agreement at the same moment, so what a
		// line costs and when it is expected both come from the agreement as it stood when the order was
		// raised."
		const fixture = orderFixture({
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
					leadTimeDays: 5,
					priority: 100,
					status: 'ACTIVE'
				}
			]
		});

		const created = await fixture.service.create({
			vendorId: VENDOR,
			warehouseId: WAREHOUSE,
			currency: 'USD',
			lines: [{ variantId: VARIANT, quantity: '100' }]
		} as never);

		const [line] = fixture.liveLines(created.id);

		expect(line).toMatchObject({ unitCost: '4.200000', vendorTermId: 'term-1', total: '420.000000' });
		expect(line.metadata).toMatchObject({ pricing: { source: 'TERM', leadTimeDays: 5 } });
		expect(created.grandTotal).toBe('420.000000');
	});

	it('refuses a line nothing can price', async () => {
		const fixture = orderFixture({ terms: [] });

		await expect(
			fixture.service.create({
				vendorId: VENDOR,
				warehouseId: WAREHOUSE,
				currency: 'USD',
				lines: [{ variantId: OTHER_VARIANT, quantity: '1' }]
			} as never)
		).rejects.toThrow(/VENDOR_TERM_NOT_FOUND/);
		expect(fixture.liveLines()).toEqual([]);
	});
});

describe('PurchaseOrderService — amending and deleting a draft (doc 05 §16.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(BUYER);
	});

	afterEach(() => jest.restoreAllMocks());

	it('amends a draft and recomputes every total from the whole line set', async () => {
		// "The totals are recomputed even when only the freight charge changed, because the header is a
		// function of the lines and the charge together: a partial recomputation is how a total goes stale."
		const fixture = orderFixture({
			orders: [orderRow('order-1', { subtotal: '20.000000', grandTotal: '20.000000' })],
			lines: [lineRow('line-1')]
		});

		const amended = await fixture.service.update('order-1', { shippingTotal: '5', note: 'rush' } as never);

		expect(amended).toMatchObject({
			note: 'rush',
			subtotal: '20.000000',
			shippingTotal: '5.000000',
			grandTotal: '25.000000',
			version: 2
		});
	});

	it('refuses to amend an order that has left the draft, and one that moved on since the caller read it', async () => {
		const sent = orderFixture({ orders: [orderRow('order-1', { status: PurchaseOrderStatus.SENT })] });
		const stale = orderFixture({ orders: [orderRow('order-1', { version: 4 })] });

		await expect(sent.service.update('order-1', { note: 'x' } as never)).rejects.toThrow(
			/PURCHASE_ORDER_INVALID_STATE/
		);
		await expect(stale.service.update('order-1', { note: 'x', version: 3 } as never)).rejects.toThrow(
			/PURCHASE_ORDER_VERSION_CONFLICT/
		);
		expect(stale.order('order-1')?.note).toBeUndefined();
		expect(stale.order('order-1')?.version).toBe(4);
		// The version the caller actually read is accepted.
		await expect(stale.service.update('order-1', { note: 'x', version: 4 } as never)).resolves.toMatchObject({
			note: 'x'
		});
	});

	it('moves the due date when the settlement form moves, because the two are one fact', async () => {
		const fixture = orderFixture({ orders: [orderRow('order-1', { paymentTermsDaysSnapshot: 30 })] });

		const amended = await fixture.service.update('order-1', { paymentTermsDaysSnapshot: 7 } as never);
		const moved = new Date(amended.dueDate as Date).getTime() - Date.now();

		expect(moved).toBeGreaterThan(6 * DAY);
		expect(moved).toBeLessThan(8 * DAY);
	});

	it('replaces the line set and re-states the header’s expected date as the earliest of the lines', async () => {
		const fixture = orderFixture({ orders: [orderRow('order-1')], lines: [lineRow('stale')] });
		const first = new Date('2026-04-01T00:00:00.000Z');
		const second = new Date('2026-07-01T00:00:00.000Z');

		const amended = await fixture.service.update('order-1', {
			lines: [
				{ variantId: VARIANT, quantity: '1', unitCost: '10', expectedAt: second },
				{ variantId: OTHER_VARIANT, quantity: '1', unitCost: '10', expectedAt: first }
			]
		} as never);

		expect(amended.expectedAt).toEqual(first);
		expect(fixture.liveLines('order-1')).toHaveLength(2);
	});

	it('deletes a draft and refuses to delete anything the supplier has been told about', async () => {
		// "an order the supplier has been told about is cancelled, and an order goods arrived against is
		// closed, because both of those leave a document that explains what happened."
		const draft = orderFixture({ orders: [orderRow('order-1')] });
		const sent = orderFixture({ orders: [orderRow('order-1', { status: PurchaseOrderStatus.SENT })] });

		await draft.service.delete('order-1');

		expect(draft.order('order-1')).toBeUndefined();
		await expect(sent.service.delete('order-1')).rejects.toThrow(/PURCHASE_ORDER_INVALID_STATE/);
		expect(sent.order('order-1')).toMatchObject({ status: PurchaseOrderStatus.SENT });
	});
});

describe('PurchaseOrderService — the lifecycle and the edges it refuses (doc 09 §9.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(BUYER);
	});

	afterEach(() => jest.restoreAllMocks());

	it('records an approval as a fact on the draft, which stays a draft', async () => {
		// A tenant that approves by role does not need a second row to say so.
		const fixture = orderFixture({ orders: [orderRow('order-1')], withApproval: false });

		const approved = await fixture.service.approve('order-1', 'ok', 1);

		expect(approved).toMatchObject({
			status: PurchaseOrderStatus.DRAFT,
			approvedByUserId: BUYER,
			note: 'ok',
			version: 2
		});
		expect(approved.approvedAt).toBeInstanceOf(Date);
		expect(fixture.approvalCalls).toEqual([]);
	});

	it('raises the platform’s approval through the capability when it is registered, and records its id', async () => {
		const fixture = orderFixture({ orders: [orderRow('order-1', { grandTotal: '420.000000' })], withApproval: true });

		const approved = await fixture.service.approve('order-1');

		expect(approved.approvalId).toBe('approval-1');
		expect(fixture.approvalCalls[0]).toMatchObject({
			purchaseOrderId: 'order-1',
			name: 'Purchase order PO-order-1',
			amount: '420.000000',
			currency: 'USD'
		});
	});

	it('answers an already approved order with itself, and refuses an order that is not a draft', async () => {
		const approved = orderFixture({
			orders: [orderRow('order-1', { approvedAt: new Date('2026-01-01T00:00:00.000Z'), version: 3 })]
		});
		const sent = orderFixture({ orders: [orderRow('order-1', { status: PurchaseOrderStatus.SENT })] });

		await expect(approved.service.approve('order-1', 'again')).resolves.toMatchObject({ version: 3 });
		await expect(sent.service.approve('order-1')).rejects.toThrow(/PURCHASE_ORDER_INVALID_STATE/);
	});

	it('refuses to send an order nobody approved', async () => {
		// "The approval step is what makes the spend a decision rather than an accident, and a tenant that
		// does not want the step grants both permissions to the same role."
		const fixture = orderFixture({ orders: [orderRow('order-1')] });

		await expect(fixture.service.send('order-1')).rejects.toThrow(/PURCHASE_ORDER_NOT_APPROVED/);
		expect(fixture.order('order-1')).toMatchObject({ status: PurchaseOrderStatus.DRAFT });
	});

	it('sends an approved order, dating its lines and re-anchoring the due date from the snapshots', async () => {
		// "This is the instant a lead time and a settlement term are measured from, so both are anchored
		// here": `expectedAt = orderedAt + leadTimeDays` per line, and the due date from the settlement form
		// that was snapshotted when the order was raised.
		const fixture = orderFixture({
			orders: [
				orderRow('order-1', {
					approvedAt: new Date('2026-01-01T00:00:00.000Z'),
					paymentTermsDaysSnapshot: 30
				})
			],
			lines: [
				lineRow('line-1', { expectedAt: undefined, metadata: { pricing: { leadTimeDays: 5 } } }),
				lineRow('line-2', { variantId: OTHER_VARIANT, expectedAt: undefined, metadata: { pricing: { leadTimeDays: 9 } } })
			]
		});

		const sentAt = Date.now();
		const sent = await fixture.service.send('order-1', { email: 'buyer@supplier.invalid' });

		expect(sent).toMatchObject({ status: PurchaseOrderStatus.SENT, version: 2 });
		expect(sent.sentAt).toBeInstanceOf(Date);
		expect(sent.orderedAt).toEqual(sent.sentAt);
		expect(sent.metadata).toMatchObject({ sentTo: 'buyer@supplier.invalid' });

		const [first, second] = fixture.liveLines('order-1');

		expect(new Date(first.expectedAt).getTime()).toBeGreaterThanOrEqual(sentAt + 5 * DAY - 1000);
		expect(new Date(second.expectedAt).getTime()).toBeGreaterThanOrEqual(sentAt + 9 * DAY - 1000);
		// The header's expected date is the minimum over the lines.
		expect(sent.expectedAt).toEqual(first.expectedAt);
		// And the due date is measured from the instant it went out, not from the instant it was raised.
		expect(new Date(sent.dueDate as Date).getTime()).toBeGreaterThanOrEqual(sentAt + 30 * DAY - 1000);
	});

	it('refuses to send an order twice', async () => {
		const fixture = orderFixture({ orders: [orderRow('order-1', { status: PurchaseOrderStatus.SENT })] });

		await expect(fixture.service.send('order-1')).rejects.toThrow(/PURCHASE_ORDER_INVALID_STATE/);
	});

	it('acknowledges a sent order, recording what the supplier said back', async () => {
		const fixture = orderFixture({ orders: [orderRow('order-1', { status: PurchaseOrderStatus.SENT })] });
		const revised = new Date('2026-09-01T00:00:00.000Z');

		const acknowledged = await fixture.service.acknowledge('order-1', { expectedAt: revised, note: 'delayed' });

		expect(acknowledged).toMatchObject({
			status: PurchaseOrderStatus.ACKNOWLEDGED,
			expectedAt: revised,
			note: 'delayed',
			version: 2
		});
		expect(acknowledged.acknowledgedAt).toBeInstanceOf(Date);
	});

	it('refuses to acknowledge an order that was never sent, or one already acknowledged', async () => {
		const draft = orderFixture({ orders: [orderRow('order-1')] });
		const acknowledged = orderFixture({ orders: [orderRow('order-1', { status: PurchaseOrderStatus.ACKNOWLEDGED })] });

		await expect(draft.service.acknowledge('order-1')).rejects.toThrow(/PURCHASE_ORDER_INVALID_STATE/);
		await expect(acknowledged.service.acknowledge('order-1')).rejects.toThrow(/PURCHASE_ORDER_INVALID_STATE/);
	});

	it('cancels a draft or a sent order, and refuses once anything has been received', async () => {
		// "`CANCELED` is reachable only from `DRAFT` and `SENT`; a purchase order with any receipt is
		// finished by `CLOSED`, which is what releases the unreceived remainder."
		const draft = orderFixture({ orders: [orderRow('order-1')] });
		const sent = orderFixture({ orders: [orderRow('order-1', { status: PurchaseOrderStatus.SENT })] });
		const acknowledged = orderFixture({
			orders: [orderRow('order-1', { status: PurchaseOrderStatus.ACKNOWLEDGED })]
		});
		const partial = orderFixture({
			orders: [orderRow('order-1', { status: PurchaseOrderStatus.PARTIALLY_RECEIVED, receivedAt: new Date() })]
		});

		await expect(draft.service.cancel('order-1', 'no longer needed')).resolves.toMatchObject({
			status: PurchaseOrderStatus.CANCELED,
			note: 'no longer needed'
		});
		await expect(sent.service.cancel('order-1')).resolves.toMatchObject({ status: PurchaseOrderStatus.CANCELED });
		await expect(acknowledged.service.cancel('order-1')).rejects.toThrow(/PURCHASE_ORDER_INVALID_STATE/);
		await expect(partial.service.cancel('order-1')).rejects.toThrow(/PURCHASE_ORDER_INVALID_STATE/);
		expect(partial.order('order-1')).toMatchObject({ status: PurchaseOrderStatus.PARTIALLY_RECEIVED });
	});

	it('closes an order short and stamps the instant goods last arrived', async () => {
		// "a partially received order is closed when the supplier will not deliver the rest" — and the
		// timestamp is written with the status so the pair cannot disagree.
		const short = orderFixture({ orders: [orderRow('order-1', { status: PurchaseOrderStatus.PARTIALLY_RECEIVED })] });
		const complete = orderFixture({
			orders: [orderRow('order-1', { status: PurchaseOrderStatus.RECEIVED, receivedAt: new Date(0) })]
		});

		const closedShort = await short.service.close('order-1', 'supplier short-shipped');
		const closedComplete = await complete.service.close('order-1');

		expect(closedShort).toMatchObject({ status: PurchaseOrderStatus.CLOSED, note: 'supplier short-shipped' });
		expect(closedShort.receivedAt).toBeInstanceOf(Date);
		// An order whose goods did arrive keeps the instant they did.
		expect(closedComplete.receivedAt).toEqual(new Date(0));
	});

	it('treats closing an already closed order as a no-op, and refuses to close a draft', async () => {
		const closed = orderFixture({ orders: [orderRow('order-1', { status: PurchaseOrderStatus.CLOSED })] });
		const draft = orderFixture({ orders: [orderRow('order-1')] });

		await expect(closed.service.close('order-1')).resolves.toMatchObject({ status: PurchaseOrderStatus.CLOSED });
		await expect(draft.service.close('order-1')).rejects.toThrow(/PURCHASE_ORDER_INVALID_STATE/);
	});
});

describe('PurchaseOrderService — the receipt side of the lifecycle (doc 05 §16.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(BUYER);
	});

	afterEach(() => jest.restoreAllMocks());

	it('reports the three refusals a receipt can meet as three different facts', async () => {
		const draft = orderFixture({ orders: [orderRow('order-1')] });
		const received = orderFixture({ orders: [orderRow('order-1', { status: PurchaseOrderStatus.RECEIVED })] });
		const closed = orderFixture({ orders: [orderRow('order-1', { status: PurchaseOrderStatus.CLOSED })] });
		const canceled = orderFixture({ orders: [orderRow('order-1', { status: PurchaseOrderStatus.CANCELED })] });
		const sent = orderFixture({ orders: [orderRow('order-1', { status: PurchaseOrderStatus.SENT })] });

		await expect(draft.service.assertReceivable('order-1')).rejects.toThrow(/PURCHASE_ORDER_NOT_SENT/);
		await expect(received.service.assertReceivable('order-1')).rejects.toThrow(
			/PURCHASE_ORDER_ALREADY_RECEIVED/
		);
		await expect(closed.service.assertReceivable('order-1')).rejects.toThrow(/PURCHASE_ORDER_ALREADY_RECEIVED/);
		await expect(canceled.service.assertReceivable('order-1')).rejects.toThrow(/PURCHASE_ORDER_INVALID_STATE/);
		await expect(sent.service.assertReceivable('order-1')).resolves.toMatchObject({
			status: PurchaseOrderStatus.SENT
		});
	});

	it('refuses a receipt raised against a version that has since moved', async () => {
		const fixture = orderFixture({ orders: [orderRow('order-1', { status: PurchaseOrderStatus.SENT, version: 3 })] });

		await expect(fixture.service.assertReceivable('order-1', 2)).rejects.toThrow(
			/PURCHASE_ORDER_VERSION_CONFLICT/
		);
		await expect(fixture.service.assertReceivable('order-1', 3)).resolves.toMatchObject({ version: 3 });
	});

	it('derives the status from what the lines now say has arrived', async () => {
		// The status is recomputed from the lines rather than tracked beside them, which is what makes a
		// reversal leave no trace.
		const partial = orderFixture({
			orders: [orderRow('order-1', { status: PurchaseOrderStatus.SENT })],
			lines: [
				lineRow('line-1', { quantity: '10.000000', receivedQuantity: '4.000000' }),
				lineRow('line-2', { variantId: OTHER_VARIANT, quantity: '10.000000' })
			]
		});
		const complete = orderFixture({
			orders: [orderRow('order-1', { status: PurchaseOrderStatus.SENT })],
			lines: [
				lineRow('line-1', { quantity: '10.000000', receivedQuantity: '8.000000', damagedQuantity: '2.000000' })
			]
		});

		const afterPartial = await partial.service.refreshReceiptState('order-1');
		const afterComplete = await complete.service.refreshReceiptState('order-1');

		expect(afterPartial).toMatchObject({ status: PurchaseOrderStatus.PARTIALLY_RECEIVED, receivedAt: null });
		// A damaged unit counts towards the ordered quantity exactly as a sound one does.
		expect(afterComplete.status).toBe(PurchaseOrderStatus.RECEIVED);
		expect(afterComplete.receivedAt).toBeInstanceOf(Date);
	});

	it('falls back to what the supplier last confirmed when everything that arrived was reversed', async () => {
		const acknowledged = orderFixture({
			orders: [
				orderRow('order-1', { status: PurchaseOrderStatus.PARTIALLY_RECEIVED, acknowledgedAt: new Date(0) })
			],
			lines: [lineRow('line-1', { receivedQuantity: '0' })]
		});
		const unacknowledged = orderFixture({
			orders: [orderRow('order-1', { status: PurchaseOrderStatus.PARTIALLY_RECEIVED })],
			lines: [lineRow('line-1', { receivedQuantity: '0' })]
		});

		expect(await acknowledged.service.refreshReceiptState('order-1')).toMatchObject({
			status: PurchaseOrderStatus.ACKNOWLEDGED
		});
		expect(await unacknowledged.service.refreshReceiptState('order-1')).toMatchObject({
			status: PurchaseOrderStatus.SENT
		});
	});

	it('leaves a cancelled or closed order alone, whatever its lines say', async () => {
		const canceled = orderFixture({
			orders: [orderRow('order-1', { status: PurchaseOrderStatus.CANCELED })],
			lines: [lineRow('line-1', { receivedQuantity: '10.000000' })]
		});

		await expect(canceled.service.refreshReceiptState('order-1')).resolves.toMatchObject({
			status: PurchaseOrderStatus.CANCELED
		});
	});

	it('reads an order and checks it may still be written, and recomputes its header on demand', async () => {
		const fixture = orderFixture({
			orders: [orderRow('order-1')],
			// The stored line total is deliberately stale, so the assertion below is about the header being
			// derived from the line's own columns rather than read back from the cache beside them.
			lines: [lineRow('line-1', { quantity: '3.000000', unitCost: '10.000000', total: '20.000000' })]
		});

		await expect(fixture.service.assertEditable('order-1')).resolves.toMatchObject({ id: 'order-1' });
		await expect(fixture.service.recomputeTotalsFor('order-1')).resolves.toMatchObject({
			subtotal: '30.000000',
			grandTotal: '30.000000'
		});
	});

	it('refuses an order of another organization, and one that does not exist', async () => {
		const fixture = orderFixture({ orders: [orderRow('theirs', { organizationId: OTHER_ORG })] });

		await expect(fixture.service.findOneScoped('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findOneDetailed('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findOneScoped('no-such-order')).rejects.toThrow(/PURCHASE_ORDER_NOT_FOUND/);
	});

	it('reads a detailed order with its lines', async () => {
		const fixture = orderFixture({
			orders: [orderRow('order-1', { status: PurchaseOrderStatus.SENT })],
			lines: [lineRow('line-1', { purchaseOrderId: 'order-1' })]
		});

		const detailed = await fixture.service.findOneDetailed('order-1');

		expect(detailed).toMatchObject({ id: 'order-1', status: PurchaseOrderStatus.SENT });
	});
});
