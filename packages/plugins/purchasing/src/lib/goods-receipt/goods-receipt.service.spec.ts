/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a receiving service needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary,
 * exactly as the catalogue and inventory packages' service specs do, and **the services under test are
 * the real ones**: the receipt service, the real line service it writes its lines through, the real
 * order and order-line services it moves the counters through, and the real term service it reads the
 * negotiated allowance from.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');
	// The order service reaches the kernel's conditional write by name through this barrel, so a factory
	// that replaces the barrel has to answer for it. The double decides rather than succeeds.
	const { ApiErrorCode, commitVersionedUpdate } = require('../testing/versioned-write.double');

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
		ApiErrorCode,
		commitVersionedUpdate,
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
import {
	GoodsReceiptStatus,
	PurchaseOrderStatus,
	PurchasingCodes,
	StockMovementKind
} from '../purchasing.types';
import { VendorProductTermService } from '../vendor-product-term/vendor-product-term.service';
import { PurchaseOrderLineService } from '../purchase-order-line/purchase-order-line.service';
import { PurchaseOrderLine } from '../purchase-order-line/purchase-order-line.entity';
import { PurchaseOrderService } from '../purchase-order/purchase-order.service';
import { PurchaseOrder } from '../purchase-order/purchase-order.entity';
import { GoodsReceiptLineService } from '../goods-receipt-line/goods-receipt-line.service';
import { GoodsReceiptService } from './goods-receipt.service';

/**
 * Goods receipts: what physically arrived, and the stock movements that follow from it.
 *
 * The rule the service exists for is stated on the class and echoed by doc 05 §16.2:
 *
 * > receiving is bounded by what was ordered, within the allowance the line is received under. A line
 * > may not be pushed past its ordered quantity beyond that allowance, and the check is exact —
 * > quantities are compared as scaled integers, on the boundary, where a floating point comparison
 * > would give the wrong answer. A receipt that would exceed it is refused with
 * > `RECEIPT_OVER_TOLERANCE` and nothing is written.
 *
 * and the allowance itself is a chain §16.5 states as authoritative: what the caller states for this
 * delivery, then the fraction the line's own winning term negotiated, then the organization's
 * setting, then the order's own configured allowance, and none of them means no allowance at all.
 *
 * The other half is where the stock goes, and it is pinned here as a conservation rather than as a
 * call log: every good unit is a `RECEIPT` that increments the level; every damaged unit is a `DAMAGE`
 * that leaves the level unchanged, so "a damaged unit is recorded and never sellable" (I-64); and a
 * reversal writes a `WRITE_OFF` of **exactly** what the receipt added and puts the counters back, so
 * the order's outstanding figure returns to what it was.
 *
 * One invariant runs through the whole suite — doc 09 INV-20: `Σ line.quantity = Σ line.receivedQuantity
 * + Σ line.damagedQuantity + incomingQuantity` for every open purchase order. Each case asserts the
 * side of it that its situation can break.
 *
 * The service is constructed directly over in-memory tables with the real collaborating services
 * behind it.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const RECEIVER = '00000000-0000-4000-8000-000000000060';
const VENDOR = 'vendor-1';
const WAREHOUSE = 'warehouse-1';
const OTHER_WAREHOUSE = 'warehouse-2';
const ORDER = 'order-1';
const ORDER_LINE = 'order-line-1';
const SECOND_ORDER_LINE = 'order-line-2';
const VARIANT = 'variant-1';
const SECOND_VARIANT = 'variant-2';

type Row = Record<string, any>;

interface ITables {
	goods_receipt: Row[];
	goods_receipt_line: Row[];
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
 * @param options.detached Whether a read hands back a detached copy. It does, for every table, because
 * that is what TypeORM does: `findOne` builds a fresh entity per read and there is no identity map to
 * hand the caller back the object it already holds. The receipt-line table used to be aliased here, on
 * the reasoning that a line is stamped and read again inside one operation — and that alias hid a real
 * defect, because `stampMovement` writes the movement id onto ITS OWN copy of the row and the put-away
 * a few lines later read the caller's untouched one. Under the alias the two were the same object and
 * the suite saw a link that production never made.
 */
