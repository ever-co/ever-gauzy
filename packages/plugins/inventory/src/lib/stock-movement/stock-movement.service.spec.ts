/**
 * Two module boundaries are doubled here, for the same reason.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a ledger reader needs and none of which is available
 * outside a running application; its nested `uuid` is ESM-only, so reading one entity would fail
 * under jest. `@gauzy/config` reads the process environment at import time. Both are therefore
 * doubled at the module boundary, and **the service under test is the real one**, together with the
 * real `stock_movement` entity it reads.
 *
 * The base-class double mirrors `TenantAwareCrudService` where the behaviour is observable to a
 * caller, and nothing else: the point of this suite is that the ledger's mutating entry points are
 * closed, so what the double must not do is quietly offer one the service does not.
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

		async save(entity: any): Promise<any> {
			return this.typeOrmRepository.save(entity);
		}

		async update(id: any, partial: any): Promise<any> {
			return this.typeOrmRepository.update(id, partial);
		}

		async delete(criteria: any): Promise<any> {
			return this.typeOrmRepository.delete(criteria);
		}

		async softDelete(criteria: any): Promise<any> {
			return this.typeOrmRepository.softDelete(criteria);
		}

		async softRemove(id: any): Promise<any> {
			return this.typeOrmRepository.softRemove(id);
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

import { RequestContext } from '@gauzy/core';
import { StockMovementType, StockMovementReferenceType } from '../inventory.enums';
import { StockMovement } from './stock-movement.entity';
import { StockMovementService } from './stock-movement.service';

/**
 * The stock ledger.
 *
 * `stock_movement` is append-only (INV-12, doc 09 §3.5), and the way this package enforces that is
 * worth pinning precisely: the service extends the platform's tenant-aware CRUD service and then
 * **closes every mutating entry point it inherits**, so a caller that reaches for an update gets a
 * stated reason instead of a silent no-op. The suite therefore asserts the refusals themselves, one
 * per entry point, and that a refused mutation leaves the ledger exactly as it was.
 *
 * The other half of the suite is the read the domain reconciles with: the sum of a level's movements
 * is that level's on-hand quantity (INV-01), scoped to the tenant and to the pair, which is what
 * makes the nightly reconciliation a report rather than a repair.
 *
 * The service is constructed directly with an in-memory double of its repository. The double states
 * the `where`, the `order` and the `take` the service states and models the aggregate read it builds,
 * so a sum that stopped narrowing to its tenant or to its `(variant, location)` pair is caught here.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000009';
const ORG = '00000000-0000-4000-8000-000000000002';
const WAREHOUSE = '00000000-0000-4000-8000-000000000010';
const OTHER_WAREHOUSE = '00000000-0000-4000-8000-000000000011';
const VARIANT = '00000000-0000-4000-8000-000000000030';
const OTHER_VARIANT = '00000000-0000-4000-8000-000000000031';

type Row = Record<string, any>;

/** One ledger row, of the shape the engine writes. */
const movementRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	warehouseId: WAREHOUSE,
	variantId: VARIANT,
	warehouseProductId: 'aggregate-1',
	warehouseProductVariantId: 'level-1',
	type: StockMovementType.RECEIPT,
	quantity: 1,
	quantityBefore: 0,
	quantityAfter: 1,
	reservedBefore: 0,
	reservedAfter: 0,
	referenceType: StockMovementReferenceType.PURCHASE_ORDER,
	referenceId: 'po-1',
	occurredAt: new Date('2026-01-15T12:00:00.000Z'),
	...overrides
});

/**
 * An in-memory stand-in for the `stock_movement` table and the level it explains.
 *
 * @param movements The ledger rows the fixture starts with.
 * @param level What the level row holds, when the case is about the two agreeing.
 */
