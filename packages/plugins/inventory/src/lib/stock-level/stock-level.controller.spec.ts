/**
 * Two module boundaries are doubled here, and the reason is the same for both.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a stock level resource needs and none of which is
 * available outside a running application; its nested `uuid` is ESM-only, so reading one entity would
 * fail under jest. `@gauzy/config` reads the process environment at import time. Both are therefore
 * doubled at the module boundary, and **the resource under test is the real one**: the controller over
 * the real ledger engine, with the real entities it names and the real error vocabulary it refuses
 * with. The platform entity classes are identity rather than behaviour — the engine uses them to name
 * a table.
 *
 * The permission decorator is doubled with the platform’s own metadata key, read from the platform’s
 * constants, so the assertions below are made against the metadata a guard actually reads rather than
 * against the decorator’s prose.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException, SetMetadata } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');

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

		async findOneByIdString(id: any): Promise<any> {
			if (!id) {
				throw new NotFoundException('The requested record was not found');
			}

			const record = await this.typeOrmRepository.findOne({ where: { id } });

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

		async paginate(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
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
		RolePermissionModule: class RolePermissionModule {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		UUIDValidationPipe: class UUIDValidationPipe {},
		// The two decorators the controller carries. `Permissions` writes the same metadata the
		// platform's own decorator writes, so the assertions below read what a guard reads.
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		UseValidationPipe: decorator,
		BaseEvent: class {},
		EventBus: class {},
		Product: class Product {},
		ProductVariant: class ProductVariant {},
		Warehouse: class Warehouse {},
		WarehouseProduct: class WarehouseProduct {},
		WarehouseProductVariant: class WarehouseProductVariant {},
		User: class User {},
		Sequence: class Sequence {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => mockTenantId,
			currentOrganizationId: () => mockOrganizationId,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

jest.mock(
	'@gauzy/config',
	() => ({
		DatabaseTypeEnum: {
			mongodb: 'mongodb',
			sqlite: 'sqlite',
			betterSqlite3: 'better-sqlite3',
			postgres: 'postgres',
			mysql: 'mysql'
		}
	}),
	{ virtual: true }
);

import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { Product, PermissionGuard, TenantPermissionGuard, WarehouseProduct, WarehouseProductVariant } from '@gauzy/core';
import { StockMovement } from './../stock-movement/stock-movement.entity';
import { StockMovementReferenceType, StockMovementType } from './../inventory.enums';
import { StockLevelController } from './stock-level.controller';
import { StockLevelService } from './stock-level.service';

/**
 * The stock level resource over REST (doc 02 §3.4, doc 09 §10.4–§10.5).
 *
 * A level is a resource of its own: what one variant holds at one location, the availability that
 * follows from it, and the reconciliation that puts it back in agreement with the movement ledger. The
 * suite pins the properties the resource owes:
 *
 * - the list answers from the level rows the caller’s tenant owns, with the location the row’s
 *   product-level aggregate carries and the availability derived on read (INV-06);
 * - one level is readable by id, and a level of another tenant is not: the id is not a capability, so
 *   the answer is the same one a level that does not exist gets;
 * - a reconciliation recomputes `quantity` from the level’s own movement ledger and writes the level
 *   row under a compare-and-set, so a concurrent movement is never overwritten;
 * - a level that already agrees with its ledger is **not written at all**, which is what makes a
 *   second run report nothing — the operational definition of a reconciliation that has converged;
 * - the aggregate a corrected level hangs from takes the same delta, so a product-level row stays the
 *   sum of its variant rows;
 * - the reads carry the read permission and the reconciliation carries the reconciliation permission,
 *   on the metadata a guard reads.
 *
 * The controller is constructed directly over the real service and an in-memory double of the
 * connection. The double keeps a real snapshot and applies the compare-and-set on `version` for real,
 * so "not rewritten" is asserted against the store rather than against a mock’s call log.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000003';
const ORG = '00000000-0000-4000-8000-000000000002';
const WAREHOUSE = '00000000-0000-4000-8000-000000000010';
const PRODUCT = '00000000-0000-4000-8000-000000000020';
const VARIANT = '00000000-0000-4000-8000-000000000030';
const OTHER_VARIANT = '00000000-0000-4000-8000-000000000031';
const FOREIGN_VARIANT = '00000000-0000-4000-8000-000000000032';

/** The tenant the request runs in, which every read is scoped to. */
let mockTenantId: string | null = TENANT;
let mockOrganizationId: string | null = ORG;