function repository(tables: ITables, tableName: keyof ITables, options: { detached?: boolean } = {}) {
	const detached = options.detached ?? true;
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
		find: async (requestOptions: any = {}) =>
			sorted(
				rows()
					.filter((row) => matches(row, requestOptions.where))
					.map((row) => (detached ? { ...row } : row)),
				requestOptions.order
			),
		findOne: async (requestOptions: any = {}) => {
			const found = rows().find((row) => matches(row, requestOptions.where));

			if (!found) {
				return null;
			}

			const answer = detached ? { ...found } : found;

			// A `relations` read is what a detail view asks for, and the ORM attaches the rows it was asked
			// for: a double that ignored the option would make "the receipt returns its lines" unassertable.
			if (tableName === 'goods_receipt' && requestOptions.relations?.lines) {
				answer.lines = tables.goods_receipt_line.filter(
					(row) => !row.deletedAt && same(row.receiptId, found.id)
				);
			}

			return answer;
		},
		findAndCount: async (requestOptions: any = {}) => {
			const items = rows().filter((row) => matches(row, requestOptions.where));

			return [items, items.length];
		},
		count: async (requestOptions: any = {}) => rows().filter((row) => matches(row, requestOptions.where)).length,
		create: (partial: any) => ({
			// The platform's own `create` stamps the tenant the request carries onto the row it writes, and
			// every read below filters by it.
			...(partial.tenantId === undefined ? { tenantId: RequestContext.currentTenantId() } : {}),
			...(partial.organizationId === undefined ? { organizationId: RequestContext.currentOrganizationId() } : {}),
			...partial
		}),
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
			// A conditional write is a WHERE, not an id: `commitVersionedUpdate` predicates its statement on
			// the version and the tenant scope too, and a double that matched on the id alone would report
			// every conditional write as landing.
			const where = typeof criteria === 'string' ? { id: criteria } : (criteria ?? {});
			const matching = tables[tableName].filter((row) => matches(row, where));

			for (const row of matching) {
				Object.assign(row, partial);
			}

			return { affected: matching.length };
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

/** One `purchase_order` row, as the services read it. */
const orderRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	number: `PO-${id}`,
	vendorId: VENDOR,
	warehouseId: WAREHOUSE,
	status: PurchaseOrderStatus.SENT,
	currency: 'USD',
	subtotal: '0',
	discountTotal: '0',
	taxTotal: '0',
	shippingTotal: '0',
	grandTotal: '0',
	version: 1,
	...overrides
});

/** One `purchase_order_line` row, as the services read it. */
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
	total: '40.000000',
	createdAt: `2026-01-01T00:00:0${id.length % 10}.000Z`,
	...overrides
});

/** One incoming movement, as the ledger capability saw it. */
interface IMovement {
	warehouseId: string;
	variantId: string;
	quantity: string;
	kind: StockMovementKind;
	referenceType: string;
	referenceId: string;
	batchNumber?: string;
}

/** One put-away, as the ledger capability saw it. */
interface IPutAway {
	warehouseId: string;
	binId: string;
	variantId: string;
	quantity: string;
	stockMovementId?: string;
	referenceId: string;
}

/**
 * Builds the receipt service over one in-memory store, with the real collaborating services behind it.
 *
 * @param options.orders The orders the fixture starts with.
 * @param options.lines The order lines the fixture starts with.
 * @param options.terms The negotiated terms the fixture starts with.
 * @param options.receipts The receipts the fixture starts with.
 * @param options.receiptLines The receipt lines the fixture starts with.
 * @param options.setting The organization's standing over-receipt allowance.
 * @param options.withLedger Whether the inventory capability is registered.
 * @param options.numberSeries Whether the organization has a `RECEIPT` series.
 */
