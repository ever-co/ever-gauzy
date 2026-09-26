/**
 * Three module boundaries are doubled here, and the reason is the same for all three.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a reservation service needs and none of which is
 * available outside a running application; its nested `uuid` is ESM-only, so reading one entity would
 * fail under jest. `@gauzy/config` reads the process environment at import time. Both are therefore
 * doubled at the module boundary, and **the services under test are the real ones**: the reservation
 * service and the real ledger engine it writes every transition through.
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
			// The tenant and the organization a row is stamped with, stated where the module is replaced
			// because a jest mock factory cannot read a fixture constant declared below it.
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

import { FindOperator } from 'typeorm';
import { Product, ProductVariant, WarehouseProduct, WarehouseProductVariant } from '@gauzy/core';
import { StockMovementType, StockReservationReferenceType, StockReservationStatus } from '../inventory.enums';
import { StockLevelService } from '../stock-level/stock-level.service';
import { StockMovement } from '../stock-movement/stock-movement.entity';
import { StockReservation } from './stock-reservation.entity';
import { StockReservationService } from './stock-reservation.service';

/**
 * Holds on stock.
 *
 * A reservation is what stands between a buyer and an oversell, so the properties the specification
 * fixes are the ones this suite pins (doc 09 §5, §15):
 *
 * - a hold is written **beside the ledger row that explains it**: `reserve` writes the reservation and
 *   a `RESERVATION` movement in one step, and `release` writes `RELEASED` and a `RELEASE` movement —
 *   so `reservedQuantity` is always the sum of the `ACTIVE` rows (INV-03, P4.3);
 * - `quantity`, `warehouseId` and `variantId` are written once and never change; only the status, the
 *   expiry and the document a hold belongs to may move (INV-18), which is what makes a hold safe to
 *   re-point from a cart to an order at placement;
 * - a hold is closed **at most once**: releasing a released hold is refused rather than applied twice,
 *   so the reserved quantity cannot be given back twice (P4.7);
 * - availability decides a new hold, and the numbers that decided a refusal are reported with it;
 * - the expiry sweep closes the holds whose instant has passed and leaves the rest, and a second sweep
 *   of the same holds is a no-op.
 *
 * The clock is injected wherever an expiry decides the verdict: the TTL of a hold and the sweep's
 * window are both read from it, and neither is allowed to depend on when the suite runs.
 *
 * Both services are constructed directly over an in-memory double of the connection. The double keeps
 * a real snapshot so a refused write leaves nothing behind, and it applies the compare-and-set the
 * ledger engine uses for real — including the case where a competing writer won the row between the
 * availability read and the write.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const WAREHOUSE = '00000000-0000-4000-8000-000000000010';
const PRODUCT = '00000000-0000-4000-8000-000000000020';
const VARIANT = '00000000-0000-4000-8000-000000000030';
const CART = '00000000-0000-4000-8000-000000000040';
const ORDER = '00000000-0000-4000-8000-000000000041';

/** The programme's frozen clock: every expiry verdict below is decided by it and not by the wall clock. */
const AT = new Date('2026-01-15T12:00:00.000Z');
const MINUTE = 60_000;

type Row = Record<string, any>;

/** How a competing writer interferes with the ledger engine's compare-and-set. */
interface IContention {
	loseAttempts: number;
	competingQuantityDelta: number;
}

/**
 * The in-memory stand-in for the connection both services write through.
 *
 * @param tables The whole datastore.
 * @param options.contention How a competing writer interferes with the compare-and-set.
 */
