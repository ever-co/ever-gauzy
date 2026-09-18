/**
 * Two module boundaries are doubled here, for the reason the package’s other suites state: `@gauzy/core`
 * boots the whole application graph from its barrel — configuration, the ORM, the job registry, the
 * module scanner — none of which a read of level rows needs and none of which is available outside a
 * running application, and `@gauzy/config` reads the process environment at import time. **The service
 * under test is the real one**, together with the real ledger engine it asks for a level’s policy and
 * the real decimal primitives it sums with: what is substituted is the entity identity the read names
 * and the repository double that answers the statements the read issues.
 *
 * The engine is constructed with no connection at all. The only method this suite reaches is
 * `toAvailability`, which derives a policy from a row it is handed and touches no connection.
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

import { RequestContext } from '@gauzy/core';
import { StockLevelService } from './../stock-level/stock-level.service';
import { StockAvailabilityService } from './stock-availability.service';
import { UNBOUNDED_SELLABLE } from './stock-availability.types';

/**
 * What may be sold of a variant, as a package that does not own stock reads it.
 *
 * The answer is what a caller measures its own quantity against, so the cases below are about the
 * three ways it can be wrong rather than merely inconvenient:
 *
 * - **The quantity is exact.** On hand, held and buffer are summed as exact decimals, because the
 *   caller compares the answer with a quantity at a boundary — a line of exactly what is left — and
 *   `0.3 − 0.1` evaluated as a double is below `0.2`, which would refuse the last available unit.
 * - **An uncounted level is not a ceiling.** A level the ledger lets a hold of any size land on is
 *   reported as unbounded; reporting its stored quantity would refuse every sale of that variant.
 * - **A variant that is not stocked is not answered for.** Nothing is reported for a location that
 *   holds none of it — including the whole-network question about a variant stocked nowhere — because
 *   a number invented there would be acted on as stock.
 *
 * Tenancy is asserted as well: the levels of another tenant, and of another organization of the same
 * tenant, are not summed into the answer, because a read that crossed either would be a data leak
 * rather than a wrong number in a feature.
 */

const TENANT = 'tenant-1';
const ORG = 'organization-1';
const OTHER_TENANT = 'tenant-2';
const OTHER_ORG = 'organization-2';
const VARIANT = 'variant-1';
const OTHER_VARIANT = 'variant-2';
const WAREHOUSE = 'warehouse-1';
const OTHER_WAREHOUSE = 'warehouse-2';

/** One `warehouse_product_variant` row with the aggregate it hangs from, as this read sees it. */
interface ILevelRow {
	id: string;
	variantId: string;
	quantity?: number;
	reservedQuantity?: number;
	safetyStock?: number;
	incomingQuantity?: number;
	isUnlimited?: boolean;
	allowBackorder?: boolean;
	backorderLimit?: number | null;
	aggregate: { warehouseId: string; tenantId?: string; organizationId?: string };
}

