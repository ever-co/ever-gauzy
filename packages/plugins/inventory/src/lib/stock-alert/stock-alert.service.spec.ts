/**
 * Three module boundaries are doubled here, and the reason is the same for all three.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which an alert service needs and none of which is available
 * outside a running application; its nested `uuid` is ESM-only, so reading one entity would fail
 * under jest. `@gauzy/config` reads the process environment at import time. Both are therefore
 * doubled at the module boundary, and **the service under test is the real one**.
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
	})
);

import { WarehouseProduct, WarehouseProductVariant } from '@gauzy/core';
import { StockAlert } from './stock-alert.entity';
import { StockAlertService } from './stock-alert.service';

/**
 * Low-stock rules and their evaluation.
 *
 * An alert is a notification, and the two things that must be true about one are that it fires when
 * the stock is genuinely low and that it does not fire over and over about the same shortage
 * (doc 09 §10.1, §10.2, §15.3). The suite pins:
 *
 * - one rule per `(variant, location)`: a second rule watching the same pair is refused with the rule
 *   that already watches it named, because two rules over one pair would send two notifications for
 *   one shortage;
 * - availability is derived — on hand, less what is held, less the unsellable floor — and the
 *   threshold is **inclusive**: a rule fires when availability is at or below it and not when it is
 *   above;
 * - a rule whose last fire is inside its cooling-off period is **suppressed** rather than re-sent, and
 *   fires again once the period has passed;
 * - the cooldown is the *only* thing that suppresses a rule: a rule that is still breached fires again
 *   after the cooldown, and one that has come back above its threshold does not fire at all;
 * - evaluation **never writes stock**: it reads levels and writes at most the instant it fired.
 *
 * The clock is injected: `evaluate` takes the reference moment, and every verdict below is decided by
 * it rather than by when the suite runs.
 *
 * The service is constructed directly with an in-memory double of its repository. The double states
 * the `where` the service states and models the aggregate availability query it builds, so a rule
 * that stopped being scoped to its variant or its location is caught here.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const WAREHOUSE = '00000000-0000-4000-8000-000000000010';
const OTHER_WAREHOUSE = '00000000-0000-4000-8000-000000000011';
const PRODUCT = '00000000-0000-4000-8000-000000000020';
const VARIANT = '00000000-0000-4000-8000-000000000030';
const OTHER_VARIANT = '00000000-0000-4000-8000-000000000031';
const RULE = 'stock_alert-1';

/** The programme's frozen instants: nothing here may depend on the wall clock. */
const AT = new Date('2026-01-15T12:00:00.000Z');
const MINUTE = 60_000;

type Row = Record<string, any>;

/**
 * An in-memory stand-in for the alert repository.
 *
 * @param tables The whole datastore.
 * @param entityToTable The table each entity class names.
 */
function repository(tables: Record<string, Row[]>, entityToTable: Map<unknown, string>) {
	let sequence = 0;
	const rows = (entity: unknown): Row[] => {
		const table = entityToTable.get(entity);

		if (!table) {
			throw new Error('the in-memory double was handed an entity it does not know');
		}

		return tables[table];
	};
	const same = (left: unknown, right: unknown) => String(left ?? '') === String(right ?? '');
	const matches = (row: Row, where: Row = {}) =>
		Object.entries(where).every(([field, expected]) => {
			if (expected && typeof expected === 'object' && 'type' in (expected as Row)) {
				throw new Error(`the in-memory double does not implement the "${(expected as Row).type}" operator`);
			}

			return expected === undefined ? true : same(row[field], expected);
		});
	/** The level rows a joined availability read is narrowed to. */
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

	const createQueryBuilder = (entity?: unknown): any => {
		let target = entity;
		let rawSelect: string | null = null;
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
			getMany: async () => (target === WarehouseProductVariant ? levels(conditions) : rows(target)),
			getOne: async () => {
				const found = target === WarehouseProductVariant ? levels(conditions) : rows(target);

				return found[0] ?? null;
			},
			getRawOne: async () => {
				if (/SUM\(level\.quantity - level\.reservedQuantity - level\.safetyStock\)/.test(rawSelect ?? '')) {
					const available = levels(conditions).reduce(
						(sum, level) =>
							sum +
							Number(level.quantity ?? 0) -
							Number(level.reservedQuantity ?? 0) -
							Number(level.safetyStock ?? 0),
						0
					);

					return { available };
				}

				throw new Error(`the in-memory double does not implement the raw read "${rawSelect}"`);
			}
		};

		return query;
	};

	const manager = { createQueryBuilder } as any;

	return {
		manager,
		metadata: { tableName: 'stock_alert', hasColumnWithPropertyPath: () => false },
		create: (partial: Row) => ({ ...partial }),
		save: async (rowOrRows: any) => {
			const list = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];

			for (const row of list) {
				const index = row.id ? rows(StockAlert).findIndex((candidate) => same(candidate.id, row.id)) : -1;

				if (index >= 0) {
					Object.assign(rows(StockAlert)[index], row);
					continue;
				}

				if (!row.id) {
					row.id = `stock_alert-${++sequence}`;
				}

				rows(StockAlert).push(row);
			}

			return Array.isArray(rowOrRows) ? list : list[0];
		},
		find: async (options: any = {}) => rows(StockAlert).filter((row) => matches(row, options.where)),
		findOne: async (options: any = {}) => rows(StockAlert).find((row) => matches(row, options.where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = rows(StockAlert).filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async () => rows(StockAlert).length,
		update: async (id: unknown, patch: Row) => {
			const row = rows(StockAlert).find((candidate) => same(candidate.id, id));

			if (row) {
				Object.assign(row, patch);
			}

			return { affected: row ? 1 : 0 };
		}
	};
}