function receiptFixture(
	options: {
		orders?: Row[];
		lines?: Row[];
		terms?: Row[];
		receipts?: Row[];
		receiptLines?: Row[];
		setting?: string | null;
		withLedger?: boolean;
		numberSeries?: boolean;
	} = {}
) {
	const tables: ITables = {
		goods_receipt: [...(options.receipts ?? [])],
		goods_receipt_line: [...(options.receiptLines ?? [])],
		purchase_order: [...(options.orders ?? [orderRow(ORDER)])],
		purchase_order_line: [
			...(options.lines ?? [lineRow(ORDER_LINE), lineRow(SECOND_ORDER_LINE, { variantId: SECOND_VARIANT })])
		],
		vendor_product_term: [...(options.terms ?? [])],
		organization_vendor: [
			{ id: VENDOR, tenantId: TENANT, organizationId: ORG, name: 'Supplier', currency: 'USD', isActive: true }
		],
		product_variant: [
			{ id: VARIANT, tenantId: TENANT, organizationId: ORG },
			{ id: SECOND_VARIANT, tenantId: TENANT, organizationId: ORG }
		],
		product_variant_price: [],
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
				return null;
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

	const orderLineService = new PurchaseOrderLineService(lineRepository as never, {} as never, termService);
	const orderRepository = repository(tables, 'purchase_order');

	Object.assign(orderRepository, { manager: managerFor() });

	const sequenceService = {
		allocate: async (key: string) => {
			if (options.numberSeries === false) {
				/*
				 * The real allocator answers a key it has no active series for with a `NotFoundException`
				 * — "no numbering series is configured" — and the services map exactly that to their own
				 * `*_SEQUENCE_MISSING` code. A double that threw a plain `Error` would be testing a
				 * refusal the platform never raises, and would pass while the mapping was wrong.
				 */
				throw new NotFoundException(`no series configured for ${key}`);
			}

			return { formatted: 'GR-000001', key };
		}
	};
	const orderService = new PurchaseOrderService(
		orderRepository as never,
		{} as never,
		orderLineService,
		sequenceService as never
	);

	const receiptLineRepository = repository(tables, 'goods_receipt_line');
	const receiptLineService = new GoodsReceiptLineService(receiptLineRepository as never, {} as never);
	const settingsAsked: string[][] = [];
	const tenantSettingService = {
		getResolvedSettings: async (keys: string[]) => {
			settingsAsked.push(keys);

			if (options.setting === null || options.setting === undefined) {
				return {};
			}

			return { [keys[0]]: options.setting };
		}
	};
	const movements: IMovement[] = [];
	const putAways: IPutAway[] = [];
	const inventory =
		options.withLedger === false
			? undefined
			: {
					recordMovement: async (request: IMovement) => {
						movements.push(request);

						return { movementId: `movement-${movements.length}`, quantityAfter: request.quantity };
					},
					putAway: async (request: IPutAway) => {
						putAways.push(request);

						return { transferOutMovementId: 'out-1', transferInMovementId: 'in-1' };
					}
			  };
	const service = new GoodsReceiptService(
		repository(tables, 'goods_receipt') as never,
		{} as never,
		receiptLineService,
		orderService,
		orderLineService,
		termService,
		tenantSettingService as never,
		sequenceService as never,
		inventory as never
	);

	return {
		service,
		tables,
		movements,
		putAways,
		settingsAsked,
		order: (id: string = ORDER) => tables.purchase_order.find((row) => row.id === id),
		orderLine: (id: string) => tables.purchase_order_line.find((row) => row.id === id),
		linesOf: (id: string) => tables.goods_receipt_line.filter((row) => row.receiptId === id && !row.deletedAt),
		liveLines: () => tables.goods_receipt_line.filter((row) => !row.deletedAt)
	};
}

describe('GoodsReceiptService — receiving goods (doc 09 §9.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(RECEIVER);
	});

	afterEach(() => jest.restoreAllMocks());

	it('records a delivery, its movements, the counters and the order’s new status', async () => {
		const fixture = receiptFixture();

		const receipt = await fixture.service.receive({
			purchaseOrderId: ORDER,
			lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '8', damagedQuantity: '1' }]
		});

		expect(receipt).toMatchObject({
			purchaseOrderId: ORDER,
			warehouseId: WAREHOUSE,
			number: 'GR-000001',
			status: GoodsReceiptStatus.POSTED,
			receivedByUserId: RECEIVER,
			version: 1,
			movementIds: ['movement-1', 'movement-2'],
			receivedQuantity: '8.000000',
			damagedQuantity: '1.000000',
			outstandingQuantity: '11.000000'
		});
		// The delivery's own counter is the order's, and the two lines' remainders are summed.
		expect(receipt.purchaseOrderStatus).toBe(PurchaseOrderStatus.PARTIALLY_RECEIVED);
		expect(receipt.purchaseOrderStatuses).toEqual({ [ORDER]: PurchaseOrderStatus.PARTIALLY_RECEIVED });

		// One movement per line and disposition, and the line carries the one it produced.
		expect(fixture.movements.map((movement) => [movement.kind, movement.quantity])).toEqual([
			[StockMovementKind.RECEIPT, '8.000000'],
			[StockMovementKind.DAMAGE, '1.000000']
		]);
		for (const movement of fixture.movements) {
			expect(movement).toMatchObject({
				warehouseId: WAREHOUSE,
				variantId: VARIANT,
				referenceType: 'GOODS_RECEIPT'
			});
		}

		const [written] = fixture.linesOf(receipt.id);

		expect(written).toMatchObject({
			purchaseOrderLineId: ORDER_LINE,
			variantId: VARIANT,
			quantity: '8.000000',
			damagedQuantity: '1.000000',
			unitCost: '4.000000',
			// Set once, immediately, which is what makes a replayed receipt detectable.
			stockMovementId: 'movement-1'
		});

		expect(fixture.orderLine(ORDER_LINE)).toMatchObject({
			receivedQuantity: '8.000000',
			damagedQuantity: '1.000000'
		});
	});

	it('conserves the order: what arrived, plus what is outstanding, is what was ordered', async () => {
		// Doc 09 INV-20, over two lines: `Σ quantity = Σ received + Σ damaged + incomingQuantity`.
		const fixture = receiptFixture();

		const receipt = await fixture.service.receive({
			purchaseOrderId: ORDER,
			lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '8', damagedQuantity: '1' }]
		});

		const ordered = fixture.tables.purchase_order_line.reduce((total, line) => total + Number(line.quantity), 0);
		const settled = fixture.tables.purchase_order_line.reduce(
			(total, line) => total + Number(line.receivedQuantity) + Number(line.damagedQuantity),
			0
		);

		expect(settled + Number(receipt.outstandingQuantity)).toBe(ordered);
	});

	it('refuses a delivery with no lines at all', async () => {
		const fixture = receiptFixture();

		await expect(fixture.service.receive({ purchaseOrderId: ORDER, lines: [] })).rejects.toBeInstanceOf(
			BadRequestException
		);
		await expect(fixture.service.receive({ purchaseOrderId: ORDER } as never)).rejects.toThrow(
			/needs at least one line/
		);
		expect(fixture.tables.goods_receipt).toEqual([]);
	});

	it('refuses a line whose order line names no unit', async () => {
		const fixture = receiptFixture({ lines: [lineRow(ORDER_LINE, { variantId: undefined })] });

		await expect(
			fixture.service.receive({
				purchaseOrderId: ORDER,
				warehouseId: WAREHOUSE,
				lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '1' }]
			})
		).rejects.toThrow(/PURCHASE_ORDER_LINE_VARIANT_MISSING/);
		expect(fixture.tables.goods_receipt).toEqual([]);
	});

	it('refuses a line the caller cannot receive against', async () => {
		const fixture = receiptFixture();

		await expect(
			fixture.service.receive({
				purchaseOrderId: ORDER,
				// The location is stated so the delivery reaches the line checks rather than the location guard.
				warehouseId: WAREHOUSE,
				lines: [{ purchaseOrderLineId: 'no-such-line', quantity: '1' }]
			})
		).rejects.toThrow(/PURCHASE_ORDER_LINE_NOT_FOUND/);
		expect(fixture.tables.goods_receipt).toEqual([]);
		expect(fixture.movements).toEqual([]);
	});

	// A delivery that is anchored to an order and names a line that does not resolve is answered with
	// the *line* refusal rather than the location one. Every order the delivery touches is discovered
	// through its lines, so a delivery whose line resolves to nothing has no order to inherit a location
	// from — and an operator told "a goods receipt must name the location the goods arrived at" for a
	// keying error in the line is sent to fix something that is not wrong. `resolveLines` documents the
	// correct answer itself: "@throws NotFoundException when a line is not one the caller may receive
	// against."
	// (`goods-receipt.service.ts`, `resolveNamedLines` — asked in `receive` before `resolveWarehouse`.)
	it('names the line a delivery cannot resolve, not the location it did not state', async () => {
		const fixture = receiptFixture();

		await expect(
			fixture.service.receive({
				purchaseOrderId: ORDER,
				lines: [{ purchaseOrderLineId: 'no-such-line', quantity: '1' }]
			})
		).rejects.toThrow(/PURCHASE_ORDER_LINE_NOT_FOUND/);
	});

	it('refuses a line that carries no quantity at all', async () => {
		// A delivery of nothing is not a delivery; the check is on what arrived, good and damaged together.
		const fixture = receiptFixture();

		await expect(
			fixture.service.receive({
				purchaseOrderId: ORDER,
				lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '0', damagedQuantity: '0' }]
			})
		).rejects.toThrow(/received with no quantity at all/);
		expect(fixture.tables.goods_receipt).toEqual([]);
		expect(fixture.movements).toEqual([]);
	});

	it('refuses an order nothing may be received against yet', async () => {
		const fixture = receiptFixture({ orders: [orderRow(ORDER, { status: PurchaseOrderStatus.DRAFT })] });

		await expect(
			fixture.service.receive({ purchaseOrderId: ORDER, lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '1' }] })
		).rejects.toThrow(/PURCHASE_ORDER_NOT_SENT/);
		expect(fixture.tables.goods_receipt).toEqual([]);
	});

	it('refuses a delivery anchored to an order when a line belongs to another one', async () => {
		const fixture = receiptFixture({
			orders: [orderRow(ORDER), orderRow('another-order')],
			lines: [lineRow(ORDER_LINE), lineRow(SECOND_ORDER_LINE, { purchaseOrderId: 'another-order' })]
		});

		await expect(
			fixture.service.receive({
				purchaseOrderId: ORDER,
				lines: [
					{ purchaseOrderLineId: ORDER_LINE, quantity: '1' },
					{ purchaseOrderLineId: SECOND_ORDER_LINE, quantity: '1' }
				]
			})
		).rejects.toThrow(/RECEIPT_ORDER_MISMATCH/);
		expect(fixture.tables.goods_receipt).toEqual([]);
	});

	it('refuses a receipt raised against an order version that has since moved', async () => {
		const fixture = receiptFixture({ orders: [orderRow(ORDER, { version: 4 })] });

		await expect(
			fixture.service.receive({
				purchaseOrderId: ORDER,
				expectedVersion: 3,
				lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '1' }]
			})
		).rejects.toThrow(/PURCHASE_ORDER_VERSION_CONFLICT/);
	});
});

