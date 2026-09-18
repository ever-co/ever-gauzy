/**
 * Two module boundaries are doubled here, for the reason the package’s other suites state: `@gauzy/core`
 * boots the whole application graph from its barrel — configuration, the ORM, the job registry, the
 * module scanner — none of which a ledger seam needs and none of which is available outside a running
 * application, and `@gauzy/config` reads the process environment at import time. **The service under
 * test is the real one**, together with the real decimal primitives it writes and sums with.
 *
 * Two things stand in for the rest of the platform, and both are stated rather than mocked:
 *
 * - **The ledger engine.** `applyMovement` is the one write path into stock, and the double below
 *   behaves like it in the three ways this seam depends on: it resolves the level of a location and a
 *   variant, it brings the quantity to the ledger’s scale and applies the delta to the level, and it
 *   refuses a write that would drive the on-hand quantity negative. It writes a movement row **without
 *   a tenant or an organization of its own**, exactly as the engine does — the tenant of a movement is
 *   the aggregate it was applied to — and it takes the transaction it is handed, so a relocation that
 *   fails on its second leg can be shown to leave nothing behind.
 * - **The two repositories.** They answer the statements the service actually issues — the join onto
 *   the aggregate, the conditions on the movement, the level and the aggregate, the grouped sum over
 *   the ledger — and a statement the double does not model throws rather than answering wrongly.
 */

jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}
	}

	const decimal = jest.requireActual('@gauzy/core/src/lib/money/decimal');

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
		MultiORMOneToOne: decorator,
		JsonColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		Product: class Product {},
		ProductVariant: class ProductVariant {},
		Warehouse: class Warehouse {},
		WarehouseProduct: class WarehouseProduct {},
		WarehouseProductVariant: class WarehouseProductVariant {},
		addDecimalStrings: decimal.addDecimalStrings,
		subtractDecimalStrings: decimal.subtractDecimalStrings,
		compareDecimalStrings: decimal.compareDecimalStrings,
		parseDecimalString: decimal.parseDecimalString,
		formatDecimalUnits: decimal.formatDecimalUnits,
		pow10: decimal.pow10,
		// The double answers with the fixture’s scope, which is what a request-scoped read resolves to.
		// Every case that is about tenancy re-points it with a spy, so the scope is never a constant of
		// this specification.
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => 'tenant-1',
			currentOrganizationId: () => 'organization-1',
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

import { RequestContext, WarehouseProductVariant, addDecimalStrings, compareDecimalStrings } from '@gauzy/core';
import { StockMovement } from './../stock-movement/stock-movement.entity';
import { StockMovementType } from './../inventory.enums';
import { StockLedgerService } from './stock-ledger.service';

/**
 * The ledger as a seam, as the packages that do not own stock read it and write through it.
 *
 * The cases below are about the three properties that make the seam trustworthy rather than about the
 * statements it issues:
 *
 * - **A derived balance is the ledger’s own sum.** What a bin holds is the sum of the movements
 *   recorded against it, grouped by the database; a pair the ledger recorded nothing about has no
 *   answer at all, which is a different fact from a balance of zero.
 * - **What a caller states is what the ledger records.** A movement is written through the engine, so
 *   the level and the ledger stay each other’s explanation — the sum of a level’s movements is the
 *   level’s quantity, before and after the write, including for the kinds that record an event without
 *   moving the level at all.
 * - **A relocation is a balanced pair or nothing.** The two movements are one transaction: a pair whose
 *   second leg is refused leaves neither the movements nor the level they would have moved.
 *
 * Tenancy is asserted as well: the movements and the levels of another tenant, and of another
 * organization of the same tenant, are neither read nor written against — and a movement the ledger
 * wrote carries no tenant of its own, so the scope of a read is the aggregate the movement belongs to.
 */

const TENANT = 'tenant-1';
const ORG = 'organization-1';
const OTHER_TENANT = 'tenant-2';
const OTHER_ORG = 'organization-2';
const WAREHOUSE = 'warehouse-1';
const OTHER_WAREHOUSE = 'warehouse-2';
const VARIANT = 'variant-1';
const OTHER_VARIANT = 'variant-2';
const BIN = 'bin-1';
const OTHER_BIN = 'bin-2';
const AGGREGATE = 'aggregate-1';
const REFERENCE = 'line-1';

/** One `stock_movement` row, as this seam writes and reads it. */
interface IMovementRow {
	id: string;
	warehouseId: string;
	variantId: string;
	warehouseProductId?: string;
	warehouseProductVariantId?: string;
	binId?: string;
	type: string;
	quantity: number;
	quantityBefore?: number;
	quantityAfter?: number;
	referenceType?: string;
	referenceId?: string;
	reason?: string;
	note?: string;
	tenantId?: string;
	organizationId?: string;
	/** The transaction the write joined, carried here so a balanced pair can be asserted as one write. */
	__transaction?: unknown;
}

/** One `warehouse_product_variant` row. */
interface ILevelRow {
	id: string;
	variantId: string;
	warehouseProductId: string;
	quantity: number;
	reservedQuantity?: number;
	binId?: string;
	isUnlimited?: boolean;
}

/** One `warehouse_product` row: the aggregate a level hangs from and a movement was applied to. */
interface IAggregateRow {
	id: string;
	warehouseId: string;
	productId?: string;
	tenantId?: string;
	organizationId?: string;
}

/** The tables this suite drives, as plain arrays, and the transactions that ran over them. */
interface IStore {
	movements: IMovementRow[];
	levels: ILevelRow[];
	aggregates: IAggregateRow[];
	transactions: unknown[];
	sequence: number;
}

/** One condition the read stated. */
interface ICondition {
	sql: string;
	params: Record<string, any>;
}

/** A raw select the read stated. */
interface IRawSelect {
	expression: string;
	label: string;
}

/**
 * @param left One value of a condition.
 * @param right The other.
 * @returns Whether the two name the same value.
 */
function same(left: unknown, right: unknown): boolean {
	return String(left ?? '') === String(right ?? '');
}

