/**
 * Removing a purchasing document keeps to the document's lifecycle (review R2-10, R2-11), against a real database.
 *
 * **R2-10.** A goods receipt is born `POSTED`: its lines' movements are part of the ledger and the order lines'
 * received counters count them. The inherited removals ignored that — `DELETE /goods-receipts/:id` (and
 * `deleteGoodsReceipt`) took the receipt and, by `ON DELETE CASCADE`, its lines, while the movements and the
 * counters stayed; `DELETE …/soft` withdrew it, and a withdrawn receipt can no longer be reversed because every
 * read of it skips retired rows. The same held for a receipt line. A posted receipt is reversed first; only a
 * `CANCELED` one — whose reversal already took its stock back and put the counters back — may go.
 *
 * **R2-11.** The hard delete of a purchase order and of an order line requires `DRAFT` and rewrites the totals; their
 * soft twins called the inherited `softRemove` with neither. A `SENT` order lost a line to a withdrawal while its
 * total still counted it, and once the remaining lines were received the order read `RECEIVED` although the
 * withdrawn line never arrived (the receipt state is read from live lines only).
 *
 * **Here nothing the defect lives in is doubled but the CRUD base.** The services are the package's own; the
 * database is an in-memory better-sqlite3 connection whose foreign keys cascade exactly as the migration's do;
 * the repositories are TypeORM's own, so a soft-deleted row is skipped by every ordinary read the way it is in
 * production. `@gauzy/core` is doubled at the module boundary for the reason the package's other suites give —
 * its barrel boots the whole application — and its CRUD base is reduced to the tenant-scoped reads and writes the
 * real one performs. Every refusal reads the rows back, so a refusal that still wrote something fails too.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');
	const { ApiErrorCode, commitVersionedUpdate } = require('./testing/versioned-write.double');

	/** A no-op decorator factory: the entities are declared, and mapped below by fixture schemas. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	/** The CRUD base, reduced to what the real one does for these calls: everything scoped to the caller's tenant. */
	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}

		private scoped(where: Record<string, unknown> = {}): Record<string, unknown> {
			return { ...where, ...(mockCaller.tenantId ? { tenantId: mockCaller.tenantId } : {}) };
		}

		async assertNestedGraphNotForeign(): Promise<void> {
			return undefined;
		}

		async find(options: any = {}): Promise<any[]> {
			return this.typeOrmRepository.find({ ...options, where: this.scoped(options.where) });
		}

		async findOneByIdString(id: any, options: any = {}): Promise<any> {
			const record = await this.typeOrmRepository.findOne({
				...options,
				where: this.scoped({ ...(options.where ?? {}), id })
			});

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async update(criteria: any, partial: any): Promise<any> {
			return this.typeOrmRepository.update(
				this.scoped(typeof criteria === 'string' ? { id: criteria } : criteria),
				partial
			);
		}

		async delete(criteria: any): Promise<any> {
			return this.typeOrmRepository.delete(
				this.scoped(typeof criteria === 'string' ? { id: criteria } : criteria)
			);
		}

		async softRemove(id: any): Promise<any> {
			return this.typeOrmRepository.softRemove(await this.findOneByIdString(id));
		}

		async softRecover(id: any): Promise<any> {
			return this.typeOrmRepository.recover(await this.findOneByIdString(id, { withDeleted: true }));
		}
	}

	return {
		ApiErrorCode,
		commitVersionedUpdate,
		readAffectedRows: jest.requireActual('@gauzy/core/src/lib/database/database.helper').readAffectedRows,
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
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
		Organization: class Organization {},
		OrganizationVendor: class OrganizationVendor {},
		ProductVariant: class ProductVariant {},
		ProductVariantPrice: class ProductVariantPrice {},
		SequenceService: class SequenceService {},
		TenantSettingService: class TenantSettingService {},
		Warehouse: class Warehouse {},
		RequestContext: {
			currentUser: () => (mockCaller.tenantId ? { tenantId: mockCaller.tenantId } : null),
			currentUserId: () => null,
			currentTenantId: () => mockCaller.tenantId,
			currentOrganizationId: () => mockCaller.organizationId,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

jest.mock('@gauzy/config', () => ({
	isMySQL: () => false,
	isPostgres: () => false,
	DatabaseTypeEnum: {
		mongodb: 'mongodb',
		sqlite: 'sqlite',
		betterSqlite3: 'better-sqlite3',
		postgres: 'postgres',
		mysql: 'mysql'
	}
}));

/** The caller the request context answers with. */
const mockCaller: { tenantId: string | null; organizationId: string | null } = { tenantId: null, organizationId: null };

import 'reflect-metadata';
import { DataSource, EntitySchema } from 'typeorm';
import { Warehouse } from '@gauzy/core';
import { GoodsReceiptLine } from './goods-receipt-line/goods-receipt-line.entity';
import { GoodsReceiptLineService } from './goods-receipt-line/goods-receipt-line.service';
import { GoodsReceipt } from './goods-receipt/goods-receipt.entity';
import { GoodsReceiptService } from './goods-receipt/goods-receipt.service';
import { PurchaseOrderLine } from './purchase-order-line/purchase-order-line.entity';
import { PurchaseOrderLineService } from './purchase-order-line/purchase-order-line.service';
import { PurchaseOrder } from './purchase-order/purchase-order.entity';
import { PurchaseOrderService } from './purchase-order/purchase-order.service';
import { GoodsReceiptStatus, PurchaseOrderStatus } from './purchasing.types';

type Row = Record<string, any>;

const TENANT = '00000000-0000-4000-8000-00000000000a';
const ORG = '00000000-0000-4000-8000-0000000000a1';
const VENDOR = '00000000-0000-4000-8000-0000000000f1';
const WAREHOUSE = '00000000-0000-4000-8000-0000000001a1';
const ORDER = '00000000-0000-4000-8000-0000000002a1';
const LINE_A = '00000000-0000-4000-8000-0000000003a1';
const LINE_B = '00000000-0000-4000-8000-0000000003b1';
const VARIANT_A = '00000000-0000-4000-8000-0000000004a1';
const VARIANT_B = '00000000-0000-4000-8000-0000000004b1';
const RECEIPT = '00000000-0000-4000-8000-0000000005a1';
const RECEIPT_LINE = '00000000-0000-4000-8000-0000000006a1';

/*
|--------------------------------------------------------------------------
| Fixture schemas: the columns the services read and write
|--------------------------------------------------------------------------
*/

const base = () => ({
	id: { type: 'varchar', primary: true, generated: 'uuid' },
	createdAt: { type: 'datetime', createDate: true },
	updatedAt: { type: 'datetime', updateDate: true },
	deletedAt: { type: 'datetime', nullable: true, deleteDate: true },
	tenantId: { type: 'varchar', nullable: true },
	organizationId: { type: 'varchar', nullable: true }
});

const decimal = (options: Row = {}) => ({ type: 'decimal', precision: 20, scale: 6, default: 0, ...options });
const optional = (type: string) => ({ type, nullable: true });

const schemas = [
	new EntitySchema<any>({
		name: 'Warehouse',
		target: Warehouse,
		tableName: 'warehouse',
		columns: { ...(base() as any), name: optional('varchar') }
	}),
	new EntitySchema<any>({
		name: 'PurchaseOrder',
		target: PurchaseOrder,
		tableName: 'purchase_order',
		columns: {
			...(base() as any),
			number: { type: 'varchar' },
			vendorId: { type: 'varchar' },
			warehouseId: { type: 'varchar' },
			status: { type: 'varchar' },
			currency: { type: 'varchar' },
			subtotal: decimal(),
			discountTotal: decimal(),
			taxTotal: decimal(),
			shippingTotal: decimal(),
			grandTotal: decimal(),
			expectedAt: optional('datetime'),
			receivedAt: optional('datetime'),
			version: { type: 'int', default: 1 },
			note: optional('varchar')
		},
		relations: {
			lines: { type: 'one-to-many', target: 'PurchaseOrderLine', inverseSide: 'purchaseOrder' }
		}
	}),
	new EntitySchema<any>({
		name: 'PurchaseOrderLine',
		target: PurchaseOrderLine,
		tableName: 'purchase_order_line',
		columns: {
			...(base() as any),
			variantId: { type: 'varchar' },
			quantity: decimal(),
			conversionFactor: decimal({ default: 1 }),
			receivedQuantity: decimal(),
			damagedQuantity: decimal(),
			billedQuantity: decimal(),
			unitCost: decimal(),
			taxRate: decimal({ nullable: true, default: null }),
			discountTotal: decimal(),
			total: decimal(),
			expectedAt: optional('datetime'),
			purchaseOrderId: { type: 'varchar' }
		},
		relations: {
			purchaseOrder: {
				type: 'many-to-one',
				target: 'PurchaseOrder',
				joinColumn: { name: 'purchaseOrderId' },
				onDelete: 'CASCADE'
			}
		}
	}),
	new EntitySchema<any>({
		name: 'GoodsReceipt',
		target: GoodsReceipt,
		tableName: 'goods_receipt',
		columns: {
			...(base() as any),
			number: { type: 'varchar' },
			status: { type: 'varchar' },
			receivedAt: { type: 'datetime' },
			canceledAt: optional('datetime'),
			version: { type: 'int', default: 1 },
			note: optional('varchar'),
			purchaseOrderId: optional('varchar'),
			warehouseId: { type: 'varchar' }
		},
		relations: {
			lines: { type: 'one-to-many', target: 'GoodsReceiptLine', inverseSide: 'receipt' },
			warehouse: { type: 'many-to-one', target: 'Warehouse', joinColumn: { name: 'warehouseId' } }
		}
	}),
	new EntitySchema<any>({
		name: 'GoodsReceiptLine',
		target: GoodsReceiptLine,
		tableName: 'goods_receipt_line',
		columns: {
			...(base() as any),
			purchaseOrderLineId: { type: 'varchar' },
			variantId: { type: 'varchar' },
			quantity: decimal(),
			damagedQuantity: decimal(),
			unitCost: decimal(),
			warehouseBinId: optional('varchar'),
			stockMovementId: optional('varchar'),
			receiptId: { type: 'varchar' }
		},
		relations: {
			// `FK_goods_receipt_line_receipt` is `ON DELETE CASCADE` in the migration: removing a receipt takes its lines.
			receipt: {
				type: 'many-to-one',
				target: 'GoodsReceipt',
				joinColumn: { name: 'receiptId' },
				onDelete: 'CASCADE'
			}
		}
	})
];

/*
|--------------------------------------------------------------------------
| Harness
|--------------------------------------------------------------------------
*/

interface IHarness {
	dataSource: DataSource;
	orders: PurchaseOrderService;
	orderLines: PurchaseOrderLineService;
	receipts: GoodsReceiptService;
	receiptLines: GoodsReceiptLineService;
	/** Reads one row back, retired or not. */
	row: (table: string, id: string) => Promise<Row | undefined>;
	set: (table: string, id: string, values: Row) => Promise<void>;
}

async function harness(): Promise<IHarness> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: schemas,
		synchronize: true,
		logging: false
	});
	await dataSource.initialize();

	const insert = async (table: string, row: Row) => {
		const columns = Object.keys(row);
		await dataSource.query(
			`INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
			columns.map((column) => row[column])
		);
	};
	const scope = { tenantId: TENANT, organizationId: ORG };
	await insert('warehouse', { id: WAREHOUSE, ...scope });

	// One order: line A is 10 × 2.00, line B is 5 × 3.00, so the order is worth 35.00. It is SENT unless a case
	// says otherwise, and line A has received 10 through one posted receipt.
	await insert('purchase_order', {
		id: ORDER,
		number: 'PO-1',
		vendorId: VENDOR,
		warehouseId: WAREHOUSE,
		status: PurchaseOrderStatus.SENT,
		currency: 'USD',
		subtotal: '35.00',
		grandTotal: '35.00',
		...scope
	});
	await insert('purchase_order_line', {
		id: LINE_A,
		purchaseOrderId: ORDER,
		variantId: VARIANT_A,
		quantity: '10',
		unitCost: '2.00',
		total: '20.00',
		receivedQuantity: '10',
		...scope
	});
	await insert('purchase_order_line', {
		id: LINE_B,
		purchaseOrderId: ORDER,
		variantId: VARIANT_B,
		quantity: '5',
		unitCost: '3.00',
		total: '15.00',
		...scope
	});
	await insert('goods_receipt', {
		id: RECEIPT,
		number: 'GR-1',
		status: GoodsReceiptStatus.POSTED,
		receivedAt: new Date().toISOString(),
		purchaseOrderId: ORDER,
		warehouseId: WAREHOUSE,
		...scope
	});
	await insert('goods_receipt_line', {
		id: RECEIPT_LINE,
		receiptId: RECEIPT,
		purchaseOrderLineId: LINE_A,
		variantId: VARIANT_A,
		quantity: '10',
		unitCost: '2.00',
		stockMovementId: '00000000-0000-4000-8000-0000000007a1',
		...scope
	});

	const repository = (entity: unknown) => dataSource.getRepository(entity as any) as any;
	const orderLines = new PurchaseOrderLineService(repository(PurchaseOrderLine), undefined as any, undefined as any);
	const orders = new PurchaseOrderService(repository(PurchaseOrder), undefined as any, orderLines, undefined as any);
	const receiptLines = new GoodsReceiptLineService(repository(GoodsReceiptLine), undefined as any);
	const receipts = new GoodsReceiptService(
		repository(GoodsReceipt),
		undefined as any,
		receiptLines,
		orders,
		orderLines,
		undefined as any,
		undefined as any,
		undefined as any
	);

	return {
		dataSource,
		orders,
		orderLines,
		receipts,
		receiptLines,
		row: async (table, id) => (await dataSource.query(`SELECT * FROM "${table}" WHERE "id" = ?`, [id]))[0],
		set: async (table, id, values) => {
			const columns = Object.keys(values);
			await dataSource.query(
				`UPDATE "${table}" SET ${columns.map((column) => `"${column}" = ?`).join(', ')} WHERE "id" = ?`,
				[...columns.map((column) => values[column]), id]
			);
		}
	};
}

describe('removing a purchasing document keeps to its lifecycle (DB-backed)', () => {
	let h: IHarness;

	beforeEach(async () => {
		h = await harness();
		mockCaller.tenantId = TENANT;
		mockCaller.organizationId = ORG;
	});

	afterEach(async () => {
		mockCaller.tenantId = null;
		mockCaller.organizationId = null;
		await h.dataSource.destroy();
	});

	/*
	|--------------------------------------------------------------------------
	| R2-10: goods receipts
	|--------------------------------------------------------------------------
	*/

	describe('a posted goods receipt is reversed, not removed (R2-10)', () => {
		it('refuses to hard-delete a POSTED receipt, and leaves the receipt and its lines', async () => {
			await expect(h.receipts.delete(RECEIPT)).rejects.toMatchObject({
				status: 409,
				response: { code: 'GOODS_RECEIPT_NOT_DELETABLE' }
			});

			expect((await h.row('goods_receipt', RECEIPT))?.status).toBe(GoodsReceiptStatus.POSTED);
			expect(await h.row('goods_receipt_line', RECEIPT_LINE)).toBeDefined();
		});

		it('refuses to soft-delete a POSTED receipt, so it stays reversible', async () => {
			await expect(h.receipts.softRemove(RECEIPT)).rejects.toMatchObject({
				status: 409,
				response: { code: 'GOODS_RECEIPT_NOT_DELETABLE' }
			});

			expect((await h.row('goods_receipt', RECEIPT))?.deletedAt).toBeNull();
			expect((await h.receipts.findOneDetailed(RECEIPT)).status).toBe(GoodsReceiptStatus.POSTED);
		});

		it('refuses to hard- or soft-delete a line of a POSTED receipt', async () => {
			await expect(h.receiptLines.delete(RECEIPT_LINE)).rejects.toMatchObject({
				status: 409,
				response: { code: 'GOODS_RECEIPT_LINE_NOT_DELETABLE' }
			});
			await expect(h.receiptLines.softRemove(RECEIPT_LINE)).rejects.toMatchObject({
				status: 409,
				response: { code: 'GOODS_RECEIPT_LINE_NOT_DELETABLE' }
			});

			const line = await h.row('goods_receipt_line', RECEIPT_LINE);
			expect(line).toBeDefined();
			expect(line?.deletedAt).toBeNull();
		});

		it('control: a CANCELED receipt and its lines may be withdrawn and recovered, and removed', async () => {
			await h.set('goods_receipt', RECEIPT, { status: GoodsReceiptStatus.CANCELED });

			await h.receiptLines.softRemove(RECEIPT_LINE);
			expect((await h.row('goods_receipt_line', RECEIPT_LINE))?.deletedAt).not.toBeNull();
			await h.receiptLines.softRecover(RECEIPT_LINE);

			await h.receipts.softRemove(RECEIPT);
			expect((await h.row('goods_receipt', RECEIPT))?.deletedAt).not.toBeNull();
			await h.receipts.softRecover(RECEIPT);
			expect((await h.row('goods_receipt', RECEIPT))?.deletedAt).toBeNull();

			await h.receipts.delete(RECEIPT);
			expect(await h.row('goods_receipt', RECEIPT)).toBeUndefined();
			expect(await h.row('goods_receipt_line', RECEIPT_LINE)).toBeUndefined();
		});
	});

	/*
	|--------------------------------------------------------------------------
	| R2-11: purchase orders and their lines
	|--------------------------------------------------------------------------
	*/

	describe('a purchase order and its lines are withdrawn only while DRAFT, and the totals follow (R2-11)', () => {
		it('refuses to soft-delete a SENT order', async () => {
			await expect(h.orders.softRemove(ORDER)).rejects.toMatchObject({ status: 409 });

			expect((await h.row('purchase_order', ORDER))?.deletedAt).toBeNull();
		});

		it('refuses to withdraw a line of a SENT order, so the order cannot read RECEIVED without it', async () => {
			await expect(h.orderLines.softRemove(LINE_B)).rejects.toMatchObject({ status: 409 });
			await expect(h.orders.softRemoveLine(LINE_B)).rejects.toMatchObject({ status: 409 });

			expect((await h.row('purchase_order_line', LINE_B))?.deletedAt).toBeNull();
			// Line A is fully received and line B is still open, so the order is still waiting for B.
			expect((await h.orderLines.findForOrder(ORDER)).map((line) => line.id).sort()).toEqual([LINE_A, LINE_B]);
		});

		it('refuses to recover a withdrawn line into an order that has left DRAFT', async () => {
			await h.set('purchase_order_line', LINE_B, { deletedAt: new Date().toISOString() });

			await expect(h.orderLines.softRecover(LINE_B)).rejects.toMatchObject({ status: 409 });
			await expect(h.orders.softRecoverLine(LINE_B)).rejects.toMatchObject({ status: 409 });

			expect((await h.row('purchase_order_line', LINE_B))?.deletedAt).not.toBeNull();
		});

		it('control: a DRAFT order withdraws and recovers a line with the totals rewritten, and is withdrawn itself', async () => {
			await h.set('purchase_order', ORDER, { status: PurchaseOrderStatus.DRAFT });

			await h.orders.softRemoveLine(LINE_B);
			expect((await h.row('purchase_order_line', LINE_B))?.deletedAt).not.toBeNull();
			expect(Number((await h.row('purchase_order', ORDER))?.grandTotal)).toBe(20);

			await h.orders.softRecoverLine(LINE_B);
			expect((await h.row('purchase_order_line', LINE_B))?.deletedAt).toBeNull();
			expect(Number((await h.row('purchase_order', ORDER))?.grandTotal)).toBe(35);

			await h.orders.softRemove(ORDER);
			expect((await h.row('purchase_order', ORDER))?.deletedAt).not.toBeNull();
		});
	});
});