describe('GoodsReceiptService — the over-shipment allowance a line is received under', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(RECEIVER);
	});

	afterEach(() => jest.restoreAllMocks());

	it('accepts a delivery that fits exactly, and refuses one storage unit past the ceiling', async () => {
		// The check is exact and sits exactly on the boundary, which is where a floating point comparison
		// would give the wrong answer.
		const fixture = receiptFixture();

		const exact = await fixture.service.receive({
			purchaseOrderId: ORDER,
			lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '10' }]
		});

		expect(exact.purchaseOrderStatuses[ORDER]).toBe(PurchaseOrderStatus.PARTIALLY_RECEIVED);

		const over = receiptFixture();

		await expect(
			over.service.receive({
				purchaseOrderId: ORDER,
				lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '10.000001' }]
			})
		).rejects.toThrow(new RegExp(PurchasingCodes.RECEIPT_OVER_TOLERANCE));
		// Nothing at all was written by the refusal.
		expect(over.tables.goods_receipt).toEqual([]);
		expect(over.tables.goods_receipt_line).toEqual([]);
		expect(over.movements).toEqual([]);
		expect(over.orderLine(ORDER_LINE)).toMatchObject({ receivedQuantity: '0', damagedQuantity: '0' });
	});

	it('lets a stated allowance cover the over-shipment, and refuses one unit past it', async () => {
		// A ten-per-cent allowance on ten units is a ceiling of eleven.
		const fixture = receiptFixture();

		const inside = await fixture.service.receive({
			purchaseOrderId: ORDER,
			overReceiptTolerance: '0.1',
			lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '11' }]
		});

		expect(inside.receivedQuantity).toBe('11.000000');

		await expect(
			fixture.service.receive({
				purchaseOrderId: ORDER,
				overReceiptTolerance: '0.1',
				lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '0.000001' }]
			})
		).rejects.toThrow(new RegExp(PurchasingCodes.RECEIPT_OVER_TOLERANCE));
	});

	it('measures the ceiling against what was already received, not against this delivery alone', async () => {
		// Two deliveries of six against a line of ten: the second is refused, because six plus six passes
		// the ceiling however reasonable each delivery looks on its own.
		const fixture = receiptFixture();

		await fixture.service.receive({
			purchaseOrderId: ORDER,
			lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '6' }]
		});

		await expect(
			fixture.service.receive({
				purchaseOrderId: ORDER,
				lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '6' }]
			})
		).rejects.toThrow(/6\.000000 has already been received/);

		// The remainder is what fits.
		const rest = await fixture.service.receive({
			purchaseOrderId: ORDER,
			lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '4' }]
		});

		expect(rest.receivedQuantity).toBe('4.000000');
	});

	it('resolves the allowance from the line’s own winning term when the caller states none', async () => {
		// The first step of the chain, and the reason it is a read of one column rather than a fresh
		// resolution: "a term renegotiated since the order was placed does not move the allowance the order
		// was raised under".
		const fixture = receiptFixture({
			terms: [
				{
					id: 'term-1',
					tenantId: TENANT,
					organizationId: ORG,
					vendorId: VENDOR,
					variantId: VARIANT,
					currency: 'USD',
					unitCost: '4.000000',
					minQuantity: '0.000000',
					overReceiptTolerancePercent: '0.25',
					priority: 100,
					status: 'ACTIVE'
				}
			],
			lines: [lineRow(ORDER_LINE, { vendorTermId: 'term-1' })]
		});

		const receipt = await fixture.service.receive({
			purchaseOrderId: ORDER,
			lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '12' }]
		});

		expect(receipt.receivedQuantity).toBe('12.000000');
		// The organization's setting was never consulted: the most specific statement won.
		expect(fixture.settingsAsked).toEqual([]);
	});

	it('falls through to the organization’s setting when the line’s term states none', async () => {
		const fixture = receiptFixture({
			terms: [
				{
					id: 'term-1',
					tenantId: TENANT,
					organizationId: ORG,
					vendorId: VENDOR,
					variantId: VARIANT,
					currency: 'USD',
					unitCost: '4.000000',
					minQuantity: '0.000000',
					priority: 100,
					status: 'ACTIVE'
				}
			],
			lines: [lineRow(ORDER_LINE, { vendorTermId: 'term-1' })],
			setting: '0.2'
		});

		const receipt = await fixture.service.receive({
			purchaseOrderId: ORDER,
			lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '11' }]
		});

		expect(receipt.receivedQuantity).toBe('11.000000');
		expect(fixture.settingsAsked).toEqual([['purchasing.overReceiptTolerancePercent']]);
	});

	it('falls through to the order’s own configured allowance last, and to none at all after that', async () => {
		const configured = receiptFixture({
			orders: [orderRow(ORDER, { metadata: { overReceiptTolerance: '0.5' } })]
		});
		const none = receiptFixture({ orders: [orderRow(ORDER, { metadata: {} })] });

		await expect(
			configured.service.receive({
				purchaseOrderId: ORDER,
				lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '14' }]
			})
		).resolves.toMatchObject({ receivedQuantity: '14.000000' });

		await expect(
			none.service.receive({
				purchaseOrderId: ORDER,
				lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '14' }]
			})
		).rejects.toThrow(new RegExp(PurchasingCodes.RECEIPT_OVER_TOLERANCE));
	});

	it('reads the allowance the line was priced under without failing when the term is gone', async () => {
		// "A receipt resolving its tolerance must not fail because the term behind a line has since been
		// retired and deleted: the chain falls through to the organization's setting instead."
		const fixture = receiptFixture({
			lines: [lineRow(ORDER_LINE, { vendorTermId: 'long-gone' })],
			setting: '0.1'
		});

		await expect(
			fixture.service.receive({
				purchaseOrderId: ORDER,
				lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '11' }]
			})
		).resolves.toMatchObject({ receivedQuantity: '11.000000' });
	});
});