/**
 * Answers the scope condition the ledger states on the aggregate.
 *
 * The condition admits the tenant-wide row — the aggregate that names no organization — beside the
 * caller’s own, so the double models both readings: without the `IS NULL` half it would answer the
 * equality alone and a shared row would look out of scope, which is the defect the condition exists
 * to prevent.
 *
 * @param rowOrganizationId The organization of the aggregate the row hangs from.
 * @param sql The condition the read stated.
 * @param callerOrganizationId The organization the caller runs in.
 * @returns Whether the database would have returned the row.
 */
function scopedToOrganization(
	rowOrganizationId: string | null | undefined,
	sql: string,
	callerOrganizationId: unknown
): boolean {
	return /IS NULL/.test(sql)
		? rowOrganizationId == null || same(rowOrganizationId, callerOrganizationId)
		: same(rowOrganizationId, callerOrganizationId);
}

/** @returns A copy of the store, and the value each array had. */
function snapshot(store: IStore): IStore {
	return {
		movements: store.movements.map((row) => ({ ...row })),
		levels: store.levels.map((row) => ({ ...row })),
		aggregates: store.aggregates.map((row) => ({ ...row })),
		transactions: [...store.transactions],
		sequence: store.sequence
	};
}

/** Puts a store back to the state it was read in, which is what a refused transaction leaves behind. */
function restore(store: IStore, copy: IStore): void {
	store.movements = copy.movements;
	store.levels = copy.levels;
	store.aggregates = copy.aggregates;
	store.transactions = copy.transactions;
	store.sequence = copy.sequence;
}

/**
 * @param store The tables.
 * @param warehouseProductId The aggregate a movement or a level belongs to.
 * @returns The aggregate row, which is the row that carries the tenant and the organization.
 */
function aggregateOf(store: IStore, warehouseProductId?: string): IAggregateRow | undefined {
	return store.aggregates.find((aggregate) => same(aggregate.id, warehouseProductId));
}

/**
 * @param store The tables.
 * @param row A movement row.
 * @param conditions The conditions the read stated.
 * @returns Whether the database would have returned the row.
 * @throws Error when the read states a shape this double does not model.
 */
function movementMatches(store: IStore, row: IMovementRow, conditions: ICondition[]): boolean {
	const aggregate = aggregateOf(store, row.warehouseProductId);

	return conditions.every(({ sql, params }) => {
		if (/movement\.warehouseId/.test(sql)) {
			return same(row.warehouseId, params.warehouseId);
		}
		if (/movement\.variantId/.test(sql)) {
			return same(row.variantId, params.variantId);
		}
		if (/movement\.binId IN/.test(sql)) {
			return (params.binIds ?? []).some((binId: unknown) => same(row.binId, binId));
		}
		if (/movement\.binId/.test(sql)) {
			return same(row.binId, params.binId);
		}
		if (/aggregate\.tenantId/.test(sql)) {
			return same(aggregate?.tenantId, params.tenantId);
		}
		if (/aggregate\.organizationId/.test(sql)) {
			return scopedToOrganization(aggregate?.organizationId, sql, params.organizationId);
		}

		throw new Error(`the in-memory ledger read does not implement the condition "${sql}"`);
	});
}

/**
 * @param store The tables.
 * @param row A level row.
 * @param conditions The conditions the read stated.
 * @returns Whether the database would have returned the row.
 * @throws Error when the read states a shape this double does not model.
 */
function levelMatches(store: IStore, row: ILevelRow, conditions: ICondition[]): boolean {
	const aggregate = aggregateOf(store, row.warehouseProductId);

	return conditions.every(({ sql, params }) => {
		if (/level\.variantId/.test(sql)) {
			return same(row.variantId, params.variantId);
		}
		if (/level\.id/.test(sql)) {
			return same(row.id, params.id);
		}
		if (/level\.binId IN/.test(sql)) {
			return (params.binIds ?? []).some((binId: unknown) => same(row.binId, binId));
		}
		if (/aggregate\.warehouseId/.test(sql)) {
			return same(aggregate?.warehouseId, params.warehouseId);
		}
		if (/aggregate\.tenantId/.test(sql)) {
			return same(aggregate?.tenantId, params.tenantId);
		}
		if (/aggregate\.organizationId/.test(sql)) {
			return scopedToOrganization(aggregate?.organizationId, sql, params.organizationId);
		}

		throw new Error(`the in-memory level read does not implement the condition "${sql}"`);
	});
}

/**
 * The query builder double: the reads this seam issues and nothing else.
 *
 * @param store The tables.
 * @param target The entity the read names, which decides what is being read.
 */
function queryBuilder(store: IStore, target: unknown) {
	const conditions: ICondition[] = [];
	const rawSelects: IRawSelect[] = [];
	const filteredMovements = () => store.movements.filter((row) => movementMatches(store, row, conditions));
	const filteredLevels = () => store.levels.filter((row) => levelMatches(store, row, conditions));

	const query: any = {
		innerJoin: () => query,
		limit: () => query,
		addSelect: (first: unknown, second?: string) => {
			if (typeof first === 'string' && typeof second === 'string') {
				rawSelects.push({ expression: first, label: second });
			}

			return query;
		},
		select: (first: unknown, second?: string) => {
			if (typeof first === 'string' && typeof second === 'string') {
				rawSelects.push({ expression: first, label: second });
			}

			return query;
		},
		groupBy: () => query,
		addGroupBy: () => query,
		where: (sql: string, params: Record<string, any> = {}) => {
			conditions.push({ sql, params });

			return query;
		},
		andWhere: (sql: string, params: Record<string, any> = {}) => {
			conditions.push({ sql, params });

			return query;
		},
		getMany: async () => (target === WarehouseProductVariant ? filteredLevels() : filteredMovements()),
		getOne: async () => (target === WarehouseProductVariant ? filteredLevels() : filteredMovements())[0] ?? null,
		getRawOne: async () => {
			const expression = rawSelects[0]?.expression ?? '';

			if (!/SUM\(movement\.quantity\)/.test(expression)) {
				throw new Error(`the in-memory ledger read does not implement the raw read "${expression}"`);
			}

			// A sum over no rows is null, which is the only thing that tells "the ledger never recorded
			// this pair" apart from "it recorded nothing net".
			return filteredMovements().length
				? { [rawSelects[0].label]: totalOf(filteredMovements()) }
				: { [rawSelects[0].label]: null };
		},
		getRawMany: async () => {
			if (!rawSelects.some((select) => /SUM\(movement\.quantity\)/.test(select.expression))) {
				throw new Error('the in-memory ledger read only sums movement quantities');
			}

			const byPair = new Map<string, { binId?: string; variantId?: string; total: string }>();

			for (const movement of filteredMovements()) {
				const key = `${movement.binId ?? ''}:${movement.variantId}`;
				const group = byPair.get(key) ?? { binId: movement.binId, variantId: movement.variantId, total: '0' };

				group.total = addDecimalStrings(group.total, movement.quantity ?? 0);
				byPair.set(key, group);
			}

			return [...byPair.values()].map((group) => ({
				binId: group.binId,
				variantId: group.variantId,
				quantity: Number(group.total)
			}));
		}
	};

	return query;
}