/**
 * Builds the alert service over one in-memory datastore.
 *
 * @param rules The rules the fixture starts with.
 * @param levels The level rows availability is derived from.
 */
function alertFixture(rules: Row[] = [], levels: Row[] = []) {
	const tables: Record<string, Row[]> = {
		stock_alert: [...rules],
		warehouse_product: [
			{
				id: 'aggregate-1',
				tenantId: TENANT,
				organizationId: ORG,
				warehouseId: WAREHOUSE,
				productId: PRODUCT,
				quantity: 0,
				reservedQuantity: 0,
				version: 1
			}
		],
		warehouse_product_variant: levels
	};
	const typeOrmStockAlertRepository = repository(
		tables,
		new Map<unknown, string>([
			[StockAlert, 'stock_alert'],
			[WarehouseProductVariant, 'warehouse_product_variant'],
			[WarehouseProduct, 'warehouse_product']
		])
	);
	const service = new StockAlertService(typeOrmStockAlertRepository as never, {} as never);

	return {
		service,
		tables,
		repository: typeOrmStockAlertRepository,
		rules: () => tables.stock_alert,
		rule: (id: string = RULE) => tables.stock_alert.find((row) => row.id === id)
	};
}

/** One level row of the fixture location. */
const levelRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	warehouseProductId: 'aggregate-1',
	variantId: VARIANT,
	quantity: 10,
	reservedQuantity: 0,
	incomingQuantity: 0,
	safetyStock: 0,
	allowBackorder: false,
	backorderLimit: null,
	version: 1,
	...overrides
});

/** One alert rule, watching the fixture variant at the fixture location. */
const alertRow = (overrides: Row = {}): Row => ({
	id: RULE,
	tenantId: TENANT,
	organizationId: ORG,
	variantId: VARIANT,
	warehouseId: WAREHOUSE,
	threshold: 5,
	cooldownMinutes: 30,
	isActive: true,
	...overrides
});

describe('StockAlertService — the rules it watches (doc 09 §10.1)', () => {
	it('refuses a second rule for the same variant and location, naming the one that watches it', async () => {
		const fixture = alertFixture([alertRow()]);

		await expect(
			fixture.service.createAlert({
				variantId: VARIANT,
				warehouseId: WAREHOUSE,
				threshold: 3,
				cooldownMinutes: 30
			})
		).rejects.toMatchObject({
			response: { code: 'STOCK_ALERT_ALREADY_EXISTS', details: { alertId: RULE } }
		});
		expect(fixture.rules()).toHaveLength(1);
	});

	it('accepts a rule for the same variant at another location, and for another variant here', async () => {
		// Control: the unique pair is `(variant, location)`, so a third rule that differs in either half is
		// a different watch and is accepted.
		const fixture = alertFixture([alertRow()]);

		const elsewhere = await fixture.service.createAlert({
			variantId: VARIANT,
			warehouseId: OTHER_WAREHOUSE,
			threshold: 3,
			cooldownMinutes: 30
		});
		const otherVariant = await fixture.service.createAlert({
			variantId: OTHER_VARIANT,
			warehouseId: WAREHOUSE,
			threshold: 3,
			cooldownMinutes: 30
		});

		expect(fixture.rules()).toHaveLength(3);
		expect(elsewhere.warehouseId).toBe(OTHER_WAREHOUSE);
		expect(otherVariant.variantId).toBe(OTHER_VARIANT);
	});

	it('lists the rules it watches', async () => {
		const fixture = alertFixture([alertRow(), alertRow({ id: 'stock_alert-2', variantId: OTHER_VARIANT })]);

		const listed = await fixture.service.findAlerts();

		expect(listed.total).toBe(2);
		expect(listed.items).toHaveLength(2);
	});
});