describe('GoodsReceiptService — where the stock goes (I-64, doc 09 §9.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(RECEIVER);
	});

	afterEach(() => jest.restoreAllMocks());

	it('records damaged units without ever making them sellable', async () => {
		// "good quantity increments the level through a `RECEIPT` movement, damaged quantity writes a
		// `DAMAGE` movement that leaves the level unchanged — so a damaged unit is recorded and never
		// sellable."
		const fixture = receiptFixture();

		await fixture.service.receive({
			purchaseOrderId: ORDER,
			lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '0', damagedQuantity: '3' }]
		});

		expect(fixture.movements).toHaveLength(1);
		expect(fixture.movements[0]).toMatchObject({ kind: StockMovementKind.DAMAGE, quantity: '3.000000' });
		// The counters still record what arrived, so the order's outstanding figure moves.
		expect(fixture.orderLine(ORDER_LINE)).toMatchObject({ receivedQuantity: '0.000000', damagedQuantity: '3.000000' });
	});

	it('refuses to complete a delivery with units to move and no ledger registered', async () => {
		// "A receipt whose goods never became sellable is worse than a receipt that did not happen."
		const fixture = receiptFixture({ withLedger: false });

		await expect(
			fixture.service.receive({
				purchaseOrderId: ORDER,
				lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '1' }]
			})
		).rejects.toThrow(/PURCHASING_INVENTORY_UNAVAILABLE/);
		expect(fixture.orderLine(ORDER_LINE)).toMatchObject({ receivedQuantity: '0' });
	});

	it('walks the good units into the bin a line names, linked to the movement they arrived under', async () => {
		const fixture = receiptFixture();

		await fixture.service.receive({
			purchaseOrderId: ORDER,
			lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '4', warehouseBinId: 'bin-1', batchNumber: 'LOT-9' }]
		});

		expect(fixture.movements[0]).toMatchObject({ batchNumber: 'LOT-9' });
		expect(fixture.putAways).toEqual([
			expect.objectContaining({
				warehouseId: WAREHOUSE,
				binId: 'bin-1',
				variantId: VARIANT,
				quantity: '4.000000',
				stockMovementId: 'movement-1',
				referenceId: fixture.liveLines()[0].id
			})
		]);
	});

	it('does not put away a line that names no bin', async () => {
		const fixture = receiptFixture();

		await fixture.service.receive({
			purchaseOrderId: ORDER,
			lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '4' }]
		});

		expect(fixture.putAways).toEqual([]);
	});
});