/**
 * @param movements The movements of one group.
 * @returns Their exact sum, as the ledger’s own decimal arithmetic states it.
 */
function totalOf(movements: IMovementRow[]): number {
	return Number(
		movements.reduce<string>((total, movement) => addDecimalStrings(total, movement.quantity ?? 0), '0')
	);
}

/**
 * The ledger engine, standing in for `StockLevelService.applyMovement`.
 *
 * It resolves the level of a location and a variant — creating the level when the variant has never
 * been stocked there, as the engine does — applies the delta at the ledger’s scale, refuses a write
 * that would drive the on-hand quantity negative, and writes the movement row that explains the level.
 * The row carries no tenant and no organization of its own, because the engine writes it without them.
 *
 * @param store The tables.
 */
function engine(store: IStore) {
	const levelOf = (input: any): ILevelRow => {
		const aggregate =
			store.aggregates.find((row) => same(row.warehouseId, input.warehouseId)) ??
			(() => {
				const created: IAggregateRow = {
					id: `aggregate-${++store.sequence}`,
					warehouseId: input.warehouseId,
					tenantId: TENANT,
					organizationId: ORG
				};

				store.aggregates.push(created);

				return created;
			})();

		const existing = store.levels.find(
			(row) => same(row.warehouseProductId, aggregate.id) && same(row.variantId, input.variantId)
		);

		if (existing) {
			return existing;
		}

		const created: ILevelRow = {
			id: `level-${++store.sequence}`,
			variantId: input.variantId,
			warehouseProductId: aggregate.id,
			quantity: 0,
			reservedQuantity: 0
		};

		store.levels.push(created);

		return created;
	};

	return {
		/**
		 * @param input The movement the engine is asked for.
		 * @param manager The transaction the write joins, when the caller is inside one.
		 * @returns The movement row that was written and the level state it produced.
		 */
		/**
		 * Naming the bin a variant is kept in, which the engine owns because the level row is its table.
		 * The double answers the same way the engine does: the bin lands on the level row the movement was
		 * applied to, and a location that does not stock the variant has no row to name one on.
		 */
		setHomeBin: async (input: any, manager?: unknown) => {
			const aggregate = store.aggregates.find((row) => same(row.warehouseId, input.warehouseId));
			const level = store.levels.find(
				(row) => same(row.warehouseProductId, aggregate?.id) && same(row.variantId, input.variantId)
			);

			if (!level) {
				return false;
			}

			level.binId = input.binId;
			void manager;

			return true;
		},

		applyMovement: async (input: any, manager?: unknown) => {
			const level = levelOf(input);
			const quantityBefore = Number(level.quantity ?? 0);
			const quantityAfter = Number(addDecimalStrings(quantityBefore, input.quantityDelta ?? 0));

			if (quantityAfter < 0 && !level.isUnlimited) {
				throw new Error(`the ledger engine refuses a negative on-hand quantity (INV-05): ${quantityAfter}`);
			}

			level.quantity = quantityAfter;

			const movement: IMovementRow = {
				id: `movement-${++store.sequence}`,
				warehouseId: input.warehouseId,
				variantId: input.variantId,
				warehouseProductId: level.warehouseProductId,
				warehouseProductVariantId: level.id,
				binId: input.binId,
				type: input.type,
				quantity: Number(input.quantityDelta ?? 0),
				quantityBefore,
				quantityAfter,
				referenceType: input.referenceType,
				referenceId: input.referenceId,
				reason: input.reason,
				note: input.note,
				__transaction: manager
			};

			store.movements.push(movement);

			return {
				movementId: movement.id,
				levelId: level.id,
				quantityBefore,
				quantityAfter,
				reservedBefore: 0,
				reservedAfter: 0,
				binId: input.binId
			};
		}
	};
}

/**
 * @param seed The rows the fixture starts with.
 * @returns The service under test, the tables it wrote to, and the engine it wrote through.
 */
function fixture(seed: Partial<IStore> = {}) {
	const store: IStore = {
		movements: [],
		levels: [],
		aggregates: [{ id: AGGREGATE, warehouseId: WAREHOUSE, tenantId: TENANT, organizationId: ORG }],
		transactions: [],
		sequence: 0,
		...seed
	};

	const ledger = engine(store);
	const builder = (target: unknown) => () => queryBuilder(store, target);
	const transaction = async (work: (transaction: unknown) => Promise<unknown>) => {
		const token = `transaction-${store.transactions.length + 1}`;
		const copy = snapshot(store);

		try {
			const result = await work(token);

			store.transactions.push(token);

			return result;
		} catch (error) {
			restore(store, copy);

			throw error;
		}
	};
	const repository = (target: unknown) => ({
		createQueryBuilder: builder(target),
		manager: { createQueryBuilder: builder(target), transaction }
	});

	return {
		store,
		ledger,
		service: new StockLedgerService(
			repository(StockMovement) as never,
			repository(WarehouseProductVariant) as never,
			ledger as never
		)
	};
}

/** A level of the fixture location. */
const levelRow = (overrides: Partial<ILevelRow> = {}): ILevelRow => ({
	id: 'level-1',
	variantId: VARIANT,
	warehouseProductId: AGGREGATE,
	quantity: 0,
	reservedQuantity: 0,
	...overrides
});

/** A movement the ledger already holds. */
let movementSequence = 0;
const movementRow = (overrides: Partial<IMovementRow> = {}): IMovementRow => ({
	id: `held-${++movementSequence}`,
	warehouseId: WAREHOUSE,
	variantId: VARIANT,
	warehouseProductId: AGGREGATE,
	type: StockMovementType.RECEIPT,
	quantity: 0,
	...overrides
});