describe('StockAlertService — firing at the threshold (doc 09 §10.2, §15.3)', () => {
	it('fires at its threshold and not one unit above it', async () => {
		// Availability is derived: on hand, less what is held, less the unsellable floor. Ten on hand with
		// three held and two reserved as the floor leaves five, and the threshold is inclusive.
		const levels = [levelRow('level-1', { quantity: 10, reservedQuantity: 3, safetyStock: 2 })];

		const atThreshold = alertFixture([alertRow({ threshold: 5 })], levels);
		const belowThreshold = alertFixture([alertRow({ threshold: 4 })], levels);

		const fired = await atThreshold.service.evaluate(AT);
		const quiet = await belowThreshold.service.evaluate(AT);

		expect(fired.evaluated).toBe(1);
		expect(fired.fired).toEqual([
			{ alertId: RULE, variantId: VARIANT, warehouseId: WAREHOUSE, availability: 5, threshold: 5 }
		]);
		expect(atThreshold.rule().lastTriggeredAt).toEqual(AT);
		expect(quiet.fired).toEqual([]);
		expect(belowThreshold.rule().lastTriggeredAt).toBeUndefined();
	});

	it('sums availability over the level rows of the variant at the location', async () => {
		// The rule watches the location's whole holding of the variant, not one row of it: two rows of four
		// and three leave seven, so a threshold of five is quiet here — a per-row reading would have fired
		// twice on a location that is comfortably stocked.
		const levels = [levelRow('level-1', { quantity: 4 }), levelRow('level-2', { quantity: 3 })];
		const quiet = alertFixture([alertRow({ threshold: 5 })], levels);
		const firing = alertFixture([alertRow({ threshold: 7 })], levels);

		expect((await quiet.service.evaluate(AT)).fired).toEqual([]);

		const fired = await firing.service.evaluate(AT);

		expect(fired.fired[0]).toMatchObject({ availability: 7, threshold: 7 });
	});

	it('does not fire a rule whose variant is comfortably stocked', async () => {
		const fixture = alertFixture([alertRow({ threshold: 2 })], [levelRow('level-1', { quantity: 40 })]);

		const evaluated = await fixture.service.evaluate(AT);

		expect(evaluated.evaluated).toBe(1);
		expect(evaluated.fired).toEqual([]);
		expect(fixture.rule().lastTriggeredAt).toBeUndefined();
	});

	it('evaluates only the rules that are enabled', async () => {
		const fixture = alertFixture(
			[alertRow(), alertRow({ id: 'stock_alert-2', variantId: OTHER_VARIANT, isActive: false })],
			[levelRow('level-1', { quantity: 1 }), levelRow('level-2', { variantId: OTHER_VARIANT, quantity: 0 })]
		);

		const evaluated = await fixture.service.evaluate(AT);

		expect(evaluated.evaluated).toBe(1);
		expect(evaluated.fired.map((one) => one.alertId)).toEqual([RULE]);
		// The disabled rule was not sent, and it was not stamped either: enabling it later fires at once.
		expect(fixture.rule('stock_alert-2').lastTriggeredAt).toBeUndefined();
	});

	it('reports an evaluation over no rules as nothing at all', async () => {
		const fixture = alertFixture();

		expect(await fixture.service.evaluate(AT)).toEqual({ evaluated: 0, fired: [], suppressed: 0 });
	});

	it('never writes stock, because an alert is a notification', async () => {
		// Evaluation reads levels and writes at most the instant a rule fired: a notification must never be
		// able to change a level, so the level and its aggregate are untouched and the rule gains exactly one
		// column.
		const fixture = alertFixture([alertRow({ threshold: 100 })], [levelRow('level-1', { quantity: 1 })]);
		const levelBefore = { ...fixture.tables.warehouse_product_variant[0] };
		const aggregateBefore = { ...fixture.tables.warehouse_product[0] };

		await fixture.service.evaluate(AT);

		expect(fixture.tables.warehouse_product_variant[0]).toEqual(levelBefore);
		expect(fixture.tables.warehouse_product[0]).toEqual(aggregateBefore);
		expect(fixture.rule()).toEqual({ ...alertRow({ threshold: 100 }), lastTriggeredAt: AT });
	});
});