function datastore(tables: Record<string, Row[]>, options: { contention?: IContention } = {}) {
	const entityToTable = new Map<unknown, string>([
		[Product, 'product'],
		[ProductVariant, 'product_variant'],
		[WarehouseProduct, 'warehouse_product'],
		[WarehouseProductVariant, 'warehouse_product_variant'],
		[StockMovement, 'stock_movement'],
		[StockReservation, 'stock_reservation']
	]);
	let sequence = 0;
	const contention = options.contention ?? { loseAttempts: 0, competingQuantityDelta: 0 };
	let casLosses = contention.loseAttempts;
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
			tables[table] = tableRows;
		}
		// A competing writer's commit is not the engine's to roll back.
		for (const [levelId, state] of committedElsewhere) {
			const level = tables.warehouse_product_variant.find((row) => row.id === levelId);

			if (level) {
				Object.assign(level, state);
			}
		}
	};
	/** One column's condition, including the comparison the expiry sweep builds with `LessThanOrEqual`. */
	const matches = (row: Row, where: Row = {}) =>
		Object.entries(where).every(([field, expected]) => {
			if (expected instanceof FindOperator) {
				const value = row[field];

				switch (expected.type) {
					case 'lessThanOrEqual':
						return new Date(value).getTime() <= new Date(expected.value as Date).getTime();
					case 'moreThanOrEqual':
						return new Date(value).getTime() >= new Date(expected.value as Date).getTime();
					case 'isNull':
						return value === null || value === undefined;
					case 'not':
						return !same(value, expected.value);
					default:
						throw new Error(`the in-memory double does not implement the "${expected.type}" operator`);
				}
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

	let manager: any;
	const createQueryBuilder = (entity?: unknown): any => {
		let target = entity;
		let rawSelect: string | null = null;
		let updateSpec: Row | null = null;
		const conditions: Array<{ sql: string; params: Row }> = [];
		const query: any = {
			innerJoin: () => query,
			leftJoin: () => query,
			select: (first: unknown, second?: string) => {
				if (!Array.isArray(first) && typeof second === 'string') {
					rawSelect = String(first);
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
				const params = conditions.reduce<Row>((all, one) => ({ ...all, ...one.params }), {});

				if (/SUM\(reservation\.quantity\)/.test(rawSelect ?? '')) {
					const total = tables.stock_reservation
						.filter(
							(reservation) =>
								same(reservation.variantId, params.variantId) &&
								same(reservation.warehouseId, params.warehouseId) &&
								same(reservation.status, params.status)
						)
						.reduce((sum, reservation) => sum + Number(reservation.quantity ?? 0), 0);

					return { total };
				}
				if (/SUM\(movement\.quantity\)/.test(rawSelect ?? '')) {
					const total = tables.stock_movement
						.filter(
							(movement) =>
								same(movement.variantId, params.variantId) &&
								same(movement.warehouseId, params.warehouseId)
						)
						.reduce((sum, movement) => sum + Number(movement.quantity ?? 0), 0);

					return { total };
				}

				throw new Error(`the in-memory double does not implement the raw read "${rawSelect}"`);
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

				if (version !== undefined && casLosses > 0) {
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

				for (const [column, value] of Object.entries(updateSpec)) {
					row[column] = typeof value === 'function' ? Number(row[column] ?? 0) + deltaFrom(value, conditions.reduce<Row>((all, one) => ({ ...all, ...one.params }), {})) : value;
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
		insert: async (entity: unknown, partial: Row) => {
			const row = { id: `${String(entityToTable.get(entity))}-${++sequence}`, ...partial };

			rows(entity).push(row);

			return row;
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
			if (/SET LOCAL lock_timeout|SET SESSION innodb_lock_wait_timeout/.test(sql)) {
				return [];
			}
			if (/FOR UPDATE/.test(sql)) {
				return [];
			}
			if (/FROM "product_variant"/.test(sql)) {
				const variant = tables.product_variant.find((row) => same(row.id, params[0]));

				return variant ? [{ productId: variant.productId }] : [];
			}

			throw new Error(`the in-memory double does not implement the statement "${sql}"`);
		}
	};

	/**
	 * The transaction both the connection and the manager hand out: the callback sees the same
	 * datastore, and a throw from anywhere inside it puts the datastore back exactly as it was — which
	 * is the property every "nothing was written" assertion below depends on. A competing writer's
	 * committed change survives, because in the world this stands in for it was committed elsewhere.
	 */
	manager.transaction = async (run: (transactional: any) => Promise<any>) => {
		const copy = snapshot();

		try {
			return await run(manager);
		} catch (error) {
			restore(copy);
			throw error;
		}
	};

	const dataSource: any = {
		manager,
		createQueryBuilder,
		transaction: manager.transaction
	};
	/**
	 * The reservation repository the service is constructed with: the same datastore, reached the way
	 * the real repository reaches it, so a write made through either one is visible to the other.
	 */
	const reservationRepository: any = {
		manager,
		createQueryBuilder: () => createQueryBuilder(StockReservation),
		metadata: { tableName: 'stock_reservation', hasColumnWithPropertyPath: () => false },
		create: (partial: Row) => ({ ...partial }),
		save: async (entity: any) => manager.save(StockReservation, entity),
		find: async (options: any = {}) => {
			const found = ordered(
				tables.stock_reservation.filter((row) => matches(row, options.where)),
				options.order
			);

			return options.take ? found.slice(0, options.take) : found;
		},
		findOne: async (options: any = {}) =>
			tables.stock_reservation.find((row) => matches(row, options.where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = tables.stock_reservation.filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async () => tables.stock_reservation.length,
		update: async (criteria: any, patch: Row) => manager.update(StockReservation, criteria?.id ?? criteria, patch),
		delete: async (criteria: any) => manager.delete(StockReservation, criteria?.id ?? criteria)
	};

	return {
		dataSource,
		manager,
		tables,
		reservationRepository,
		level: () => tables.warehouse_product_variant[0],
		ledger: () => tables.stock_movement,
		reservations: () => tables.stock_reservation
	};
}

/**
 * Builds the reservation service over the real ledger engine and one in-memory datastore.
 *
 * @param options.quantity What the level holds at the fixture location.
 * @param options.reservedQuantity What it already holds for somebody else.
 * @param options.safetyStock The floor a new hold may not consume.
 * @param options.allowBackorder Whether the level's policy permits backordered holds.
 * @param options.backorderLimit The limit that policy states, when it states one.
 * @param options.seedLevel Whether the variant is stocked at all.
 * @param options.contention How a competing writer interferes with the ledger's compare-and-set.
 */
function reservationFixture(
	options: {
		quantity?: number;
		reservedQuantity?: number;
		safetyStock?: number;
		allowBackorder?: boolean;
		backorderLimit?: number | null;
		seedLevel?: boolean;
		contention?: IContention;
	} = {}
) {
	const tables: Record<string, Row[]> = {
		product: [{ id: PRODUCT, tenantId: TENANT, organizationId: ORG }],
		// Where a variant says which product it belongs to: the answer the ledger engine resolves a
		// first-time level from when a caller names no product, and the claim it checks a stated one
		// against when a caller names something else.
		product_variant: [{ id: VARIANT, productId: PRODUCT }],
		warehouse_product: [],
		warehouse_product_variant: [],
		stock_movement: [],
		stock_reservation: []
	};
	const aggregate = {
		id: 'aggregate-1',
		tenantId: TENANT,
		organizationId: ORG,
		warehouseId: WAREHOUSE,
		productId: PRODUCT,
		quantity: options.quantity ?? 0,
		reservedQuantity: options.reservedQuantity ?? 0,
		version: 1
	};

	if (options.seedLevel !== false) {
		tables.warehouse_product.push(aggregate);
		tables.warehouse_product_variant.push({
			id: 'level-1',
			tenantId: TENANT,
			organizationId: ORG,
			warehouseProductId: aggregate.id,
			variantId: VARIANT,
			quantity: options.quantity ?? 0,
			reservedQuantity: options.reservedQuantity ?? 0,
			incomingQuantity: 0,
			safetyStock: options.safetyStock ?? 0,
			allowBackorder: options.allowBackorder ?? false,
			backorderLimit: options.backorderLimit ?? null,
			trackInventory: true,
			isUnlimited: false,
			version: 1
		});
	}

	const store = datastore(tables, { contention: options.contention });
	const stockLevelService = new StockLevelService(store.dataSource as never);
	const service = new StockReservationService(
		store.reservationRepository as never,
		{} as never,
		stockLevelService
	);
	const activeOf = (referenceId: string = CART) =>
		store
			.reservations()
			.filter((row) => row.referenceId === referenceId && row.status === StockReservationStatus.ACTIVE);

	return { service, store, tables, activeOf };
}

/** One hold request, so a case states only what it is about. */
const hold = (overrides: Row = {}) => ({
	variantId: VARIANT,
	productId: PRODUCT,
	warehouseId: WAREHOUSE,
	quantity: 2,
	referenceType: StockReservationReferenceType.CART,
	referenceId: CART,
	...overrides
});

describe('StockReservationService — holding stock (doc 09 §5, INV-03)', () => {
	it('holds a quantity and records the ledger row that explains the level’s reserved quantity', async () => {
		const fixture = reservationFixture({ quantity: 10 });

		const reservation = await fixture.service.reserve(hold({ quantity: 2 }) as never);

		expect(reservation).toMatchObject({
			variantId: VARIANT,
			warehouseId: WAREHOUSE,
			warehouseProductVariantId: 'level-1',
			quantity: 2,
			status: StockReservationStatus.ACTIVE,
			referenceType: StockReservationReferenceType.CART,
			referenceId: CART,
			tenantId: TENANT,
			organizationId: ORG
		});
		// The units are still on hand: a hold is a reservation-only movement.
		expect(fixture.store.level()).toMatchObject({ quantity: 10, reservedQuantity: 2 });
		expect(fixture.store.ledger()).toHaveLength(1);
		expect(fixture.store.ledger()[0]).toMatchObject({
			type: StockMovementType.RESERVATION,
			quantity: 0,
			quantityBefore: 10,
			quantityAfter: 10,
			reservedBefore: 0,
			reservedAfter: 2,
			referenceType: 'CART',
			referenceId: CART
		});
		// INV-03: the level's reserved quantity is the sum of the ACTIVE holds.
		expect(Number(fixture.store.level().reservedQuantity)).toBe(2);
	});

	it('derives the expiry of a hold from the document it belongs to', async () => {
		// The TTLs are the documented defaults (doc 09 §5.5): a cart holds for half an hour, an order for
		// a week, a subscription billing run for three days. The clock is injected, so the window is the
		// service's and not the suite's.
		jest.useFakeTimers({ now: AT });

		try {
			const fixture = reservationFixture({ quantity: 100 });

			const cart = await fixture.service.reserve(hold({ referenceId: CART }) as never);
			const order = await fixture.service.reserve(
				hold({ referenceType: StockReservationReferenceType.ORDER, referenceId: ORDER }) as never
			);
			const subscription = await fixture.service.reserve(
				hold({
					referenceType: StockReservationReferenceType.SUBSCRIPTION,
					referenceId: 'subscription-1'
				}) as never
			);
			const stated = new Date(AT.getTime() + 5 * MINUTE);
			const explicit = await fixture.service.reserve(
				hold({ referenceId: 'order-2', expiresAt: stated }) as never
			);

			expect(new Date(cart.expiresAt).getTime() - AT.getTime()).toBe(30 * MINUTE);
			expect(new Date(order.expiresAt).getTime() - AT.getTime()).toBe(10080 * MINUTE);
			expect(new Date(subscription.expiresAt).getTime() - AT.getTime()).toBe(4320 * MINUTE);
			// A caller that states its own expiry is taken at its word.
			expect(new Date(explicit.expiresAt).getTime()).toBe(stated.getTime());
		} finally {
			jest.useRealTimers();
		}
	});

	it('refuses a hold that availability cannot cover, with the numbers that decided it', async () => {
		const fixture = reservationFixture({ quantity: 2 });

		await expect(fixture.service.reserve(hold({ quantity: 3 }) as never)).rejects.toMatchObject({
			response: { code: 'STOCK_INSUFFICIENT_AVAILABLE', details: { requested: 3, available: 2 } }
		});
		expect(fixture.store.reservations()).toEqual([]);
		expect(fixture.store.ledger()).toEqual([]);
		expect(fixture.store.level()).toMatchObject({ quantity: 2, reservedQuantity: 0, version: 1 });
	});

	it('counts the safety stock as unavailable to a new hold', async () => {
		// The safety stock is the floor a *new* demand may not consume (doc 09 §3.3), which is why it is
		// subtracted from what a hold may take and never from a hold that already exists.
		const fixture = reservationFixture({ quantity: 10, safetyStock: 4 });

		await expect(fixture.service.reserve(hold({ quantity: 7 }) as never)).rejects.toMatchObject({
			response: { code: 'STOCK_INSUFFICIENT_AVAILABLE', details: { requested: 7, available: 6 } }
		});

		const accepted = await fixture.service.reserve(hold({ quantity: 6 }) as never);

		expect(accepted.quantity).toBe(6);
		expect(fixture.store.level()).toMatchObject({ quantity: 10, reservedQuantity: 6, safetyStock: 4 });
	});

	it('refuses a hold of zero or a negative quantity', async () => {
		const fixture = reservationFixture({ quantity: 10 });

		for (const quantity of [0, -1]) {
			await expect(fixture.service.reserve(hold({ quantity }) as never)).rejects.toMatchObject({
				response: { code: 'STOCK_INVARIANT_VIOLATION', details: { requested: quantity } }
			});
		}
		expect(fixture.store.reservations()).toEqual([]);
		expect(fixture.store.ledger()).toEqual([]);
	});

	it('refuses a hold at a location where the variant has never been stocked', async () => {
		// Nothing on hand is not the same as "not stocked here", but neither can cover a hold: the variant
		// has to arrive before it can be held (doc 09 §5.2).
		const fixture = reservationFixture({ seedLevel: false });

		await expect(fixture.service.reserve(hold({ quantity: 1 }) as never)).rejects.toMatchObject({
			response: { code: 'STOCK_INSUFFICIENT_AVAILABLE', details: { requested: 1, available: 0 } }
		});
		expect(fixture.store.reservations()).toEqual([]);
		expect(fixture.store.ledger()).toEqual([]);
	});

	it('opens the level from the variant’s own product when a hold is allowed to be a backorder', async () => {
		// The one path on which a hold reaches a location that has never stocked the variant: the caller
		// states that the demand may be backordered, so nothing is there to hold and nothing is there to
		// take the product from either. The variant names its own product, and the level and the aggregate
		// it hangs from are opened from that answer rather than refused for a product the caller — which
		// states the variant and the location — had no way to know.
		const fixture = reservationFixture({ seedLevel: false });

		const accepted = await fixture.service.reserve(hold({ quantity: 2, allowBackorder: true }) as never);

		expect(accepted).toMatchObject({ quantity: 2, status: StockReservationStatus.ACTIVE });
		expect(fixture.tables.warehouse_product).toEqual([
			expect.objectContaining({ warehouseId: WAREHOUSE, productId: PRODUCT, reservedQuantity: 2 })
		]);
		expect(fixture.store.level()).toMatchObject({
			variantId: VARIANT,
			quantity: 0,
			reservedQuantity: 2,
			version: 2
		});
		// The hold and the ledger row that explains it are still one write, on a level this call created.
		expect(fixture.store.ledger()).toHaveLength(1);
		expect(fixture.store.ledger()[0]).toMatchObject({
			type: StockMovementType.RESERVATION,
			quantity: 0,
			reservedBefore: 0,
			reservedAfter: 2,
			warehouseProductVariantId: fixture.store.level().id
		});
		// INV-03 on the level that was opened by the hold: the reserved quantity is the sum of the holds.
		expect(fixture.store.level().reservedQuantity).toBe(
			fixture.store.reservations().reduce((sum, row) => sum + Number(row.quantity), 0)
		);
	});

	// The hold row and the movement that explains it are one write: `reserve` creates the reservation
	// inside the transaction that moves the level (`stock-reservation.service.ts`, the
	// `manager.transaction(...)` that wraps the `manager.save(StockReservation, reservation)` and the
	// `applyMovement` call), so a ledger refusal takes the hold back with it. Here the level is
	// contended: a competing writer won the row between the availability read and the write, four
	// compare-and-set attempts were overtaken, and the engine refuses with `STOCK_CONFLICT`. The hold
	// must not survive that — a hold no movement accounts for breaks INV-03
	// (`reservedQuantity = Σ ACTIVE holds`) and leaves a phantom for the expiry sweep to trip over.
	it('leaves no hold behind when the ledger refuses the write', async () => {
		const fixture = reservationFixture({
			quantity: 10,
			allowBackorder: false,
			contention: { loseAttempts: 4, competingQuantityDelta: 0 }
		});

		await expect(fixture.service.reserve(hold({ quantity: 2 }) as never)).rejects.toMatchObject({
			response: { code: 'STOCK_CONFLICT' }
		});

		expect(fixture.store.reservations()).toEqual([]);
		expect(fixture.store.level()).toMatchObject({ reservedQuantity: 0 });
	});

	// The same seam, seen from the caller's side: doc 09 §5.2 states `allowBackorder` as an override of
	// the level policy *for this call*, and a hold beyond the on-hand quantity is exactly the call it
	// exists for. Both guards read it — the service's availability check and the ledger engine's hold
	// rule — so the override reaches the place where the hold is actually taken.
	it('honours the caller’s backorder override for a hold past the on-hand quantity', async () => {
		const fixture = reservationFixture({ quantity: 10, allowBackorder: false });

		const accepted = await fixture.service.reserve(hold({ quantity: 12, allowBackorder: true }) as never);

		expect(accepted).toMatchObject({ quantity: 12, status: StockReservationStatus.ACTIVE });
		expect(fixture.store.level()).toMatchObject({ quantity: 10, reservedQuantity: 12 });
	});
});

describe('StockReservationService — releasing, expiring and re-pointing (INV-03, INV-18, P4.3, P4.7)', () => {
	it('releases a hold and returns the reserved quantity to what it was', async () => {
		const fixture = reservationFixture({ quantity: 10 });
		const reservation = await fixture.service.reserve(hold({ quantity: 3 }) as never);

		const released = await fixture.service.release(reservation.id, 'CART_ABANDONED');

		expect(released).toMatchObject({ status: StockReservationStatus.RELEASED });
		expect(released.releasedAt).toBeInstanceOf(Date);
		expect(fixture.store.level()).toMatchObject({ quantity: 10, reservedQuantity: 0 });
		expect(fixture.store.ledger().map((row) => row.type)).toEqual([
			StockMovementType.RESERVATION,
			StockMovementType.RELEASE
		]);
		expect(fixture.store.ledger()[1]).toMatchObject({
			quantity: 0,
			reservedBefore: 3,
			reservedAfter: 0,
			reason: 'CART_ABANDONED'
		});
		// INV-03 again, this time with nothing ACTIVE left: the two numbers agree.
		expect(fixture.store.level().reservedQuantity).toBe(0);
		expect(fixture.activeOf()).toEqual([]);
	});

	it('refuses to close a hold twice and writes no second release', async () => {
		// P4.7: a hold is consumed at most once. Releasing twice would give the reserved quantity back
		// twice, which is how a level ends up holding negative stock.
		const fixture = reservationFixture({ quantity: 10 });
		const reservation = await fixture.service.reserve(hold({ quantity: 3 }) as never);

		await fixture.service.release(reservation.id);

		await expect(fixture.service.release(reservation.id)).rejects.toMatchObject({
			response: {
				code: 'RESERVATION_ALREADY_CLOSED',
				details: { reservationId: reservation.id, status: StockReservationStatus.RELEASED }
			}
		});
		expect(fixture.store.ledger()).toHaveLength(2);
		expect(fixture.store.level()).toMatchObject({ reservedQuantity: 0 });
	});

	it('refuses to close a hold that does not exist', async () => {
		const fixture = reservationFixture({ quantity: 10 });

		await expect(fixture.service.release('no-such-hold')).rejects.toMatchObject({
			response: { code: 'RESERVATION_NOT_FOUND', details: { reservationId: 'no-such-hold' } }
		});
		expect(fixture.store.ledger()).toEqual([]);
	});

	it('expires the holds whose instant has passed and leaves the ones that have not', async () => {
		jest.useFakeTimers({ now: AT });

		try {
			const fixture = reservationFixture({ quantity: 100 });

			await fixture.service.reserve(
				hold({ quantity: 1, referenceId: CART, expiresAt: new Date(AT.getTime() - MINUTE) }) as never
			);
			await fixture.service.reserve(
				hold({
					quantity: 2,
					referenceType: StockReservationReferenceType.ORDER,
					referenceId: ORDER,
					expiresAt: new Date(AT.getTime() - 1)
				}) as never
			);
			await fixture.service.reserve(
				hold({ quantity: 4, referenceId: 'order-2', expiresAt: new Date(AT.getTime() + MINUTE) }) as never
			);

			const swept = await fixture.service.releaseExpired();

			expect(swept).toMatchObject({ released: 2, batches: 1 });
			// The hold that has not expired is untouched, and the level's reserved quantity is exactly the
			// sum of what is still ACTIVE (INV-03).
			expect(fixture.store.level()).toMatchObject({ reservedQuantity: 4 });
			const stillActive = fixture.store
				.reservations()
				.filter((row) => row.status === StockReservationStatus.ACTIVE);

			expect(stillActive).toHaveLength(1);
			expect(stillActive[0]).toMatchObject({ quantity: 4, referenceId: 'order-2' });
			expect(
				fixture.store.reservations().filter((row) => row.status === StockReservationStatus.EXPIRED)
			).toHaveLength(2);
			expect(fixture.store.ledger().filter((row) => row.reason === 'EXPIRED')).toHaveLength(2);
		} finally {
			jest.useRealTimers();
		}
	});

	it('expires nothing on a second sweep of the same holds', async () => {
		jest.useFakeTimers({ now: AT });

		try {
			const fixture = reservationFixture({ quantity: 100 });

			await fixture.service.reserve(
				hold({ quantity: 2, expiresAt: new Date(AT.getTime() - MINUTE) }) as never
			);
			await fixture.service.releaseExpired();

			const again = await fixture.service.releaseExpired();

			// The state guard turns a second sweep into a no-op rather than a second release, so the two
			// workers of a distributed sweep cannot both give the same hold back.
			expect(again).toMatchObject({ released: 0, batches: 0 });
			expect(fixture.store.ledger()).toHaveLength(2);
			expect(fixture.store.level()).toMatchObject({ reservedQuantity: 0 });
		} finally {
			jest.useRealTimers();
		}
	});

	it('re-points holds from a cart to an order without changing their quantities (INV-18)', async () => {
		const fixture = reservationFixture({ quantity: 10 });

		await fixture.service.reserve(hold({ quantity: 2, lineId: 'cart-line-1' }) as never);
		await fixture.service.reserve(hold({ quantity: 3, lineId: 'cart-line-2' }) as never);
		const levelBefore = { ...fixture.store.level() };

		const moved = await fixture.service.reassign(
			{ referenceType: StockReservationReferenceType.CART, referenceId: CART },
			{ referenceType: StockReservationReferenceType.ORDER, referenceId: ORDER },
			{ 'cart-line-1': 'order-line-1' }
		);

		expect(moved).toBe(2);
		expect(fixture.activeOf(ORDER)).toHaveLength(2);
		expect(fixture.store.reservations().map((row) => row.referenceType)).toEqual(['ORDER', 'ORDER']);
		expect(fixture.store.reservations().map((row) => row.lineId)).toEqual(['order-line-1', 'cart-line-2']);
		// Nothing about the stock moved with the re-point: the same units are held, by another document.
		expect(fixture.store.level()).toMatchObject({
			quantity: levelBefore.quantity,
			reservedQuantity: levelBefore.reservedQuantity,
			version: levelBefore.version
		});
		expect(fixture.store.ledger()).toHaveLength(2);
		expect(fixture.store.level()).toMatchObject({ reservedQuantity: 5 });
	});

	it('re-points the active holds only, leaving a closed one where it was', async () => {
		const fixture = reservationFixture({ quantity: 10 });
		const released = await fixture.service.reserve(hold({ quantity: 1, lineId: 'cart-line-1' }) as never);
		await fixture.service.reserve(hold({ quantity: 2, lineId: 'cart-line-2' }) as never);
		await fixture.service.release(released.id);

		const moved = await fixture.service.reassign(
			{ referenceType: StockReservationReferenceType.CART, referenceId: CART },
			{ referenceType: StockReservationReferenceType.ORDER, referenceId: ORDER }
		);

		expect(moved).toBe(1);
		expect(fixture.store.reservations().map((row) => [row.referenceId, row.status])).toEqual([
			[CART, StockReservationStatus.RELEASED],
			[ORDER, StockReservationStatus.ACTIVE]
		]);
	});

	it('pushes the expiry of the active holds of one document only', async () => {
		jest.useFakeTimers({ now: AT });

		try {
			const fixture = reservationFixture({ quantity: 100 });
			const closed = await fixture.service.reserve(
				hold({ quantity: 1, referenceType: StockReservationReferenceType.ORDER, referenceId: ORDER }) as never
			);
			await fixture.service.reserve(
				hold({ quantity: 1, referenceType: StockReservationReferenceType.ORDER, referenceId: ORDER }) as never
			);
			const other = await fixture.service.reserve(
				hold({ quantity: 1, referenceType: StockReservationReferenceType.CART, referenceId: CART }) as never
			);
			await fixture.service.release(closed.id);

			const extended = await fixture.service.extend(
				StockReservationReferenceType.ORDER,
				ORDER,
				new Date(AT.getTime() + 60 * MINUTE)
			);

			expect(extended).toBe(1);
			const [released, active, cart] = fixture.store.reservations();
			expect(new Date(released.expiresAt).getTime()).toBe(closed.expiresAt.getTime());
			expect(new Date(active.expiresAt).getTime()).toBe(AT.getTime() + 60 * MINUTE);
			expect(new Date(cart.expiresAt).getTime()).toBe(other.expiresAt.getTime());
		} finally {
			jest.useRealTimers();
		}
	});

	it('keeps the level’s reserved quantity equal to the sum of the active holds over a mixed sequence', async () => {
		// P4.3, the property the reconciliation re-derives the level from: whatever mixture of holds and
		// releases happened, the level equals the ACTIVE rows and the ledger explains the difference.
		const fixture = reservationFixture({ quantity: 20 });

		const first = await fixture.service.reserve(hold({ quantity: 3, referenceId: CART }) as never);
		await fixture.service.reserve(hold({ quantity: 2, referenceId: CART }) as never);
		await fixture.service.reserve(
			hold({ quantity: 4, referenceType: StockReservationReferenceType.ORDER, referenceId: ORDER }) as never
		);
		await fixture.service.release(first.id);
		await fixture.service.reserve(hold({ quantity: 1, referenceId: CART }) as never);

		const activeSum = fixture
			.store.reservations()
			.filter((row) => row.status === StockReservationStatus.ACTIVE)
			.reduce((sum, row) => sum + Number(row.quantity), 0);

		expect(activeSum).toBe(7);
		expect(Number(fixture.store.level().reservedQuantity)).toBe(activeSum);
		// The on-hand quantity never moved: holds are holds.
		expect(fixture.store.level()).toMatchObject({ quantity: 20 });
		// And the reserved side of the ledger is the reserved side of the level.
		expect(
			fixture.store.ledger().reduce((sum, row) => sum + Number(row.reservedAfter - row.reservedBefore), 0)
		).toBe(activeSum);
	});

	it('sums the active holds of a level, which is what the reconciliation re-derives from', async () => {
		const fixture = reservationFixture({ quantity: 10 });

		const first = await fixture.service.reserve(hold({ quantity: 2 }) as never);
		await fixture.service.reserve(hold({ quantity: 3 }) as never);
		await fixture.service.release(first.id);

		expect(await fixture.service.sumActiveForLevel(VARIANT, WAREHOUSE)).toBe(3);
		// A hold of another location is not this level's, and a released one is not a hold.
		expect(await fixture.service.sumActiveForLevel(VARIANT, 'another-location')).toBe(0);
	});
});