/** One condition the read stated. */
interface ICondition {
	sql: string;
	params: Record<string, any>;
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
 * @param row A stored level row.
 * @param conditions The conditions the read stated.
 * @returns Whether the database would have returned the row.
 * @throws Error when the read states a shape this double does not model, rather than answering wrongly.
 */
function matches(row: ILevelRow, conditions: ICondition[]): boolean {
	return conditions.every(({ sql, params }) => {
		if (/aggregate\.warehouseId/.test(sql)) {
			return same(row.aggregate.warehouseId, params.warehouseId);
		}
		if (/aggregate\.tenantId/.test(sql)) {
			return same(row.aggregate.tenantId, params.tenantId);
		}
		if (/aggregate\.organizationId/.test(sql)) {
			return same(row.aggregate.organizationId, params.organizationId);
		}
		if (/level\.variantId/.test(sql)) {
			return same(row.variantId, params.variantId);
		}
		if (/level\.id/.test(sql)) {
			return same(row.id, params.id);
		}

		throw new Error(`the in-memory level read does not implement the condition "${sql}"`);
	});
}

/**
 * The joined level read, answered from the rows it is given.
 *
 * The double models the statements the service actually issues — the join onto the aggregate, the
 * variant and location conditions, and the scope conditions stated on the aggregate — and it carries
 * the aggregate’s location and scope onto the row it returns, under the spelling the real query builder
 * produces for a joined column.
 */
function levelRead(rows: ILevelRow[], reads: ICondition[][]) {
	const conditions: ICondition[] = [];
	const query: any = {
		innerJoin: () => query,
		select: () => query,
		addSelect: () => query,
		limit: () => query,
		orderBy: () => query,
		where: (sql: string, params: Record<string, any> = {}) => {
			conditions.push({ sql, params });

			return query;
		},
		andWhere: (sql: string, params: Record<string, any> = {}) => {
			conditions.push({ sql, params });

			return query;
		},
		getMany: async () => {
			reads.push(conditions.map((condition) => ({ ...condition })));

			return rows
				.filter((row) => matches(row, conditions))
				.map((row) => ({ ...row, warehouseId: row.aggregate.warehouseId }));
		},
		getOne: async () => {
			reads.push(conditions.map((condition) => ({ ...condition })));

			const found = rows.filter((row) => matches(row, conditions))[0];

			return found ? { ...found, warehouseId: found.aggregate.warehouseId } : null;
		}
	};

	return query;
}

/**
 * @param rows The `warehouse_product_variant` rows, each with the aggregate it hangs from.
 * @returns The service under test, wired to the double, and the conditions each read stated.
 */
function fixture(rows: ILevelRow[] = []) {
	const reads: ICondition[][] = [];
	const builder = () => levelRead(rows, reads);
	const repository = {
		createQueryBuilder: builder,
		// The read goes through the repository’s manager, which is the read the ledger’s own lookups make.
		manager: { createQueryBuilder: builder }
	};
	const engine = new StockLevelService(null as never);

	return {
		reads,
		engine,
		service: new StockAvailabilityService(repository as never, engine)
	};
}

/** A level of the fixture variant, at a location of the caller’s own scope. */
const level = (overrides: Partial<ILevelRow> = {}): ILevelRow => ({
	id: 'level-1',
	variantId: VARIANT,
	quantity: 0,
	reservedQuantity: 0,
	safetyStock: 0,
	incomingQuantity: 0,
	isUnlimited: false,
	allowBackorder: false,
	backorderLimit: null,
	aggregate: { warehouseId: WAREHOUSE, tenantId: TENANT, organizationId: ORG },
	...overrides
});

describe('StockAvailabilityService — what may be sold of a variant', () => {
	afterEach(() => jest.restoreAllMocks());

	it('reports what is on hand less what is held and less the unsellable buffer', async () => {
		const { service } = fixture([level({ quantity: 10, reservedQuantity: 2, safetyStock: 1 })]);

		expect(await service.availabilityOf({ variantId: VARIANT, warehouseId: WAREHOUSE })).toMatchObject({
			sellableQuantity: 7,
			allowBackorder: false
		});
	});

	it('answers with the exact decimal at the boundary the caller compares at', async () => {
		// `0.3 − 0.1` evaluated as a double is `0.19999999999999998`, which is below the `0.2` a caller
		// asks for: the last unit the level can serve would be refused. The sum is taken over the exact
		// decimal texts, so the answer is the number the three columns actually say.
		const { service } = fixture([level({ quantity: 0.3, reservedQuantity: 0.1 })]);

		const availability = await service.availabilityOf({ variantId: VARIANT, warehouseId: WAREHOUSE });

		expect(availability.sellableQuantity).toBe(0.2);
		expect(availability.sellableQuantity >= 0.2).toBe(true);
	});

	it('reports a buffer that exceeds what is held rather than hiding it', async () => {
		// The buffer is a floor the stock is below, and the answer says so: clamping at zero would report
		// stock that may not be sold.
		const { service } = fixture([level({ quantity: 1, safetyStock: 3 })]);

		expect(await service.availabilityOf({ variantId: VARIANT, warehouseId: WAREHOUSE })).toMatchObject({
			sellableQuantity: -2
		});
	});

	it('reports the backorder policy of the level, and its ceiling', async () => {
		const { service } = fixture([level({ quantity: 1, allowBackorder: true, backorderLimit: 5 })]);

		expect(await service.availabilityOf({ variantId: VARIANT, warehouseId: WAREHOUSE })).toMatchObject({
			sellableQuantity: 1,
			allowBackorder: true,
			backorderLimit: 5
		});
	});

	it('reports a backorder with no stated ceiling as a bound no quantity can exceed', async () => {
		// The ledger applies a policy with no limit without one, so a missing ceiling is not a ceiling of
		// zero: reporting zero would refuse every quantity past the stock on a level that accepts them.
		const { service } = fixture([level({ quantity: 1, allowBackorder: true, backorderLimit: null })]);

		expect(await service.availabilityOf({ variantId: VARIANT, warehouseId: WAREHOUSE })).toMatchObject({
			allowBackorder: true,
			backorderLimit: UNBOUNDED_SELLABLE
		});
	});

	it('reports an uncounted level as unbounded rather than as its stored quantity', async () => {
		// Control first: the same row counted is a level that may sell nothing, which is what the ledger
		// would refuse a hold against — and what a caller must be told.
		const counted = fixture([level({ quantity: 0, isUnlimited: false })]);

		expect((await counted.service.availabilityOf({ variantId: VARIANT, warehouseId: WAREHOUSE })).sellableQuantity).toBe(0);

		// The uncounted level takes a hold of any size, so its stored quantity is not a ceiling.
		const uncounted = fixture([level({ quantity: 0, isUnlimited: true })]);

		expect(await uncounted.service.availabilityOf({ variantId: VARIANT, warehouseId: WAREHOUSE })).toMatchObject({
			sellableQuantity: UNBOUNDED_SELLABLE
		});
	});

	it('answers nothing for a variant that is not stocked at the location', async () => {
		const { service } = fixture([level({ aggregate: { warehouseId: OTHER_WAREHOUSE, tenantId: TENANT, organizationId: ORG } })]);

		expect(await service.availabilityOf({ variantId: VARIANT, warehouseId: WAREHOUSE })).toBeNull();
	});

	it('answers nothing for a variant that is not stocked anywhere the question reaches', async () => {
		const { service } = fixture([level({ variantId: OTHER_VARIANT })]);

		expect(await service.availabilityOf({ variantId: VARIANT })).toBeNull();
		expect(await service.availabilityOf({ variantId: VARIANT, warehouseId: WAREHOUSE })).toBeNull();
	});

	it('answers nothing, rather than raising, for a question that names no variant', async () => {
		// The caller’s own report reads a null as "nothing can be sold here"; an exception would turn the
		// report into a failed request.
		const { service, reads } = fixture([level({ quantity: 5 })]);

		expect(await service.availabilityOf({ variantId: undefined })).toBeNull();
		expect(reads).toEqual([]);
	});

	it('sums every location the variant is stocked at when no location is named', async () => {
		// The whole-network question is the same reading the low-stock scan applies when its rule names no
		// location: what may be sold somewhere is the sum of what each location may sell.
		const { service } = fixture([
			level({ id: 'level-1', quantity: 10, reservedQuantity: 2, safetyStock: 1 }),
			level({ id: 'level-2', quantity: 5, aggregate: { warehouseId: OTHER_WAREHOUSE, tenantId: TENANT, organizationId: ORG } })
		]);

		expect(await service.availabilityOf({ variantId: VARIANT })).toMatchObject({ sellableQuantity: 12 });
		// Control: the same caller asking about one location is answered with that location alone.
		expect(await service.availabilityOf({ variantId: VARIANT, warehouseId: OTHER_WAREHOUSE })).toMatchObject({
			sellableQuantity: 5
		});
	});

	it('reports a backorder across the network when one of the locations accepts one', async () => {
		const { service } = fixture([
			level({ id: 'level-1', quantity: 1, allowBackorder: false }),
			level({
				id: 'level-2',
				quantity: 1,
				allowBackorder: true,
				backorderLimit: 4,
				aggregate: { warehouseId: OTHER_WAREHOUSE, tenantId: TENANT, organizationId: ORG }
			})
		]);

		expect(await service.availabilityOf({ variantId: VARIANT })).toMatchObject({
			sellableQuantity: 2,
			allowBackorder: true,
			backorderLimit: 4
		});
	});

	it('does not sum a level of another organization into the answer', async () => {
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);
		const { service, reads } = fixture([
			level({ id: 'level-mine', quantity: 5, aggregate: { warehouseId: WAREHOUSE, tenantId: TENANT, organizationId: OTHER_ORG } }),
			level({ id: 'level-theirs', quantity: 100 })
		]);

		expect(await service.availabilityOf({ variantId: VARIANT })).toMatchObject({ sellableQuantity: 5 });
		expect(reads[0].map((condition) => condition.sql)).toEqual(
			expect.arrayContaining(['aggregate.tenantId = :tenantId', 'aggregate.organizationId = :organizationId'])
		);
	});

	it('does not sum a level of another tenant into the answer', async () => {
		const { service } = fixture([
			level({ id: 'level-mine', quantity: 5 }),
			level({
				id: 'level-theirs',
				quantity: 100,
				aggregate: { warehouseId: WAREHOUSE, tenantId: OTHER_TENANT, organizationId: ORG }
			})
		]);

		expect(await service.availabilityOf({ variantId: VARIANT })).toMatchObject({ sellableQuantity: 5 });
	});

	it('narrows a read to the caller’s location, variant and scope', async () => {
		// The conditions the read states are the answer’s provenance, so they are asserted here rather than
		// inferred from a fixture that happens to hold one row.
		const { service, reads } = fixture([level({ quantity: 5 })]);

		await service.availabilityOf({ variantId: VARIANT, warehouseId: WAREHOUSE });

		expect(reads[0].map((condition) => condition.sql)).toEqual(
			expect.arrayContaining([
				'level.variantId = :variantId',
				'aggregate.warehouseId = :warehouseId',
				'aggregate.tenantId = :tenantId',
				'aggregate.organizationId = :organizationId'
			])
		);
		expect(reads[0].find((condition) => condition.sql === 'level.variantId = :variantId').params).toEqual({
			variantId: VARIANT
		});
	});

	it('does not narrow a read for a caller with no tenant and no organization', async () => {
		// A worker, a migration or a system context reads the platform’s own stock, which is the rule the
		// ledger’s own reads follow.
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(null);
		const { service, reads } = fixture([
			level({ id: 'level-1', quantity: 5 }),
			level({ id: 'level-2', quantity: 4, aggregate: { warehouseId: OTHER_WAREHOUSE } })
		]);

		expect(await service.availabilityOf({ variantId: VARIANT })).toMatchObject({ sellableQuantity: 9 });
		expect(reads[0].map((condition) => condition.sql)).not.toEqual(
			expect.arrayContaining(['aggregate.tenantId = :tenantId', 'aggregate.organizationId = :organizationId'])
		);
	});

	it('reads a level whose location the join reported under the fallback spelling', async () => {
		// The platform’s query builders report a joined column either as `warehouseId` or under the
		// prefixed spelling; the answer must not depend on which one this installation produces.
		const rows = [
			{
				...level({ quantity: 8 }),
				warehouseId: undefined,
				__aggregate_warehouseId: WAREHOUSE
			} as unknown as ILevelRow
		];
		const repository = {
			createQueryBuilder: () => {
				const query: any = {
					innerJoin: () => query,
					select: () => query,
					addSelect: () => query,
					where: () => query,
					andWhere: () => query,
					getMany: async () => rows
				};

				return query;
			},
			manager: {
				createQueryBuilder: () => {
					const query: any = {
						innerJoin: () => query,
						select: () => query,
						addSelect: () => query,
						where: () => query,
						andWhere: () => query,
						getMany: async () => rows
					};

					return query;
				}
			}
		};
		const service = new StockAvailabilityService(repository as never, new StockLevelService(null as never));

		expect(await service.availabilityOf({ variantId: VARIANT })).toMatchObject({ sellableQuantity: 8 });
	});
});