/**
 * A level holding a quantity, together with the movement that explains it.
 *
 * The ledger’s invariant is that a level is the sum of its own movements, so a fixture that seeds a
 * quantity without the movement that put it there would be a state the ledger cannot reach — and the
 * invariant assertions below would be measuring the fixture rather than the write.
 *
 * @param quantity What the level holds.
 * @param overrides The level’s own overrides.
 * @returns The rows the fixture starts with.
 */
function stocked(quantity: number, overrides: Partial<ILevelRow> = {}): Partial<IStore> {
	return {
		levels: [levelRow({ quantity, ...overrides })],
		movements: [
			movementRow({
				type: StockMovementType.RECEIPT,
				quantity,
				referenceType: 'MIGRATION',
				referenceId: 'opening-1'
			})
		]
	};
}

/**
 * @param store The tables.
 * @param referenceType The concept whose movements are being read.
 * @returns The movements written under that concept, which is what one operation contributed.
 */
function movementsOf(store: IStore, referenceType: string): IMovementRow[] {
	return store.movements.filter((movement) => movement.referenceType === referenceType);
}

/**
 * @param store The tables.
 * @param variantId The variant whose ledger is summed.
 * @param warehouseId The location whose ledger is summed.
 * @returns The exact sum of the movements recorded for the pair, which is what the level must hold.
 */
function ledgerSum(store: IStore, variantId: string, warehouseId: string): string {
	return store.movements
		.filter((movement) => same(movement.variantId, variantId) && same(movement.warehouseId, warehouseId))
		.reduce<string>((total, movement) => addDecimalStrings(total, movement.quantity ?? 0), '0');
}

describe('StockLedgerService — the derived balances of the ledger', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('derives the contents of a bin from the movements recorded against it', async () => {
		const { service } = fixture({
			movements: [
				movementRow({ binId: BIN, quantity: 12 }),
				movementRow({ binId: BIN, quantity: -5 }),
				movementRow({ binId: BIN, variantId: OTHER_VARIANT, quantity: 3 }),
				movementRow({ binId: OTHER_BIN, quantity: 99 })
			]
		});

		expect(await service.readBinBalances([BIN])).toEqual([
			{ binId: BIN, variantId: VARIANT, quantity: '7.000000' },
			{ binId: BIN, variantId: OTHER_VARIANT, quantity: '3.000000' }
		]);
	});

	it('answers nothing for bins the ledger never recorded a movement for', async () => {
		// The absent case: the read is asked about a position nothing was ever recorded against, which is
		// a different fact from a position whose movements net to zero.
		const { service } = fixture({ movements: [movementRow({ binId: BIN, quantity: 4 })] });

		expect(await service.readBinBalances([OTHER_BIN])).toEqual([]);
		expect(await service.readBinBalances([])).toEqual([]);
	});

	it('reports a pair whose movements net to zero, because the ledger recorded it', async () => {
		// The movements exist and cancel, so the pair is reported at zero: the ledger’s own statement about
		// the position, and the row a count compares a level’s claim against.
		const { service } = fixture({
			movements: [movementRow({ binId: BIN, quantity: 4 }), movementRow({ binId: BIN, quantity: -4 })]
		});

		expect(await service.readBinBalances([BIN])).toEqual([{ binId: BIN, variantId: VARIANT, quantity: '0.000000' }]);
	});

	it('reports the balance of one pair, and answers nothing for a pair with no ledger', async () => {
		const { service } = fixture({
			movements: [movementRow({ binId: BIN, quantity: 7 }), movementRow({ binId: OTHER_BIN, quantity: 100 })]
		});

		expect(await service.readBinBalance({ warehouseId: WAREHOUSE, variantId: VARIANT, binId: BIN })).toMatchObject({
			binId: BIN,
			variantId: VARIANT,
			quantity: '7.000000'
		});
		// Control: a pair the ledger holds no movement for has no balance at all, rather than a zero that
		// would read as an empty position.
		expect(await service.readBinBalance({ warehouseId: WAREHOUSE, variantId: OTHER_VARIANT, binId: BIN })).toBeUndefined();
	});

	it('sums the whole location when no bin is named, movements without a bin included', async () => {
		const { service } = fixture({
			movements: [
				movementRow({ binId: BIN, quantity: 7 }),
				movementRow({ quantity: 5 }),
				movementRow({ binId: OTHER_BIN, variantId: OTHER_VARIANT, quantity: 100 })
			]
		});

		expect(await service.readBinBalance({ warehouseId: WAREHOUSE, variantId: VARIANT })).toEqual({
			variantId: VARIANT,
			quantity: '12.000000'
		});
	});

	it('reads the movements the ledger wrote without a tenant of their own, for the aggregate’s tenant', async () => {
		// The engine writes a movement without a tenant or an organization — the aggregate it was applied
		// to is the row that carries them — so a read narrowed on the movement’s own columns would report
		// every bin as empty. The fixture’s rows carry neither, exactly as the engine leaves them.
		const { service } = fixture({ movements: [movementRow({ binId: BIN, quantity: 9 })] });

		expect(await service.readBinBalances([BIN])).toEqual([{ binId: BIN, variantId: VARIANT, quantity: '9.000000' }]);
	});

	it('does not read a balance of another organization of the same tenant', async () => {
		const { service } = fixture({
			aggregates: [
				{ id: AGGREGATE, warehouseId: WAREHOUSE, tenantId: TENANT, organizationId: ORG },
				{ id: 'aggregate-theirs', warehouseId: WAREHOUSE, tenantId: TENANT, organizationId: OTHER_ORG }
			],
			movements: [
				movementRow({ binId: BIN, quantity: 7 }),
				movementRow({ id: 'movement-theirs', binId: BIN, warehouseProductId: 'aggregate-theirs', quantity: 100 })
			]
		});

		expect(await service.readBinBalances([BIN])).toEqual([{ binId: BIN, variantId: VARIANT, quantity: '7.000000' }]);
		expect(await service.readBinBalance({ warehouseId: WAREHOUSE, variantId: VARIANT, binId: BIN })).toMatchObject({
			quantity: '7.000000'
		});
	});

	it('reads a balance of the tenant-wide row every organization shares', async () => {
		// A product that names no organization belongs to the whole tenant, so the stock the ledger holds
		// against it is in scope for every organization of that tenant. This is the shape a put-away of a
		// shared product produces: with the equality alone the bin answers empty the moment after the
		// ledger recorded the units as placed there.
		const { service } = fixture({
			aggregates: [{ id: AGGREGATE, warehouseId: WAREHOUSE, tenantId: TENANT, organizationId: null }],
			movements: [movementRow({ binId: BIN, quantity: 5 })]
		});

		expect(await service.readBinBalances([BIN])).toEqual([{ binId: BIN, variantId: VARIANT, quantity: '5.000000' }]);
	});

	it('does not read a balance of another tenant', async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(OTHER_TENANT);
		const { service } = fixture({
			aggregates: [
				{ id: AGGREGATE, warehouseId: WAREHOUSE, tenantId: TENANT, organizationId: ORG },
				{ id: 'aggregate-theirs', warehouseId: WAREHOUSE, tenantId: OTHER_TENANT, organizationId: ORG }
			],
			movements: [
				movementRow({ binId: BIN, quantity: 7 }),
				movementRow({ id: 'movement-theirs', binId: BIN, warehouseProductId: 'aggregate-theirs', quantity: 100 })
			]
		});

		expect(await service.readBinBalances([BIN])).toEqual([{ binId: BIN, variantId: VARIANT, quantity: '100.000000' }]);
	});
});

