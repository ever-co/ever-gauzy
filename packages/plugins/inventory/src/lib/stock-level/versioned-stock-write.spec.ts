/**
 * The versioned write into stock: what a stated version protects, and what it does not.
 *
 * `applyMovement` is the single write path into stock, and it reaches storage through the kernel's
 * conditional write — `commitVersionedUpdate` from `@gauzy/core` — so a caller that read a level and
 * stated the version it read is refused the moment the row has moved past that version, rather than
 * writing the decision it made about a value that no longer exists. The code under test is the real
 * ledger engine and the real `stock_movement` entity it writes; what is doubled is the package
 * barrel, for the reason the package's other suites state: the barrel boots the whole application
 * graph and its nested `uuid` is ESM-only under jest.
 *
 * The double for the conditional write is the shared one, `../testing/versioned-write.double`, which
 * reproduces the kernel's six steps — resolve the expected version, refuse a record that cannot be
 * read with `404`, predicate the update on the expected version, read the affected-row count, read
 * the row back on a miss, and answer `409 ENTITY_VERSION_CONFLICT` when the row has moved on. It
 * decides rather than succeeds, so the refusals below are the kernel's refusals.
 *
 * The accepted version reaches the engine the way it reaches it in production: the guard leaves it
 * on the request, and the engine reads it from there through the doubled `RequestContext`. This
 * suite's own factory therefore answers `currentRequest` with a request object the cases control,
 * which is the one respect in which it differs from the seven mocks whose `currentRequest` answers
 * `null` — those suites exercise the unversioned path only.
 *
 * The engine is constructed over an in-memory double of its `DataSource`, as in
 * `stock-level.service.spec.ts`: the double applies the `UPDATE … WHERE id = … AND version = …` for
 * real, so an update predicated on a version the row does not hold matches nothing and the engine's
 * conditional write is exercised rather than assumed.
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
			// The request the write reads the accepted version from. Unlike the other suites' mocks this
			// one answers with a request, because what a request carries is what this suite is about; the
			// cases below state what it holds before each movement.
			currentRequest: () => mockRequest,
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

import { HttpException, HttpStatus } from '@nestjs/common';
import { Product, ProductVariant, WarehouseProduct, WarehouseProductVariant } from '@gauzy/core';
import { StockMovementType, StockMovementReferenceType } from '../inventory.enums';
import { StockMovement } from '../stock-movement/stock-movement.entity';
import { StockLevelService } from './stock-level.service';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const WAREHOUSE = '00000000-0000-4000-8000-000000000010';
const PRODUCT = '00000000-0000-4000-8000-000000000020';
const VARIANT = '00000000-0000-4000-8000-000000000030';
const PO = '00000000-0000-4000-8000-000000000040';

type Row = Record<string, any>;

/** What a caller accepted in its `If-Match` header, in the shape the platform states it. */
interface IVersionExpectation {
	wildcard: boolean;
	versions: number[];
}

/** What a request carries, as far as this suite is concerned. */
interface IFakeRequest {
	versionExpectation?: IVersionExpectation & { target?: string };
}

/**
 * The table a route names when the version its caller states is the level's.
 *
 * Restated rather than imported so a rename of the constant cannot quietly move both sides of this
 * suite at once: the value is the level row's table, and that is what the guard stamps.
 */
const LEVEL_TARGET = 'warehouse_product_variant';

/**
 * The request the doubled `RequestContext` answers with.
 *
 * A real request reaches the engine through the guard, which leaves what the caller accepted on it,
 * and the write reads it from there rather than parsing the header again. This is that request, and
 * the cases below state what it holds before each movement.
 */
let mockRequest: IFakeRequest | null = null;

/**
 * States the version the request accepted for the level, the way the platform's guard leaves it on a
 * request whose route declared `@Versioned({ target: STOCK_LEVEL_VERSION_TARGET })`.
 */
function acceptVersion(version: number): void {
	mockRequest = { versionExpectation: { wildcard: false, versions: [version], target: LEVEL_TARGET } };
}

