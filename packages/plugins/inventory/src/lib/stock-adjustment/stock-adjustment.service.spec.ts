/**
 * Three module boundaries are doubled here, and the reason is the same for all three.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which an adjustment service needs and none of which is
 * available outside a running application; its nested `uuid` is ESM-only, so reading one entity would
 * fail under jest. `@gauzy/config` reads the process environment at import time. Both are therefore
 * doubled at the module boundary, and **the services under test are the real ones**: the adjustment
 * service and the real ledger engine it applies every correction through.
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
			currentTenantId: () => '00000000-0000-4000-8000-000000000001',
			currentOrganizationId: () => '00000000-0000-4000-8000-000000000002',
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

import { Product, ProductVariant, WarehouseProduct, WarehouseProductVariant } from '@gauzy/core';
import {
	StockAdjustmentStatus,
	StockAdjustmentType,
	StockMovementType,
	StockMovementReferenceType,
	StockReasonCode
} from '../inventory.enums';
import { StockLevelService } from '../stock-level/stock-level.service';
import { StockMovement } from '../stock-movement/stock-movement.entity';
import { StockAdjustment } from './stock-adjustment.entity';
import { StockAdjustmentService } from './stock-adjustment.service';

/**
 * Manual corrections.
 *
 * An operator may move a quantity by hand, and this is the only instruction that lets them do it, so
 * the suite pins what the domain requires of that power (doc 09 §4.3 rows 24–26, §15.3):
 *
 * - a correction **states why it happened** — a reason code or a free-text reason — and one that
 *   states neither is refused before it reaches the database;
 * - an instruction is drafted and then applied, and applying it writes **exactly one movement**, in
 *   the same transaction that marks the instruction applied — so an instruction cannot be applied
 *   without the ledger knowing, and a refused application leaves the instruction drafted;
 * - the delta is derived from the instruction's type **against the level as it actually is**, not
 *   against a delta computed when it was drafted: the level may have moved in between, and the
 *   correction has to be the difference from what is there;
 * - an instruction that asks for what is already there applies successfully and writes nothing;
 * - the engine's own guards still hold: a correction cannot drive the on-hand quantity negative, and
 *   it cannot write off stock a customer is already holding.
 *
 * The service is constructed directly over an in-memory double of the connection, with the real
 * ledger engine behind it. The double keeps a real snapshot, so "nothing was written" is asserted
 * against the store. The sequence service is the one collaborator that is a double: numbering is a
 * kernel capability with its own suite.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const WAREHOUSE = '00000000-0000-4000-8000-000000000010';
const PRODUCT = '00000000-0000-4000-8000-000000000020';
const VARIANT = '00000000-0000-4000-8000-000000000030';

type Row = Record<string, any>;

/** The in-memory stand-in for the connection the adjustment service and the ledger engine write through. */
function datastore(tables: Record<string, Row[]>) {
	const entityToTable = new Map<unknown, string>([
		[Product, 'product'],
		[ProductVariant, 'product_variant'],
		[WarehouseProduct, 'warehouse_product'],
		[WarehouseProductVariant, 'warehouse_product_variant'],
		[StockMovement, 'stock_movement'],
		[StockAdjustment, 'stock_adjustment']
	]);
	let sequence = 0;

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
			tables[table] = tableRows;
		}
	};
	const matches = (row: Row, where: Row = {}) =>
		Object.entries(where).every(([field, expected]) => {
			if (expected && typeof expected === 'object' && 'type' in (expected as Row)) {
				throw new Error(`the in-memory double does not implement the "${(expected as Row).type}" operator`);
			}

			return expected === undefined ? true : same(row[field], expected);
		});
	const levels = (conditions: Array<{ sql: string; params: Row }>): Row[] =>
		tables.warehouse_product_variant.filter((level) => {
			for (const condition of conditions) {
				if (/aggregate\.warehouseId/.test(condition.sql)) {
					const aggregate = tables.warehouse_product.find((row) => same(row.id, level.warehouseProductId));

					if (!same(aggregate?.warehouseId, condition.params.warehouseId)) {
						return false;
					}
				}
				if (/level\.variantId/.test(condition.sql) && !same(level.variantId, condition.params.variantId)) {
					return false;
				}
			}

			return true;
		});
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
		let updateSpec: Row | null = null;
		const conditions: Array<{ sql: string; params: Row }> = [];
		const query: any = {
			innerJoin: () => query,
			leftJoin: () => query,
			select: () => query,
			addSelect: () => query,
			limit: () => query,
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
		query: async (sql: string, params: any[] = []) => {
			if (/SET LOCAL lock_timeout|SET SESSION innodb_lock_wait_timeout|FOR UPDATE/.test(sql)) {
				return [];
			}
			if (/FROM "product_variant"/.test(sql)) {
				const variant = tables.product_variant.find((row) => same(row.id, params[0]));

				return variant ? [{ productId: variant.productId }] : [];
			}

			throw new Error(`the in-memory double does not implement the statement "${sql}"`);
		}
	};

	manager.transaction = async (run: (transactional: any) => Promise<any>) => {
		const copy = snapshot();

		try {
			return await run(manager);
		} catch (error) {
			restore(copy);
			throw error;
		}
	};

	const dataSource: any = { manager, createQueryBuilder, transaction: manager.transaction };
	const repository: any = {
		manager,
		metadata: { tableName: 'stock_adjustment', hasColumnWithPropertyPath: () => false },
		create: (partial: Row) => ({ ...partial }),
		save: async (rowOrRows: any) => manager.save(StockAdjustment, rowOrRows),
		find: async (options: any = {}) => rows(StockAdjustment).filter((row) => matches(row, options.where)),
		findOne: async (options: any = {}) => rows(StockAdjustment).find((row) => matches(row, options.where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = rows(StockAdjustment).filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async () => rows(StockAdjustment).length,
		view: () => tables.stock_adjustment
	};

	return { dataSource, manager, tables, repository, adjustmentRepository: repository };
}

/**
 * Builds the adjustment service over the real ledger engine and one in-memory datastore.
 *
 * @param options.quantity What the level holds.
 * @param options.reservedQuantity What the level already holds for a customer.
 */
function adjustmentFixture(options: { quantity?: number; reservedQuantity?: number } = {}) {
	const tables: Record<string, Row[]> = {
		product: [{ id: PRODUCT, tenantId: TENANT, organizationId: ORG }],
		product_variant: [{ id: VARIANT, productId: PRODUCT }],
		warehouse_product: [
			{
				id: 'aggregate-1',
				tenantId: TENANT,
				organizationId: ORG,
				warehouseId: WAREHOUSE,
				productId: PRODUCT,
				quantity: options.quantity ?? 10,
				reservedQuantity: options.reservedQuantity ?? 0,
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
				quantity: options.quantity ?? 10,
				reservedQuantity: options.reservedQuantity ?? 0,
				incomingQuantity: 0,
				safetyStock: 0,
				allowBackorder: false,
				backorderLimit: null,
				version: 1
			}
		],
		stock_movement: [],
		stock_adjustment: []
	};
	const store = datastore(tables);
	const stockLevelService = new StockLevelService(store.dataSource as never);
	const allocated: string[] = [];
	const sequenceService = {
		allocate: async (key: string) => {
			allocated.push(key);

			return { key, value: allocated.length, formatted: `ADJ-${String(allocated.length).padStart(6, '0')}` };
		}
	};
	const service = new StockAdjustmentService(
		store.adjustmentRepository as never,
		{} as never,
		sequenceService as never,
		stockLevelService
	);

	return {
		service,
		store,
		tables,
		allocated,
		level: () => tables.warehouse_product_variant[0],
		ledger: () => tables.stock_movement,
		adjustments: () => tables.stock_adjustment
	};
}

describe('StockAdjustmentService — drafting an instruction (doc 09 §4.3 row 24)', () => {
	it('refuses an instruction that states no reason at all', async () => {
		// A manual correction is an unexplained number unless it says why it happened, and an instruction
		// that names neither a reason code nor a reason is refused before it reaches the database.
		const fixture = adjustmentFixture();

		await expect(
			fixture.service.createAdjustment({
				warehouseId: WAREHOUSE,
				variantId: VARIANT,
				type: StockAdjustmentType.INCREASE,
				quantity: 5
			})
		).rejects.toMatchObject({ response: { code: 'STOCK_ADJUSTMENT_REASON_REQUIRED' } });
		expect(fixture.adjustments()).toEqual([]);
		expect(fixture.allocated).toEqual([]);
	});

	it('numbers a drafted instruction from the platform sequence and changes nothing yet', async () => {
		const fixture = adjustmentFixture();

		const adjustment = await fixture.service.createAdjustment({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			type: StockAdjustmentType.DECREASE,
			quantity: 4,
			reasonCode: StockReasonCode.DAMAGE
		});

		expect(fixture.allocated).toEqual(['STOCK_ADJUSTMENT']);
		expect(adjustment).toMatchObject({
			number: 'ADJ-000001',
			status: StockAdjustmentStatus.DRAFT,
			type: StockAdjustmentType.DECREASE,
			quantity: 4,
			reasonCode: StockReasonCode.DAMAGE,
			tenantId: TENANT,
			organizationId: ORG
		});
		// Drafting is a statement of intent: no movement, and the level is untouched.
		expect(fixture.ledger()).toEqual([]);
		expect(fixture.level()).toMatchObject({ quantity: 10, version: 1 });
	});

	it('accepts a free-text reason where no reason code fits', async () => {
		const fixture = adjustmentFixture();

		const adjustment = await fixture.service.createAdjustment({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			type: StockAdjustmentType.FOUND,
			quantity: 2,
			reason: 'Found behind the rack during the refit'
		});

		expect(adjustment).toMatchObject({
			status: StockAdjustmentStatus.DRAFT,
			reason: 'Found behind the rack during the refit'
		});
	});
});

describe('StockAdjustmentService — applying an instruction (doc 09 §4.3 rows 24–26)', () => {
	it('moves the level by the stated quantity, one direction per type', async () => {
		const cases: Array<{ type: StockAdjustmentType; quantity: number; quantityAfter: number }> = [
			{ type: StockAdjustmentType.INCREASE, quantity: 4, quantityAfter: 14 },
			{ type: StockAdjustmentType.FOUND, quantity: 4, quantityAfter: 14 },
			{ type: StockAdjustmentType.DECREASE, quantity: 4, quantityAfter: 6 },
			{ type: StockAdjustmentType.SCRAP, quantity: 4, quantityAfter: 6 },
			{ type: StockAdjustmentType.DAMAGE, quantity: 4, quantityAfter: 6 }
		];

		for (const testCase of cases) {
			const fixture = adjustmentFixture();
			const adjustment = await fixture.service.createAdjustment({
				warehouseId: WAREHOUSE,
				variantId: VARIANT,
				type: testCase.type,
				quantity: testCase.quantity,
				reasonCode: StockReasonCode.DAMAGE
			});

			const applied = await fixture.service.apply(adjustment.id);

			expect({ type: testCase.type, delta: applied.quantityDelta }).toEqual({
				type: testCase.type,
				delta: testCase.quantityAfter - 10
			});
			expect(fixture.level()).toMatchObject({ quantity: testCase.quantityAfter });
			expect(fixture.ledger()).toHaveLength(1);
			expect(fixture.ledger()[0]).toMatchObject({
				type: StockMovementType.ADJUSTMENT,
				quantity: testCase.quantityAfter - 10,
				quantityBefore: 10,
				quantityAfter: testCase.quantityAfter,
				referenceType: StockMovementReferenceType.ADJUSTMENT,
				referenceId: adjustment.id,
				reason: StockReasonCode.DAMAGE
			});
		}
	});

	it('derives the delta of a SET from the level as it actually is, not from the drafted figure', async () => {
		// The instruction stores the observed target rather than a pre-computed delta, because the level may
		// have moved between drafting and applying: a correction computed against a stale reading would
		// either overshoot the count or leave the level short of it.
		const fixture = adjustmentFixture({ quantity: 10 });
		const adjustment = await fixture.service.createAdjustment({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			type: StockAdjustmentType.SET,
			quantity: 8,
			reasonCode: StockReasonCode.CYCLE_COUNT
		});

		// Somebody receives five more units while the instruction is waiting to be applied.
		const stockLevelService = new StockLevelService(fixture.store.dataSource as never);

		await stockLevelService.applyMovement({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			productId: PRODUCT,
			type: StockMovementType.RECEIPT,
			quantityDelta: 5,
			reservedDelta: 0,
			referenceType: StockMovementReferenceType.GOODS_RECEIPT,
			referenceId: 'receipt-1'
		});

		const applied = await fixture.service.apply(adjustment.id);

		// `8 − 15`, not the `8 − 10` the instruction would have stored had it pre-computed its delta.
		expect(applied.quantityDelta).toBe(-7);
		expect(fixture.level()).toMatchObject({ quantity: 8 });
		expect(fixture.ledger()).toHaveLength(2);
		expect(fixture.ledger()[1]).toMatchObject({ quantity: -7, quantityBefore: 15, quantityAfter: 8 });
	});

	it('marks the instruction applied and links it to the movement it wrote', async () => {
		const fixture = adjustmentFixture();
		const adjustment = await fixture.service.createAdjustment({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			type: StockAdjustmentType.DECREASE,
			quantity: 3,
			reasonCode: StockReasonCode.SCRAP,
			note: 'Crushed in the aisle'
		});

		const applied = await fixture.service.apply(adjustment.id);

		expect(applied.adjustment).toMatchObject({
			status: StockAdjustmentStatus.APPLIED,
			movementId: fixture.ledger()[0].id,
			warehouseProductVariantId: 'level-1'
		});
		expect(applied.adjustment.appliedAt).toBeInstanceOf(Date);
		expect(fixture.ledger()[0]).toMatchObject({ note: 'Crushed in the aisle' });
	});

	it('applies an instruction that asks for what is already there without writing a movement', async () => {
		const fixture = adjustmentFixture({ quantity: 10 });
		const adjustment = await fixture.service.createAdjustment({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			type: StockAdjustmentType.SET,
			quantity: 10,
			reasonCode: StockReasonCode.RECONCILIATION
		});

		const applied = await fixture.service.apply(adjustment.id);

		expect(applied.quantityDelta).toBe(0);
		expect(applied.adjustment).toMatchObject({ status: StockAdjustmentStatus.APPLIED });
		expect(fixture.ledger()).toEqual([]);
		expect(fixture.level()).toMatchObject({ quantity: 10, version: 1 });
	});

	it('refuses to apply an instruction twice', async () => {
		const fixture = adjustmentFixture();
		const adjustment = await fixture.service.createAdjustment({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			type: StockAdjustmentType.DECREASE,
			quantity: 3,
			reasonCode: StockReasonCode.SCRAP
		});

		await fixture.service.apply(adjustment.id);

		await expect(fixture.service.apply(adjustment.id)).rejects.toMatchObject({
			response: {
				code: 'STOCK_ADJUSTMENT_ALREADY_APPLIED',
				details: { adjustmentId: adjustment.id, status: StockAdjustmentStatus.APPLIED }
			}
		});
		// One instruction, one movement (doc 09 §4.3): the second application moved nothing.
		expect(fixture.ledger()).toHaveLength(1);
		expect(fixture.level()).toMatchObject({ quantity: 7 });
	});

	it('reports an instruction that does not exist as missing', async () => {
		const fixture = adjustmentFixture();

		await expect(fixture.service.apply('no-such-adjustment')).rejects.toMatchObject({
			response: { code: 'STOCK_LEVEL_NOT_FOUND', details: { adjustmentId: 'no-such-adjustment' } }
		});
		await expect(fixture.service.cancel('no-such-adjustment')).rejects.toMatchObject({
			response: { code: 'STOCK_LEVEL_NOT_FOUND' }
		});
	});

	it('leaves an instruction drafted when the engine refuses to write it', async () => {
		// An application that was refused is not an application: the instruction stays drafted, so the
		// operator can correct it, and the level is exactly as it was.
		const fixture = adjustmentFixture({ quantity: 10 });
		const adjustment = await fixture.service.createAdjustment({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			type: StockAdjustmentType.DECREASE,
			quantity: 20,
			reasonCode: StockReasonCode.SCRAP
		});

		await expect(fixture.service.apply(adjustment.id)).rejects.toMatchObject({
			response: { code: 'STOCK_INVARIANT_VIOLATION', details: { invariant: 'INV-05' } }
		});
		expect(fixture.adjustments()[0]).toMatchObject({ status: StockAdjustmentStatus.DRAFT });
		expect(fixture.ledger()).toEqual([]);
		expect(fixture.level()).toMatchObject({ quantity: 10, version: 1 });
	});

	it('refuses to write off stock a customer is already holding', async () => {
		// The engine's reservation guard is what stands between a tidy-up and a broken promise: driving the
		// on-hand quantity below what is already held would leave the hold covering units that are not there.
		const fixture = adjustmentFixture({ quantity: 10, reservedQuantity: 6 });
		const adjustment = await fixture.service.createAdjustment({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			type: StockAdjustmentType.DECREASE,
			quantity: 5,
			reasonCode: StockReasonCode.DAMAGE
		});

		await expect(fixture.service.apply(adjustment.id)).rejects.toMatchObject({
			response: { code: 'STOCK_INVARIANT_VIOLATION', details: { invariant: 'INV-07' } }
		});
		expect(fixture.level()).toMatchObject({ quantity: 10, reservedQuantity: 6 });
		expect(fixture.ledger()).toEqual([]);

		// Control: the same correction is accepted while it leaves the hold covered.
		const smaller = await fixture.service.createAdjustment({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			type: StockAdjustmentType.DECREASE,
			quantity: 4,
			reasonCode: StockReasonCode.DAMAGE
		});

		await fixture.service.apply(smaller.id);

		expect(fixture.level()).toMatchObject({ quantity: 6, reservedQuantity: 6 });
	});
});

describe('StockAdjustmentService — cancelling an instruction', () => {
	it('cancels a drafted instruction without touching stock', async () => {
		const fixture = adjustmentFixture();
		const adjustment = await fixture.service.createAdjustment({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			type: StockAdjustmentType.DECREASE,
			quantity: 3,
			reasonCode: StockReasonCode.SCRAP
		});

		const cancelled = await fixture.service.cancel(adjustment.id);

		expect(cancelled).toMatchObject({ status: StockAdjustmentStatus.CANCELED });
		expect(fixture.ledger()).toEqual([]);
		expect(fixture.level()).toMatchObject({ quantity: 10, version: 1 });
	});

	it('refuses to cancel an instruction that was applied', async () => {
		const fixture = adjustmentFixture();
		const adjustment = await fixture.service.createAdjustment({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			type: StockAdjustmentType.DECREASE,
			quantity: 3,
			reasonCode: StockReasonCode.SCRAP
		});
		await fixture.service.apply(adjustment.id);

		await expect(fixture.service.cancel(adjustment.id)).rejects.toMatchObject({
			response: { code: 'STOCK_ADJUSTMENT_ALREADY_APPLIED' }
		});
		expect(fixture.adjustments()[0]).toMatchObject({ status: StockAdjustmentStatus.APPLIED });
		expect(fixture.level()).toMatchObject({ quantity: 7 });
	});
});
