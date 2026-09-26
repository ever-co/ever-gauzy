/**
 * Three module boundaries are doubled here, and the reason is the same for all three.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a ledger engine needs and none of which is available
 * outside a running application; its nested `uuid` is ESM-only, so reading one entity would fail
 * under jest. `@gauzy/config` reads the process environment at import time. Both are therefore
 * doubled at the module boundary, and **the engine under test is the real one**, together with the
 * real `stock_movement` entity it writes and the real error vocabulary it refuses with.
 *
 * The platform entity classes the engine resolves level rows through are the only pieces substituted
 * by the mock: they are identity, not behaviour — `StockLevelService` uses them to name a table.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	/**
	 * The platform’s conditional write and its reader for the version a request accepted. The engine
	 * under test reaches both through the barrel being replaced here, so the shared double answers for
	 * both — the kernel’s own behaviour, decided rather than stubbed.
	 */
	const { commitVersionedUpdate, versionExpectationOf } = require('../testing/versioned-write.double');

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
		// The statement helpers are pure and dialect-driven; loading the real module here would pull
		// `@gauzy/config` and the request context into a suite that doubles the barrel on purpose.
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
		// The kernel helpers the ledger engine imports beside the entities above. Both decide rather than
		// answer unconditionally, so a versioned write is refused here as it is refused in production.
		commitVersionedUpdate,
		versionExpectationOf,
		RequestContext: {
			// The engine reads the version the current request accepted from here, and a unit test has no
			// request: the accepted version is then absent, which is the case the engine's own
			// compare-and-set covers.
			currentRequest: () => null,
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

jest.mock(
	'@gauzy/config',
	() => ({
		isMySQL: () => false,
		isPostgres: () => false,
		isSqlite: () => true,
		DatabaseTypeEnum: {
			mongodb: 'mongodb',
			sqlite: 'sqlite',
			betterSqlite3: 'better-sqlite3',
			postgres: 'postgres',
			mysql: 'mysql'
		}
	})
);

import { Product, ProductVariant, WarehouseProduct, WarehouseProductVariant } from '@gauzy/core';
import { StockMovementType, StockMovementReferenceType } from '../inventory.enums';
import { StockMovement } from '../stock-movement/stock-movement.entity';
import { StockLevelService } from './stock-level.service';

/**
 * The single write path into stock.
 *
 * Every quantity change on the platform is one call to `applyMovement`, and the properties the
 * specification fixes are the ones this suite pins (doc 09 §4.1, §15):
 *
 * - a movement changes the level by **exactly its quantity**, and the row records
 *   `quantityBefore`/`quantityAfter` computed from one read, so `quantityBefore + quantity ==
 *   quantityAfter` for every row (INV-10) and every row's `quantityBefore` is the previous row's
 *   `quantityAfter` (P4.4);
 * - the level is **the sum of its movements** (INV-01 / P4.1) — the level tables are a cache of the
 *   ledger, which is what makes the nightly reconciliation a report rather than a repair;
 * - the reserved quantity moves **independently** of the on-hand quantity: a hold is a
 *   reservation-only movement whose `quantityDelta` is zero, so the units are still on hand and only
 *   what a *new* demand may take has changed (doc 09 §4.5);
 * - availability is `quantity − reservedQuantity − safetyStock`, derived and never stored (INV-06),
 *   because a stored third number is a second answer that can drift from the two it comes from;
 * - the domain's invariants are evaluated against the locked values: on-hand never goes negative
 *   (INV-05) and a hold never exceeds the on-hand quantity without a backorder policy, nor the
 *   policy's limit (INV-07);
 * - every quantity change names the document that caused it (INV-12);
 * - the write is a **compare-and-set on the level's `version`**, preceded by a row lock where the
 *   dialect has one; a contended write is retried three times and then refused with `STOCK_CONFLICT`
 *   rather than overwriting the winner (doc 09 §4.1, §15).
 *
 * The engine is constructed directly with an in-memory double of its `DataSource`. The double states
 * the `where` and the `order` the engine states, models `SELECT ... FOR UPDATE` as the row lock the
 * dialect would take, keeps a real snapshot so a refused write leaves nothing behind, and applies
 * the compare-and-set on `version` for real — including the case where a competing writer won the row
 * between the read and the write.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const WAREHOUSE = '00000000-0000-4000-8000-000000000010';
const OTHER_WAREHOUSE = '00000000-0000-4000-8000-000000000011';
const PRODUCT = '00000000-0000-4000-8000-000000000020';
const VARIANT = '00000000-0000-4000-8000-000000000030';
const PO = '00000000-0000-4000-8000-000000000040';

type Row = Record<string, any>;

/** The tables this suite drives, as plain arrays. */
interface ITables {
	product: Row[];
	product_variant: Row[];
	warehouse_product: Row[];
	warehouse_product_variant: Row[];
	stock_movement: Row[];
	warehouse_bin: Row[];
}

/** How a competing writer interferes with the compare-and-set. */
interface IContention {
	/** How many compare-and-set attempts the competing writer wins before the engine's retry lands. */
	loseAttempts: number;
	/** What the competing writer added to the level's on-hand quantity. */
	competingQuantityDelta: number;
}

/**
 * The in-memory stand-in for the connection the engine writes through.
 *
 * It is a real (if tiny) transactional store: `transaction` copies every table, and a throw from
 * inside restores the copy, so "nothing was written" is asserted against state and not against a
 * mock's call log. A competing writer's committed change survives that restore, because in the world
 * this stands in for it was committed by another transaction.
 *
 * @param tables The whole datastore.
 * @param options.dialect The dialect the connection reports, which decides whether a row lock is taken.
 * @param options.contention How a competing writer interferes with the compare-and-set.
 */
function datastore(
	tables: ITables,
	options: { dialect?: string; contention?: IContention } = {}
) {
	const entityToTable = new Map<unknown, keyof ITables>([
		[Product, 'product'],
		// The variant table is read through the repository rather than as raw SQL: the engine needs a
		// variant's product before it can create the level for it, and the double answers the same read.
		[ProductVariant, 'product_variant'],
		[WarehouseProduct, 'warehouse_product'],
		[WarehouseProductVariant, 'warehouse_product_variant'],
		[StockMovement, 'stock_movement']
	]);
	let sequence = 0;
	/** Every raw statement the engine issued, so the lock it claims can be asserted. */
	const queries: string[] = [];
	const contention = options.contention ?? { loseAttempts: 0, competingQuantityDelta: 0 };
	let casAttempts = 0;
	let casLosses = contention.loseAttempts;
	/** What a competing writer committed, re-applied after a rollback put the store back. */
	const committedElsewhere = new Map<string, Row>();

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
		// A competing writer's commit is not the engine's to roll back.
		for (const [levelId, state] of committedElsewhere) {
			const level = tables.warehouse_product_variant.find((row) => row.id === levelId);

			if (level) {
				Object.assign(level, state);
			}
		}
	};
	const matches = (row: Row, where: Row = {}) =>
		Object.entries(where).every(([field, expected]) => {
			if (expected && typeof expected === 'object' && 'type' in (expected as Row)) {
				throw new Error(`the in-memory double does not implement the "${(expected as Row).type}" operator`);
			}

			if (expected === undefined) {
				return true;
			}

			return same(row[field], expected);
		});
	const ordered = (found: Row[], order?: Record<string, 'ASC' | 'DESC'>) => {
		const columns = Object.keys(order ?? {});

		if (!columns.length) {
			return found;
		}

		return [...found].sort((left, right) => {
			for (const column of columns) {
				const a = left[column] instanceof Date ? left[column].getTime() : left[column];
				const b = right[column] instanceof Date ? right[column].getTime() : right[column];

				if (a === b) {
					continue;
				}

				const direction = order?.[column] === 'DESC' ? -1 : 1;

				return (a > b ? 1 : -1) * direction;
			}

			return 0;
		});
	};
	/**
	 * The row lock. On Postgres and MySQL the engine states one; on SQLite it does not, because the
	 * single writer serialises transactions already. Every statement the engine issues is recorded, so
	 * the lock it claims is asserted against what it sent rather than against its prose.
	 */
	const lockRow = (params: Row) => {
		const level = tables.warehouse_product_variant.find((row) => same(row.id, params?.id));

		return level ? [{ id: level.id }] : [];
	};

	let manager: any;
	/** The root entities a joined level read has to be narrowed through. */
	const levels = (conditions: Array<{ sql: string; params: Row }>): Row[] =>
		tables.warehouse_product_variant.filter((level) => {
			for (const condition of conditions) {
				if (/aggregate\.warehouseId/.test(condition.sql)) {
					const aggregate = tables.warehouse_product.find(
						(row) => same(row.id, level.warehouseProductId)
					);

					if (!same(aggregate?.warehouseId, condition.params.warehouseId)) {
						return false;
					}
				}
				if (/level\.variantId/.test(condition.sql) && !same(level.variantId, condition.params.variantId)) {
					return false;
				}
				if (/level\.id/.test(condition.sql) && !same(level.id, condition.params.id)) {
					return false;
				}
			}

			return true;
		});
	const occurrences = (variantId: unknown, warehouseId: unknown): Row[] =>
		tables.stock_movement.filter(
			(movement) => same(movement.variantId, variantId) && same(movement.warehouseId, warehouseId)
		);
	/** What availability is: on hand, less what is held, less the floor demand may not consume. */
	const availabilityOf = (level: Row) =>
		Number(level.quantity ?? 0) - Number(level.reservedQuantity ?? 0) - Number(level.safetyStock ?? 0);
		/**
	 * Reads the delta out of the SQL the engine builds for its aggregate update.
	 *
	 * The engine binds its delta as a named parameter now (`"quantity" + :quantityDelta`, handed over
	 * through `setParameters`) and used to interpolate it as a literal; the double reads both spellings,
	 * so it pins neither. The parameters arrive from the caller because they live in the query builder's
	 * closure, not beside the in-memory tables.
	 */
	const deltaFrom = (value: unknown, boundParams: Row = {}): number => {
		const sql = typeof value === 'function' ? String((value as () => string)()) : String(value);
		const literal = /"\s*\+\s*(-?\d+(?:\.\d+)?)/.exec(sql);
		if (literal) {
			return Number(literal[1]);
		}

		const bound = /"\s*\+\s*:(\w+)/.exec(sql);
		if (bound) {
			return Number(boundParams[bound[1]]);
		}

		throw new Error(`the in-memory double cannot read a delta out of "${sql}"`);
	};

	/**
	 * The query builder double: the reads, the aggregate update and the compare-and-set the engine
	 * issues, and nothing else — an unimplemented shape throws rather than answering wrongly.
	 */
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
			setLock: () => query,
			where: (sql: string, params: Row = {}) => {
				conditions.push({ sql, params });

				return query;
			},
			andWhere: (sql: string, params: Row = {}) => {
				conditions.push({ sql, params });

				return query;
			},

			// The statement names its parameters in a call of their own, after the predicate that uses
			// them; `execute` reads one map, so they join the condition the predicate pushed.
			setParameters: (params: Row = {}) => {
				const last = conditions[conditions.length - 1];

				if (last) {
					last.params = { ...last.params, ...params };
				} else {
					conditions.push({ sql: '', params });
				}

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
					const total = occurrences(params.variantId, params.warehouseId).reduce(
						(sum, movement) => sum + Number(movement.quantity ?? 0),
						0
					);

					return { total };
				}
				if (/SUM\(level\.quantity - level\.reservedQuantity - level\.safetyStock\)/.test(expression)) {
					const available = levels(conditions).reduce((sum, level) => sum + availabilityOf(level), 0);

					return { available };
				}

				throw new Error(`the in-memory double does not implement the raw read "${expression}"`);
			},
			execute: async () => {
				if (!updateSpec) {
					throw new Error('the in-memory double only implements an UPDATE');
				}

				const id = Object.values(conditions).find((condition) => condition.params.id)?.params.id;
				const version = Object.values(conditions).find((condition) => condition.params.version)?.params
					.version;
				const table = rows(target);
				const row = table.find((candidate) => same(candidate.id, id));

				if (!row) {
					return { affected: 0 };
				}

				if (version !== undefined) {
					// The compare-and-set: a competing writer that committed between the read and the write
					// bumped the version, and this update must lose rather than overwrite it.
					casAttempts += 1;

					if (casLosses > 0) {
						casLosses -= 1;
						row.version = Number(row.version ?? 1) + 1;
						row.quantity = Number(row.quantity ?? 0) + contention.competingQuantityDelta;
						committedElsewhere.set(row.id, {
							version: row.version,
							quantity: row.quantity,
							reservedQuantity: row.reservedQuantity
						});

						return { affected: 0 };
					}
				}

				for (const [column, value] of Object.entries(updateSpec)) {
					if (typeof value === 'function') {
						row[column] = Number(row[column] ?? 0) + deltaFrom(value, conditions.reduce<Row>((all, one) => ({ ...all, ...one.params }), {}));
						continue;
					}

					row[column] = value;
				}

				return { affected: 1 };
			}
		};

		return query;
	};

	manager = {
		connection: { options: { type: options.dialect ?? 'better-sqlite3' } },
		createQueryBuilder,
		create: (entity: unknown, partial: Row) => ({ ...partial }),
		save: async (entity: unknown, rowOrRows: any) => {
			const list = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];

			for (const row of list) {
				const table = rows(entity);
				const index = row.id ? table.findIndex((candidate) => same(candidate.id, row.id)) : -1;

				if (index >= 0) {
					table[index] = { ...table[index], ...row };
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
			ordered(
				rows(entity).filter((row) => matches(row, options.where)),
				options.order
			),
		count: async (entity: unknown, options: any = {}) =>
			rows(entity).filter((row) => matches(row, options.where)).length,
		update: async (entity: unknown, id: unknown, patch: Row) => {
			const row = rows(entity).find((candidate) => same(candidate.id, id));

			if (row) {
				Object.assign(row, patch);
			}

			return { affected: row ? 1 : 0 };
		},
		delete: async (entity: unknown, criteria: unknown) => {
			const ids = Array.isArray(criteria) ? criteria : [criteria];
			const table = rows(entity);
			let affected = 0;

			for (const id of ids) {
				const index = table.findIndex((candidate) => same(candidate.id, id));

				if (index >= 0) {
					table.splice(index, 1);
					affected += 1;
				}
			}

			return { affected };
		},
		/**
		 * The raw statements the engine issues: the bin and variant lookups, the lock timeout, and the
		 * `SELECT ... FOR UPDATE` on the level row. Anything else is a statement this double does not
		 * model, and it says so instead of answering.
		 */
		query: async (sql: string, params: any[] = []) => {
			if (/SET LOCAL lock_timeout|SET SESSION innodb_lock_wait_timeout/.test(sql)) {
				queries.push(sql.trim());

				return [];
			}
			if (/FOR UPDATE/.test(sql)) {
				queries.push(sql.trim());

				return lockRow({ id: params[0] });
			}
			if (/FROM "warehouse_bin"/.test(sql)) {
				const bin = tables.warehouse_bin.find((row) => same(row.id, params[0]));

				return bin ? [{ warehouseId: bin.warehouseId }] : [];
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

	return {
		dataSource,
		tables,
		queries,
		manager,
		casAttempts: () => casAttempts,
		levelFor: (variantId: string = VARIANT, warehouseId: string = WAREHOUSE) => {
			const aggregate = tables.warehouse_product.find((row) => same(row.warehouseId, warehouseId));

			return tables.warehouse_product_variant.find(
				(row) => same(row.variantId, variantId) && same(row.warehouseProductId, aggregate?.id)
			);
		},
		aggregateFor: (warehouseId: string = WAREHOUSE) =>
			tables.warehouse_product.find((row) => same(row.warehouseId, warehouseId)),
		ledgerOf: (variantId: string = VARIANT, warehouseId: string = WAREHOUSE) =>
			tables.stock_movement.filter(
				(movement) => same(movement.variantId, variantId) && same(movement.warehouseId, warehouseId)
			)
	};
}

/** What the fixture seeds, and how the connection behaves. */
interface ILevelSeed {
	quantity?: number | string;
	reservedQuantity?: number | string;
	safetyStock?: number;
	allowBackorder?: boolean;
	backorderLimit?: number | null;
	isUnlimited?: boolean;
	version?: number;
}

/**
 * Builds the engine over one in-memory datastore, with the product of the fixture stocked at one
 * location unless the case says otherwise.
 *
 * @param options.level What the level row holds before the case runs.
 * @param options.seedLevel Whether to stock the variant at all, so the "never stocked" path is reachable.
 * @param options.withAggregate Whether the product-level aggregate row exists.
 * @param options.dialect The dialect the connection reports.
 * @param options.contention How a competing writer interferes with the compare-and-set.
 */
function levelFixture(
	options: {
		level?: ILevelSeed;
		seedLevel?: boolean;
		withAggregate?: boolean;
		dialect?: string;
		contention?: IContention;
	} = {}
) {
	const tables: ITables = {
		product: [
			{ id: PRODUCT, tenantId: TENANT, organizationId: ORG },
			{ id: 'other-product', tenantId: TENANT, organizationId: ORG }
		],
		// The variant table is where a variant says which product it belongs to, which is the answer a
		// first-time stock is resolved from when the caller names no product of its own.
		product_variant: [
			{ id: VARIANT, productId: PRODUCT },
			{ id: 'other-variant', productId: 'other-product' }
		],
		warehouse_product: [],
		warehouse_product_variant: [],
		stock_movement: [],
		warehouse_bin: []
	};
	const withAggregate = options.withAggregate ?? options.seedLevel !== false;
	const aggregate = {
		id: 'aggregate-1',
		tenantId: TENANT,
		organizationId: ORG,
		warehouseId: WAREHOUSE,
		productId: PRODUCT,
		quantity: Number(options.level?.quantity ?? 0),
		reservedQuantity: Number(options.level?.reservedQuantity ?? 0),
		incomingQuantity: 0,
		safetyStock: 0,
		allowBackorder: false,
		trackInventory: true,
		isUnlimited: false,
		version: 1
	};

	if (withAggregate) {
		tables.warehouse_product.push(aggregate);
	}
	if (options.seedLevel !== false) {
		tables.warehouse_product_variant.push({
			id: 'level-1',
			tenantId: TENANT,
			organizationId: ORG,
			warehouseProductId: withAggregate ? aggregate.id : undefined,
			variantId: VARIANT,
			quantity: options.level?.quantity ?? 0,
			reservedQuantity: options.level?.reservedQuantity ?? 0,
			incomingQuantity: 0,
			safetyStock: options.level?.safetyStock ?? 0,
			allowBackorder: options.level?.allowBackorder ?? false,
			backorderLimit: options.level?.backorderLimit ?? null,
			trackInventory: true,
			isUnlimited: options.level?.isUnlimited ?? false,
			version: options.level?.version ?? 1
		});
	}

	const store = datastore(tables, {
		dialect: options.dialect,
		contention: options.contention
	});
	const service = new StockLevelService(store.dataSource as never);

	return { service, store, tables };
}

/** One movement input, so a case states only what it is about. */
const movement = (overrides: Row = {}) => ({
	warehouseId: WAREHOUSE,
	variantId: VARIANT,
	productId: PRODUCT,
	type: StockMovementType.RECEIPT,
	quantityDelta: 5,
	reservedDelta: 0,
	referenceType: StockMovementReferenceType.PURCHASE_ORDER,
	referenceId: PO,
	...overrides
});

describe('StockLevelService — one movement, one ledger row (INV-01, INV-10, P4.1, P4.4)', () => {
	it('changes the level by exactly the movement’s quantity and records both sides of it', async () => {
		const fixture = levelFixture({ level: { quantity: 10 } });

		const applied = await fixture.service.applyMovement(movement({ quantityDelta: 5 }) as never);

		expect(applied).toMatchObject({ quantityBefore: 10, quantityAfter: 15, reservedBefore: 0, reservedAfter: 0 });
		expect(fixture.store.levelFor()).toMatchObject({ quantity: 15, reservedQuantity: 0, version: 2 });
		expect(fixture.store.ledgerOf()).toHaveLength(1);
		expect(fixture.store.ledgerOf()[0]).toMatchObject({
			type: StockMovementType.RECEIPT,
			quantity: 5,
			quantityBefore: 10,
			quantityAfter: 15,
			reservedBefore: 0,
			reservedAfter: 0,
			referenceType: StockMovementReferenceType.PURCHASE_ORDER,
			referenceId: PO,
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			warehouseProductVariantId: 'level-1'
		});
	});

	it('keeps the level equal to the sum of its movements over a sequence, and each row’s before on the previous after', async () => {
		// The property the whole package exists for (INV-01, P4.1) and the one the nightly reconciliation
		// reports on: the level tables are a cache of the ledger, so the two can never be written apart.
		const fixture = levelFixture({ level: { quantity: 0 } });
		const operations = [
			movement({ type: StockMovementType.RECEIPT, quantityDelta: 12, referenceId: 'po-1' }),
			movement({ type: StockMovementType.SALE, quantityDelta: -5, referenceId: 'order-1' }),
			movement({ type: StockMovementType.ADJUSTMENT, quantityDelta: -2, referenceId: 'adjustment-1' }),
			movement({ type: StockMovementType.RETURN, quantityDelta: 3, referenceId: 'return-1' }),
			movement({ type: StockMovementType.WRITE_OFF, quantityDelta: -1, referenceId: 'write-off-1' })
		];

		for (const operation of operations) {
			await fixture.service.applyMovement(operation as never);
		}

		const ledger = fixture.store.ledgerOf();
		const level = fixture.store.levelFor();

		expect(ledger).toHaveLength(operations.length);
		expect(ledger.reduce((sum, row) => sum + Number(row.quantity), 0)).toBe(Number(level.quantity));
		expect(Number(level.quantity)).toBe(7);
		expect(ledger.map((row) => row.quantityAfter)).toEqual([12, 7, 5, 8, 7]);
		expect(ledger.slice(1).map((row) => row.quantityBefore)).toEqual(ledger.slice(0, -1).map((row) => row.quantityAfter));
		// One ledger row per call, and one version bump per committed write.
		expect(Number(level.version)).toBe(operations.length + 1);
	});

	it('moves the reserved quantity without touching the on-hand quantity', async () => {
		// Control for the naive implementation this engine exists to replace: a hold is *not* a sale. If
		// a reservation decremented the on-hand quantity, the units would leave the shelf before they
		// were picked, the ledger and the level would disagree about what is countable, and a released
		// hold would have to be un-sold rather than un-held (doc 09 §4.5).
		const fixture = levelFixture({ level: { quantity: 10 } });

		await fixture.service.applyMovement(
			movement({
				type: StockMovementType.RESERVATION,
				quantityDelta: 0,
				reservedDelta: 3,
				referenceType: StockMovementReferenceType.ORDER,
				referenceId: 'order-1'
			}) as never
		);

		expect(fixture.store.levelFor()).toMatchObject({ quantity: 10, reservedQuantity: 3 });
		expect(fixture.store.ledgerOf()[0]).toMatchObject({ quantity: 0, reservedAfter: 3 });
		// Two orders of the same level, moving independently: what is on hand, and what is already spoken for.
		expect(Number(fixture.store.levelFor().quantity) - Number(fixture.store.levelFor().reservedQuantity)).toBe(7);
	});

	it('returns the level to what it was when a hold is released (P4.8)', async () => {
		// The level starts empty and is opened by a movement, so that "the level is the sum of its
		// movements" is a claim about this fixture and not about a balance seeded behind the ledger's back.
		const fixture = levelFixture({ level: { quantity: 0 } });

		await fixture.service.applyMovement(movement({ quantityDelta: 10, referenceId: 'opening-1' }) as never);
		const before = { ...fixture.store.levelFor() };

		await fixture.service.applyMovement(
			movement({ type: StockMovementType.RESERVATION, quantityDelta: 0, reservedDelta: 3, referenceId: 'order-1' }) as never
		);
		await fixture.service.applyMovement(
			movement({ type: StockMovementType.RELEASE, quantityDelta: 0, reservedDelta: -3, referenceId: 'order-1' }) as never
		);

		expect(fixture.store.levelFor()).toMatchObject({
			quantity: before.quantity,
			reservedQuantity: before.reservedQuantity
		});
		// The ledger keeps both rows: the release explains the number, it does not erase the hold.
		expect(fixture.store.ledgerOf().map((row) => row.type)).toEqual([
			StockMovementType.RECEIPT,
			StockMovementType.RESERVATION,
			StockMovementType.RELEASE
		]);
		expect(fixture.store.ledgerOf().reduce((sum, row) => sum + Number(row.quantity), 0)).toBe(
			Number(fixture.store.levelFor().quantity)
		);
	});

	it('moves the product-level aggregate by the same delta as the variant row (INV-02)', async () => {
		// The aggregate is applied by delta and never by a re-read and re-sum, so it is always the running
		// sum of its variant rows — a re-read would race with every concurrent writer on the location.
		const fixture = levelFixture({ level: { quantity: 10 } });

		await fixture.service.applyMovement(movement({ quantityDelta: 4 }) as never);
		await fixture.service.applyMovement(
			movement({ type: StockMovementType.RESERVATION, quantityDelta: 0, reservedDelta: 2 }) as never
		);

		expect(fixture.store.aggregateFor()).toMatchObject({ quantity: 14, reservedQuantity: 2 });
		expect(Number(fixture.store.aggregateFor().quantity)).toBe(Number(fixture.store.levelFor().quantity));
	});
});

describe('StockLevelService — the exact before and after of the movement catalogue (doc 09 §4.2, §4.3)', () => {
	/**
	 * The rows of §4.3 that are one movement, walked against the table's own starting state
	 * (`quantityBefore = 100`, `reservedBefore = 20`) with the exact resulting pair the table states.
	 */
	const catalogue: Array<{
		trigger: string;
		type: StockMovementType;
		quantityDelta: number;
		reservedDelta: number;
		referenceType: StockMovementReferenceType;
		quantityAfter: number;
		reservedAfter: number;
	}> = [
		{
			trigger: 'a goods receipt line arrives',
			type: StockMovementType.RECEIPT,
			quantityDelta: 12,
			reservedDelta: 0,
			referenceType: StockMovementReferenceType.GOODS_RECEIPT,
			quantityAfter: 112,
			reservedAfter: 20
		},
		{
			trigger: 'an opening balance is recorded for a level with no history',
			type: StockMovementType.RECEIPT,
			quantityDelta: 12,
			reservedDelta: 0,
			referenceType: StockMovementReferenceType.MIGRATION,
			quantityAfter: 112,
			reservedAfter: 20
		},
		{
			trigger: 'a cart line is held at checkout',
			type: StockMovementType.RESERVATION,
			quantityDelta: 0,
			reservedDelta: 3,
			referenceType: StockMovementReferenceType.CART,
			quantityAfter: 100,
			reservedAfter: 23
		},
		{
			trigger: 'a cart line is released',
			type: StockMovementType.RELEASE,
			quantityDelta: 0,
			reservedDelta: -3,
			referenceType: StockMovementReferenceType.CART,
			quantityAfter: 100,
			reservedAfter: 17
		},
		{
			trigger: 'a fulfillment consumes the hold it was placed against',
			type: StockMovementType.SALE,
			quantityDelta: -3,
			reservedDelta: -3,
			referenceType: StockMovementReferenceType.FULFILLMENT,
			quantityAfter: 97,
			reservedAfter: 17
		},
		{
			trigger: 'a direct sale is made with no hold',
			type: StockMovementType.SALE,
			quantityDelta: -3,
			reservedDelta: 0,
			referenceType: StockMovementReferenceType.ORDER,
			quantityAfter: 97,
			reservedAfter: 20
		},
		{
			trigger: 'a return is received and restocked',
			type: StockMovementType.RETURN,
			quantityDelta: 3,
			reservedDelta: 0,
			referenceType: StockMovementReferenceType.RETURN,
			quantityAfter: 103,
			reservedAfter: 20
		},
		{
			trigger: 'a transfer leaves the source',
			type: StockMovementType.TRANSFER_OUT,
			quantityDelta: -3,
			reservedDelta: -3,
			referenceType: StockMovementReferenceType.TRANSFER,
			quantityAfter: 97,
			reservedAfter: 17
		},
		{
			trigger: 'a transfer arrives at the destination',
			type: StockMovementType.TRANSFER_IN,
			quantityDelta: 3,
			reservedDelta: 0,
			referenceType: StockMovementReferenceType.TRANSFER,
			quantityAfter: 103,
			reservedAfter: 20
		},
		{
			trigger: 'an operator corrects the quantity by hand',
			type: StockMovementType.ADJUSTMENT,
			quantityDelta: -3,
			reservedDelta: 0,
			referenceType: StockMovementReferenceType.ADJUSTMENT,
			quantityAfter: 97,
			reservedAfter: 20
		},
		{
			trigger: 'a count reconciles the location to what was counted',
			type: StockMovementType.COUNT,
			quantityDelta: -3,
			reservedDelta: 0,
			referenceType: StockMovementReferenceType.COUNT,
			quantityAfter: 97,
			reservedAfter: 20
		},
		{
			trigger: 'damaged stock is found on hand and scrapped',
			type: StockMovementType.DAMAGE,
			quantityDelta: -3,
			reservedDelta: 0,
			referenceType: StockMovementReferenceType.MANUAL,
			quantityAfter: 97,
			reservedAfter: 20
		},
		{
			trigger: 'stock leaves for internal consumption',
			type: StockMovementType.ISSUE,
			quantityDelta: -3,
			reservedDelta: 0,
			referenceType: StockMovementReferenceType.MANUAL,
			quantityAfter: 97,
			reservedAfter: 20
		}
	];

	it.each(catalogue)('writes an exact before and after for $type when $trigger', async (row) => {
		const fixture = levelFixture({ level: { quantity: 100, reservedQuantity: 20 } });

		const applied = await fixture.service.applyMovement(
			movement({
				type: row.type,
				quantityDelta: row.quantityDelta,
				reservedDelta: row.reservedDelta,
				referenceType: row.referenceType
			}) as never
		);

		expect(applied).toMatchObject({
			quantityBefore: 100,
			quantityAfter: row.quantityAfter,
			reservedBefore: 20,
			reservedAfter: row.reservedAfter
		});
		expect(fixture.store.levelFor()).toMatchObject({
			quantity: row.quantityAfter,
			reservedQuantity: row.reservedAfter
		});
		expect(fixture.store.ledgerOf()).toHaveLength(1);
		expect(fixture.store.ledgerOf()[0]).toMatchObject({
			type: row.type,
			quantity: row.quantityDelta,
			reservedBefore: 20,
			reservedAfter: row.reservedAfter,
			referenceType: row.referenceType
		});
	});
});

describe('StockLevelService — availability, derived and never stored (INV-06)', () => {
	it('derives availability as on hand, less what is held, less the floor demand may not consume', async () => {
		// The package's own definition (doc 09 §3.1, §3.3 and INV-06): `availableQuantity = quantity −
		// reservedQuantity − safetyStock`. The safety stock is subtracted here and only here, because it
		// is the floor a *new* demand may not consume and it never affects a hold that already exists.
		const fixture = levelFixture({ level: { quantity: 10, reservedQuantity: 3, safetyStock: 2 } });

		const availability = await fixture.service.findLevel(WAREHOUSE, VARIANT);

		expect(availability).toMatchObject({
			levelId: 'level-1',
			warehouseId: WAREHOUSE,
			variantId: VARIANT,
			quantity: 10,
			reservedQuantity: 3,
			safetyStock: 2,
			availableQuantity: 5
		});
		expect(await fixture.service.availableQuantity(WAREHOUSE, VARIANT)).toBe(5);
		// The level row carries no `availableQuantity` column: a stored third number would be a second
		// answer to the same question and could drift from the two it is computed from.
		expect('availableQuantity' in fixture.store.levelFor()).toBe(false);
	});

	it('answers a variant that is not stocked at the location with no availability at all', async () => {
		// Zero on hand and "not stocked here" are different answers, and the caller has to be able to tell
		// them apart before it decides to refuse a demand (doc 09 §5.2).
		const fixture = levelFixture({ seedLevel: false, withAggregate: false });

		expect(await fixture.service.findLevel(WAREHOUSE, VARIANT)).toBeNull();
		expect(await fixture.service.availableQuantity(WAREHOUSE, VARIANT)).toBe(0);
		expect(fixture.store.ledgerOf()).toEqual([]);
	});

	it('normalises the quantities a numeric column hands back as strings', async () => {
		// Control: a `numeric(20,6)` column arrives from the driver as a *string*, so `level.quantity + 5`
		// is `"105"` for a naive implementation and `15` for one that reads the value as a number. The
		// assertion below is the difference between the two, and the reason every read of a quantity in
		// the engine goes through `Number(...)`.
		const fixture = levelFixture({ level: { quantity: '10', reservedQuantity: '3' } });

		await fixture.service.applyMovement(movement({ quantityDelta: 5 }) as never);

		expect(fixture.store.levelFor().quantity).toBe(15);
		expect(fixture.store.levelFor().reservedQuantity).toBe(3);
		expect((await fixture.service.findLevel(WAREHOUSE, VARIANT))?.availableQuantity).toBe(12);

		const naive = '10' + 5;
		expect(naive).toBe('105');
		expect(fixture.store.levelFor().quantity).not.toBe(naive);
	});
});

describe('StockLevelService — the invariants a movement may not break (INV-05, INV-07, INV-12)', () => {
	it('refuses a hold larger than the on-hand quantity on a level that allows no backorder', async () => {
		const fixture = levelFixture({ level: { quantity: 2 } });

		await expect(
			fixture.service.applyMovement(
				movement({ type: StockMovementType.RESERVATION, quantityDelta: 0, reservedDelta: 3 }) as never
			)
		).rejects.toMatchObject({
			response: {
				code: 'STOCK_INVARIANT_VIOLATION',
				details: { invariant: 'INV-07', level: { id: 'level-1' } }
			}
		});
		// Nothing was written by the refusal: no ledger row, and the level exactly as it was.
		expect(fixture.store.ledgerOf()).toEqual([]);
		expect(fixture.store.levelFor()).toMatchObject({ quantity: 2, reservedQuantity: 0, version: 1 });
		expect(fixture.store.aggregateFor()).toMatchObject({ quantity: 2, reservedQuantity: 0 });
	});

	it('refuses a movement that would drive the on-hand quantity negative', async () => {
		const fixture = levelFixture({ level: { quantity: 2 } });

		await expect(
			fixture.service.applyMovement(
				movement({ type: StockMovementType.SALE, quantityDelta: -3 }) as never
			)
		).rejects.toMatchObject({
			response: { code: 'STOCK_INVARIANT_VIOLATION', details: { invariant: 'INV-05' } }
		});
		expect(fixture.store.levelFor()).toMatchObject({ quantity: 2 });
		expect(fixture.store.ledgerOf()).toEqual([]);
	});

	it('refuses a release that would drive the reserved quantity negative', async () => {
		const fixture = levelFixture({ level: { quantity: 5, reservedQuantity: 1 } });

		await expect(
			fixture.service.applyMovement(
				movement({ type: StockMovementType.RELEASE, quantityDelta: 0, reservedDelta: -2 }) as never
			)
		).rejects.toMatchObject({
			response: { code: 'STOCK_INVARIANT_VIOLATION', details: { invariant: 'INV-07' } }
		});
		expect(fixture.store.levelFor()).toMatchObject({ quantity: 5, reservedQuantity: 1 });
	});

	it('refuses a movement that names no document, because INV-12 has nothing to cite', async () => {
		const fixture = levelFixture({ level: { quantity: 5 } });

		await expect(
			fixture.service.applyMovement(movement({ referenceId: undefined }) as never)
		).rejects.toMatchObject({
			response: { code: 'STOCK_INVARIANT_VIOLATION', details: { invariant: 'INV-12' } }
		});
		await expect(
			fixture.service.applyMovement(movement({ referenceType: undefined }) as never)
		).rejects.toMatchObject({
			response: { code: 'STOCK_INVARIANT_VIOLATION', details: { invariant: 'INV-12' } }
		});
		expect(fixture.store.ledgerOf()).toEqual([]);
		expect(fixture.store.levelFor()).toMatchObject({ quantity: 5 });
	});

	it('refuses a delta that is not a finite number', async () => {
		const fixture = levelFixture({ level: { quantity: 5 } });

		await expect(
			fixture.service.applyMovement(movement({ quantityDelta: Number.NaN }) as never)
		).rejects.toMatchObject({ response: { code: 'STOCK_INVARIANT_VIOLATION' } });
		await expect(
			fixture.service.applyMovement(movement({ reservedDelta: Number.POSITIVE_INFINITY }) as never)
		).rejects.toMatchObject({ response: { code: 'STOCK_INVARIANT_VIOLATION' } });
		expect(fixture.store.levelFor()).toMatchObject({ quantity: 5, version: 1 });
	});

	it('accepts backordered demand up to the level’s limit and refuses it past the limit', async () => {
		// P4.5 / INV-11: past the on-hand quantity a hold is a backorder, and a level that permits one
		// permits it only up to the limit it states.
		const fixture = levelFixture({
			level: { quantity: 10, allowBackorder: true, backorderLimit: 2 }
		});

		await fixture.service.applyMovement(
			movement({ type: StockMovementType.RESERVATION, quantityDelta: 0, reservedDelta: 12 }) as never
		);

		expect(fixture.store.levelFor()).toMatchObject({ quantity: 10, reservedQuantity: 12 });

		await expect(
			fixture.service.applyMovement(
				movement({ type: StockMovementType.RESERVATION, quantityDelta: 0, reservedDelta: 1 }) as never
			)
		).rejects.toMatchObject({
			response: {
				code: 'STOCK_INVARIANT_VIOLATION',
				details: { invariant: 'INV-07', level: { backorderLimit: 2 } }
			}
		});
		expect(fixture.store.levelFor()).toMatchObject({ reservedQuantity: 12 });
		expect(fixture.store.ledgerOf()).toHaveLength(1);
	});

	it('lets a level marked unlimited go negative, and still records every movement exactly', async () => {
		// A made-to-order or digital unit is not stock-controlled: the ledger still records what happened,
		// so `quantity` tracks reality and is allowed below zero (doc 09 §3.3).
		const fixture = levelFixture({ level: { quantity: 0, isUnlimited: true } });

		await fixture.service.applyMovement(
			movement({ type: StockMovementType.SALE, quantityDelta: -2 }) as never
		);

		expect(fixture.store.levelFor()).toMatchObject({ quantity: -2 });
		expect(fixture.store.ledgerOf().reduce((sum, row) => sum + Number(row.quantity), 0)).toBe(-2);
	});
});

describe('StockLevelService — resolving the level (doc 09 §4.1 steps 1–2)', () => {
	it('creates the level with the documented defaults the first time a variant is stocked', async () => {
		const fixture = levelFixture({ seedLevel: false, withAggregate: false });

		const applied = await fixture.service.applyMovement(movement({ quantityDelta: 7 }) as never);

		expect(applied).toMatchObject({ quantityBefore: 0, quantityAfter: 7 });
		// The opening quantity arrives as the movement being applied, never as a caller-supplied column.
		expect(fixture.store.levelFor()).toMatchObject({
			variantId: VARIANT,
			quantity: 7,
			reservedQuantity: 0,
			incomingQuantity: 0,
			safetyStock: 0,
			allowBackorder: false,
			trackInventory: true,
			isUnlimited: false
		});
		expect(fixture.store.aggregateFor()).toMatchObject({ warehouseId: WAREHOUSE, productId: PRODUCT, quantity: 7 });
	});

	it('stamps the level and the movement with the scope of the aggregate they belong to', async () => {
		// Both tables are read through tenant-scoped queries — the availability lookups filter on the
		// tenant, and so do the ledger reads — so a row written without a scope is a row nothing in this
		// package can find, including the reconciliation that compares the two.
		const fixture = levelFixture({ seedLevel: false, withAggregate: false });

		await fixture.service.applyMovement(movement({ quantityDelta: 4 }) as never);

		expect(fixture.store.levelFor()).toMatchObject({ tenantId: TENANT, organizationId: ORG });
		expect(fixture.tables.stock_movement[0]).toMatchObject({ tenantId: TENANT, organizationId: ORG });
	});

	it('refuses a movement for a product that does not exist', async () => {
		const fixture = levelFixture({ seedLevel: false, withAggregate: false });

		await expect(
			fixture.service.applyMovement(movement({ productId: 'no-such-product' }) as never)
		).rejects.toMatchObject({ response: { code: 'STOCK_LEVEL_NOT_FOUND' } });
		expect(fixture.tables.warehouse_product_variant).toEqual([]);
		expect(fixture.tables.stock_movement).toEqual([]);
	});

	// The product a first-time stock belongs to is not unknowable: a variant belongs to exactly one
	// product and the variant table says which. A movement that names only the `(location, variant)`
	// pair — which is what a receipt into a location that has never stocked the variant is — is
	// therefore answerable, and demanding a product the caller has no reason to know would refuse it.
	it('stocks a variant at a location for the first time from the variant’s own product', async () => {
		const fixture = levelFixture({ seedLevel: false, withAggregate: false });

		const applied = await fixture.service.applyMovement(
			movement({ productId: undefined, type: StockMovementType.RECEIPT, quantityDelta: 6 }) as never
		);

		expect(applied).toMatchObject({ quantityBefore: 0, quantityAfter: 6 });
		// The aggregate the level hangs from is created with the product the variant belongs to, and the
		// ledger row records the product beside the level it moved.
		const aggregate = fixture.store.aggregateFor();
		expect(aggregate).toMatchObject({ warehouseId: WAREHOUSE, productId: PRODUCT, quantity: 6 });
		expect(fixture.store.levelFor()).toMatchObject({
			variantId: VARIANT,
			quantity: 6,
			reservedQuantity: 0,
			version: 2
		});
		expect(fixture.store.ledgerOf()).toHaveLength(1);
		expect(fixture.store.ledgerOf()[0]).toMatchObject({
			type: StockMovementType.RECEIPT,
			quantity: 6,
			warehouseProductId: aggregate.id,
			warehouseProductVariantId: fixture.store.levelFor().id
		});
		// INV-01: whatever opened the level, the level is the sum of its movements.
		expect(fixture.store.ledgerOf().reduce((sum, row) => sum + Number(row.quantity), 0)).toBe(
			Number(fixture.store.levelFor().quantity)
		);
	});

	it('refuses a movement whose stated product is not the product the variant belongs to', async () => {
		// A caller that states a product has made a claim about which stock item the movement is about.
		// The variant contradicts it, and the two readings name two different products, so the movement
		// is refused rather than written against either one of them.
		const fixture = levelFixture({ seedLevel: false, withAggregate: false });

		await expect(
			fixture.service.applyMovement(movement({ productId: 'other-product' }) as never)
		).rejects.toMatchObject({
			response: {
				code: 'STOCK_INVARIANT_VIOLATION',
				details: { invariant: 'INV-01', statedProductId: 'other-product', variantProductId: PRODUCT }
			}
		});
		expect(fixture.tables.warehouse_product).toEqual([]);
		expect(fixture.tables.warehouse_product_variant).toEqual([]);
		expect(fixture.tables.stock_movement).toEqual([]);
	});

	it('accepts a stated product that is the product the variant belongs to', async () => {
		// The control for the two cases above: the same fixture, the same product, stated by the caller
		// instead of resolved from the variant.
		const fixture = levelFixture({ seedLevel: false, withAggregate: false });

		const applied = await fixture.service.applyMovement(
			movement({ productId: PRODUCT, quantityDelta: 6 }) as never
		);

		expect(applied).toMatchObject({ quantityAfter: 6 });
		expect(fixture.store.aggregateFor()).toMatchObject({ productId: PRODUCT });
	});

	it('stocks into the aggregate the location already holds for the variant’s product', async () => {
		// The same first-time path with the product-level row already there: the level is created under
		// the aggregate that exists rather than a second one for the same product.
		const fixture = levelFixture({ seedLevel: false, withAggregate: true });

		await fixture.service.applyMovement(movement({ productId: undefined, quantityDelta: 4 }) as never);

		expect(fixture.tables.warehouse_product).toHaveLength(1);
		expect(fixture.store.levelFor()).toMatchObject({
			variantId: VARIANT,
			warehouseProductId: 'aggregate-1',
			quantity: 4
		});
	});

	it('refuses a stated product the variant contradicts even where that product is already stocked', async () => {
		// The aggregate of the product the caller names is already at the location — the state that would
		// let an unchecked disagreement slip a level of another product’s variant underneath it. The
		// check runs before that aggregate is resolved, so the movement is refused rather than written
		// against a product the variant does not belong to.
		const fixture = levelFixture({ seedLevel: false, withAggregate: false });
		fixture.tables.warehouse_product.push({
			id: 'aggregate-of-another-product',
			tenantId: TENANT,
			organizationId: ORG,
			warehouseId: WAREHOUSE,
			productId: 'other-product',
			quantity: 0,
			reservedQuantity: 0,
			version: 1
		});

		await expect(
			fixture.service.applyMovement(movement({ productId: 'other-product' }) as never)
		).rejects.toMatchObject({
			response: {
				code: 'STOCK_INVARIANT_VIOLATION',
				details: { invariant: 'INV-01', statedProductId: 'other-product', variantProductId: PRODUCT }
			}
		});
		expect(fixture.tables.warehouse_product_variant).toEqual([]);
		expect(fixture.tables.stock_movement).toEqual([]);
	});

	it('refuses a movement that names a level row of another location', async () => {
		// A level row is addressed by `(location, variant)`; an id that does not resolve is a stated miss
		// rather than a silent write against whatever row happened to be there.
		const fixture = levelFixture({ level: { quantity: 3 } });

		await expect(
			fixture.service.applyMovement(movement({ levelId: 'level-of-another-location' }) as never)
		).rejects.toMatchObject({ response: { code: 'STOCK_LEVEL_NOT_FOUND' } });
		expect(fixture.store.ledgerOf()).toEqual([]);
	});

	it('refuses a bin-addressed movement on a location the bin does not belong to', async () => {
		const fixture = levelFixture({ level: { quantity: 3 } });
		fixture.tables.warehouse_bin.push({ id: 'bin-elsewhere', warehouseId: OTHER_WAREHOUSE });

		await expect(
			fixture.service.applyMovement(movement({ binId: 'bin-elsewhere' }) as never)
		).rejects.toMatchObject({ response: { code: 'BIN_LOCATION_MISMATCH' } });
		expect(fixture.store.ledgerOf()).toEqual([]);

		fixture.tables.warehouse_bin.push({ id: 'bin-here', warehouseId: WAREHOUSE });

		const applied = await fixture.service.applyMovement(movement({ binId: 'bin-here' }) as never);

		expect(applied.binId).toBe('bin-here');
		expect(fixture.store.ledgerOf()[0].binId).toBe('bin-here');
	});
});

describe('StockLevelService — the concurrency rule the package states (doc 09 §4.1, §15)', () => {
	it('takes the level row lock on a dialect that has one and takes none where it has not', async () => {
		// The engine's claim is a `SELECT ... FOR UPDATE` on the level row where the dialect supports it,
		// and the transaction itself on the embedded dialect, which serialises writers.
		const postgres = levelFixture({ level: { quantity: 5 }, dialect: 'postgres' });

		await postgres.service.applyMovement(movement({ quantityDelta: 1 }) as never);

		expect(postgres.store.queries).toEqual([
			'SET LOCAL lock_timeout = $1',
			'SELECT "id" FROM "warehouse_product_variant" WHERE "id" = $1 FOR UPDATE'
		]);

		const sqlite = levelFixture({ level: { quantity: 5 }, dialect: 'better-sqlite3' });

		await sqlite.service.applyMovement(movement({ quantityDelta: 1 }) as never);

		expect(sqlite.store.queries).toEqual([]);
	});

	it('guards the write with a compare-and-set on the level’s version', async () => {
		const fixture = levelFixture({ level: { quantity: 5, version: 1 } });

		await fixture.service.applyMovement(movement({ quantityDelta: 1 }) as never);
		await fixture.service.applyMovement(movement({ quantityDelta: 1 }) as never);

		// One read, one compare-and-set, one bump per committed movement: a lost update is detected rather
		// than silently overwriting the winner.
		expect(fixture.store.casAttempts()).toBe(2);
		expect(fixture.store.levelFor()).toMatchObject({ quantity: 7, version: 3 });
	});

	it('retries a contended write and lands it on the state the winner left behind', async () => {
		// A competing writer committed +5 between this movement's read and its compare-and-set. The retry
		// re-reads the locked row, so the movement it finally writes is recorded against the winner's
		// state and the engine's own `quantityBefore` is that state — not the value it read first.
		const fixture = levelFixture({
			level: { quantity: 10 },
			contention: { loseAttempts: 1, competingQuantityDelta: 5 }
		});

		const applied = await fixture.service.applyMovement(movement({ quantityDelta: 5 }) as never);

		expect(fixture.store.casAttempts()).toBe(2);
		expect(applied).toMatchObject({ quantityBefore: 15, quantityAfter: 20 });
		expect(fixture.store.levelFor()).toMatchObject({ quantity: 20, version: 3 });
	});

	it('refuses the loser of three retries with STOCK_CONFLICT and writes nothing at all', async () => {
		// The stated end of the ladder: three retries, then a refusal that names the contention. The
		// losing call must leave no trace of its own — the level is the winner's, and the loser's ledger
		// rows are gone with the transaction.
		const fixture = levelFixture({
			level: { quantity: 10 },
			contention: { loseAttempts: 4, competingQuantityDelta: 0 }
		});

		await expect(fixture.service.applyMovement(movement({ quantityDelta: 5 }) as never)).rejects.toMatchObject({
			response: { code: 'STOCK_CONFLICT', details: { levelId: 'level-1', attempts: 3 } }
		});
		expect(fixture.store.casAttempts()).toBe(4);
		expect(fixture.store.ledgerOf()).toEqual([]);
		expect(fixture.store.levelFor()).toMatchObject({ quantity: 10, reservedQuantity: 0 });
	});

	// The property the whole engine exists to hold, under the one condition that makes it a claim about
	// this fixture: the level is opened by the movement the case applies and the competing writer
	// interferes by taking the row's version, so every unit the level holds is a unit the ledger
	// records. (`stock-level.service.ts`, the ledger row written once the compare-and-set is known to
	// have won.) A ledger row written before the compare-and-set would leave one row per attempt, and
	// the two assertions below would report it.
	it('writes one ledger row per movement, even when the write had to be retried', async () => {
		const fixture = levelFixture({
			level: { quantity: 0 },
			contention: { loseAttempts: 1, competingQuantityDelta: 0 }
		});

		await fixture.service.applyMovement(movement({ quantityDelta: 5 }) as never);

		const ledger = fixture.store.ledgerOf();

		expect(ledger).toHaveLength(1);
		expect(ledger.reduce((sum, row) => sum + Number(row.quantity), 0)).toBe(
			Number(fixture.store.levelFor().quantity)
		);
	});
});




/**
 * The level reads' window, as the builder is handed it.
 *
 * `stockLevels` is a connection, and a connection can ask for a window of no rows: a backward walk from the
 * first row — `last: 5, before: <offset 0>` — has nothing before its anchor, and `resolveConnectionWindow`
 * answers it with `take: 0`. `listLevels` handed that zero to the query builder's `limit`, and a zero limit is
 * only as safe as the builder that writes it — one that tests it for truthiness writes no `LIMIT` at all, and
 * the read then answers every level the filters select. The REST route's own read took the same zero from
 * `?take=0`, and `?take=-1` is a limit SQLite reads as no limit at all.
 *
 * The builder double here records every call it is handed, so the assertions are about the statement the
 * service composed rather than about rows a double chose to answer.
 */
describe('StockLevelService — a window of no rows reads no rows', () => {
	/** A level read's builder that records its calls and answers the rows and the count it was given. */
	const recordingBuilder = (rows: Row[], count: number) => {
		const calls: Array<[string, unknown[]]> = [];
		const builder: any = {};

		for (const method of ['innerJoin', 'select', 'addSelect', 'andWhere', 'where', 'withDeleted', 'orderBy', 'offset', 'limit']) {
			builder[method] = (...args: unknown[]) => {
				calls.push([method, args]);

				return builder;
			};
		}

		builder.clone = () => {
			calls.push(['clone', []]);

			return builder;
		};
		builder.getMany = async () => {
			calls.push(['getMany', []]);

			return rows;
		};
		builder.getCount = async () => {
			calls.push(['getCount', []]);

			return count;
		};

		return { builder, calls, service: new StockLevelService({ manager: { createQueryBuilder: () => builder } } as never) };
	};

	/** @returns The arguments every call of one builder method was handed. */
	const argumentsOf = (calls: Array<[string, unknown[]]>, method: string) =>
		calls.filter(([name]) => name === method).map(([, args]) => args);

	let tenant: jest.SpyInstance;

	beforeEach(() => {
		const { RequestContext } = jest.requireMock('@gauzy/core');

		tenant = jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	});

	afterEach(() => tenant.mockRestore());

	it('answers `take: 0` with an empty page and the count of the tenant’s levels, and reads no rows', async () => {
		const { calls, service } = recordingBuilder([{ id: 'level-1' }], 7);

		const page = await service.listLevels({ warehouseId: WAREHOUSE, variantId: VARIANT, skip: 0, take: 0 });

		// The count the connection reports as `totalCount`, over the same filters and the caller's tenant.
		expect(page).toEqual({ items: [], total: 7 });
		expect(argumentsOf(calls, 'getCount')).toHaveLength(1);
		expect(argumentsOf(calls, 'andWhere')).toEqual(
			expect.arrayContaining([
				['aggregate.warehouseId = :warehouseId', { warehouseId: WAREHOUSE }],
				['level.variantId = :variantId', { variantId: VARIANT }],
				['level.tenantId = :tenantId', { tenantId: TENANT }]
			])
		);
		// Nothing was selected, so no builder was ever asked to write a zero limit it might drop.
		expect(argumentsOf(calls, 'getMany')).toHaveLength(0);
		expect(argumentsOf(calls, 'limit')).toHaveLength(0);
	});

	it('still reads a non-empty window through the builder, limited to the size it asked for', async () => {
		const { calls, service } = recordingBuilder([{ id: 'level-1', variantId: VARIANT, warehouseId: WAREHOUSE }], 7);

		const page = await service.listLevels({ skip: 3, take: 2 });

		expect(page.total).toBe(7);
		expect(page.items).toHaveLength(1);
		expect(argumentsOf(calls, 'offset')).toEqual([[3]]);
		expect(argumentsOf(calls, 'limit')).toEqual([[2]]);
		expect(argumentsOf(calls, 'orderBy')).toEqual([['level.id', 'ASC']]);
	});

	it.each([0, -1])('answers the route’s read with no levels for `take: %p`, without reading', async (take) => {
		const { calls, service } = recordingBuilder([{ id: 'level-1' }], 7);

		expect(await service.findLevels({ warehouseId: WAREHOUSE, take })).toEqual([]);
		expect(argumentsOf(calls, 'getMany')).toHaveLength(0);
		expect(argumentsOf(calls, 'limit')).toHaveLength(0);
	});

	it('keeps the route’s own ceiling when no size is stated', async () => {
		const { calls, service } = recordingBuilder([], 0);

		await service.findLevels({ warehouseId: WAREHOUSE });

		expect(argumentsOf(calls, 'limit')).toEqual([[100]]);
	});
});