describe('StockLedgerService — what the level rows claim sits in a bin', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('reports the quantity of every level that names one of the bins', async () => {
		const { service } = fixture({
			levels: [
				levelRow({ id: 'level-1', binId: BIN, quantity: 4 }),
				levelRow({ id: 'level-2', variantId: OTHER_VARIANT, binId: OTHER_BIN, quantity: 3 }),
				levelRow({ id: 'level-3', variantId: 'variant-3', quantity: 99 })
			]
		});

		expect(await service.readExpectedBinBalances({ warehouseId: WAREHOUSE, binIds: [BIN, OTHER_BIN] })).toEqual([
			{ binId: BIN, variantId: VARIANT, quantity: '4.000000' },
			{ binId: OTHER_BIN, variantId: OTHER_VARIANT, quantity: '3.000000' }
		]);
	});

	it('claims the levels of a tenant-wide row for every organization that shares it', async () => {
		// The claim side of the same reading: a level of a product the tenant shares is claimed at its bin
		// whichever organization of the tenant is counting it.
		const { service } = fixture({
			aggregates: [{ id: AGGREGATE, warehouseId: WAREHOUSE, tenantId: TENANT, organizationId: null }],
			levels: [levelRow({ id: 'level-1', binId: BIN, quantity: 4 })]
		});

		expect(await service.readExpectedBinBalances({ warehouseId: WAREHOUSE, binIds: [BIN] })).toEqual([
			{ binId: BIN, variantId: VARIANT, quantity: '4.000000' }
		]);
	});

	it('claims nothing for a level that names no bin, or is stocked at another location', async () => {
		const { service } = fixture({
			aggregates: [
				{ id: AGGREGATE, warehouseId: WAREHOUSE, tenantId: TENANT, organizationId: ORG },
				{ id: 'aggregate-elsewhere', warehouseId: OTHER_WAREHOUSE, tenantId: TENANT, organizationId: ORG }
			],
			levels: [
				levelRow({ id: 'level-1', quantity: 4 }),
				levelRow({ id: 'level-2', variantId: OTHER_VARIANT, binId: BIN, warehouseProductId: 'aggregate-elsewhere' })
			]
		});

		expect(await service.readExpectedBinBalances({ warehouseId: WAREHOUSE, binIds: [BIN] })).toEqual([]);
		expect(await service.readExpectedBinBalances({ warehouseId: WAREHOUSE, binIds: [] })).toEqual([]);
	});

	it('does not report a claim of another organization', async () => {
		const { service } = fixture({
			aggregates: [
				{ id: AGGREGATE, warehouseId: WAREHOUSE, tenantId: TENANT, organizationId: ORG },
				{ id: 'aggregate-theirs', warehouseId: WAREHOUSE, tenantId: TENANT, organizationId: OTHER_ORG }
			],
			levels: [
				levelRow({ id: 'level-mine', binId: BIN, quantity: 4 }),
				levelRow({ id: 'level-theirs', binId: BIN, warehouseProductId: 'aggregate-theirs', quantity: 100 })
			]
		});

		expect(await service.readExpectedBinBalances({ warehouseId: WAREHOUSE, binIds: [BIN] })).toEqual([
			{ binId: BIN, variantId: VARIANT, quantity: '4.000000' }
		]);
	});
});

describe('StockLedgerService — where a variant is normally kept', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('reports the home bin the level names, with the quantity the level holds', async () => {
		const { service } = fixture({ levels: [levelRow({ binId: BIN, quantity: 12 })] });

		expect(await service.resolveHomeBin({ warehouseId: WAREHOUSE, variantId: VARIANT })).toEqual({
			binId: BIN,
			quantity: '12.000000'
		});
	});

	it('reports the quantity of a level that names no home bin, without inventing one', async () => {
		// The level states that the location keeps this stock somewhere it has not been organised into a
		// bin for. A bin chosen from the movement history would be a guess the ledger does not make.
		const { service } = fixture({ levels: [levelRow({ quantity: 5 })] });

		expect(await service.resolveHomeBin({ warehouseId: WAREHOUSE, variantId: VARIANT })).toEqual({ quantity: '5.000000' });
	});

	it('answers nothing for a variant that is not stocked at the location', async () => {
		const { service } = fixture({ levels: [levelRow({ binId: BIN, quantity: 5 })] });

		expect(await service.resolveHomeBin({ warehouseId: WAREHOUSE, variantId: OTHER_VARIANT })).toBeUndefined();
		expect(await service.resolveHomeBin({ warehouseId: OTHER_WAREHOUSE, variantId: VARIANT })).toBeUndefined();
	});

	it('does not report the home bin of another organization', async () => {
		const { service } = fixture({
			aggregates: [
				{ id: AGGREGATE, warehouseId: WAREHOUSE, tenantId: TENANT, organizationId: ORG },
				{ id: 'aggregate-theirs', warehouseId: WAREHOUSE, tenantId: TENANT, organizationId: OTHER_ORG }
			],
			levels: [levelRow({ binId: BIN, warehouseProductId: 'aggregate-theirs', quantity: 100 })]
		});

		expect(await service.resolveHomeBin({ warehouseId: WAREHOUSE, variantId: VARIANT })).toBeUndefined();
	});
});