function ledgerFixture(movements: Row[] = [], level?: Row) {
	const tables: Record<string, Row[]> = {
		stock_movement: [...movements],
		warehouse_product_variant: level ? [level] : []
	};
	const same = (left: unknown, right: unknown) => String(left ?? '') === String(right ?? '');
	const matches = (row: Row, where: Row = {}) =>
		Object.entries(where).every(([field, expected]) => {
			if (expected && typeof expected === 'object' && 'type' in (expected as Row)) {
				throw new Error(`the in-memory double does not implement the "${(expected as Row).type}" operator`);
			}

			return expected === undefined ? true : same(row[field], expected);
		});
	/** Every condition the aggregate read stated, applied to the ledger. */
	const matchingMovement = (conditions: Array<{ sql: string; params: Row }>) => {
		const params = conditions.reduce<Row>((all, one) => ({ ...all, ...one.params }), {});

		return tables.stock_movement.filter((row) => {
			if (params.variantId !== undefined && !same(row.variantId, params.variantId)) {
				return false;
			}
			if (params.warehouseId !== undefined && !same(row.warehouseId, params.warehouseId)) {
				return false;
			}
			if (params.tenantId !== undefined && !same(row.tenantId, params.tenantId)) {
				return false;
			}

			return true;
		});
	};

	const createQueryBuilder = (): any => {
		let rawSelect: string | null = null;
		const conditions: Array<{ sql: string; params: Row }> = [];
		const query: any = {
			select: (first: unknown, second?: string) => {
				if (!Array.isArray(first) && typeof second === 'string') {
					rawSelect = String(first);
				}

				return query;
			},
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
			getRawOne: async () => {
				if (!/SUM\(movement\.quantity\)/.test(rawSelect ?? '')) {
					throw new Error(`the in-memory double does not implement the raw read "${rawSelect}"`);
				}

				return {
					total: matchingMovement(conditions).reduce((sum, row) => sum + Number(row.quantity ?? 0), 0)
				};
			}
		};

		return query;
	};

	const repository: any = {
		metadata: { tableName: 'stock_movement', hasColumnWithPropertyPath: () => false },
		createQueryBuilder,
		create: (partial: Row) => ({ ...partial }),
		save: async (rowOrRows: any) => rowOrRows,
		find: async (options: any = {}) => tables.stock_movement.filter((row) => matches(row, options.where)),
		findOne: async (options: any = {}) =>
			tables.stock_movement.find((row) => matches(row, options.where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const found = tables.stock_movement
				.filter((row) => matches(row, options.where))
				.sort((left, right) => {
					const direction = options.order?.occurredAt === 'DESC' ? -1 : 1;

					return (
						(new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime()) * direction
					);
				});
			const items = options.take ? found.slice(0, options.take) : found;

			return [items, found.length];
		},
		count: async () => tables.stock_movement.length
	};

	return {
		service: new StockMovementService(repository as never, {} as never),
		repository,
		tables,
		ledger: () => tables.stock_movement
	};
}

describe('StockMovementService — the ledger is append-only (INV-12, doc 09 §3.5)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses to append a movement from a caller, because only the engine writes the ledger', async () => {
		// A movement carries the resulting quantity of the level row it changed, so it can only be produced
		// by the transaction that wrote that row. Accepting one from a caller would let the ledger and the
		// level disagree — which is the one thing the ledger exists to prevent.
		const fixture = ledgerFixture([movementRow('movement-1')]);

		await expect(
			(fixture.service.append as unknown as (input: unknown) => Promise<unknown>)({
				variantId: VARIANT,
				quantity: 5
			})
		).rejects.toMatchObject({ response: { code: 'STOCK_MOVEMENT_NOT_APPENDABLE' } });
		expect(fixture.ledger()).toHaveLength(1);
	});

	it('refuses to update, delete, soft-delete or soft-remove a movement', async () => {
		// The refusal is what makes the rule explicit: a caller that reaches for one of these gets a stated
		// reason — "record a reversing movement instead" — rather than a silent no-op or a lost audit trail.
		const fixture = ledgerFixture([movementRow('movement-1')]);
		const service = fixture.service as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;

		for (const method of ['update', 'delete', 'softDelete', 'softRemove']) {
			await expect(service[method]('movement-1', { quantity: 99 })).rejects.toMatchObject({
				response: { code: 'STOCK_MOVEMENT_NOT_APPENDABLE' }
			});
		}

		// The row is exactly as it was: the append-only rule is enforced here, not merely unexposed.
		expect(fixture.ledger()).toHaveLength(1);
		expect(fixture.ledger()[0]).toMatchObject({ quantity: 1, quantityAfter: 1 });
		expect('deletedAt' in fixture.ledger()[0]).toBe(false);
	});

	it('still reads the ledger it refuses to change', async () => {
		// Control: the refusals above must not have closed the reads the domain reconciles with.
		const fixture = ledgerFixture([movementRow('movement-1')]);

		expect(await fixture.service.sumForLevel(VARIANT, WAREHOUSE)).toBe(1);
	});
});