describe('GoodsReceiptService — the location and the orders a delivery touches', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(RECEIVER);
	});

	afterEach(() => jest.restoreAllMocks());

	it('inherits the anchored order’s location and refuses a different one', async () => {
		// I-63: "a receipt's warehouse equals the warehouse of every order its lines belong to" —
		// receiving elsewhere is a transfer, not a receipt.
		const inherited = receiptFixture();
		const elsewhere = receiptFixture();

		const receipt = await inherited.service.receive({
			purchaseOrderId: ORDER,
			lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '1' }]
		});

		expect(receipt.warehouseId).toBe(WAREHOUSE);

		await expect(
			elsewhere.service.receive({
				purchaseOrderId: ORDER,
				warehouseId: OTHER_WAREHOUSE,
				lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '1' }]
			})
		).rejects.toThrow(/RECEIPT_WAREHOUSE_MISMATCH/);
	});

	it('requires a location on a consolidated delivery, which has no order to inherit one from', async () => {
		const fixture = receiptFixture();

		await expect(
			fixture.service.receive({ lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '1' }] })
		).rejects.toThrow(/RECEIPT_WAREHOUSE_REQUIRED/);
		await expect(
			fixture.service.receive({
				warehouseId: WAREHOUSE,
				lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '1' }]
			})
		).resolves.toMatchObject({ purchaseOrderId: undefined, warehouseId: WAREHOUSE });
	});

	it('receives one delivery covering several orders and recomputes each of them', async () => {
		// "a consolidated delivery is routine and the header column is a convenience anchor, not the
		// relation": every order the delivery touched gets its counters moved and its status recomputed.
		const fixture = receiptFixture({
			orders: [orderRow(ORDER), orderRow('another-order')],
			lines: [
				lineRow(ORDER_LINE, { quantity: '2.000000' }),
				lineRow(SECOND_ORDER_LINE, { purchaseOrderId: 'another-order', quantity: '4.000000' })
			]
		});

		const receipt = await fixture.service.receive({
			warehouseId: WAREHOUSE,
			lines: [
				{ purchaseOrderLineId: ORDER_LINE, quantity: '2' },
				{ purchaseOrderLineId: SECOND_ORDER_LINE, quantity: '3' }
			]
		});

		expect(receipt.purchaseOrderId).toBeUndefined();
		expect(receipt.purchaseOrderStatus).toBeUndefined();
		expect(receipt.purchaseOrderStatuses).toEqual({
			[ORDER]: PurchaseOrderStatus.RECEIVED,
			'another-order': PurchaseOrderStatus.PARTIALLY_RECEIVED
		});
		expect(receipt.outstandingQuantity).toBe('1.000000');
	});

	it('refuses a consolidated delivery against an order that was never sent, or one already received', async () => {
		// **The corrected contract: every order a delivery touches is checked with the same predicate.**
		// Only the anchored order used to reach `assertReceivable`; a consolidated delivery — the routine
		// case, which names no order — was gated on `CANCELED` and `CLOSED` alone. So a receipt with no
		// `purchaseOrderId` naming a line of a DRAFT order posted, wrote `RECEIPT` movements that
		// incremented stock, and moved that order from `DRAFT` straight to `PARTIALLY_RECEIVED` — around
		// the approval gate `send()` enforces — and the same call against a `RECEIVED` order received it
		// a second time.
		const draft = receiptFixture({ orders: [orderRow(ORDER, { status: PurchaseOrderStatus.DRAFT })] });
		const received = receiptFixture({ orders: [orderRow(ORDER, { status: PurchaseOrderStatus.RECEIVED })] });

		await expect(
			draft.service.receive({
				warehouseId: WAREHOUSE,
				lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '1' }]
			})
		).rejects.toThrow(/PURCHASE_ORDER_NOT_SENT/);
		await expect(
			received.service.receive({
				warehouseId: WAREHOUSE,
				lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '1' }]
			})
		).rejects.toThrow(/PURCHASE_ORDER_ALREADY_RECEIVED/);

		// Nothing was posted and no stock moved for either of them.
		expect(draft.tables.goods_receipt).toEqual([]);
		expect(received.tables.goods_receipt).toEqual([]);
		expect(draft.movements).toEqual([]);
		expect(received.movements).toEqual([]);
		expect(draft.order(ORDER)).toMatchObject({ status: PurchaseOrderStatus.DRAFT });
	});

	it('refuses a consolidated delivery whose line belongs to a finished order', async () => {
		const fixture = receiptFixture({
			orders: [orderRow(ORDER, { status: PurchaseOrderStatus.CANCELED })],
			lines: [lineRow(ORDER_LINE)]
		});

		await expect(
			fixture.service.receive({
				warehouseId: WAREHOUSE,
				lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '1' }]
			})
		).rejects.toThrow(/PURCHASE_ORDER_INVALID_STATE/);
		expect(fixture.tables.goods_receipt).toEqual([]);
	});
});