describe('StockLedgerService — the movements a caller states', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('restocks units through the engine, and the level becomes the sum of its movements', async () => {
		const { service, store } = fixture(stocked(6));

		const result = await service.recordMovement({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			quantity: '4',
			kind: StockMovementType.RETURN,
			referenceType: 'ORDER_RETURN',
			referenceId: REFERENCE,
			reason: 'Returned goods went back into sellable stock.'
		});

		const written = movementsOf(store, 'ORDER_RETURN');

		expect(result.quantityAfter).toBe('10.000000');
		expect(result.movementId).toBe(written[0].id);
		expect(written[0]).toMatchObject({
			type: StockMovementType.RETURN,
			quantity: 4,
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			referenceType: 'ORDER_RETURN',
			referenceId: REFERENCE
		});
		// The ledger’s invariant, stated exactly: what the level holds is what its movements sum to.
		expect(compareDecimalStrings(ledgerSum(store, VARIANT, WAREHOUSE), store.levels[0].quantity)).toBe(0);
	});

	it('answers with the exact quantity a removal leaves, at the storage scale', async () => {
		// `0.3 − 0.1` as a double is below `0.2`; the movement’s delta is the caller’s exact decimal and
		// the quantity reported is the level’s own value, so the answer and the level row agree exactly.
		const { service, store } = fixture(stocked(0.3));

		const result = await service.recordMovement({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			quantity: '-0.1',
			kind: StockMovementType.SALE,
			referenceType: 'ORDER',
			referenceId: REFERENCE
		});

		expect(result.quantityAfter).toBe('0.200000');
		expect(Number(result.quantityAfter)).toBe(0.2);
		expect(compareDecimalStrings(ledgerSum(store, VARIANT, WAREHOUSE), store.levels[0].quantity)).toBe(0);
	});

	it('writes a movement for a bin, and the bin then holds it', async () => {
		// The write and the derived read are the same ledger: what a short pick or a count writes back is
		// what the bin read reports, under the same scope.
		const { service } = fixture(stocked(5));

		await service.recordMovement({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			quantity: '-2',
			kind: StockMovementType.ADJUSTMENT,
			binId: BIN,
			referenceType: 'PICK_LIST_LINE',
			referenceId: REFERENCE,
			reason: 'SHORT_PICK'
		});

		expect(await service.readBinBalances([BIN])).toEqual([{ binId: BIN, variantId: VARIANT, quantity: '-2.000000' }]);
	});

	it('records a write-off the caller states as an event without moving the level, and keeps the quantity in the row', async () => {
		// A return line that is not restockable states an event-only write-off and leaves the level
		// unchanged: the units came back without ever entering sellable stock. The quantity the caller
		// stated is kept on the row, so the ledger still says how many units the event was about.
		const { service, store } = fixture(stocked(4));

		const result = await service.recordMovement({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			quantity: '2',
			kind: StockMovementType.WRITE_OFF,
			eventOnly: true,
			referenceType: 'ORDER_RETURN',
			referenceId: REFERENCE,
			reason: 'Returned goods were not restocked.'
		});

		const written = movementsOf(store, 'ORDER_RETURN')[0];

		expect(result.quantityAfter).toBe('4.000000');
		expect(store.levels[0].quantity).toBe(4);
		expect(written).toMatchObject({ type: StockMovementType.WRITE_OFF, quantity: 0 });
		// The row records the event, and says how many units it was about: the level is unchanged because
		// those units never entered sellable stock, not because nothing happened.
		expect(written.quantityBefore).toBe(4);
		expect(written.quantityAfter).toBe(4);
		expect(written.note).toContain('2.000000');
		expect(compareDecimalStrings(ledgerSum(store, VARIANT, WAREHOUSE), store.levels[0].quantity)).toBe(0);
	});

	it('applies a write-off the caller states as a delta, so reversing a receipt takes its goods back out', async () => {
		// The other caller of the same kind: a goods receipt that is reversed. The receipt moved the level,
		// so the compensating write-off has to move it back — reading the kind as "no effect" would leave
		// goods the installation no longer holds in the number it sells against.
		const { service, store } = fixture(stocked(4));

		const result = await service.recordMovement({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			quantity: '-4',
			kind: StockMovementType.WRITE_OFF,
			referenceType: 'GOODS_RECEIPT',
			referenceId: REFERENCE,
			reason: 'RECEIPT_CANCELED'
		});

		const written = movementsOf(store, 'GOODS_RECEIPT')[0];

		expect(result.quantityAfter).toBe('0.000000');
		expect(store.levels[0].quantity).toBe(0);
		expect(written).toMatchObject({ type: StockMovementType.WRITE_OFF, quantity: -4 });
		// A delta movement carries no event note: its quantity is the level's change, so the row already
		// says what happened and nothing has to be kept beside it.
		expect(written.note).toBeUndefined();
		expect(compareDecimalStrings(ledgerSum(store, VARIANT, WAREHOUSE), store.levels[0].quantity)).toBe(0);
	});

	it('records a damage as an event without moving the level, so broken units are never sellable', async () => {
		const { service, store } = fixture(stocked(4));

		const result = await service.recordMovement({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			quantity: '1',
			kind: StockMovementType.DAMAGE,
			eventOnly: true,
			referenceType: 'ORDER_RETURN',
			referenceId: REFERENCE,
			reason: 'Returned goods arrived damaged.'
		});

		expect(result.quantityAfter).toBe('4.000000');
		expect(store.levels[0].quantity).toBe(4);
		expect(movementsOf(store, 'ORDER_RETURN')[0]).toMatchObject({ type: StockMovementType.DAMAGE, quantity: 0 });
		// Control: the compensating movement of the same kind is stated as an event too, so it moves the
		// level just as little and a receipt that is compensated leaves the level exactly as it was found.
		await service.recordMovement({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			quantity: '-1',
			kind: StockMovementType.DAMAGE,
			eventOnly: true,
			referenceType: 'ORDER_RETURN',
			referenceId: REFERENCE,
			reason: 'RECEIVE_COMPENSATED'
		});

		expect(store.levels[0].quantity).toBe(4);
		expect(movementsOf(store, 'ORDER_RETURN')).toHaveLength(2);
		expect(compareDecimalStrings(ledgerSum(store, VARIANT, WAREHOUSE), store.levels[0].quantity)).toBe(0);
	});

	it('brings a quantity of finer scale to the ledger’s scale, and writes that', async () => {
		const { service, store } = fixture(stocked(1));

		const result = await service.recordMovement({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			quantity: '2.0000004',
			kind: StockMovementType.RECEIPT,
			referenceType: 'GOODS_RECEIPT',
			referenceId: REFERENCE
		});

		// The column holds six fractional digits, so the movement records the value the column can hold and
		// the level is left holding exactly that.
		expect(movementsOf(store, 'GOODS_RECEIPT')[0].quantity).toBe(2);
		expect(result.quantityAfter).toBe('3.000000');
		expect(compareDecimalStrings(ledgerSum(store, VARIANT, WAREHOUSE), store.levels[0].quantity)).toBe(0);
	});

	it('refuses a movement whose kind the ledger does not have, before writing anything', async () => {
		const { service, store } = fixture(stocked(4));

		await expect(
			service.recordMovement({
				warehouseId: WAREHOUSE,
				variantId: VARIANT,
				quantity: '1',
				kind: 'SHRINKAGE',
				referenceType: 'ORDER_RETURN',
				referenceId: REFERENCE
			})
		).rejects.toMatchObject({ response: { code: 'STOCK_INVARIANT_VIOLATION', details: { kind: 'SHRINKAGE' } } });
		expect(movementsOf(store, 'ORDER_RETURN')).toEqual([]);
		expect(store.levels[0].quantity).toBe(4);
	});

	it('refuses a movement that does not name what it moved or what caused it', async () => {
		const { service, store } = fixture(stocked(4));

		await expect(
			service.recordMovement({
				warehouseId: WAREHOUSE,
				variantId: VARIANT,
				kind: StockMovementType.RETURN
			} as never)
		).rejects.toMatchObject({ response: { code: 'STOCK_INVARIANT_VIOLATION' } });
		await expect(
			service.recordMovement({
				warehouseId: WAREHOUSE,
				variantId: VARIANT,
				quantity: '1',
				kind: StockMovementType.RETURN,
				referenceType: 'ORDER_RETURN'
			} as never)
		).rejects.toMatchObject({ response: { code: 'STOCK_INVARIANT_VIOLATION' } });
		await expect(
			service.recordMovement({
				warehouseId: WAREHOUSE,
				quantity: '1',
				kind: StockMovementType.RETURN,
				referenceType: 'ORDER_RETURN',
				referenceId: REFERENCE
			} as never)
		).rejects.toMatchObject({ response: { code: 'STOCK_INVARIANT_VIOLATION' } });
		expect(movementsOf(store, 'ORDER_RETURN')).toEqual([]);
	});

	it('refuses a quantity that is not an exact decimal', async () => {
		const { service, store } = fixture(stocked(4));

		await expect(
			service.recordMovement({
				warehouseId: WAREHOUSE,
				variantId: VARIANT,
				quantity: '1e-7',
				kind: StockMovementType.RETURN,
				referenceType: 'ORDER_RETURN',
				referenceId: REFERENCE
			})
		).rejects.toMatchObject({ response: { code: 'STOCK_INVARIANT_VIOLATION' } });
		expect(movementsOf(store, 'ORDER_RETURN')).toEqual([]);
	});

	it('refuses a movement the engine refuses, and leaves the level where it was', async () => {
		// The engine’s own guard is the last word: a removal larger than the level holds is refused by the
		// write path, not by this seam, and nothing is written when it is.
		const { service, store } = fixture(stocked(1));

		await expect(
			service.recordMovement({
				warehouseId: WAREHOUSE,
				variantId: VARIANT,
				quantity: '-2',
				kind: StockMovementType.SALE,
				referenceType: 'ORDER',
				referenceId: REFERENCE
			})
		).rejects.toThrow(/INV-05/);
		expect(movementsOf(store, 'ORDER')).toEqual([]);
		expect(store.levels[0].quantity).toBe(1);
	});
});