describe('StockAlertService — the cooling-off period and re-arming (doc 09 §10.2, §15.3)', () => {
	it('suppresses a rule whose last fire is inside its cooling-off period, and fires again once it has passed', async () => {
		const fixture = alertFixture([alertRow({ threshold: 5, cooldownMinutes: 30 })], [
			levelRow('level-1', { quantity: 2 })
		]);

		const first = await fixture.service.evaluate(AT);

		expect(first.fired).toHaveLength(1);
		expect(fixture.rule().lastTriggeredAt).toEqual(AT);

		// Ten minutes later the shortage is still there, and the rule is inside its cooldown: the shortage is
		// not re-reported, because a notification per scan is a notification nobody reads.
		const withinCooldown = await fixture.service.evaluate(new Date(AT.getTime() + 10 * MINUTE));

		expect(withinCooldown).toEqual({ evaluated: 1, fired: [], suppressed: 1 });
		expect(fixture.rule().lastTriggeredAt).toEqual(AT);

		// Half an hour after the fire, the same breach is reported again.
		const afterCooldown = await fixture.service.evaluate(new Date(AT.getTime() + 31 * MINUTE));

		expect(afterCooldown.fired).toHaveLength(1);
		expect(afterCooldown.suppressed).toBe(0);
		expect(fixture.rule().lastTriggeredAt).toEqual(new Date(AT.getTime() + 31 * MINUTE));
	});

	it('does not re-fire a rule whose stock came back above the threshold, and re-arms on the next breach', async () => {
		// A resolved alert is the level coming back above the threshold: there is nothing to report, and the
		// rule fires again only when the stock is low again — the cooldown is what governs the repeat, not
		// the scan.
		const fixture = alertFixture([alertRow({ threshold: 5, cooldownMinutes: 30 })], [
			levelRow('level-1', { quantity: 2 })
		]);

		await fixture.service.evaluate(AT);
		fixture.tables.warehouse_product_variant[0].quantity = 40;

		const resolved = await fixture.service.evaluate(new Date(AT.getTime() + 31 * MINUTE));

		expect(resolved.fired).toEqual([]);
		expect(resolved.suppressed).toBe(0);

		fixture.tables.warehouse_product_variant[0].quantity = 1;

		const breachedAgain = await fixture.service.evaluate(new Date(AT.getTime() + 32 * MINUTE));

		expect(breachedAgain.fired).toHaveLength(1);
		expect(breachedAgain.fired[0]).toMatchObject({ availability: 1, threshold: 5 });
	});

	it('re-evaluates a rule with no cooldown on every pass', async () => {
		// Boundary control for the suppression above: a cooldown of zero means the rule repeats, which is what
		// an installation that wants every scan reported configures.
		const fixture = alertFixture([alertRow({ threshold: 5, cooldownMinutes: 0 })], [
			levelRow('level-1', { quantity: 2 })
		]);

		await fixture.service.evaluate(AT);
		const second = await fixture.service.evaluate(new Date(AT.getTime() + MINUTE));

		expect(second.fired).toHaveLength(1);
		expect(second.suppressed).toBe(0);
		expect(fixture.rule().lastTriggeredAt).toEqual(new Date(AT.getTime() + MINUTE));
	});

	it('watches the whole organization when a rule names no location', async () => {
		const fixture = alertFixture([alertRow({ warehouseId: undefined, threshold: 5 })], [
			levelRow('level-1', { quantity: 2 })
		]);

		const evaluated = await fixture.service.evaluate(AT);

		expect(evaluated.fired).toEqual([
			{ alertId: RULE, variantId: VARIANT, warehouseId: undefined, availability: 2, threshold: 5 }
		]);
	});
});