type Row = Record<string, any>;

/** The tables this suite drives, as plain arrays. */
interface ITables {
	product: Row[];
	product_variant: Row[];
	warehouse_product: Row[];
	warehouse_product_variant: Row[];
	stock_movement: Row[];
}

/**
 * The in-memory stand-in for the connection the resource reads and writes through.
 *
 * It states the joined level read, the ledger sum and the compare-and-set the service issues, and
 * nothing else — an unimplemented shape throws rather than answering wrongly.
 *
 * @param tables The whole datastore.
 */
function datastore(tables: ITables) {
	const entityToTable = new Map<unknown, keyof ITables>([
		[Product, 'product'],
		[WarehouseProduct, 'warehouse_product'],
		[WarehouseProductVariant, 'warehouse_product_variant'],
		[StockMovement, 'stock_movement']
	]);
	let sequence = 0;
	const queries: string[] = [];

	const rows = (entity: unknown): Row[] => {
		const table = entityToTable.get(entity);

		if (!table) {
			throw new Error('the in-memory double was handed an entity it does not know');
		}

		return tables[table];
	};
	const same = (left: unknown, right: unknown) => String(left ?? '') === String(right ?? '');
	const snapshot = (): Record<string, Row[]> =>
		Object.fromEntries(
			Object.entries(tables).map(([table, tableRows]) => [table, tableRows.map((row) => ({ ...row }))])
		);
	const restore = (copy: Record<string, Row[]>) => {
		for (const [table, tableRows] of Object.entries(copy)) {
			(tables as unknown as Record<string, Row[]>)[table] = tableRows;
		}
	};
	const matches = (row: Row, where: Row = {}) =>
		Object.entries(where).every(([field, expected]) => (expected === undefined ? true : same(row[field], expected)));
	const aggregateOf = (level: Row): Row | undefined =>
		tables.warehouse_product.find((row) => same(row.id, level.warehouseProductId));
	/**
	 * The joined level read: the conditions the service states, and the location the aggregate carries
	 * — the column the join selects and the availability answer is addressed by.
	 */
	const levels = (conditions: Array<{ sql: string; params: Row }>): Row[] =>
		tables.warehouse_product_variant
			.filter((level) => {
				for (const condition of conditions) {
					if (
						/aggregate\.warehouseId/.test(condition.sql) &&
						!same(aggregateOf(level)?.warehouseId, condition.params.warehouseId)
					) {
						return false;
					}
					if (/level\.variantId/.test(condition.sql) && !same(level.variantId, condition.params.variantId)) {
						return false;
					}
					if (/level\.id/.test(condition.sql) && !same(level.id, condition.params.id)) {
						return false;
					}
					if (/level\.tenantId/.test(condition.sql) && !same(level.tenantId, condition.params.tenantId)) {
						return false;
					}
				}

				return true;
			})
			.map((level) => ({ ...level, warehouseId: aggregateOf(level)?.warehouseId }));
	/** Reads the delta out of the SQL the engine builds for its aggregate update. */
	const deltaFrom = (value: unknown): number => {
		const sql = typeof value === 'function' ? String((value as () => string)()) : String(value);
		const match = /"\s*\+\s*(-?\d+(?:\.\d+)?)/.exec(sql);

		if (!match) {
			throw new Error(`the in-memory double cannot read a delta out of "${sql}"`);
		}

		return Number(match[1]);
	};

	let manager: any;
	const createQueryBuilder = (entity?: unknown): any => {
		let target = entity;
		let rawSelect: { expression: string; label: string } | null = null;
		let updateSpec: Row | null = null;
		const conditions: Array<{ sql: string; params: Row }> = [];
		const query: any = {
			innerJoin: () => query,
			leftJoin: () => query,
			select: (first: unknown, second?: string) => {
				if (!Array.isArray(first) && typeof second === 'string') {
					rawSelect = { expression: String(first), label: second };
				}

				return query;
			},
			addSelect: () => query,
			limit: () => query,
			orderBy: () => query,
			where: (sql: string, params: Row = {}) => {
				conditions.push({ sql, params });

				return query;
			},
			andWhere: (sql: string, params: Row = {}) => {
				conditions.push({ sql, params });

				return query;
			},
			update: (entityToUpdate: unknown) => {
				target = entityToUpdate;

				return query;
			},
			set: (spec: Row) => {
				updateSpec = spec;

				return query;
			},
			getMany: async () => (target === WarehouseProductVariant ? levels(conditions) : rows(target)),
			getOne: async () => {
				const found = target === WarehouseProductVariant ? levels(conditions) : rows(target);

				return found[0] ?? null;
			},
			getRawOne: async () => {
				const expression = rawSelect?.expression ?? '';
				const params = conditions.reduce<Row>((all, one) => ({ ...all, ...one.params }), {});

				if (/SUM\(movement\.quantity\)/.test(expression)) {
					const total = tables.stock_movement
						.filter(
							(movement) =>
								same(movement.warehouseId, params.warehouseId) &&
								same(movement.variantId, params.variantId)
						)
						.reduce((sum, movement) => sum + Number(movement.quantity ?? 0), 0);

					return { total };
				}

				throw new Error(`the in-memory double does not implement the raw read "${expression}"`);
			},
			execute: async () => {
				if (!updateSpec) {
					throw new Error('the in-memory double only implements an UPDATE');
				}

				const id = conditions.find((condition) => condition.params.id)?.params.id;
				const version = conditions.find((condition) => condition.params.version)?.params.version;
				const row = rows(target).find((candidate) => same(candidate.id, id));

				if (!row) {
					return { affected: 0 };
				}
				if (version !== undefined && !same(row.version, version)) {
					return { affected: 0 };
				}

				for (const [column, value] of Object.entries(updateSpec)) {
					row[column] = typeof value === 'function' ? Number(row[column] ?? 0) + deltaFrom(value) : value;
				}

				return { affected: 1 };
			}
		};

		return query;
	};

	manager = {
		connection: { options: { type: 'better-sqlite3' } },
		createQueryBuilder,
		create: (entity: unknown, partial: Row) => ({ ...partial }),
		save: async (entity: unknown, rowOrRows: any) => {
			const list = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];

			for (const row of list) {
				const table = rows(entity);
				const index = row.id ? table.findIndex((candidate) => same(candidate.id, row.id)) : -1;

				if (index >= 0) {
					Object.assign(table[index], row);
					continue;
				}

				if (!row.id) {
					row.id = `${String(entityToTable.get(entity))}-${++sequence}`;
				}

				table.push(row);
			}

			return Array.isArray(rowOrRows) ? list : list[0];
		},
		findOne: async (entity: unknown, options: any = {}) =>
			rows(entity).find((row) => matches(row, options.where)) ?? null,
		find: async (entity: unknown, options: any = {}) =>
			rows(entity).filter((row) => matches(row, options.where)),
		count: async (entity: unknown, options: any = {}) =>
			rows(entity).filter((row) => matches(row, options.where)).length,
		update: async (entity: unknown, id: unknown, patch: Row) => {
			const row = rows(entity).find((candidate) => same(candidate.id, id));

			if (row) {
				Object.assign(row, patch);
			}

			return { affected: row ? 1 : 0 };
		},
		/**
		 * The raw statements the engine issues: the lock timeout, the row lock and the variant read.
		 * Anything else is a statement this double does not model, and it says so instead of answering.
		 */
		query: async (sql: string, params: any[] = []) => {
			if (/SET LOCAL lock_timeout|SET SESSION innodb_lock_wait_timeout|FOR UPDATE/.test(sql)) {
				queries.push(sql.trim());

				return [];
			}
			if (/FROM "product_variant"/.test(sql)) {
				const variant = tables.product_variant.find((row) => same(row.id, params[0]));

				return variant ? [{ productId: variant.productId }] : [];
			}

			throw new Error(`the in-memory double does not implement the statement "${sql}"`);
		}
	};

	const dataSource: any = {
		manager,
		createQueryBuilder,
		transaction: async (run: (transactional: any) => Promise<any>) => {
			const copy = snapshot();

			try {
				return await run(manager);
			} catch (error) {
				restore(copy);
				throw error;
			}
		}
	};

	return { dataSource, manager, tables, queries };
}