describe('StockLedgerService — a relocation between two bins', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('writes the pair, moves the quantity between the bins and leaves the level where it was', async () => {
		const { service, store } = fixture(stocked(10));

		const results = await service.relocate({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			fromBinId: BIN,
			toBinId: OTHER_BIN,
			quantity: '4',
			referenceType: 'WAREHOUSE_BIN_TRANSFER',
			referenceId: REFERENCE
		});

		const legs = movementsOf(store, 'WAREHOUSE_BIN_TRANSFER');

		expect(results.map((result) => result.quantityAfter)).toEqual(['6.000000', '10.000000']);
		expect(legs.map((movement) => [movement.type, movement.quantity, movement.binId])).toEqual([
			[StockMovementType.TRANSFER_OUT, -4, BIN],
			[StockMovementType.TRANSFER_IN, 4, OTHER_BIN]
		]);
		// The location holds what it held, and the ledger says where it is kept.
		expect(store.levels[0].quantity).toBe(10);
		expect(await service.readBinBalances([BIN])).toEqual([{ binId: BIN, variantId: VARIANT, quantity: '-4.000000' }]);
		expect(await service.readBinBalances([OTHER_BIN])).toEqual([
			{ binId: OTHER_BIN, variantId: VARIANT, quantity: '4.000000' }
		]);
		// Both legs are one write: the same transaction carries them.
		expect(legs).toHaveLength(2);
		expect(legs[0].__transaction).toBe(legs[1].__transaction);
		expect(store.transactions).toHaveLength(1);
		expect(compareDecimalStrings(ledgerSum(store, VARIANT, WAREHOUSE), store.levels[0].quantity)).toBe(0);
	});

	it('writes neither movement when the leg that would overdraw the level is refused', async () => {
		// A pair is one transaction or none: a relocation that cannot be completed leaves the level and the
		// ledger exactly as they were found, rather than half a move nobody can explain.
		const { service, store } = fixture(stocked(1));

		await expect(
			service.relocate({
				warehouseId: WAREHOUSE,
				variantId: VARIANT,
				fromBinId: BIN,
				toBinId: OTHER_BIN,
				quantity: '4',
				referenceType: 'WAREHOUSE_BIN_TRANSFER',
				referenceId: REFERENCE
			})
		).rejects.toThrow(/INV-05/);
		expect(movementsOf(store, 'WAREHOUSE_BIN_TRANSFER')).toEqual([]);
		expect(store.levels[0].quantity).toBe(1);
		expect(store.transactions).toEqual([]);
	});

	it('refuses a relocation between a bin and itself', async () => {
		const { service, store } = fixture(stocked(4));

		await expect(
			service.relocate({
				warehouseId: WAREHOUSE,
				variantId: VARIANT,
				fromBinId: BIN,
				toBinId: BIN,
				quantity: '1',
				referenceType: 'WAREHOUSE_BIN_TRANSFER',
				referenceId: REFERENCE
			})
		).rejects.toMatchObject({ response: { code: 'STOCK_TRANSFER_SAME_LOCATION' } });
		expect(movementsOf(store, 'WAREHOUSE_BIN_TRANSFER')).toEqual([]);
	});

	it('refuses a relocation that states no positive quantity, or names no bin', async () => {
		const { service, store } = fixture(stocked(4));
		const move = {
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			fromBinId: BIN,
			toBinId: OTHER_BIN,
			referenceType: 'WAREHOUSE_BIN_TRANSFER',
			referenceId: REFERENCE
		};

		await expect(service.relocate({ ...move, quantity: '0' })).rejects.toMatchObject({
			response: { code: 'STOCK_INVARIANT_VIOLATION' }
		});
		await expect(service.relocate({ ...move, quantity: '-1' })).rejects.toMatchObject({
			response: { code: 'STOCK_INVARIANT_VIOLATION' }
		});
		await expect(service.relocate({ ...move, quantity: '1', toBinId: undefined } as never)).rejects.toMatchObject({
			response: { code: 'STOCK_INVARIANT_VIOLATION' }
		});
		expect(movementsOf(store, 'WAREHOUSE_BIN_TRANSFER')).toEqual([]);
		expect(store.transactions).toEqual([]);
	});
});