describe('GoodsReceiptService — a further line, and a reversal (doc 09 §9.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(RECEIVER);
	});

	afterEach(() => jest.restoreAllMocks());

	/** A posted receipt with one line of four against the first order line. */
	async function postedReceipt() {
		const fixture = receiptFixture();

		const receipt = await fixture.service.receive({
			purchaseOrderId: ORDER,
			lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '4' }]
		});

		return { fixture, receipt };
	}

	it('records one further line against a posted receipt through the same checks', async () => {
		// A delivery that arrives in two lorries on one note: the second half goes through exactly the
		// ceiling and the same movement seam.
		const { fixture, receipt } = await postedReceipt();

		const updated = await fixture.service.recordLine(receipt.id, {
			purchaseOrderLineId: ORDER_LINE,
			quantity: '3'
		});

		expect(updated).toMatchObject({ receivedQuantity: '3.000000', outstandingQuantity: '13.000000' });
		expect(fixture.linesOf(receipt.id)).toHaveLength(2);
		expect(fixture.orderLine(ORDER_LINE)).toMatchObject({ receivedQuantity: '7.000000' });
		expect(fixture.movements).toHaveLength(2);
	});

	it('refuses a further line that would pass the ceiling', async () => {
		const { fixture, receipt } = await postedReceipt();

		await expect(
			fixture.service.recordLine(receipt.id, { purchaseOrderLineId: ORDER_LINE, quantity: '7' })
		).rejects.toThrow(new RegExp(PurchasingCodes.RECEIPT_OVER_TOLERANCE));
		expect(fixture.linesOf(receipt.id)).toHaveLength(1);
	});

	it('refuses a further line against a receipt that was reversed', async () => {
		const { fixture, receipt } = await postedReceipt();

		await fixture.service.reverse(receipt.id);

		await expect(
			fixture.service.recordLine(receipt.id, { purchaseOrderLineId: ORDER_LINE, quantity: '1' })
		).rejects.toThrow(/was reversed, so nothing further can be recorded/);
	});

	it('refuses a further line whose order is finished', async () => {
		const { fixture, receipt } = await postedReceipt();

		fixture.order(ORDER)!.status = PurchaseOrderStatus.CLOSED;

		await expect(
			fixture.service.recordLine(receipt.id, { purchaseOrderLineId: ORDER_LINE, quantity: '1' })
		).rejects.toThrow(/PURCHASE_ORDER_INVALID_STATE/);
	});

	it('refuses a further line that does not belong to the order the receipt is anchored to', async () => {
		const fixture = receiptFixture({
			orders: [orderRow(ORDER), orderRow('another-order')],
			lines: [lineRow(ORDER_LINE), lineRow(SECOND_ORDER_LINE, { purchaseOrderId: 'another-order' })]
		});

		const receipt = await fixture.service.receive({
			purchaseOrderId: ORDER,
			lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '4' }]
		});

		await expect(
			fixture.service.recordLine(receipt.id, { purchaseOrderLineId: SECOND_ORDER_LINE, quantity: '1' })
		).rejects.toThrow(/RECEIPT_ORDER_MISMATCH/);
		expect(fixture.linesOf(receipt.id)).toHaveLength(1);
	});

	it('names a further line it cannot resolve, rather than the order the receipt is anchored to', async () => {
		// The same shape as the delivery path: the order a line belongs to is discovered through the line,
		// so a name that resolves to nothing would otherwise be answered as a line of another order — a
		// mismatch that does not exist, reported for a line that is simply not there.
		const { fixture, receipt } = await postedReceipt();

		await expect(
			fixture.service.recordLine(receipt.id, { purchaseOrderLineId: 'no-such-line', quantity: '1' })
		).rejects.toThrow(/PURCHASE_ORDER_LINE_NOT_FOUND/);
		expect(fixture.linesOf(receipt.id)).toHaveLength(1);
	});

	it('answers the line a single-line write produced', async () => {
		const { fixture, receipt } = await postedReceipt();

		const line = await fixture.service.recordSingleLine(receipt.id, {
			purchaseOrderLineId: ORDER_LINE,
			quantity: '2'
		});

		expect(line).toMatchObject({ purchaseOrderLineId: ORDER_LINE, quantity: '2.000000', receiptId: receipt.id });
	});

	it('reverses a receipt, taking exactly what it added back out of stock', async () => {
		// "Reversing it writes the compensating movements the ledger needs — a `WRITE_OFF` of exactly the
		// good quantity the receipt added, at the same location — puts the received counters back on the
		// orders' lines and refreshes those orders' statuses."
		const { fixture, receipt } = await postedReceipt();

		const reversed = await fixture.service.reverse(receipt.id, 'wrong delivery');

		expect(reversed).toMatchObject({
			status: GoodsReceiptStatus.CANCELED,
			note: 'wrong delivery',
			version: 2
		});
		expect(reversed.canceledAt).toBeInstanceOf(Date);
		expect(fixture.movements.map((movement) => [movement.kind, movement.quantity])).toEqual([
			[StockMovementKind.RECEIPT, '4.000000'],
			[StockMovementKind.WRITE_OFF, '-4.000000']
		]);
		// The counters are back where they were, and the order falls back to what the supplier confirmed.
		expect(fixture.orderLine(ORDER_LINE)).toMatchObject({ receivedQuantity: '0.000000', damagedQuantity: '0.000000' });
		expect(fixture.order(ORDER)).toMatchObject({ status: PurchaseOrderStatus.SENT });
	});

	it('takes the damaged units off the counters without writing a level movement for them', async () => {
		// "a compensating write-off would subtract units the level never gained."
		const fixture = receiptFixture();

		const receipt = await fixture.service.receive({
			purchaseOrderId: ORDER,
			lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '2', damagedQuantity: '3' }]
		});

		await fixture.service.reverse(receipt.id);

		expect(fixture.movements.map((movement) => movement.kind)).toEqual([
			StockMovementKind.RECEIPT,
			StockMovementKind.DAMAGE,
			StockMovementKind.WRITE_OFF
		]);
		expect(fixture.orderLine(ORDER_LINE)).toMatchObject({ receivedQuantity: '0.000000', damagedQuantity: '0.000000' });
	});

	it('refuses to reverse a delivery with units to take back and no ledger registered', async () => {
		const { fixture, receipt } = await postedReceipt();
		const withoutLedger = receiptFixture({
			receipts: [{ ...fixture.tables.goods_receipt[0] }],
			receiptLines: fixture.tables.goods_receipt_line.map((row) => ({ ...row })),
			withLedger: false
		});

		await expect(withoutLedger.service.reverse(receipt.id)).rejects.toThrow(
			/PURCHASING_INVENTORY_UNAVAILABLE/
		);
		expect(withoutLedger.tables.goods_receipt[0].status).toBe(GoodsReceiptStatus.POSTED);
	});

	it('treats reversing an already reversed receipt as a no-op', async () => {
		const { fixture, receipt } = await postedReceipt();

		await fixture.service.reverse(receipt.id, 'first');

		const again = await fixture.service.reverse(receipt.id, 'second');

		expect(again).toMatchObject({ status: GoodsReceiptStatus.CANCELED, note: 'first' });
		// One receipt, one compensating pair: a second reversal writes nothing.
		expect(fixture.movements).toHaveLength(2);
	});
});