/**
 * Builds the resource over the real ledger engine and one in-memory datastore.
 *
 * The fixture stocks two variants at one location and holds the level of a second tenant beside them.
 * The first level disagrees with its ledger — it holds 10 while its movements sum to 7 — and the
 * second agrees with its own, which is the pair the reconciliation cases below are about.
 */
function levelResourceFixture() {
	const tables: ITables = {
		product: [{ id: PRODUCT, tenantId: TENANT, organizationId: ORG }],
		product_variant: [
			{ id: VARIANT, productId: PRODUCT },
			{ id: OTHER_VARIANT, productId: PRODUCT },
			{ id: FOREIGN_VARIANT, productId: PRODUCT }
		],
		warehouse_product: [
			{
				id: 'aggregate-1',
				tenantId: TENANT,
				organizationId: ORG,
				warehouseId: WAREHOUSE,
				productId: PRODUCT,
				quantity: 15,
				reservedQuantity: 0,
				version: 1
			}
		],
		warehouse_product_variant: [
			{
				id: 'level-1',
				tenantId: TENANT,
				organizationId: ORG,
				warehouseProductId: 'aggregate-1',
				variantId: VARIANT,
				quantity: 10,
				reservedQuantity: 2,
				incomingQuantity: 0,
				safetyStock: 1,
				allowBackorder: false,
				backorderLimit: null,
				isUnlimited: false,
				trackInventory: true,
				version: 1
			},
			{
				id: 'level-2',
				tenantId: TENANT,
				organizationId: ORG,
				warehouseProductId: 'aggregate-1',
				variantId: OTHER_VARIANT,
				quantity: 5,
				reservedQuantity: 0,
				incomingQuantity: 0,
				safetyStock: 0,
				allowBackorder: false,
				backorderLimit: null,
				isUnlimited: false,
				trackInventory: true,
				version: 1
			},
			{
				id: 'level-of-another-tenant',
				tenantId: OTHER_TENANT,
				organizationId: ORG,
				warehouseProductId: 'aggregate-1',
				variantId: FOREIGN_VARIANT,
				quantity: 99,
				reservedQuantity: 0,
				incomingQuantity: 0,
				safetyStock: 0,
				allowBackorder: false,
				backorderLimit: null,
				isUnlimited: false,
				trackInventory: true,
				version: 1
			}
		],
		stock_movement: [
			{
				id: 'movement-1',
				tenantId: TENANT,
				warehouseId: WAREHOUSE,
				variantId: VARIANT,
				warehouseProductId: PRODUCT,
				warehouseProductVariantId: 'level-1',
				type: StockMovementType.RECEIPT,
				quantity: 12,
				referenceType: StockMovementReferenceType.PURCHASE_ORDER,
				referenceId: 'purchase-order-1'
			},
			{
				id: 'movement-2',
				tenantId: TENANT,
				warehouseId: WAREHOUSE,
				variantId: VARIANT,
				warehouseProductId: PRODUCT,
				warehouseProductVariantId: 'level-1',
				type: StockMovementType.SALE,
				quantity: -5,
				referenceType: StockMovementReferenceType.ORDER,
				referenceId: 'order-1'
			},
			{
				id: 'movement-3',
				tenantId: TENANT,
				warehouseId: WAREHOUSE,
				variantId: OTHER_VARIANT,
				warehouseProductId: PRODUCT,
				warehouseProductVariantId: 'level-2',
				type: StockMovementType.RECEIPT,
				quantity: 5,
				referenceType: StockMovementReferenceType.PURCHASE_ORDER,
				referenceId: 'purchase-order-2'
			}
		]
	};

	const store = datastore(tables);
	const service = new StockLevelService(store.dataSource as never);
	const controller = new StockLevelController(service);

	return {
		controller,
		service,
		store,
		tables,
		level: (id: string) => tables.warehouse_product_variant.find((row) => row.id === id),
		aggregate: () => tables.warehouse_product[0],
		ledger: () => tables.stock_movement
	};
}