/** States that the request accepted any version of the level, which is what `If-Match: *` means. */
function acceptAnyVersion(): void {
	mockRequest = { versionExpectation: { wildcard: true, versions: [], target: LEVEL_TARGET } };
}

/**
 * States a version the request accepted for **its own record** — a return, an order, a fulfilment —
 * which is what a route that did not name the level leaves on the request.
 */
function acceptVersionOfAnotherRecord(version: number): void {
	mockRequest = { versionExpectation: { wildcard: false, versions: [version] } };
}

/** A request that states no version at all: a route that did not opt in, a worker, a seed. */
function stateNoVersion(): void {
	mockRequest = {};
}

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
 * It is the double `stock-level.service.spec.ts` states, with the one property this suite is about
 * made real: the aggregate update the engine issues is a compare-and-set — `WHERE id = … AND
 * version = …` — and a statement predicated on a version the row does not hold matches nothing. That
 * is what makes the kernel's read-back decide between a refusal and a write that landed, rather than
 * a double that always answers one affected row.
 *
 * `transaction` copies every table, and a throw from inside restores the copy, so "nothing was
 * written by the refusal" is asserted against state and not against a mock's call log. A competing
 * writer's committed change survives that restore, because in the world this stands in for it was
 * committed by another transaction.
 *
 * @param tables The whole datastore.
 * @param options.contention How a competing writer interferes with the compare-and-set.
 */