describe('StockLedgerService — the put-away that walks received units into a bin', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('records the arrival in the bin and names it the variant’s home, which nothing else writes', async () => {
		// The home bin is `warehouse_product_variant.binId` — what a pick reads to know where to send the
		// picker — and the put-away is the only operation that writes it. Before this, the column was
		// declared, indexed, read by the ledger's own home-bin answer, and written by nobody.
		const { service, store } = fixture(stocked(0));

		const result = await service.putAway({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			binId: BIN,
			quantity: '6',
			referenceType: 'GOODS_RECEIPT',
			referenceId: REFERENCE
		});

		const legs = movementsOf(store, 'GOODS_RECEIPT');

		expect(legs.map((movement) => [movement.type, movement.quantity, movement.binId])).toEqual([
			[StockMovementType.TRANSFER_IN, 6, BIN]
		]);
		expect(result.transferOutMovementId).toBeUndefined();
		expect(result.transferInMovementId).toBe(legs[0].id);
		expect(result.binId).toBe(BIN);
		expect(result.quantityAfter).toBe('6.000000');
		// The level holds the units and names the bin they are in.
		expect(store.levels[0].quantity).toBe(6);
		expect(store.levels[0].binId).toBe(BIN);
		expect(await service.resolveHomeBin({ warehouseId: WAREHOUSE, variantId: VARIANT })).toMatchObject({
			binId: BIN,
			quantity: '6.000000'
		});
		expect(compareDecimalStrings(ledgerSum(store, VARIANT, WAREHOUSE), store.levels[0].quantity)).toBe(0);
	});

	it('walks the units out of the receiving bin when they were recorded in one', async () => {
		// A receipt that lands in an addressed receiving area is stock the ledger has, so the walk leaves
		// it; the pair nets to zero at the location, as a relocation does.
		const { service, store } = fixture(stocked(6, { binId: OTHER_BIN }));

		const result = await service.putAway({
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			fromBinId: OTHER_BIN,
			binId: BIN,
			quantity: '6',
			referenceType: 'GOODS_RECEIPT',
			referenceId: REFERENCE
		});

		const legs = movementsOf(store, 'GOODS_RECEIPT');

		expect(legs.map((movement) => [movement.type, movement.quantity, movement.binId])).toEqual([
			[StockMovementType.TRANSFER_OUT, -6, OTHER_BIN],
			[StockMovementType.TRANSFER_IN, 6, BIN]
		]);
		expect(result.transferOutMovementId).toBe(legs[0].id);
		// The location holds what it held and the home bin moved.
		expect(store.levels[0].quantity).toBe(6);
		expect(store.levels[0].binId).toBe(BIN);
		expect(legs[0].__transaction).toBe(legs[1].__transaction);
		expect(store.transactions).toHaveLength(1);
		expect(compareDecimalStrings(ledgerSum(store, VARIANT, WAREHOUSE), store.levels[0].quantity)).toBe(0);
	});

	it('refuses a walk that arrives where it started, or that places nothing', async () => {
		const { service, store } = fixture(stocked(6));

		await expect(
			service.putAway({
				warehouseId: WAREHOUSE,
				variantId: VARIANT,
				fromBinId: BIN,
				binId: BIN,
				quantity: '1',
				referenceType: 'GOODS_RECEIPT',
				referenceId: REFERENCE
			})
		).rejects.toMatchObject({ response: { code: 'STOCK_TRANSFER_SAME_LOCATION' } });

		for (const quantity of ['0', '-3']) {
			await expect(
				service.putAway({
					warehouseId: WAREHOUSE,
					variantId: VARIANT,
					binId: BIN,
					quantity,
					referenceType: 'GOODS_RECEIPT',
					referenceId: REFERENCE
				})
			).rejects.toMatchObject({ response: { code: 'STOCK_INVARIANT_VIOLATION' } });
		}

		expect(movementsOf(store, 'GOODS_RECEIPT')).toEqual([]);
		expect(store.levels[0].binId).toBeUndefined();
		expect(store.transactions).toEqual([]);
	});
});