describe('GoodsReceiptService — the figures a caller reads back', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(RECEIVER);
	});

	afterEach(() => jest.restoreAllMocks());

	it('derives what an order is still waiting for from its own lines, floored at zero', async () => {
		// Derived rather than accumulated, so it cannot drift from the counters a reversal put back.
		const fixture = receiptFixture({
			lines: [
				lineRow(ORDER_LINE, { quantity: '10.000000', receivedQuantity: '4.000000' }),
				lineRow(SECOND_ORDER_LINE, { quantity: '5.000000', receivedQuantity: '4.000000', damagedQuantity: '1.000000' }),
				// An over-received line owes nothing rather than a negative quantity.
				lineRow('over-received', { quantity: '1.000000', receivedQuantity: '2.000000' })
			]
		});

		expect(await fixture.service.outstandingQuantity(ORDER)).toBe('6.000000');
	});

	it('answers an order nothing has arrived against with its whole ordered quantity', async () => {
		const fixture = receiptFixture();

		expect(await fixture.service.outstandingQuantity(ORDER)).toBe('20.000000');
	});

	it('names the missing numbering series rather than failing generically', async () => {
		const fixture = receiptFixture({ numberSeries: false });

		await expect(
			fixture.service.receive({
				purchaseOrderId: ORDER,
				lines: [{ purchaseOrderLineId: ORDER_LINE, quantity: '1' }]
			})
		).rejects.toThrow(/GOODS_RECEIPT_SEQUENCE_MISSING/);
		expect(fixture.tables.goods_receipt).toEqual([]);
	});

	it('reads a receipt with its lines, and refuses one that is not the caller’s', async () => {
		const fixture = receiptFixture({
			receipts: [
				{
					id: 'receipt-1',
					tenantId: TENANT,
					organizationId: ORG,
					number: 'GR-1',
					status: GoodsReceiptStatus.POSTED,
					warehouseId: WAREHOUSE,
					receivedAt: new Date(),
					version: 1
				},
				{
					id: 'theirs',
					tenantId: TENANT,
					organizationId: OTHER_ORG,
					number: 'GR-2',
					status: GoodsReceiptStatus.POSTED,
					warehouseId: WAREHOUSE,
					receivedAt: new Date(),
					version: 1
				}
			],
			receiptLines: [
				{
					id: 'receipt-line-1',
					tenantId: TENANT,
					organizationId: ORG,
					receiptId: 'receipt-1',
					purchaseOrderLineId: ORDER_LINE,
					variantId: VARIANT,
					quantity: '4.000000',
					damagedQuantity: '0'
				}
			]
		});

		const detailed = await fixture.service.findOneDetailed('receipt-1');

		expect(detailed.lines).toHaveLength(1);
		await expect(fixture.service.findOneDetailed('theirs')).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.findOneDetailed('no-such-receipt')).rejects.toThrow(
			/GOODS_RECEIPT_NOT_FOUND/
		);
	});
});