function datastore(tables: ITables, options: { contention?: IContention } = {}) {
	const entityToTable = new Map<unknown, keyof ITables>([
		[Product, 'product'],
		[ProductVariant, 'product_variant'],
		[WarehouseProduct, 'warehouse_product'],
		[WarehouseProductVariant, 'warehouse_product_variant'],
		[StockMovement, 'stock_movement']
	]);
	let sequence = 0;
	/** Every raw statement the engine issued. */
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
	/** The row lock a dialect with one would take, recorded so the statement is not lost. */
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
	 * The query builder double: the reads, the aggregate update and the version-predicated level
	 * update the engine issues, and nothing else — an unimplemented shape throws rather than
	 * answering wrongly.
	 */
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
			execute: async () => {
				if (!updateSpec) {
					throw new Error('the in-memory double only implements an UPDATE');
				}

				const id = Object.values(conditions).find((condition) => condition.params.id)?.params.id;
				const version = Object.values(conditions).find((condition) => condition.params.version)?.params
					.version;
				const row = rows(target).find((candidate) => same(candidate.id, id));

				if (!row) {
					return { affected: 0 };
				}

				if (version !== undefined) {
					casAttempts += 1;

					// A competing writer that committed between the read and the write has bumped the
					// version, and this statement loses to it rather than overwriting the winner.
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

					// The compare-and-set itself: the statement is predicated on the version the engine
					// read, so a row holding any other version matches nothing.
					if (!same(row.version, version)) {
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
		connection: { options: { type: 'better-sqlite3' } },
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
		query: async (sql: string, params: any[] = []) => {
			if (/FOR UPDATE/.test(sql)) {
				queries.push(sql.trim());

				return lockRow({ id: params[0] });
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
		levelFor: () => tables.warehouse_product_variant[0],
		aggregateFor: () => tables.warehouse_product[0],
		ledgerOf: () => tables.stock_movement
	};
}

/** Builds the engine over one in-memory datastore, with the fixture's product stocked at one location. */
function levelFixture(options: { level?: Row; contention?: IContention } = {}) {
	const tables: ITables = {
		product: [{ id: PRODUCT, tenantId: TENANT, organizationId: ORG }],
		product_variant: [{ id: VARIANT, productId: PRODUCT }],
		warehouse_product: [
			{
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
			}
		],
		warehouse_product_variant: [
			{
				id: 'level-1',
				tenantId: TENANT,
				organizationId: ORG,
				warehouseProductId: 'aggregate-1',
				variantId: VARIANT,
				quantity: options.level?.quantity ?? 0,
				reservedQuantity: options.level?.reservedQuantity ?? 0,
				incomingQuantity: 0,
				safetyStock: 0,
				allowBackorder: false,
				backorderLimit: null,
				trackInventory: true,
				isUnlimited: false,
				version: options.level?.version ?? 1
			}
		],
		stock_movement: [],
		warehouse_bin: []
	};
	const store = datastore(tables, { contention: options.contention });

	return { service: new StockLevelService(store.dataSource as never), store, tables };
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

/**
 * The refusal a write was answered with.
 *
 * A refusal is asserted as a refusal: the case fails when the write resolves, and the refusal it was
 * given is asserted for its status and its code rather than for a message.
 *
 * @param run The write under test.
 * @returns What the write threw.
 */
async function refusalOf(run: Promise<unknown>): Promise<any> {
	return await run.then(
		() => {
			throw new Error('the write was expected to be refused, and it was not');
		},
		(error) => error
	);
}

describe('StockLevelService — the write under the version the request accepted (doc 09 §4.1, §15)', () => {
	beforeEach(() => {
		mockRequest = null;
	});

	it('refuses a version behind the level with the platform’s conflict code and writes nothing', async () => {
		// The caller read version 3 and the level has since moved to 5. The value the caller reasoned
		// about is gone, so the write is refused rather than applied to a state it never saw — and it is
		// refused once: a stated version is a decision, and re-running the attempt would write that
		// decision against a row that has moved on.
		const fixture = levelFixture({ level: { quantity: 10, version: 5 } });
		acceptVersion(3);

		const refusal = await refusalOf(fixture.service.applyMovement(movement({ quantityDelta: 5 }) as never));

		expect(refusal).toBeInstanceOf(HttpException);
		expect(refusal.getStatus()).toBe(HttpStatus.CONFLICT);
		expect(refusal.code).toBe('ENTITY_VERSION_CONFLICT');
		expect(fixture.store.casAttempts()).toBe(1);
		expect(fixture.store.levelFor()).toMatchObject({ quantity: 10, reservedQuantity: 0, version: 5 });
		expect(fixture.store.aggregateFor()).toMatchObject({ quantity: 10, reservedQuantity: 0, version: 1 });
		expect(fixture.store.ledgerOf()).toEqual([]);
	});

	it('writes under the accepted version and reports the next version', async () => {
		const fixture = levelFixture({ level: { quantity: 10, version: 5 } });
		acceptVersion(5);

		const applied = await fixture.service.applyMovement(movement({ quantityDelta: 5 }) as never);

		expect(applied).toMatchObject({ version: 6, quantityBefore: 10, quantityAfter: 15 });
		expect(fixture.store.levelFor()).toMatchObject({ quantity: 15, version: 6 });
		expect(fixture.store.ledgerOf()).toHaveLength(1);
		expect(fixture.store.ledgerOf()[0]).toMatchObject({
			quantity: 5,
			quantityBefore: 10,
			quantityAfter: 15
		});
	});

	it('writes exactly one movement for a versioned adjustment, and moves the level by its delta', async () => {
		// The level write is one statement whatever the movement is; the ledger row is written once the
		// compare-and-set is known to have won, so a versioned write records its movement exactly once.
		const fixture = levelFixture({ level: { quantity: 10, version: 2 } });
		acceptVersion(2);

		const applied = await fixture.service.applyMovement(
			movement({
				type: StockMovementType.ADJUSTMENT,
				quantityDelta: -4,
				referenceType: StockMovementReferenceType.ADJUSTMENT,
				reason: 'DAMAGED'
			}) as never
		);

		expect(applied).toMatchObject({ version: 3, quantityBefore: 10, quantityAfter: 6 });
		expect(fixture.store.ledgerOf()).toHaveLength(1);
		expect(fixture.store.ledgerOf()[0]).toMatchObject({
			type: StockMovementType.ADJUSTMENT,
			quantity: -4,
			referenceType: StockMovementReferenceType.ADJUSTMENT,
			reason: 'DAMAGED',
			warehouseProductVariantId: 'level-1'
		});
		expect(fixture.store.levelFor()).toMatchObject({ quantity: 6, version: 3 });
	});

	it('accepts any version that exists when the request accepted a wildcard', async () => {
		// `If-Match: *` states that the record must exist, not which version it holds. The version the
		// statement is predicated on is then the one read under the row lock, which is the value the
		// invariants were checked against.
		const fixture = levelFixture({ level: { quantity: 4, version: 9 } });
		acceptAnyVersion();

		const applied = await fixture.service.applyMovement(movement({ quantityDelta: 1 }) as never);

		expect(applied).toMatchObject({ version: 10, quantityAfter: 5 });
		expect(fixture.store.levelFor()).toMatchObject({ quantity: 5, version: 10 });
	});

	it('measures a request that states no version against the version read under the row lock', async () => {
		// A route that did not opt in, a worker, a seed: the request states nothing, the kernel's reader
		// refuses it with `428`, and the engine treats that refusal as "no version was accepted". The
		// write then stands on the engine's own compare-and-set, predicated on the version this
		// transaction read under the row lock.
		const fixture = levelFixture({ level: { quantity: 10, version: 4 } });
		stateNoVersion();

		const applied = await fixture.service.applyMovement(movement({ quantityDelta: 2 }) as never);

		expect(applied).toMatchObject({ version: 5, quantityAfter: 12 });
		expect(fixture.store.levelFor()).toMatchObject({ quantity: 12, version: 5 });
		expect(fixture.store.ledgerOf()).toHaveLength(1);
	});

	it('does not read the version a route stated for its own record as the level’s', async () => {
		// The receipt of a return: the route is versioned on the return, which its caller read at 2, and
		// the goods it receives are posted through this engine against a level at version 1. Reading
		// the return's version as the level's refused every receipt with `409 { expectedVersion: 2,
		// actualVersion: 1 }` — no client could receive a return — so a version the route did not
		// name the level's table for is the route's own, and the level is written under the engine's
		// compare-and-set on the version it read under the row lock.
		const fixture = levelFixture({ level: { quantity: 10, version: 1 } });
		acceptVersionOfAnotherRecord(2);

		const applied = await fixture.service.applyMovement(movement({ quantityDelta: 3 }) as never);

		expect(applied).toMatchObject({ version: 2, quantityBefore: 10, quantityAfter: 13 });
		expect(fixture.store.levelFor()).toMatchObject({ quantity: 13, version: 2 });
		expect(fixture.store.ledgerOf()).toHaveLength(1);
	});

	it('still refuses a stale version when the route named the level as what it versions', async () => {
		// The other half of the same rule: the target is what makes a stated version the level's, and
		// a route that states it is held to it exactly as before.
		const fixture = levelFixture({ level: { quantity: 10, version: 1 } });
		acceptVersion(2);

		const refusal = await refusalOf(fixture.service.applyMovement(movement({ quantityDelta: 3 }) as never));

		expect(refusal.getStatus()).toBe(HttpStatus.CONFLICT);
		expect(refusal.code).toBe('ENTITY_VERSION_CONFLICT');
		expect(fixture.store.levelFor()).toMatchObject({ quantity: 10, version: 1 });
		expect(fixture.store.ledgerOf()).toEqual([]);
	});

	it('retries a contended write when the request states no version, and still writes one movement', async () => {
		// Without a stated version there is no decision of the caller's to invalidate, so waiting for the
		// row is the right answer: the attempt is retried against the state the winner left behind, and
		// the retry's own before-and-after are the winner's numbers.
		const fixture = levelFixture({
			level: { quantity: 10, version: 1 },
			contention: { loseAttempts: 1, competingQuantityDelta: 5 }
		});
		stateNoVersion();

		const applied = await fixture.service.applyMovement(movement({ quantityDelta: 5 }) as never);

		expect(fixture.store.casAttempts()).toBe(2);
		expect(applied).toMatchObject({ version: 3, quantityBefore: 15, quantityAfter: 20 });
		expect(fixture.store.levelFor()).toMatchObject({ quantity: 20, version: 3 });
		expect(fixture.store.ledgerOf()).toHaveLength(1);
	});
});
