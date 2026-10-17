/**
 * A purchase order's buyer, written against a real database holding two tenants (security audit P0 #6c).
 *
 * `buyerUserId` is who owns an order — the routing key for its approvals and follow-ups — and a plain column: no
 * relation declares it, so the platform's cross-tenant check, which reads relation join columns, never saw it. `POST` /
 * `PUT /purchase-orders` and `createPurchaseOrder` / `updatePurchaseOrder` all reach `PurchaseOrderService.create` /
 * `update`, which stored any user id as given: a caller of tenant A made a user of tenant B the buyer of A's order.
 * `approvedByUserId` is the other user column of the order, and it is the approver's own id, written by the approval
 * and never taken from a payload; the last case pins that.
 *
 * **Nothing the defect lives in is doubled but the CRUD base.** The services are the package's own; the database is an
 * in-memory better-sqlite3 connection; the users are real rows of tenant A, of tenant B and of no tenant. `@gauzy/core`
 * is doubled at the module boundary for the reason the package's other suites give, and its CRUD base is reduced to
 * the tenant-scoped reads and writes the real one performs. Every refusal reads the order back.
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

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async update(criteria: any, partial: any): Promise<any> {
			return this.typeOrmRepository.update(
				this.scoped(typeof criteria === 'string' ? { id: criteria } : criteria),
				partial
			);
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
		User: class User {},
		Warehouse: class Warehouse {},
		RequestContext: {
			currentUser: () => (mockCaller.tenantId ? { tenantId: mockCaller.tenantId } : null),
			currentUserId: () => mockCaller.userId,
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
const mockCaller: { tenantId: string | null; organizationId: string | null; userId: string | null } = {
	tenantId: null,
	organizationId: null,
	userId: null
};

import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { DataSource, EntitySchema } from 'typeorm';
import { OrganizationVendor, User, Warehouse } from '@gauzy/core';
import { GoodsReceipt } from './goods-receipt/goods-receipt.entity';
import { PurchaseOrderLine } from './purchase-order-line/purchase-order-line.entity';
import { PurchaseOrderLineService } from './purchase-order-line/purchase-order-line.service';
import { PurchaseOrder } from './purchase-order/purchase-order.entity';
import { PurchaseOrderService } from './purchase-order/purchase-order.service';
import { PurchaseOrderStatus } from './purchasing.types';

type Row = Record<string, any>;

const TENANT_A = '00000000-0000-4000-8000-00000000000a';
const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const TENANT_B = '00000000-0000-4000-8000-00000000000b';
const VENDOR = '00000000-0000-4000-8000-0000000000f1';
const WAREHOUSE = '00000000-0000-4000-8000-0000000001a1';
const ORDER = '00000000-0000-4000-8000-0000000002a1';

/** The caller, a second user of tenant A, a user of tenant B and a user of no tenant. */
const USER = {
	caller: '00000000-0000-4000-8000-0000000009a1',
	colleague: '00000000-0000-4000-8000-0000000009a2',
	foreign: '00000000-0000-4000-8000-0000000009b1',
	noTenant: '00000000-0000-4000-8000-0000000009c1'
};

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
	new EntitySchema<any>({ name: 'User', target: User, tableName: 'user', columns: { ...(base() as any) } }),
	new EntitySchema<any>({
		name: 'Warehouse',
		target: Warehouse,
		tableName: 'warehouse',
		columns: { ...(base() as any) }
	}),
	new EntitySchema<any>({
		name: 'OrganizationVendor',
		target: OrganizationVendor,
		tableName: 'organization_vendor',
		columns: {
			...(base() as any),
			isActive: { type: 'boolean', default: true },
			isArchived: { type: 'boolean', default: false },
			paymentTermId: optional('varchar'),
			paymentTermsDays: optional('int')
		}
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
			vendorReference: optional('varchar'),
			buyerUserId: optional('varchar'),
			status: { type: 'varchar' },
			currency: { type: 'varchar' },
			subtotal: decimal(),
			discountTotal: decimal(),
			taxTotal: decimal(),
			shippingTotal: decimal(),
			grandTotal: decimal(),
			paymentTermId: optional('varchar'),
			paymentTermsDaysSnapshot: optional('int'),
			dueDate: optional('datetime'),
			expectedAt: optional('datetime'),
			approvedAt: optional('datetime'),
			approvedByUserId: optional('varchar'),
			approvalId: optional('varchar'),
			version: { type: 'int', default: 1 },
			note: optional('varchar'),
			metadata: optional('simple-json')
		},
		relations: {
			lines: { type: 'one-to-many', target: 'PurchaseOrderLine', inverseSide: 'purchaseOrder' },
			receipts: { type: 'one-to-many', target: 'GoodsReceipt', inverseSide: 'purchaseOrder' },
			vendor: {
				type: 'many-to-one',
				target: 'OrganizationVendor',
				joinColumn: { name: 'vendorId' },
				createForeignKeyConstraints: false
			},
			warehouse: {
				type: 'many-to-one',
				target: 'Warehouse',
				joinColumn: { name: 'warehouseId' },
				createForeignKeyConstraints: false
			}
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
			unitCost: decimal(),
			taxRate: decimal({ nullable: true, default: null }),
			discountTotal: decimal(),
			total: decimal(),
			expectedAt: optional('datetime'),
			purchaseOrderId: { type: 'varchar' }
		},
		relations: {
			purchaseOrder: { type: 'many-to-one', target: 'PurchaseOrder', joinColumn: { name: 'purchaseOrderId' } }
		}
	}),
	new EntitySchema<any>({
		name: 'GoodsReceipt',
		target: GoodsReceipt,
		tableName: 'goods_receipt',
		columns: { ...(base() as any), purchaseOrderId: optional('varchar') },
		relations: {
			purchaseOrder: { type: 'many-to-one', target: 'PurchaseOrder', joinColumn: { name: 'purchaseOrderId' } }
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
	rows: (table: string) => Promise<Row[]>;
	order: () => Promise<Row>;
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
	const scope = { tenantId: TENANT_A, organizationId: ORG_A };

	await insert('user', { id: USER.caller, tenantId: TENANT_A });
	await insert('user', { id: USER.colleague, tenantId: TENANT_A });
	await insert('user', { id: USER.foreign, tenantId: TENANT_B });
	await insert('user', { id: USER.noTenant, tenantId: null });
	await insert('warehouse', { id: WAREHOUSE, ...scope });
	await insert('organization_vendor', { id: VENDOR, ...scope });
	// A draft of tenant A, owned by the caller and with no lines, so an amendment touches the header alone.
	await insert('purchase_order', {
		id: ORDER,
		number: 'PO-1',
		vendorId: VENDOR,
		warehouseId: WAREHOUSE,
		buyerUserId: USER.caller,
		status: PurchaseOrderStatus.DRAFT,
		currency: 'USD',
		...scope
	});

	const repository = (entity: unknown) => dataSource.getRepository(entity as any) as any;
	const orderLines = new PurchaseOrderLineService(repository(PurchaseOrderLine), undefined as any, undefined as any);
	const sequence = { allocate: async () => ({ formatted: 'PO-2' }) };
	const orders = new PurchaseOrderService(repository(PurchaseOrder), undefined as any, orderLines, sequence as any);

	return {
		dataSource,
		orders,
		rows: (table) => dataSource.query(`SELECT * FROM "${table}"`),
		order: async () => (await dataSource.query(`SELECT * FROM "purchase_order" WHERE "id" = ?`, [ORDER]))[0]
	};
}

describe('PurchaseOrderService — the buyer is a user of the caller’s tenant (P0 #6c)', () => {
	let h: IHarness;

	beforeEach(async () => {
		mockCaller.tenantId = TENANT_A;
		mockCaller.organizationId = ORG_A;
		mockCaller.userId = USER.caller;
		h = await harness();
	});

	afterEach(async () => {
		mockCaller.tenantId = null;
		mockCaller.organizationId = null;
		mockCaller.userId = null;
		if (h?.dataSource?.isInitialized) await h.dataSource.destroy();
	});

	const raise = (buyerUserId: string) =>
		h.orders.create({ vendorId: VENDOR, warehouseId: WAREHOUSE, currency: 'USD', buyerUserId, lines: [] } as any);

	it.each([
		['a user of tenant B', USER.foreign],
		['a user of no tenant', USER.noTenant],
		['an id that names no user', '00000000-0000-4000-8000-0000000009ff']
	])('refuses to raise an order whose buyer is %s, before anything is written', async (_label, buyerUserId) => {
		await expect(raise(buyerUserId)).rejects.toThrow(/PURCHASE_ORDER_BUYER_NOT_FOUND/);

		expect((await h.rows('purchase_order')).map((row) => row.id)).toEqual([ORDER]);
	});

	it('lets a buyer of the caller’s own tenant through to the rest of the order’s checks', async () => {
		// The order then fails on its empty line set, as any order does — past the buyer.
		await expect(raise(USER.colleague)).rejects.toThrow(/at least one line/);
	});

	it.each([
		['a user of tenant B', USER.foreign],
		['a user of no tenant', USER.noTenant]
	])('refuses to hand a draft to %s, and leaves its buyer as it was', async (_label, buyerUserId) => {
		await expect(h.orders.update(ORDER, { buyerUserId } as any)).rejects.toBeInstanceOf(NotFoundException);

		expect((await h.order()).buyerUserId).toBe(USER.caller);
	});

	it('still hands a draft to another user of the caller’s tenant', async () => {
		await h.orders.update(ORDER, { buyerUserId: USER.colleague } as any);

		expect((await h.order()).buyerUserId).toBe(USER.colleague);
	});

	it('takes no approver from a payload: `approvedByUserId` is written by the approval alone', async () => {
		await h.orders.update(ORDER, { approvedByUserId: USER.foreign, note: 'amended' } as any);

		expect(await h.order()).toMatchObject({ approvedByUserId: null, note: 'amended' });
	});
});
