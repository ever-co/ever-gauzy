/**
 * Every inventory domain verb, run against a real database holding two tenants (review R2-01).
 *
 * The verbs load their document by its identifier inside a transaction, and the ledger engine resolves
 * the level, the aggregate and the product it writes the same way. The service suites beside this one
 * run over in-memory doubles that know nothing of a tenant, so a load by identifier alone looked exactly
 * like a scoped one there: a tenant-A caller could consume, release, apply, ship, receive, count, close
 * or cancel a document of tenant B, and a create that named tenant B's location and variant moved B's
 * level, and nothing in the suite could tell.
 *
 * **Here nothing the defect lives in is doubled.** The services are the real ones, including the real
 * ledger engine every verb writes through; the database is an in-memory better-sqlite3 connection with
 * the production `invalidWhereValuesBehavior`; the repositories are TypeORM's own. Tenant B's documents
 * are created through the same services while the request context says B, and tenant A then attacks
 * them. Each case reads B's rows back afterwards, so a refusal that still wrote something is a failure
 * too, and each has a control: the same verb, on A's own document, has to keep working.
 *
 * A caller with no request — the reservation expiry sweep the worker runs — is a system caller and spans
 * every tenant by design; the last case pins that it still does.
 *
 * The tables are fixture schemas carrying the columns the services read and write, bound to the
 * package's own entity classes (and to the kernel's entity classes, which the barrel double below
 * declares). `@gauzy/core` is doubled at the module boundary for the reason the package's other suites
 * give — its barrel boots the whole application — and the members this suite depends on for behaviour
 * are the kernel's own: the exact-decimal helpers, and the versioned write the package's other suites
 * share.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');
	const { commitVersionedUpdate, versionExpectationOf } = require('./testing/versioned-write.double');

	/** A no-op decorator factory: the entities are declared, and mapped below by fixture schemas. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	/** The CRUD base, reduced to the scoped read a transfer edit runs first. */
	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}

		async findOneByIdString(id: any): Promise<any> {
			const record = await this.typeOrmRepository.findOne({
				where: { id, ...(mockCaller.tenantId ? { tenantId: mockCaller.tenantId } : {}) }
			});

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}
	}

	return {
		...jest.requireActual('@gauzy/core/src/lib/money/decimal'),
		quoteIdentifier: (identifier: string) => `"${identifier}"`,
		prepareSQLQuery: (query: string) => query,
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
		Product: class Product {},
		ProductVariant: class ProductVariant {},
		Warehouse: class Warehouse {},
		WarehouseProduct: class WarehouseProduct {},
		WarehouseProductVariant: class WarehouseProductVariant {},
		User: class User {},
		Sequence: class Sequence {},
		commitVersionedUpdate,
		versionExpectationOf,
		RequestContext: {
			currentRequest: () => null,
			currentUser: () =>
				mockCaller.tenantId
					? { tenantId: mockCaller.tenantId, lastOrganizationId: mockCaller.organizationId }
					: null,
			currentUserId: () => null,
			currentTenantId: () => mockCaller.tenantId,
			currentOrganizationId: () => mockCaller.organizationId,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

/**
 * `@gauzy/config`'s barrel reads the process environment at import time; the two members this suite and
 * the engine read — the dialect vocabulary and the production `invalidWhereValuesBehavior` — are the
 * real ones from the module that declares them.
 */
jest.mock('@gauzy/config', () => jest.requireActual('@gauzy/config/src/lib/database-helpers'));

/** The caller the request context answers with; `null` is a caller with no request (a worker). */
const mockCaller: { tenantId: string | null; organizationId: string | null } = { tenantId: null, organizationId: null };

import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { DataSource, EntitySchema } from 'typeorm';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { Product, ProductVariant, Warehouse, WarehouseProduct, WarehouseProductVariant } from '@gauzy/core';
import {
	StockAdjustmentStatus,
	StockAdjustmentType,
	StockCountStatus,
	StockMovementType,
	StockReservationReferenceType,
	StockReservationStatus,
	StockTransferStatus
} from './inventory.enums';
import { InventorySequenceService } from './inventory-sequence.service';
import { StockAdjustment } from './stock-adjustment/stock-adjustment.entity';
import { StockAdjustmentService } from './stock-adjustment/stock-adjustment.service';
import { StockCountLine } from './stock-count-line/stock-count-line.entity';
import { StockCount } from './stock-count/stock-count.entity';
import { StockCountService } from './stock-count/stock-count.service';
import { StockLevelService } from './stock-level/stock-level.service';
import { StockMovement } from './stock-movement/stock-movement.entity';
import { StockReservation } from './stock-reservation/stock-reservation.entity';
import { StockReservationService } from './stock-reservation/stock-reservation.service';
import { StockTransferLine } from './stock-transfer-line/stock-transfer-line.entity';
import { StockTransferLineService } from './stock-transfer-line/stock-transfer-line.service';
import { StockTransfer } from './stock-transfer/stock-transfer.entity';
import { StockTransferService } from './stock-transfer/stock-transfer.service';

type Row = Record<string, any>;

/** Tenant A — the caller — and tenant B, whose rows A must not reach. */
const TENANT_A = '00000000-0000-4000-8000-00000000000a';
const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const TENANT_B = '00000000-0000-4000-8000-00000000000b';
const ORG_B = '00000000-0000-4000-8000-0000000000b1';

/** Two locations, one product and one variant per tenant. */
const WAREHOUSE_A = '00000000-0000-4000-8000-0000000001a1';
const WAREHOUSE_A2 = '00000000-0000-4000-8000-0000000001a2';
const WAREHOUSE_B = '00000000-0000-4000-8000-0000000001b1';
const WAREHOUSE_B2 = '00000000-0000-4000-8000-0000000001b2';
const PRODUCT_A = '00000000-0000-4000-8000-0000000002a1';
const PRODUCT_B = '00000000-0000-4000-8000-0000000002b1';
const VARIANT_A = '00000000-0000-4000-8000-0000000003a1';
const VARIANT_B = '00000000-0000-4000-8000-0000000003b1';

/** The level of each tenant's variant at its first location, both holding ten. */
const LEVEL_A = '00000000-0000-4000-8000-0000000004a1';
const LEVEL_B = '00000000-0000-4000-8000-0000000004b1';

/** The product-level aggregate each level hangs from. */
const AGGREGATE_A = '00000000-0000-4000-8000-0000000007a1';
const AGGREGATE_B = '00000000-0000-4000-8000-0000000007b1';

/** A second organization of tenant A, with stock of its own (seeded by the cases that need it). */
const ORG_A2 = '00000000-0000-4000-8000-0000000000a2';
const ORG_A2_STOCK = {
	warehouses: ['00000000-0000-4000-8000-0000000001a3'],
	product: '00000000-0000-4000-8000-0000000002a2',
	variant: '00000000-0000-4000-8000-0000000003a2',
	level: '00000000-0000-4000-8000-0000000004a2',
	aggregate: '00000000-0000-4000-8000-0000000007a2'
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

const quantity = (options: Row = {}) => ({ type: 'decimal', precision: 20, scale: 6, default: 0, ...options });
const optionalId = { type: 'varchar', nullable: true };
const optionalText = { type: 'varchar', nullable: true };
const optionalDate = { type: 'datetime', nullable: true };

const schemas = [
	new EntitySchema<any>({
		name: 'Warehouse',
		target: Warehouse,
		tableName: 'warehouse',
		columns: { ...(base() as any), name: optionalText }
	}),
	new EntitySchema<any>({
		name: 'Product',
		target: Product,
		tableName: 'product',
		columns: { ...(base() as any) }
	}),
	new EntitySchema<any>({
		name: 'ProductVariant',
		target: ProductVariant,
		tableName: 'product_variant',
		columns: { ...(base() as any), productId: optionalId }
	}),
	new EntitySchema<any>({
		name: 'WarehouseProduct',
		target: WarehouseProduct,
		tableName: 'warehouse_product',
		columns: {
			...(base() as any),
			warehouseId: { type: 'varchar' },
			productId: { type: 'varchar' },
			quantity: quantity(),
			reservedQuantity: quantity(),
			incomingQuantity: quantity(),
			safetyStock: quantity(),
			allowBackorder: { type: 'boolean', default: false },
			trackInventory: { type: 'boolean', default: true },
			isUnlimited: { type: 'boolean', default: false },
			version: { type: 'int', default: 1 }
		}
	}),
	new EntitySchema<any>({
		name: 'WarehouseProductVariant',
		target: WarehouseProductVariant,
		tableName: 'warehouse_product_variant',
		columns: {
			...(base() as any),
			warehouseProductId: { type: 'varchar' },
			variantId: { type: 'varchar' },
			quantity: quantity(),
			reservedQuantity: quantity(),
			incomingQuantity: quantity(),
			safetyStock: quantity(),
			allowBackorder: { type: 'boolean', default: false },
			backorderLimit: quantity({ nullable: true, default: null }),
			trackInventory: { type: 'boolean', default: true },
			isUnlimited: { type: 'boolean', default: false },
			binId: optionalId,
			version: { type: 'int', default: 1 }
		},
		relations: {
			warehouseProduct: {
				type: 'many-to-one',
				target: 'WarehouseProduct',
				joinColumn: { name: 'warehouseProductId' }
			}
		}
	}),
	new EntitySchema<any>({
		name: 'StockMovement',
		target: StockMovement,
		tableName: 'stock_movement',
		columns: {
			...(base() as any),
			warehouseId: { type: 'varchar' },
			warehouseProductId: optionalId,
			warehouseProductVariantId: optionalId,
			variantId: { type: 'varchar' },
			binId: optionalId,
			type: { type: 'varchar' },
			quantity: quantity(),
			quantityBefore: quantity(),
			quantityAfter: quantity(),
			reservedBefore: quantity(),
			reservedAfter: quantity(),
			referenceType: { type: 'varchar' },
			referenceId: { type: 'varchar' },
			reason: optionalText,
			note: optionalText,
			occurredAt: { type: 'datetime' }
		}
	}),
	new EntitySchema<any>({
		name: 'StockReservation',
		target: StockReservation,
		tableName: 'stock_reservation',
		columns: {
			...(base() as any),
			quantity: quantity(),
			status: { type: 'varchar' },
			referenceType: { type: 'varchar' },
			referenceId: { type: 'varchar' },
			lineId: optionalId,
			expiresAt: optionalDate,
			releasedAt: optionalDate,
			consumedAt: optionalDate,
			isBackorder: { type: 'boolean', default: false },
			expectedAt: optionalDate,
			variantId: { type: 'varchar' },
			warehouseId: { type: 'varchar' },
			warehouseProductVariantId: optionalId
		}
	}),
	new EntitySchema<any>({
		name: 'StockAdjustment',
		target: StockAdjustment,
		tableName: 'stock_adjustment',
		columns: {
			...(base() as any),
			number: { type: 'varchar' },
			type: { type: 'varchar' },
			quantity: quantity(),
			reasonCode: optionalText,
			reason: optionalText,
			note: optionalText,
			status: { type: 'varchar' },
			appliedAt: optionalDate,
			metadata: { type: 'simple-json', nullable: true },
			warehouseId: { type: 'varchar' },
			variantId: { type: 'varchar' },
			warehouseProductVariantId: optionalId,
			appliedByUserId: optionalId,
			movementId: optionalId
		}
	}),
	new EntitySchema<any>({
		name: 'StockTransfer',
		target: StockTransfer,
		tableName: 'stock_transfer',
		columns: {
			...(base() as any),
			number: { type: 'varchar' },
			status: { type: 'varchar' },
			shippedAt: optionalDate,
			receivedAt: optionalDate,
			note: optionalText,
			version: { type: 'int', default: 1 },
			metadata: { type: 'simple-json', nullable: true },
			fromWarehouseId: { type: 'varchar' },
			toWarehouseId: { type: 'varchar' }
		}
	}),
	new EntitySchema<any>({
		name: 'StockTransferLine',
		target: StockTransferLine,
		tableName: 'stock_transfer_line',
		columns: {
			...(base() as any),
			requestedQuantity: quantity(),
			shippedQuantity: quantity(),
			receivedQuantity: quantity(),
			damagedQuantity: quantity(),
			unitCost: quantity({ nullable: true, default: null }),
			note: optionalText,
			transferId: { type: 'varchar' },
			variantId: { type: 'varchar' }
		}
	}),
	new EntitySchema<any>({
		name: 'StockCount',
		target: StockCount,
		tableName: 'stock_count',
		columns: {
			...(base() as any),
			number: { type: 'varchar' },
			status: { type: 'varchar' },
			mode: optionalText,
			blindCount: { type: 'boolean', default: false },
			freezeMovements: { type: 'boolean', default: false },
			countedLineCount: { type: 'int', default: 0 },
			varianceUnits: quantity(),
			varianceValue: quantity(),
			startedAt: optionalDate,
			closedAt: optionalDate,
			note: optionalText,
			metadata: { type: 'simple-json', nullable: true },
			warehouseId: { type: 'varchar' },
			startedByUserId: optionalId,
			closedByUserId: optionalId,
			zoneId: optionalId,
			binId: optionalId,
			recountOfId: optionalId
		}
	}),
	new EntitySchema<any>({
		name: 'StockCountLine',
		target: StockCountLine,
		tableName: 'stock_count_line',
		columns: {
			...(base() as any),
			expectedQuantity: quantity(),
			countedQuantity: quantity({ nullable: true, default: null }),
			recountedQuantity: quantity({ nullable: true, default: null }),
			variance: quantity({ nullable: true, default: null }),
			status: { type: 'varchar' },
			countedAt: optionalDate,
			note: optionalText,
			countedByUserId: optionalId,
			movementId: optionalId,
			stockCountId: { type: 'varchar' },
			variantId: { type: 'varchar' },
			warehouseProductVariantId: optionalId,
			binId: optionalId
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
	engine: StockLevelService;
	reservations: StockReservationService;
	adjustments: StockAdjustmentService;
	transfers: StockTransferService;
	transferLines: StockTransferLineService;
	counts: StockCountService;
	/** Reads one row back, whatever the caller. */
	row: (table: string, id: string) => Promise<Row | undefined>;
	/** Counts the rows of a table, optionally of one tenant. */
	countOf: (table: string, tenantId?: string) => Promise<number>;
	/** Stocks one variant of one scope at one location with ten on hand; further locations are left empty. */
	stock: (scope: { tenantId: string; organizationId: string }, ids: IStockIds) => Promise<void>;
}

/** The rows one scope's stock is made of. */
interface IStockIds {
	warehouses: string[];
	product: string;
	variant: string;
	level: string;
	aggregate: string;
}

/** Acts as a caller of one tenant, or as a caller with no request at all. */
function actAs(tenantId: string | null, organizationId: string | null = null): void {
	mockCaller.tenantId = tenantId;
	mockCaller.organizationId = organizationId;
}

async function harness(): Promise<IHarness> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: schemas,
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});
	await dataSource.initialize();

	const insert = async (table: string, row: Row) => {
		const columns = Object.keys(row);
		await dataSource.query(
			`INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${columns
				.map(() => '?')
				.join(', ')})`,
			columns.map((column) => row[column])
		);
	};

	const stock: IHarness['stock'] = async (scope, { warehouses, product, variant, level, aggregate }) => {
		for (const warehouse of warehouses) {
			await insert('warehouse', { id: warehouse, ...scope });
		}
		await insert('product', { id: product, ...scope });
		await insert('product_variant', { id: variant, productId: product, ...scope });

		// Each tenant's variant is stocked at its first location with ten on hand; its second location holds
		// nothing yet, so a transfer into it is the first movement that creates a level there.
		await insert('warehouse_product', {
			id: aggregate,
			warehouseId: warehouses[0],
			productId: product,
			quantity: 10,
			...scope
		});
		await insert('warehouse_product_variant', {
			id: level,
			warehouseProductId: aggregate,
			variantId: variant,
			quantity: 10,
			...scope
		});
	};

	await stock(
		{ tenantId: TENANT_A, organizationId: ORG_A },
		{
			warehouses: [WAREHOUSE_A, WAREHOUSE_A2],
			product: PRODUCT_A,
			variant: VARIANT_A,
			level: LEVEL_A,
			aggregate: AGGREGATE_A
		}
	);
	await stock(
		{ tenantId: TENANT_B, organizationId: ORG_B },
		{
			warehouses: [WAREHOUSE_B, WAREHOUSE_B2],
			product: PRODUCT_B,
			variant: VARIANT_B,
			level: LEVEL_B,
			aggregate: AGGREGATE_B
		}
	);

	let sequence = 0;
	const sequenceService = {
		allocate: async (kind: string) => ({ formatted: `${kind}-${++sequence}` })
	} as unknown as InventorySequenceService;

	const engine = new StockLevelService(dataSource);
	const repository = (entity: unknown) => dataSource.getRepository(entity as any) as any;

	return {
		dataSource,
		engine,
		reservations: new StockReservationService(repository(StockReservation), undefined as any, engine),
		adjustments: new StockAdjustmentService(repository(StockAdjustment), undefined as any, sequenceService, engine),
		transfers: new StockTransferService(repository(StockTransfer), undefined as any, sequenceService, engine),
		transferLines: new StockTransferLineService(repository(StockTransferLine), undefined as any),
		counts: new StockCountService(repository(StockCount), undefined as any, sequenceService, engine),
		stock,
		row: async (table, id) => (await dataSource.query(`SELECT * FROM "${table}" WHERE "id" = ?`, [id]))[0],
		countOf: async (table, tenantId) =>
			Number(
				(
					await dataSource.query(
						`SELECT COUNT(*) AS "total" FROM "${table}"${tenantId ? ' WHERE "tenantId" = ?' : ''}`,
						tenantId ? [tenantId] : []
					)
				)[0].total
			)
	};
}

/** The on-hand and held quantity of a level, as numbers. */
async function levelState(h: IHarness, id: string): Promise<{ quantity: number; reservedQuantity: number }> {
	const level = await h.row('warehouse_product_variant', id);

	return { quantity: Number(level?.quantity), reservedQuantity: Number(level?.reservedQuantity) };
}

describe('inventory domain verbs keep to the caller’s tenant (DB-backed, two tenants)', () => {
	let h: IHarness;

	beforeEach(async () => {
		h = await harness();
	});

	afterEach(async () => {
		actAs(null);
		await h.dataSource.destroy();
	});

	/*
	|--------------------------------------------------------------------------
	| Reservations
	|--------------------------------------------------------------------------
	*/

	describe('stock reservations', () => {
		/** Tenant B holds three of its own units. */
		async function holdOfB(): Promise<StockReservation> {
			actAs(TENANT_B, ORG_B);
			const hold = await h.reservations.reserve({
				warehouseId: WAREHOUSE_B,
				variantId: VARIANT_B,
				productId: PRODUCT_B,
				quantity: 3,
				referenceType: StockReservationReferenceType.ORDER,
				referenceId: '00000000-0000-4000-8000-0000000005b1'
			});
			actAs(TENANT_A, ORG_A);

			return hold;
		}

		it('refuses to consume a hold of another tenant, and leaves its level and its hold as they were', async () => {
			const hold = await holdOfB();

			await expect(h.reservations.consume(hold.id)).rejects.toBeInstanceOf(NotFoundException);

			expect((await h.row('stock_reservation', hold.id))?.status).toBe(StockReservationStatus.ACTIVE);
			expect(await levelState(h, LEVEL_B)).toEqual({ quantity: 10, reservedQuantity: 3 });
			expect(await h.countOf('stock_movement', TENANT_B)).toBe(1);
		});

		it('refuses to release a hold of another tenant', async () => {
			const hold = await holdOfB();

			await expect(h.reservations.release(hold.id)).rejects.toBeInstanceOf(NotFoundException);

			expect((await h.row('stock_reservation', hold.id))?.status).toBe(StockReservationStatus.ACTIVE);
			expect(await levelState(h, LEVEL_B)).toEqual({ quantity: 10, reservedQuantity: 3 });
		});

		it('refuses a hold that names another tenant’s location and variant, and writes nothing', async () => {
			actAs(TENANT_A, ORG_A);

			await expect(
				h.reservations.reserve({
					warehouseId: WAREHOUSE_B,
					variantId: VARIANT_B,
					productId: PRODUCT_B,
					quantity: 2,
					referenceType: StockReservationReferenceType.CART,
					referenceId: '00000000-0000-4000-8000-0000000005a1'
				})
			).rejects.toBeInstanceOf(NotFoundException);

			expect(await levelState(h, LEVEL_B)).toEqual({ quantity: 10, reservedQuantity: 0 });
			expect(await h.countOf('stock_reservation')).toBe(0);
			expect(await h.countOf('stock_movement')).toBe(0);
		});

		it('control: the owner holds, consumes and releases its own stock', async () => {
			actAs(TENANT_A, ORG_A);
			const consumed = await h.reservations.reserve({
				warehouseId: WAREHOUSE_A,
				variantId: VARIANT_A,
				productId: PRODUCT_A,
				quantity: 2,
				referenceType: StockReservationReferenceType.ORDER,
				referenceId: '00000000-0000-4000-8000-0000000005a2'
			});
			const released = await h.reservations.reserve({
				warehouseId: WAREHOUSE_A,
				variantId: VARIANT_A,
				productId: PRODUCT_A,
				quantity: 1,
				referenceType: StockReservationReferenceType.CART,
				referenceId: '00000000-0000-4000-8000-0000000005a3'
			});

			expect((await h.reservations.consume(consumed.id)).status).toBe(StockReservationStatus.CONSUMED);
			expect((await h.reservations.release(released.id)).status).toBe(StockReservationStatus.RELEASED);
			expect(await levelState(h, LEVEL_A)).toEqual({ quantity: 8, reservedQuantity: 0 });
		});

		/** Tenant A's own hold of two units, taken by a caller of A's first organization. */
		async function holdOfA(): Promise<StockReservation> {
			actAs(TENANT_A, ORG_A);

			return await h.reservations.reserve({
				warehouseId: WAREHOUSE_A,
				variantId: VARIANT_A,
				productId: PRODUCT_A,
				quantity: 2,
				referenceType: StockReservationReferenceType.ORDER,
				referenceId: '00000000-0000-4000-8000-0000000005a4'
			});
		}

		it('each scope member is enforced on its own: another organization of the tenant, or another tenant sharing the organization id, cannot consume the hold', async () => {
			const hold = await holdOfA();

			actAs(TENANT_A, ORG_A2);
			await expect(h.reservations.consume(hold.id)).rejects.toBeInstanceOf(NotFoundException);
			actAs(TENANT_B, ORG_A);
			await expect(h.reservations.consume(hold.id)).rejects.toBeInstanceOf(NotFoundException);

			expect((await h.row('stock_reservation', hold.id))?.status).toBe(StockReservationStatus.ACTIVE);
			expect(await levelState(h, LEVEL_A)).toEqual({ quantity: 10, reservedQuantity: 2 });
		});

		it('a caller of the tenant with no organization is narrowed to the tenant alone', async () => {
			const hold = await holdOfA();

			actAs(TENANT_B);
			await expect(h.reservations.release(hold.id)).rejects.toBeInstanceOf(NotFoundException);
			actAs(TENANT_A);
			expect((await h.reservations.release(hold.id)).status).toBe(StockReservationStatus.RELEASED);
		});

		it("the operator's expiry sweep reaches its own organization's holds when an older batch belongs to another organization of the tenant", async () => {
			await h.stock({ tenantId: TENANT_A, organizationId: ORG_A2 }, ORG_A2_STOCK);

			actAs(TENANT_A, ORG_A2);
			const foreign = await h.reservations.reserve({
				warehouseId: ORG_A2_STOCK.warehouses[0],
				variantId: ORG_A2_STOCK.variant,
				productId: ORG_A2_STOCK.product,
				quantity: 1,
				referenceType: StockReservationReferenceType.CART,
				referenceId: '00000000-0000-4000-8000-0000000005a5',
				expiresAt: new Date(Date.now() - 120_000)
			});
			actAs(TENANT_A, ORG_A);
			const own = await h.reservations.reserve({
				warehouseId: WAREHOUSE_A,
				variantId: VARIANT_A,
				productId: PRODUCT_A,
				quantity: 1,
				referenceType: StockReservationReferenceType.CART,
				referenceId: '00000000-0000-4000-8000-0000000005a6',
				expiresAt: new Date(Date.now() - 60_000)
			});

			// A batch of one: the oldest expired hold of the tenant is the other organization's.
			expect(await h.reservations.releaseExpired(1)).toEqual({ released: 1, batches: 1 });

			expect((await h.row('stock_reservation', own.id))?.status).toBe(StockReservationStatus.EXPIRED);
			expect((await h.row('stock_reservation', foreign.id))?.status).toBe(StockReservationStatus.ACTIVE);
			expect(await levelState(h, LEVEL_A)).toEqual({ quantity: 10, reservedQuantity: 0 });
		});

		it('a caller with no request (the expiry sweep) still expires the holds of every tenant', async () => {
			const expired = new Date(Date.now() - 60_000);

			for (const [tenantId, organizationId, warehouseId, variantId, productId] of [
				[TENANT_A, ORG_A, WAREHOUSE_A, VARIANT_A, PRODUCT_A],
				[TENANT_B, ORG_B, WAREHOUSE_B, VARIANT_B, PRODUCT_B]
			]) {
				actAs(tenantId, organizationId);
				await h.reservations.reserve({
					warehouseId,
					variantId,
					productId,
					quantity: 4,
					referenceType: StockReservationReferenceType.CART,
					referenceId: '00000000-0000-4000-8000-0000000005c1',
					expiresAt: expired
				});
			}

			actAs(null);
			expect(await h.reservations.releaseExpired()).toEqual({ released: 2, batches: 1 });
			expect(await levelState(h, LEVEL_A)).toEqual({ quantity: 10, reservedQuantity: 0 });
			expect(await levelState(h, LEVEL_B)).toEqual({ quantity: 10, reservedQuantity: 0 });
		});
	});

	/*
	|--------------------------------------------------------------------------
	| Adjustments
	|--------------------------------------------------------------------------
	*/

	describe('stock adjustments', () => {
		async function draftOf(
			tenantId: string,
			organizationId: string,
			warehouseId: string,
			variantId: string
		): Promise<StockAdjustment> {
			actAs(tenantId, organizationId);
			const draft = await h.adjustments.createAdjustment({
				warehouseId,
				variantId,
				type: StockAdjustmentType.DECREASE,
				quantity: 4,
				reasonCode: 'DAMAGE'
			} as Partial<StockAdjustment>);
			actAs(TENANT_A, ORG_A);

			return draft;
		}

		it('refuses to apply a draft of another tenant, and leaves its stock where it was', async () => {
			const draft = await draftOf(TENANT_B, ORG_B, WAREHOUSE_B, VARIANT_B);

			await expect(h.adjustments.apply(draft.id)).rejects.toBeInstanceOf(NotFoundException);

			expect((await h.row('stock_adjustment', draft.id))?.status).toBe(StockAdjustmentStatus.DRAFT);
			expect(await levelState(h, LEVEL_B)).toEqual({ quantity: 10, reservedQuantity: 0 });
			expect(await h.countOf('stock_movement')).toBe(0);
		});

		it('refuses to cancel a draft of another tenant', async () => {
			const draft = await draftOf(TENANT_B, ORG_B, WAREHOUSE_B, VARIANT_B);

			await expect(h.adjustments.cancel(draft.id)).rejects.toBeInstanceOf(NotFoundException);

			expect((await h.row('stock_adjustment', draft.id))?.status).toBe(StockAdjustmentStatus.DRAFT);
		});

		it('refuses to draft a correction of another tenant’s location', async () => {
			actAs(TENANT_A, ORG_A);

			await expect(
				h.adjustments.createAdjustment({
					warehouseId: WAREHOUSE_B,
					variantId: VARIANT_B,
					type: StockAdjustmentType.SET,
					quantity: 0,
					reasonCode: 'LOSS'
				} as Partial<StockAdjustment>)
			).rejects.toBeInstanceOf(NotFoundException);

			expect(await h.countOf('stock_adjustment')).toBe(0);
		});

		it('the ledger engine refuses another tenant’s level even when a draft of the caller’s own names it', async () => {
			const draft = await draftOf(TENANT_A, ORG_A, WAREHOUSE_A, VARIANT_A);
			// The generic update can point a draft at any location after it was created; the engine is the
			// guard that cannot be walked around.
			await h.dataSource.query(
				`UPDATE "stock_adjustment" SET "warehouseId" = ?, "variantId" = ? WHERE "id" = ?`,
				[WAREHOUSE_B, VARIANT_B, draft.id]
			);

			await expect(h.adjustments.apply(draft.id)).rejects.toBeInstanceOf(NotFoundException);

			expect(await levelState(h, LEVEL_B)).toEqual({ quantity: 10, reservedQuantity: 0 });
			expect(await h.countOf('stock_movement')).toBe(0);
		});

		it('control: the owner drafts, applies and cancels its own corrections', async () => {
			const applied = await draftOf(TENANT_A, ORG_A, WAREHOUSE_A, VARIANT_A);
			const canceled = await draftOf(TENANT_A, ORG_A, WAREHOUSE_A, VARIANT_A);

			expect((await h.adjustments.apply(applied.id)).quantityDelta).toBe(-4);
			expect((await h.adjustments.cancel(canceled.id)).status).toBe(StockAdjustmentStatus.CANCELED);
			expect(await levelState(h, LEVEL_A)).toEqual({ quantity: 6, reservedQuantity: 0 });
		});
	});

	/*
	|--------------------------------------------------------------------------
	| Transfers and their lines
	|--------------------------------------------------------------------------
	*/

	describe('stock transfers', () => {
		/** A transfer of five of B's units from B's first location to its second, approved by B. */
		async function approvedTransferOfB(): Promise<StockTransfer> {
			actAs(TENANT_B, ORG_B);
			const transfer = await h.transfers.createTransfer({
				fromWarehouseId: WAREHOUSE_B,
				toWarehouseId: WAREHOUSE_B2,
				lines: [{ variantId: VARIANT_B, requestedQuantity: 5 }]
			});
			await h.transfers.request(transfer.id);
			await h.transfers.approve(transfer.id);
			actAs(TENANT_A, ORG_A);

			return transfer;
		}

		async function linesOf(transferId: string): Promise<Row[]> {
			return await h.dataSource.query(`SELECT * FROM "stock_transfer_line" WHERE "transferId" = ?`, [transferId]);
		}

		it('refuses to ship a transfer of another tenant, and leaves the source where it was', async () => {
			const transfer = await approvedTransferOfB();
			const [line] = await linesOf(transfer.id);

			await expect(
				h.transfers.ship(transfer.id, [{ lineId: line.id, shippedQuantity: 5 }])
			).rejects.toBeInstanceOf(NotFoundException);

			expect((await h.row('stock_transfer', transfer.id))?.status).toBe(StockTransferStatus.APPROVED);
			expect(await levelState(h, LEVEL_B)).toEqual({ quantity: 10, reservedQuantity: 0 });
			expect(await h.countOf('stock_movement')).toBe(0);
		});

		it('refuses to receive or cancel a transfer of another tenant', async () => {
			const transfer = await approvedTransferOfB();
			const [line] = await linesOf(transfer.id);
			actAs(TENANT_B, ORG_B);
			await h.transfers.ship(transfer.id, [{ lineId: line.id, shippedQuantity: 5 }]);
			actAs(TENANT_A, ORG_A);

			await expect(
				h.transfers.receive(transfer.id, [{ lineId: line.id, receivedQuantity: 5 }])
			).rejects.toBeInstanceOf(NotFoundException);
			await expect(h.transfers.cancel(transfer.id, 'not yours')).rejects.toBeInstanceOf(NotFoundException);

			const stored = await h.row('stock_transfer', transfer.id);
			expect(stored?.status).toBe(StockTransferStatus.IN_TRANSIT);
			expect(JSON.parse(stored?.metadata ?? 'null')).toBeNull();
			expect(Number((await linesOf(transfer.id))[0].receivedQuantity)).toBe(0);
		});

		it('refuses to request or approve a transfer of another tenant', async () => {
			actAs(TENANT_B, ORG_B);
			const draft = await h.transfers.createTransfer({
				fromWarehouseId: WAREHOUSE_B,
				toWarehouseId: WAREHOUSE_B2
			});
			actAs(TENANT_A, ORG_A);

			await expect(h.transfers.request(draft.id)).rejects.toBeInstanceOf(NotFoundException);
			expect((await h.row('stock_transfer', draft.id))?.status).toBe(StockTransferStatus.DRAFT);

			actAs(TENANT_B, ORG_B);
			await h.transfers.request(draft.id);
			actAs(TENANT_A, ORG_A);

			await expect(h.transfers.approve(draft.id)).rejects.toBeInstanceOf(NotFoundException);
			expect((await h.row('stock_transfer', draft.id))?.status).toBe(StockTransferStatus.REQUESTED);
		});

		it('refuses to create a transfer out of, or into, another tenant’s location', async () => {
			actAs(TENANT_A, ORG_A);

			await expect(
				h.transfers.createTransfer({ fromWarehouseId: WAREHOUSE_B, toWarehouseId: WAREHOUSE_A })
			).rejects.toBeInstanceOf(NotFoundException);
			await expect(
				h.transfers.createTransfer({ fromWarehouseId: WAREHOUSE_A, toWarehouseId: WAREHOUSE_B })
			).rejects.toBeInstanceOf(NotFoundException);
			await expect(
				h.transfers.createTransfer({
					fromWarehouseId: WAREHOUSE_A,
					toWarehouseId: WAREHOUSE_A2,
					lines: [{ variantId: VARIANT_B, requestedQuantity: 1 }]
				})
			).rejects.toBeInstanceOf(NotFoundException);

			expect(await h.countOf('stock_transfer')).toBe(0);
			expect(await h.countOf('stock_transfer_line')).toBe(0);
		});

		it('refuses to add a line to another tenant’s draft, or a line of another tenant’s variant', async () => {
			actAs(TENANT_B, ORG_B);
			const foreign = await h.transfers.createTransfer({
				fromWarehouseId: WAREHOUSE_B,
				toWarehouseId: WAREHOUSE_B2
			});
			actAs(TENANT_A, ORG_A);
			const own = await h.transfers.createTransfer({ fromWarehouseId: WAREHOUSE_A, toWarehouseId: WAREHOUSE_A2 });

			await expect(
				h.transferLines.addLine({ transferId: foreign.id, variantId: VARIANT_A, requestedQuantity: 3 })
			).rejects.toBeInstanceOf(NotFoundException);
			await expect(
				h.transferLines.addLine({ transferId: own.id, variantId: VARIANT_B, requestedQuantity: 3 })
			).rejects.toBeInstanceOf(NotFoundException);

			expect(await h.countOf('stock_transfer_line')).toBe(0);
		});

		it('control: the owner moves its own stock end to end', async () => {
			actAs(TENANT_A, ORG_A);
			const transfer = await h.transfers.createTransfer({
				fromWarehouseId: WAREHOUSE_A,
				toWarehouseId: WAREHOUSE_A2
			});
			const line = await h.transferLines.addLine({
				transferId: transfer.id,
				variantId: VARIANT_A,
				requestedQuantity: 4
			});
			await h.transfers.request(transfer.id);
			await h.transfers.approve(transfer.id);
			await h.transfers.ship(transfer.id, [{ lineId: line.id, shippedQuantity: 4 }]);
			const received = await h.transfers.receive(transfer.id, [{ lineId: line.id, receivedQuantity: 4 }]);

			expect(received.status).toBe(StockTransferStatus.RECEIVED);
			expect(await levelState(h, LEVEL_A)).toEqual({ quantity: 6, reservedQuantity: 0 });
			const [destination] = await h.dataSource.query(
				`SELECT "level"."quantity", "level"."tenantId" FROM "warehouse_product_variant" "level"
				 INNER JOIN "warehouse_product" "aggregate" ON "aggregate"."id" = "level"."warehouseProductId"
				 WHERE "aggregate"."warehouseId" = ?`,
				[WAREHOUSE_A2]
			);
			expect(Number(destination.quantity)).toBe(4);
			expect(destination.tenantId).toBe(TENANT_A);

			const canceled = await h.transfers.createTransfer({
				fromWarehouseId: WAREHOUSE_A,
				toWarehouseId: WAREHOUSE_A2
			});
			expect((await h.transfers.cancel(canceled.id, 'changed plan')).status).toBe(StockTransferStatus.CANCELED);
		});
	});

	/*
	|--------------------------------------------------------------------------
	| Counts
	|--------------------------------------------------------------------------
	*/

	describe('stock counts', () => {
		async function countOfB(open = false): Promise<StockCount> {
			actAs(TENANT_B, ORG_B);
			const count = await h.counts.createCount({ warehouseId: WAREHOUSE_B } as Partial<StockCount>);
			if (open) {
				await h.counts.open(count.id);
			}
			actAs(TENANT_A, ORG_A);

			return count;
		}

		async function countLinesOf(stockCountId: string): Promise<Row[]> {
			return await h.dataSource.query(`SELECT * FROM "stock_count_line" WHERE "stockCountId" = ?`, [
				stockCountId
			]);
		}

		it('refuses to open or cancel a session of another tenant', async () => {
			const count = await countOfB();

			await expect(h.counts.open(count.id)).rejects.toBeInstanceOf(NotFoundException);
			await expect(h.counts.cancel(count.id)).rejects.toBeInstanceOf(NotFoundException);

			expect((await h.row('stock_count', count.id))?.status).toBe(StockCountStatus.DRAFT);
			expect(await countLinesOf(count.id)).toHaveLength(0);
		});

		it('refuses to record or close a session of another tenant, and writes no correction on its levels', async () => {
			const count = await countOfB(true);
			const [line] = await countLinesOf(count.id);

			await expect(
				h.counts.recordLines(count.id, [{ lineId: line.id, countedQuantity: 0 }])
			).rejects.toBeInstanceOf(NotFoundException);

			actAs(TENANT_B, ORG_B);
			await h.counts.recordLines(count.id, [{ lineId: line.id, countedQuantity: 7 }]);
			actAs(TENANT_A, ORG_A);

			await expect(h.counts.close(count.id)).rejects.toBeInstanceOf(NotFoundException);

			expect((await h.row('stock_count', count.id))?.status).toBe(StockCountStatus.COUNTING);
			expect(Number((await countLinesOf(count.id))[0].countedQuantity)).toBe(7);
			expect(await levelState(h, LEVEL_B)).toEqual({ quantity: 10, reservedQuantity: 0 });
			expect(await h.countOf('stock_movement')).toBe(0);
		});

		it('refuses to open a session over another tenant’s location', async () => {
			actAs(TENANT_A, ORG_A);

			await expect(
				h.counts.createCount({ warehouseId: WAREHOUSE_B } as Partial<StockCount>)
			).rejects.toBeInstanceOf(NotFoundException);

			expect(await h.countOf('stock_count')).toBe(0);
		});

		it('a session of the caller’s own pointed at another tenant’s location snapshots none of its levels', async () => {
			actAs(TENANT_A, ORG_A);
			const count = await h.counts.createCount({ warehouseId: WAREHOUSE_A } as Partial<StockCount>);
			await h.dataSource.query(`UPDATE "stock_count" SET "warehouseId" = ? WHERE "id" = ?`, [
				WAREHOUSE_B,
				count.id
			]);

			await h.counts.open(count.id).catch(() => undefined);

			expect(await countLinesOf(count.id)).toHaveLength(0);
		});

		it('control: the owner opens, counts and closes its own session', async () => {
			actAs(TENANT_A, ORG_A);
			const count = await h.counts.createCount({ warehouseId: WAREHOUSE_A } as Partial<StockCount>);
			await h.counts.open(count.id);
			const [line] = await countLinesOf(count.id);
			await h.counts.recordLines(count.id, [{ lineId: line.id, countedQuantity: 9 }]);
			const closed = await h.counts.close(count.id);

			expect(closed.count.status).toBe(StockCountStatus.CLOSED);
			expect(closed.movements).toHaveLength(1);
			expect(await levelState(h, LEVEL_A)).toEqual({ quantity: 9, reservedQuantity: 0 });

			const canceled = await h.counts.createCount({ warehouseId: WAREHOUSE_A2 } as Partial<StockCount>);
			expect((await h.counts.cancel(canceled.id)).status).toBe(StockCountStatus.CANCELED);
		});
	});

	/*
	|--------------------------------------------------------------------------
	| A level that predates the scope stamping
	|--------------------------------------------------------------------------
	*/

	describe('a level row with no tenant of its own (its aggregate carries it)', () => {
		// Rows written before the write path stamped levels, or imported without a scope, carry the tenant on the
		// aggregate only. The engine counts such a level as its aggregate's tenant's; every read that decides a
		// write has to agree with it, or the read and the write disagree about the same row.
		beforeEach(async () => {
			await h.dataSource.query(
				`UPDATE "warehouse_product_variant" SET "tenantId" = NULL, "organizationId" = NULL WHERE "id" = ?`,
				[LEVEL_A]
			);
			actAs(TENANT_A, ORG_A);
		});

		it('a SET adjustment is computed from the quantity the level holds', async () => {
			const draft = await h.adjustments.createAdjustment({
				warehouseId: WAREHOUSE_A,
				variantId: VARIANT_A,
				type: StockAdjustmentType.SET,
				quantity: 7,
				reasonCode: 'COUNT'
			} as Partial<StockAdjustment>);

			expect((await h.adjustments.apply(draft.id)).quantityDelta).toBe(-3);
			expect(await levelState(h, LEVEL_A)).toEqual({ quantity: 7, reservedQuantity: 0 });
		});

		it('a hold is measured against the level, not refused as unstocked', async () => {
			await h.reservations.reserve({
				warehouseId: WAREHOUSE_A,
				variantId: VARIANT_A,
				productId: PRODUCT_A,
				quantity: 3,
				referenceType: StockReservationReferenceType.ORDER,
				referenceId: '00000000-0000-4000-8000-0000000005a7'
			});

			expect(await levelState(h, LEVEL_A)).toEqual({ quantity: 10, reservedQuantity: 3 });
		});

		it('a count session snapshots the level', async () => {
			const count = await h.counts.createCount({ warehouseId: WAREHOUSE_A } as Partial<StockCount>);
			await h.counts.open(count.id);

			const lines = await h.dataSource.query(`SELECT * FROM "stock_count_line" WHERE "stockCountId" = ?`, [
				count.id
			]);
			expect(lines.map((line: Row) => [line.warehouseProductVariantId, Number(line.expectedQuantity)])).toEqual([
				[LEVEL_A, 10]
			]);
		});

		it('another tenant still cannot reach it', async () => {
			actAs(TENANT_B, ORG_B);

			await expect(
				h.engine.applyMovement({
					type: StockMovementType.ADJUSTMENT,
					quantityDelta: -1,
					reservedDelta: 0,
					referenceType: 'ADJUSTMENT',
					referenceId: '00000000-0000-4000-8000-0000000006b2',
					warehouseId: WAREHOUSE_A,
					variantId: VARIANT_A,
					levelId: LEVEL_A
				} as any)
			).rejects.toBeInstanceOf(NotFoundException);
			expect(await levelState(h, LEVEL_A)).toEqual({ quantity: 10, reservedQuantity: 0 });
		});
	});

	/*
	|--------------------------------------------------------------------------
	| The ledger engine itself
	|--------------------------------------------------------------------------
	*/

	describe('the ledger engine', () => {
		const movement = {
			type: StockMovementType.ADJUSTMENT,
			quantityDelta: -10,
			reservedDelta: 0,
			referenceType: 'ADJUSTMENT',
			referenceId: '00000000-0000-4000-8000-0000000006a1'
		} as const;

		it('refuses a level of another tenant named by its id', async () => {
			actAs(TENANT_A, ORG_A);

			await expect(
				h.engine.applyMovement({
					...movement,
					warehouseId: WAREHOUSE_B,
					variantId: VARIANT_B,
					levelId: LEVEL_B
				} as any)
			).rejects.toBeInstanceOf(NotFoundException);

			expect(await levelState(h, LEVEL_B)).toEqual({ quantity: 10, reservedQuantity: 0 });
			expect(await h.countOf('stock_movement')).toBe(0);
		});

		it('refuses a level of another tenant named by its location and variant', async () => {
			actAs(TENANT_A, ORG_A);

			await expect(
				h.engine.applyMovement({ ...movement, warehouseId: WAREHOUSE_B, variantId: VARIANT_B } as any)
			).rejects.toBeInstanceOf(NotFoundException);

			expect(await levelState(h, LEVEL_B)).toEqual({ quantity: 10, reservedQuantity: 0 });
		});

		it('refuses to stock the caller’s product at another tenant’s location, and creates no level there', async () => {
			actAs(TENANT_A, ORG_A);

			await expect(
				h.engine.applyMovement({
					...movement,
					type: StockMovementType.RECEIPT,
					quantityDelta: 5,
					warehouseId: WAREHOUSE_B,
					variantId: VARIANT_A,
					productId: PRODUCT_A
				} as any)
			).rejects.toBeInstanceOf(NotFoundException);

			expect(await h.countOf('warehouse_product')).toBe(2);
			expect(await h.countOf('warehouse_product_variant')).toBe(2);
			expect(await h.countOf('stock_movement')).toBe(0);
		});

		it('refuses to stock another tenant’s variant at the caller’s own location', async () => {
			actAs(TENANT_A, ORG_A);

			await expect(
				h.engine.applyMovement({
					...movement,
					type: StockMovementType.RECEIPT,
					quantityDelta: 5,
					warehouseId: WAREHOUSE_A,
					variantId: VARIANT_B
				} as any)
			).rejects.toBeInstanceOf(NotFoundException);

			expect(await h.countOf('warehouse_product')).toBe(2);
			expect(await h.countOf('warehouse_product_variant')).toBe(2);
		});

		it('control: a caller with no request writes to any tenant’s level, and a tenant caller to its own', async () => {
			actAs(null);
			await h.engine.applyMovement({
				...movement,
				quantityDelta: -1,
				warehouseId: WAREHOUSE_B,
				variantId: VARIANT_B
			} as any);
			actAs(TENANT_A, ORG_A);
			await h.engine.applyMovement({
				...movement,
				quantityDelta: -2,
				warehouseId: WAREHOUSE_A,
				variantId: VARIANT_A
			} as any);
			await h.engine.applyMovement({
				...movement,
				type: StockMovementType.RECEIPT,
				quantityDelta: 3,
				warehouseId: WAREHOUSE_A2,
				variantId: VARIANT_A
			} as any);

			expect(await levelState(h, LEVEL_B)).toEqual({ quantity: 9, reservedQuantity: 0 });
			expect(await levelState(h, LEVEL_A)).toEqual({ quantity: 8, reservedQuantity: 0 });
			expect(await h.countOf('stock_movement', TENANT_A)).toBe(2);
			expect(await h.countOf('stock_movement', TENANT_B)).toBe(1);
		});
	});

	/*
	|--------------------------------------------------------------------------
	| Quantities a caller may not state (review R2-02, R2-03)
	|--------------------------------------------------------------------------
	|
	| Not tenancy, but the same harness for the same reason: the engine, the level row and the ledger are
	| the real ones, so "refused and nothing written" is read back from the database rather than from a
	| double that cannot tell.
	*/

	describe('a caller cannot widen the level’s backorder policy (R2-02)', () => {
		/**
		 * The input the GraphQL mutation hands `reserve()` untouched. The REST DTO has no such member and
		 * its whitelist strips it, so before the fix the same request was refused over REST and granted
		 * over GraphQL.
		 */
		const hold = {
			warehouseId: WAREHOUSE_A,
			variantId: VARIANT_A,
			productId: PRODUCT_A,
			quantity: 1000000,
			referenceType: StockReservationReferenceType.ORDER,
			referenceId: '00000000-0000-4000-8000-0000000005a9'
		};
		const overselling = { ...hold, allowBackorder: true };

		it('refuses a hold past availability on a no-backorder level although the input says allowBackorder: true', async () => {
			actAs(TENANT_A, ORG_A);

			await expect(h.reservations.reserve(overselling)).rejects.toMatchObject({
				response: { code: 'STOCK_INSUFFICIENT_AVAILABLE' }
			});

			expect(await levelState(h, LEVEL_A)).toEqual({ quantity: 10, reservedQuantity: 0 });
			expect(await h.countOf('stock_reservation')).toBe(0);
			expect(await h.countOf('stock_movement')).toBe(0);
		});

		it('refuses a hold at a location the variant was never stocked at, whatever the input says, and creates no level', async () => {
			actAs(TENANT_A, ORG_A);

			await expect(
				h.reservations.reserve({ ...overselling, warehouseId: WAREHOUSE_A2, quantity: 5 })
			).rejects.toMatchObject({ response: { code: 'STOCK_INSUFFICIENT_AVAILABLE' } });

			expect(await h.countOf('warehouse_product_variant', TENANT_A)).toBe(1);
			expect(await h.countOf('stock_reservation')).toBe(0);
		});

		it('control: the level’s own backorder policy still grants a hold up to its limit, and the caller may tighten it', async () => {
			await h.dataSource.query(
				`UPDATE "warehouse_product_variant" SET "allowBackorder" = 1, "backorderLimit" = 5 WHERE "id" = ?`,
				[LEVEL_A]
			);
			actAs(TENANT_A, ORG_A);

			// Tightening: the caller says this demand may not backorder, so a hold past on-hand is refused
			// although the level would allow it.
			await expect(
				h.reservations.reserve({ ...overselling, quantity: 12, allowBackorder: false })
			).rejects.toMatchObject({ response: { code: 'STOCK_INSUFFICIENT_AVAILABLE' } });
			expect(await levelState(h, LEVEL_A)).toEqual({ quantity: 10, reservedQuantity: 0 });

			// The level's policy: 12 against 10 on hand is 2 past it, inside the limit of 5 — whether the
			// caller restates the policy or says nothing.
			await h.reservations.reserve({ ...hold, quantity: 12 });
			await h.reservations.reserve({ ...overselling, quantity: 2, allowBackorder: true });
			expect(await levelState(h, LEVEL_A)).toEqual({ quantity: 10, reservedQuantity: 14 });

			// The level's limit still binds a caller who states `true`: 4 past on hand + 2 more is 6 > 5.
			await expect(h.reservations.reserve({ ...overselling, quantity: 2 })).rejects.toBeDefined();
			expect(await levelState(h, LEVEL_A)).toEqual({ quantity: 10, reservedQuantity: 14 });
		});
	});

	describe('a receipt cannot take units back (R2-03)', () => {
		/** Ships all ten of A's units from its first location to its second. */
		async function shippedTransferOfA(): Promise<{ transferId: string; lineId: string }> {
			actAs(TENANT_A, ORG_A);
			const transfer = await h.transfers.createTransfer({ fromWarehouseId: WAREHOUSE_A, toWarehouseId: WAREHOUSE_A2 });
			const line = await h.transferLines.addLine({ transferId: transfer.id, variantId: VARIANT_A, requestedQuantity: 10 });
			await h.transfers.request(transfer.id);
			await h.transfers.approve(transfer.id);
			await h.transfers.ship(transfer.id, [{ lineId: line.id, shippedQuantity: 10 }]);

			return { transferId: transfer.id, lineId: line.id };
		}

		/** On hand at A's second location (the destination), 0 when no level exists there yet. */
		async function destinationOnHand(): Promise<number> {
			const [destination] = await h.dataSource.query(
				`SELECT "level"."quantity" FROM "warehouse_product_variant" "level"
				 INNER JOIN "warehouse_product" "aggregate" ON "aggregate"."id" = "level"."warehouseProductId"
				 WHERE "aggregate"."warehouseId" = ?`,
				[WAREHOUSE_A2]
			);

			return Number(destination?.quantity ?? 0);
		}

		async function lineOf(lineId: string): Promise<{ received: number; damaged: number }> {
			const line = await h.row('stock_transfer_line', lineId);

			return { received: Number(line?.receivedQuantity), damaged: Number(line?.damagedQuantity) };
		}

		it('refuses a negative received quantity, so ten shipped can never arrive as sixteen', async () => {
			const { transferId, lineId } = await shippedTransferOfA();
			await h.transfers.receive(transferId, [{ lineId, receivedQuantity: 6 }]);
			expect(await destinationOnHand()).toBe(6);

			await expect(h.transfers.receive(transferId, [{ lineId, receivedQuantity: -6 }])).rejects.toMatchObject({
				status: 400
			});

			expect(await lineOf(lineId)).toEqual({ received: 6, damaged: 0 });
			expect((await h.row('stock_transfer', transferId))?.status).toBe(StockTransferStatus.PARTIALLY_RECEIVED);

			// What is left to arrive is still four, not ten.
			await expect(h.transfers.receive(transferId, [{ lineId, receivedQuantity: 10 }])).rejects.toMatchObject({
				response: { code: 'STOCK_TRANSFER_OVER_RECEIPT' }
			});
			await h.transfers.receive(transferId, [{ lineId, receivedQuantity: 4 }]);
			expect(await destinationOnHand()).toBe(10);
			expect(await levelState(h, LEVEL_A)).toEqual({ quantity: 0, reservedQuantity: 0 });
		});

		it('refuses a negative or non-finite damaged quantity and a non-finite received quantity', async () => {
			const { transferId, lineId } = await shippedTransferOfA();
			await h.transfers.receive(transferId, [{ lineId, receivedQuantity: 4, damagedQuantity: 2 }]);
			const movementsBefore = await h.countOf('stock_movement');

			for (const refused of [
				{ receivedQuantity: 0, damagedQuantity: -2 },
				{ receivedQuantity: 0, damagedQuantity: Number.NaN },
				{ receivedQuantity: 0, damagedQuantity: Number.POSITIVE_INFINITY },
				{ receivedQuantity: Number.NaN },
				{ receivedQuantity: Number.NEGATIVE_INFINITY },
				{ receivedQuantity: Number.POSITIVE_INFINITY }
			]) {
				await expect(h.transfers.receive(transferId, [{ lineId, ...refused }])).rejects.toMatchObject({
					status: 400
				});
			}

			expect(await lineOf(lineId)).toEqual({ received: 4, damaged: 2 });
			expect(await destinationOnHand()).toBe(4);
			expect((await h.row('stock_transfer', transferId))?.status).toBe(StockTransferStatus.PARTIALLY_RECEIVED);
			expect(await h.countOf('stock_movement')).toBe(movementsBefore);
		});

		it('refuses to ship a quantity that is not a finite number, and leaves the source and the transfer as they were', async () => {
			actAs(TENANT_A, ORG_A);
			const transfer = await h.transfers.createTransfer({ fromWarehouseId: WAREHOUSE_A, toWarehouseId: WAREHOUSE_A2 });
			const line = await h.transferLines.addLine({ transferId: transfer.id, variantId: VARIANT_A, requestedQuantity: 10 });
			await h.transfers.request(transfer.id);
			await h.transfers.approve(transfer.id);

			for (const shippedQuantity of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1]) {
				await expect(
					h.transfers.ship(transfer.id, [{ lineId: line.id, shippedQuantity }])
				).rejects.toMatchObject({ response: { code: 'STOCK_TRANSFER_OVER_RECEIPT' } });
			}

			expect((await h.row('stock_transfer', transfer.id))?.status).toBe(StockTransferStatus.APPROVED);
			expect(Number((await h.row('stock_transfer_line', line.id))?.shippedQuantity)).toBe(0);
			expect(await levelState(h, LEVEL_A)).toEqual({ quantity: 10, reservedQuantity: 0 });
			expect(await h.countOf('stock_movement')).toBe(0);
		});
	});
});