beforeEach(() => {
	mockTenantId = TENANT;
	mockOrganizationId = ORG;
});

describe('StockLevelController — the level resource (doc 02 §3.4)', () => {
	it('lists the levels of a location with the availability each one derives', async () => {
		const fixture = levelResourceFixture();

		const levels = await fixture.controller.findAll(WAREHOUSE);

		// Only the caller’s tenant is listed, and each level carries the location its aggregate holds and
		// the availability the package derives rather than stores (INV-06).
		expect(levels).toHaveLength(2);
		expect(levels[0]).toMatchObject({
			levelId: 'level-1',
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			quantity: 10,
			reservedQuantity: 2,
			safetyStock: 1,
			availableQuantity: 7
		});
		expect(levels[1]).toMatchObject({ levelId: 'level-2', variantId: OTHER_VARIANT, availableQuantity: 5 });
	});

	it('narrows the list by variant', async () => {
		const fixture = levelResourceFixture();

		const levels = await fixture.controller.findAll(WAREHOUSE, OTHER_VARIANT);

		expect(levels.map((level) => level.levelId)).toEqual(['level-2']);
	});

	// The tenant a request runs in is the scope every read is answered from. A level of another tenant
	// is not a level this caller may read, and it is not walked by a reconciliation either.
	it('answers a read from the caller’s own tenant only', async () => {
		const fixture = levelResourceFixture();

		mockTenantId = OTHER_TENANT;

		const levels = await fixture.controller.findAll(WAREHOUSE);

		expect(levels.map((level) => level.levelId)).toEqual(['level-of-another-tenant']);
		expect(levels[0]).toMatchObject({ variantId: FOREIGN_VARIANT, quantity: 99, availableQuantity: 99 });
	});

	it('reads one level by id, with the location the join resolves', async () => {
		const fixture = levelResourceFixture();

		await expect(fixture.controller.findById('level-1')).resolves.toMatchObject({
			levelId: 'level-1',
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			quantity: 10,
			availableQuantity: 7
		});
	});

	it('answers a level of another tenant exactly as a level that does not exist', async () => {
		const fixture = levelResourceFixture();

		await expect(fixture.controller.findById('level-of-another-tenant')).rejects.toMatchObject({
			response: { code: 'STOCK_LEVEL_NOT_FOUND', details: { levelId: 'level-of-another-tenant' } }
		});
		await expect(fixture.controller.findById('no-such-level')).rejects.toMatchObject({
			response: { code: 'STOCK_LEVEL_NOT_FOUND', details: { levelId: 'no-such-level' } }
		});
	});
});