describe('StockMovementService — the reconciliation primitive (INV-01, doc 09 §10.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	});

	afterEach(() => jest.restoreAllMocks());

	it('sums the ledger of one level, which is the level’s on-hand quantity', async () => {
		// A ledger whose rows sum to the level they explain is the property the nightly reconciliation
		// reports on, so the primitive has to answer the level's own number.
		const fixture = ledgerFixture(
			[
				movementRow('movement-1', { type: StockMovementType.RECEIPT, quantity: 12 }),
				movementRow('movement-2', { type: StockMovementType.SALE, quantity: -5 }),
				movementRow('movement-3', { type: StockMovementType.RETURN, quantity: 3 }),
				movementRow('movement-4', { type: StockMovementType.WRITE_OFF, quantity: -1 })
			],
			{
				id: 'level-1',
				tenantId: TENANT,
				organizationId: ORG,
				variantId: VARIANT,
				quantity: 9,
				reservedQuantity: 0,
				version: 5
			}
		);

		expect(await fixture.service.sumForLevel(VARIANT, WAREHOUSE)).toBe(9);
		expect(fixture.tables.warehouse_product_variant[0].quantity).toBe(9);
	});

	it('sums one level only: another variant, another location and another tenant are not this level’s ledger', async () => {
		// The sum is the level's, and a sum that reached across any of the three would report drift that is
		// not there — or hide drift that is.
		const fixture = ledgerFixture([
			movementRow('mine', { quantity: 7 }),
			movementRow('another-variant', { quantity: 100, variantId: OTHER_VARIANT }),
			movementRow('another-location', { quantity: 100, warehouseId: OTHER_WAREHOUSE }),
			movementRow('another-tenant', { quantity: 100, tenantId: OTHER_TENANT })
		]);

		expect(await fixture.service.sumForLevel(VARIANT, WAREHOUSE)).toBe(7);
		// Control: the same rows, summed for the other pair, answer with that pair's own ledger.
		expect(await fixture.service.sumForLevel(OTHER_VARIANT, WAREHOUSE)).toBe(100);
		expect(await fixture.service.sumForLevel(VARIANT, OTHER_WAREHOUSE)).toBe(100);
	});

	it('lists the ledger of one level newest first and honours the take it was given', async () => {
		const fixture = ledgerFixture([
			movementRow('oldest', { occurredAt: new Date('2026-01-01T00:00:00.000Z') }),
			movementRow('newest', { occurredAt: new Date('2026-03-01T00:00:00.000Z') }),
			movementRow('middle', { occurredAt: new Date('2026-02-01T00:00:00.000Z') }),
			movementRow('elsewhere', { occurredAt: new Date('2026-04-01T00:00:00.000Z'), variantId: OTHER_VARIANT })
		]);

		const page = await fixture.service.findLedger({ variantId: VARIANT, warehouseId: WAREHOUSE, take: 2 });

		expect(page.items.map((row) => row.id)).toEqual(['newest', 'middle']);
		expect(page.total).toBe(3);
	});
});
