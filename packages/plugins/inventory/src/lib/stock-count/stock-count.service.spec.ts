/**
 * Three module boundaries are doubled here, and the reason is the same for all three.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a count service needs and none of which is available
 * outside a running application; its nested `uuid` is ESM-only, so reading one entity would fail
 * under jest. `@gauzy/config` reads the process environment at import time. Both are therefore
 * doubled at the module boundary, and **the services under test are the real ones**: the count
 * service and the real ledger engine the closing step writes through.
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
			currentUserId: () => '00000000-0000-4000-8000-000000000099',
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

import { FindOperator } from 'typeorm';
import { Product, ProductVariant, WarehouseProduct, WarehouseProductVariant } from '@gauzy/core';
import {
	StockCountLineStatus,
	StockCountMode,
	StockCountStatus,
	StockMovementReferenceType,
	StockMovementType,
	StockReasonCode
} from '../inventory.enums';
import { StockLevelService } from '../stock-level/stock-level.service';
import { StockMovement } from '../stock-movement/stock-movement.entity';
import { StockCountLine } from '../stock-count-line/stock-count-line.entity';
import { StockCount } from './stock-count.entity';
import { StockCountService } from './stock-count.service';

/**
 * Physical counts.
 *
 * A count is where the record and the floor are compared, and the closing step is the only one that
 * touches stock (doc 09 §4, §10.4, §15.3). The suite pins the properties that make that comparison
 * worth signing off:
 *
 * - the expectation is **snapshotted at open and never re-read**, because the whole point is to
 *   compare what the record believed at the start against what the floor reports at the end;
 * - at most one session is open per location: two open sessions over the same shelves would each
 *   snapshot a different expectation and each write a correction;
 * - a second reading of one position is a **recount**, and the recount is what closes the line — both
 *   readings are kept, so the two counts stay comparable;
 * - closing writes **one correction per line whose reading differs from what is actually there**,
 *   referencing the line that produced it, and the movement's delta is `counted − current` rather
 *   than `counted − expected`, because the record may have moved after the snapshot;
 * - a line nobody counted writes nothing and is reported: a missing reading is not evidence that the
 *   stock is absent, and treating it as zero would write off the whole location;
 * - a closed session is immutable, and closing it twice is refused.
 *
 * The service is constructed directly over an in-memory double of the connection, with the real
 * ledger engine behind it. The double keeps a real snapshot, so "nothing was written" is asserted
 * against the store. The sequence service is the one collaborator that is a double.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const WAREHOUSE = '00000000-0000-4000-8000-000000000010';
const PRODUCT = '00000000-0000-4000-8000-000000000020';
const VARIANT = '00000000-0000-4000-8000-000000000030';
const OTHER_VARIANT = '00000000-0000-4000-8000-000000000031';
const BIN = '00000000-0000-4000-8000-000000000050';

type Row = Record<string, any>;

/** The in-memory stand-in for the connection the count service and the ledger engine write through. */
function datastore(tables: Record<string, Row[]>) {
	const entityToTable = new Map<unknown, string>([
		[Product, 'product'],
		[ProductVariant, 'product_variant'],
		[WarehouseProduct, 'warehouse_product'],
		[WarehouseProductVariant, 'warehouse_product_variant'],
		[StockMovement, 'stock_movement'],
		[StockCount, 'stock_count'],
		[StockCountLine, 'stock_count_line']
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
	/** One column's condition, including the null test the pending-line count builds with `IsNull`. */
	const matches = (row: Row, where: Row = {}) =>
		Object.entries(where).every(([field, expected]) => {
			if (expected instanceof FindOperator) {
				switch (expected.type) {
					case 'isNull':
						return row[field] === null || row[field] === undefined;
					case 'not':
						return !same(row[field], expected.value);
					default:
						throw new Error(`the in-memory double does not implement the "${expected.type}" operator`);
				}
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
			if (/FROM "warehouse_bin"/.test(sql)) {
				const bin = tables.warehouse_bin.find((row) => same(row.id, params[0]));

				return bin ? [{ warehouseId: bin.warehouseId }] : [];
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
	const countRepository: any = {
		manager,
		metadata: { tableName: 'stock_count', hasColumnWithPropertyPath: () => false },
		create: (partial: Row) => ({ ...partial }),
		save: async (rowOrRows: any) => manager.save(StockCount, rowOrRows),
		find: async (options: any = {}) => rows(StockCount).filter((row) => matches(row, options.where)),
		findOne: async (options: any = {}) => rows(StockCount).find((row) => matches(row, options.where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = rows(StockCount).filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async () => rows(StockCount).length
	};

	return { dataSource, manager, tables, countRepository };
}

/**
 * Builds the count service over the real ledger engine and one in-memory datastore where two variants
 * are stocked at one location.
 *
 * @param options.quantities What each of the two levels holds, keyed by variant.
 */
function countFixture(options: { quantities?: Record<string, number> } = {}) {
	const quantities = options.quantities ?? { [VARIANT]: 10, [OTHER_VARIANT]: 6 };
	const tables: Record<string, Row[]> = {
		product: [{ id: PRODUCT, tenantId: TENANT, organizationId: ORG }],
		product_variant: [
			{ id: VARIANT, productId: PRODUCT },
			{ id: OTHER_VARIANT, productId: PRODUCT }
		],
		warehouse_product: [
			{
				id: 'aggregate-1',
				tenantId: TENANT,
				organizationId: ORG,
				warehouseId: WAREHOUSE,
				productId: PRODUCT,
				quantity: Object.values(quantities).reduce((sum, one) => sum + one, 0),
				reservedQuantity: 0,
				version: 1
			}
		],
		warehouse_product_variant: [],
		stock_movement: [],
		stock_count: [],
		stock_count_line: [],
		// The session's bin, so the closing movements carry the physical address they were counted at.
		warehouse_bin: [{ id: BIN, tenantId: TENANT, organizationId: ORG, warehouseId: WAREHOUSE }]
	};

	for (const [index, variantId] of Object.keys(quantities).entries()) {
		tables.warehouse_product_variant.push({
			id: `level-${index + 1}`,
			tenantId: TENANT,
			organizationId: ORG,
			warehouseProductId: 'aggregate-1',
			variantId,
			quantity: quantities[variantId],
			reservedQuantity: 0,
			incomingQuantity: 0,
			safetyStock: 0,
			allowBackorder: false,
			backorderLimit: null,
			version: 1
		});
	}

	const store = datastore(tables);
	const stockLevelService = new StockLevelService(store.dataSource as never);
	const allocated: string[] = [];
	const sequenceService = {
		allocate: async (key: string) => {
			allocated.push(key);

			return { key, value: allocated.length, formatted: `CNT-${String(allocated.length).padStart(6, '0')}` };
		}
	};
	const service = new StockCountService(
		store.countRepository as never,
		{} as never,
		sequenceService as never,
		stockLevelService
	);

	return {
		service,
		store,
		tables,
		allocated,
		level: (variantId: string = VARIANT) =>
			tables.warehouse_product_variant.find((row) => row.variantId === variantId),
		lines: () => tables.stock_count_line,
		lineFor: (variantId: string) => tables.stock_count_line.find((row) => row.variantId === variantId),
		movements: () => tables.stock_movement,
		count: () => tables.stock_count[0]
	};
}

/** A session opened over the whole location. */
async function openSession(fixture = countFixture()) {
	const count = await fixture.service.createCount({
		warehouseId: WAREHOUSE,
		mode: StockCountMode.FULL,
		binId: BIN
	} as never);

	return { fixture, count, opened: await fixture.service.open(count.id) };
}

describe('StockCountService — opening a session (doc 09 §10.4, §15.3)', () => {
	it('numbers a draft session and snapshots the expectation when it opens', async () => {
		const fixture = countFixture();
		const draft = await fixture.service.createCount({
			warehouseId: WAREHOUSE,
			mode: StockCountMode.CYCLE,
			binId: BIN
		} as never);

		expect(fixture.allocated).toEqual(['STOCK_COUNT']);
		expect(draft).toMatchObject({
			number: 'CNT-000001',
			status: StockCountStatus.DRAFT,
			mode: StockCountMode.CYCLE,
			tenantId: TENANT,
			organizationId: ORG
		});
		// A draft has no lines yet: the scope is generated when the session opens.
		expect(fixture.lines()).toEqual([]);

		const opened = await fixture.service.open(draft.id);

		expect(opened.status).toBe(StockCountStatus.OPEN);
		expect(opened.startedAt).toBeInstanceOf(Date);
		expect(fixture.lines()).toHaveLength(2);
		expect(fixture.lineFor(VARIANT)).toMatchObject({
			stockCountId: draft.id,
			expectedQuantity: 10,
			warehouseProductVariantId: 'level-1',
			status: StockCountLineStatus.PENDING
		});
		expect(fixture.lineFor(OTHER_VARIANT)).toMatchObject({ expectedQuantity: 6 });
		// The session's own bin is what a bin-scoped count compares against.
		expect(fixture.lineFor(VARIANT).binId).toBe(BIN);
	});

	it('refuses a second open session for the same location', async () => {
		const { fixture, count } = await openSession();

		await expect(
			fixture.service.createCount({ warehouseId: WAREHOUSE, mode: StockCountMode.SPOT } as never)
		).rejects.toMatchObject({
			response: { code: 'STOCK_COUNT_ALREADY_OPEN', details: { stockCountId: count.id } }
		});
		expect(fixture.tables.stock_count).toHaveLength(1);
		expect(fixture.allocated).toEqual(['STOCK_COUNT']);
	});

	it('reports a session that does not exist as missing', async () => {
		const fixture = countFixture();

		await expect(fixture.service.open('no-such-count')).rejects.toMatchObject({
			response: { code: 'STOCK_LEVEL_NOT_FOUND', details: { stockCountId: 'no-such-count' } }
		});
	});
});

describe('StockCountService — recording readings (doc 09 §4, §15.3)', () => {
	it('records a first reading as counted and a second as a recount, which is what closes the line', async () => {
		const { fixture, count } = await openSession();
		const line = fixture.lineFor(VARIANT);

		await fixture.service.recordLines(count.id, [{ lineId: line.id, countedQuantity: 8 }]);

		expect(fixture.lineFor(VARIANT)).toMatchObject({
			countedQuantity: 8,
			variance: -2,
			status: StockCountLineStatus.COUNTED
		});
		expect(fixture.count()).toMatchObject({ status: StockCountStatus.COUNTING, countedLineCount: 1 });

		await fixture.service.recordLines(count.id, [{ lineId: line.id, countedQuantity: 9, note: 'Recount' }]);

		// Both readings are kept, so the two counts stay comparable, and the recount is the value that
		// closes the line.
		expect(fixture.lineFor(VARIANT)).toMatchObject({
			countedQuantity: 8,
			recountedQuantity: 9,
			variance: -1,
			status: StockCountLineStatus.RECOUNTED,
			note: 'Recount'
		});
		expect(fixture.lineFor(VARIANT).countedAt).toBeInstanceOf(Date);
	});

	it('reports how many lines are still awaiting a reading', async () => {
		const { fixture, count } = await openSession();

		expect(await fixture.service.pendingLineCount(count.id)).toBe(2);

		await fixture.service.recordLines(count.id, [
			{ lineId: fixture.lineFor(VARIANT).id, countedQuantity: 10 }
		]);

		expect(await fixture.service.pendingLineCount(count.id)).toBe(1);
	});

	it('refuses to record a reading on a session that has not been opened', async () => {
		const fixture = countFixture();
		const draft = await fixture.service.createCount({ warehouseId: WAREHOUSE } as never);

		await expect(
			fixture.service.recordLines(draft.id, [{ lineId: 'any-line', countedQuantity: 1 }])
		).rejects.toMatchObject({
			response: {
				code: 'STOCK_COUNT_NOT_OPEN',
				details: { stockCountId: draft.id, status: StockCountStatus.DRAFT }
			}
		});
		expect(fixture.movements()).toEqual([]);
	});

	it('hides the expectation and the variance when a blind count is read', async () => {
		// A blind count is a count the counter cannot cheat: the expectation is snapshotted all the same,
		// and it is the read that withholds it.
		const { fixture, count } = await openSession();
		await fixture.service.recordLines(count.id, [
			{ lineId: fixture.lineFor(VARIANT).id, countedQuantity: 8 }
		]);

		const blind = await fixture.service.listLines(count.id, false);
		const open = await fixture.service.listLines(count.id, true);

		expect(blind.find((line) => line.variantId === VARIANT)).not.toHaveProperty('expectedQuantity');
		expect(blind.find((line) => line.variantId === VARIANT)).not.toHaveProperty('variance');
		expect(open.find((line) => line.variantId === VARIANT)).toMatchObject({
			expectedQuantity: 10,
			variance: -2
		});
		// The record itself is untouched: the expectation is still there to close against.
		expect(fixture.lineFor(VARIANT)).toMatchObject({ expectedQuantity: 10, variance: -2 });
	});
});

describe('StockCountService — closing a session and writing the ledger (doc 09 §4.3 row 25, §15.3)', () => {
	it('writes exactly one correcting movement per line that disagrees with the record', async () => {
		const { fixture, count } = await openSession();

		await fixture.service.recordLines(count.id, [
			{ lineId: fixture.lineFor(VARIANT).id, countedQuantity: 7 },
			{ lineId: fixture.lineFor(OTHER_VARIANT).id, countedQuantity: 5 }
		]);

		const closed = await fixture.service.close(count.id);

		expect(closed.count).toMatchObject({ status: StockCountStatus.CLOSED, countedLineCount: 2 });
		expect(closed.count.closedAt).toBeInstanceOf(Date);
		expect(closed.movements).toHaveLength(2);
		// The delta is the difference from what the record held when the line was closed, and the row cites
		// the line that produced it.
		expect(fixture.movements().map((row) => [row.variantId, row.quantity, row.quantityAfter])).toEqual([
			[VARIANT, -3, 7],
			[OTHER_VARIANT, -1, 5]
		]);
		expect(fixture.movements()[0]).toMatchObject({
			type: StockMovementType.COUNT,
			referenceType: StockMovementReferenceType.COUNT,
			referenceId: fixture.lineFor(VARIANT).id,
			reason: StockReasonCode.CYCLE_COUNT,
			quantityBefore: 10
		});
		expect(fixture.level(VARIANT)).toMatchObject({ quantity: 7 });
		expect(fixture.level(OTHER_VARIANT)).toMatchObject({ quantity: 5 });
		// The line records the movement it produced, so the variance is traceable to a ledger row.
		expect(fixture.lineFor(VARIANT).movementId).toBe(fixture.movements()[0].id);
		expect(fixture.lineFor(VARIANT).variance).toBe(-3);
	});

	it('writes nothing for a line whose reading agrees with the record', async () => {
		const { fixture, count } = await openSession();

		await fixture.service.recordLines(count.id, [
			{ lineId: fixture.lineFor(VARIANT).id, countedQuantity: 10 },
			{ lineId: fixture.lineFor(OTHER_VARIANT).id, countedQuantity: 2 }
		]);

		const closed = await fixture.service.close(count.id);

		// One correction, for the line that disagreed: the location is not rewritten to what it already was.
		expect(closed.movements).toHaveLength(1);
		expect(fixture.movements()).toHaveLength(1);
		expect(fixture.movements()[0]).toMatchObject({ variantId: OTHER_VARIANT, quantity: -4 });
		expect(fixture.level(VARIANT)).toMatchObject({ quantity: 10, version: 1 });
		expect(fixture.lineFor(VARIANT).movementId).toBeUndefined();
	});

	it('writes nothing for a line nobody counted and marks it skipped', async () => {
		// A missing reading is not evidence that the stock is absent: treating it as zero would write off the
		// whole location.
		const { fixture, count } = await openSession();

		await fixture.service.recordLines(count.id, [
			{ lineId: fixture.lineFor(VARIANT).id, countedQuantity: 9 }
		]);

		await fixture.service.close(count.id);

		expect(fixture.lineFor(OTHER_VARIANT)).toMatchObject({ status: StockCountLineStatus.SKIPPED });
		expect(fixture.movements()).toHaveLength(1);
		expect(fixture.movements()[0].variantId).toBe(VARIANT);
		expect(fixture.level(OTHER_VARIANT)).toMatchObject({ quantity: 6, version: 1 });
	});

	it('reports the variance against the snapshot while correcting against what is actually there', async () => {
		// The two numbers answer two questions, and both are needed: the line's variance says what the count
		// found against what the record believed at the start, and the movement says what has to change now.
		// A receipt that lands between the snapshot and the close separates them.
		const { fixture, count } = await openSession();
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

		await fixture.service.recordLines(count.id, [{ lineId: fixture.lineFor(VARIANT).id, countedQuantity: 12 }]);
		const closed = await fixture.service.close(count.id);

		expect(fixture.lineFor(VARIANT).variance).toBe(2);
		expect(closed.movements).toHaveLength(1);
		expect(fixture.movements()[1]).toMatchObject({ quantity: -3, quantityBefore: 15, quantityAfter: 12 });
		expect(fixture.level(VARIANT)).toMatchObject({ quantity: 12 });
	});

	it('closes against the recount when a line was read twice', async () => {
		const { fixture, count } = await openSession();

		await fixture.service.recordLines(count.id, [
			{ lineId: fixture.lineFor(VARIANT).id, countedQuantity: 8 },
			{ lineId: fixture.lineFor(OTHER_VARIANT).id, countedQuantity: 6 }
		]);
		await fixture.service.recordLines(count.id, [
			{ lineId: fixture.lineFor(VARIANT).id, countedQuantity: 11 }
		]);

		const closed = await fixture.service.close(count.id);

		expect(closed.movements).toHaveLength(1);
		expect(fixture.movements()[0]).toMatchObject({ variantId: VARIANT, quantity: 1, quantityAfter: 11 });
		// The line that agreed on its first reading wrote nothing, and the recount did not resurrect it.
		expect(fixture.level(OTHER_VARIANT)).toMatchObject({ quantity: 6, version: 1 });
		expect(fixture.lineFor(VARIANT).variance).toBe(1);
	});

	it('refuses to close a session twice, because a closed session is immutable', async () => {
		const { fixture, count } = await openSession();
		await fixture.service.recordLines(count.id, [
			{ lineId: fixture.lineFor(VARIANT).id, countedQuantity: 7 }
		]);
		await fixture.service.close(count.id);

		await expect(fixture.service.close(count.id)).rejects.toMatchObject({
			response: {
				code: 'STOCK_COUNT_ALREADY_CLOSED',
				details: { stockCountId: count.id, status: StockCountStatus.CLOSED }
			}
		});
		// One closure, one correction: the variance report cannot change after it was signed off.
		expect(fixture.movements()).toHaveLength(1);
		expect(fixture.level(VARIANT)).toMatchObject({ quantity: 7 });
	});

	it('refuses to record a reading on a closed session', async () => {
		const { fixture, count } = await openSession();
		await fixture.service.close(count.id);

		await expect(
			fixture.service.recordLines(count.id, [
				{ lineId: fixture.lineFor(VARIANT).id, countedQuantity: 1 }
			])
		).rejects.toMatchObject({ response: { code: 'STOCK_COUNT_ALREADY_CLOSED' } });
		expect(fixture.lineFor(VARIANT).countedQuantity).toBeUndefined();
	});

	it('cancels a session without writing the ledger', async () => {
		const { fixture, count } = await openSession();
		await fixture.service.recordLines(count.id, [
			{ lineId: fixture.lineFor(VARIANT).id, countedQuantity: 3 }
		]);

		const cancelled = await fixture.service.cancel(count.id);

		expect(cancelled).toMatchObject({ status: StockCountStatus.CANCELED });
		expect(fixture.movements()).toEqual([]);
		expect(fixture.level(VARIANT)).toMatchObject({ quantity: 10, version: 1 });
	});
});