describe('StockLevelController — reconciliation (doc 09 §10.4, §10.5)', () => {
	it('recomputes a level that disagrees with its ledger and leaves the one that agrees alone', async () => {
		const fixture = levelResourceFixture();

		const report = await fixture.controller.reconcile({});

		// The level held 10 while its movements sum to 7, so it is corrected to the ledger.
		expect(report).toMatchObject({
			scanned: 2,
			corrected: 1,
			corrections: [
				{
					levelId: 'level-1',
					warehouseId: WAREHOUSE,
					variantId: VARIANT,
					quantityBefore: 10,
					ledgerQuantity: 7,
					quantityAfter: 7
				}
			]
		});
		expect(fixture.level('level-1')).toMatchObject({ quantity: 7, reservedQuantity: 2, version: 2 });
		// The level that agreed is not written at all: same quantity, same version.
		expect(fixture.level('level-2')).toMatchObject({ quantity: 5, version: 1 });
		// The aggregate takes the same delta, so it stays the sum of its variant rows.
		expect(fixture.aggregate()).toMatchObject({ quantity: 12 });
		// The correction is not a movement: a movement moves the level and the sum it is compared
		// against by the same quantity, so it cannot close the gap it is meant to close.
		expect(fixture.ledger()).toHaveLength(3);
	});

	it('reports nothing on a second run, which is what a converged ledger looks like', async () => {
		const fixture = levelResourceFixture();

		await fixture.controller.reconcile({});
		const before = fixture.ledger().length;

		const second = await fixture.controller.reconcile({});

		expect(second).toMatchObject({ scanned: 2, corrected: 0, corrections: [] });
		expect(fixture.level('level-1')).toMatchObject({ quantity: 7, version: 2 });
		expect(fixture.ledger()).toHaveLength(before);
	});

	it('walks the levels of the caller’s tenant and never another tenant’s', async () => {
		const fixture = levelResourceFixture();

		const report = await fixture.controller.reconcile({ warehouseId: WAREHOUSE, variantId: FOREIGN_VARIANT });

		// The variant is stocked at the location, but not by this tenant: there is nothing to walk.
		expect(report).toMatchObject({ scanned: 0, corrected: 0, corrections: [] });
		expect(fixture.level('level-of-another-tenant')).toMatchObject({ quantity: 99, version: 1 });
	});

	it('narrows the walk to one location and one variant', async () => {
		const fixture = levelResourceFixture();

		const report = await fixture.controller.reconcile({ warehouseId: WAREHOUSE, variantId: OTHER_VARIANT });

		expect(report).toMatchObject({ scanned: 1, corrected: 0, corrections: [] });
		// The level that disagrees is outside the scope of this run and stays where it was.
		expect(fixture.level('level-1')).toMatchObject({ quantity: 10, version: 1 });
	});

	it('corrects a level the ledger has no movement for to the ledger’s own sum', async () => {
		// A level with no movements is one the ledger has never recorded. The ledger is the record of
		// what happened, so the level is brought to it rather than the other way round.
		const fixture = levelResourceFixture();
		fixture.tables.warehouse_product_variant.push({
			id: 'level-3',
			tenantId: TENANT,
			organizationId: ORG,
			warehouseProductId: 'aggregate-1',
			variantId: 'a-variant-with-no-movements',
			quantity: 4,
			reservedQuantity: 0,
			version: 3
		});

		const report = await fixture.controller.reconcile({});

		expect(report.corrections).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ levelId: 'level-3', quantityBefore: 4, ledgerQuantity: 0, quantityAfter: 0 })
			])
		);
		expect(fixture.level('level-3')).toMatchObject({ quantity: 0, version: 4 });
	});
});

describe('StockLevelController — the guard stack and the permissions it declares', () => {
	it('guards both protocols with the tenant and permission guards', () => {
		const guards = Reflect.getMetadata('__guards__', StockLevelController) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
	});

	it('carries the read permission on the resource and the reconciliation permission on the route', () => {
		// What a guard reads: the handler’s own metadata when it declares one — the platform’s decorator
		// writes it onto the handler itself — and the class’s metadata otherwise. Reconciliation changes
		// the record the business is audited against, so it is not reachable with the permission that
		// only reads levels.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, StockLevelController)).toEqual(['STOCK_VIEW']);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, StockLevelController.prototype.reconcile)).toEqual([
			'STOCK_RECONCILE'
		]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, StockLevelController.prototype.findAll)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, StockLevelController.prototype.findById)).toBeUndefined();
	});
});
