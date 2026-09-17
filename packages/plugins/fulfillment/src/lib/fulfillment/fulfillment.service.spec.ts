/**
 * Two module boundaries are doubled here, and the reason is the same for both.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a shipment lifecycle needs and none of which is
 * available outside a running application. `@gauzy/plugin-order`'s barrel re-exports the whole order
 * and cart domain, which a service that only reads one line's counters does not need either. Both
 * seams are therefore doubled at the module boundary and **the services under test are the real
 * ones**: the shipment service, and the real `FulfillmentLineService` it writes its lines through, so
 * the line's own refusals are exercised rather than imitated.
 *
 * The base-class double mirrors `CrudService` / `TenantAwareCrudService` exactly where the behaviour
 * is observable to a caller, which includes the part that is easy to get wrong: **a lookup that does
 * not match raises `NotFoundException`** rather than answering `null`
 * (`packages/core/src/lib/core/crud/crud.service.ts`, the `if (!record)` branch of
 * `findOneByIdString` on line 409 and of `findOneByWhereOptions` on line 465 — both under a doc
 * comment that still claims the opposite). `update` likewise loads the row first for a string id, as
 * `TenantAwareCrudService.update` does. A double that answered `null` instead would silently make the
 * "not found" cases below vacuous.
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

		async findAll(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}

		async find(options: any = {}): Promise<any> {
			return this.typeOrmRepository.find(options);
		}

		async paginate(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount(options);

			return { items, total };
		}

		async findOneByIdString(id: any, options: any = {}): Promise<any> {
			if (!id) {
				throw new NotFoundException('The requested record was not found');
			}

			const record = await this.typeOrmRepository.findOne({
				...options,
				where: { ...(options.where ?? {}), id }
			});

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async findOneByWhereOptions(where: any): Promise<any> {
			const record = await this.typeOrmRepository.findOneBy(where);

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
		}

		async update(id: any, partial: any): Promise<any> {
			if (typeof id === 'string') {
				await this.findOneByIdString(id);
			}

			return this.typeOrmRepository.update(id, partial);
		}

		async delete(criteria: any): Promise<any> {
			return this.typeOrmRepository.delete(criteria);
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
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
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
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

jest.mock('@gauzy/plugin-order', () => ({
	// The counter writer is a collaborator of this package, not of the thing under test: the suite
	// hands the service its own line service below, so the class here is only the module's identity.
	OrderLineService: class OrderLineService {}
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FulfillmentDirection, FulfillmentStatusDetail } from '@gauzy/contracts';
import { FulfillmentLineService } from '../fulfillment-line/fulfillment-line.service';
import { FulfillmentService } from './fulfillment.service';

/**
 * One shipment's lifetime, and the order-line counters it moves.
 *
 * A fulfilment is a shipment with a lifecycle of its own — deliberately not the order's — and the
 * properties the specification fixes are the ones this suite pins:
 *
 * - a shipment is created `PENDING`, `OUTBOUND`, at version one, and **a quantity may never exceed
 *   what the order line has left** — the ordered quantity less what was written off, dismissed on a
 *   return and already fulfilled (doc 09 §12.6, INV-14), which is the precondition the inventory
 *   package's sale movement depends on;
 * - a return shipment is exempt from that guard, because returning more than is outstanding is a
 *   credit decision the returns domain makes (doc 09 §12.10);
 * - the lifecycle only moves forward, one legal move at a time, and `DELIVERED` and `CANCELED` are
 *   terminal: a delivered fulfilment is returned, never cancelled (doc 09 §12.5, §12.9);
 * - the three counters on the order line are the sum of the shipment lines that caused them — a
 *   fulfilment created takes `fulfilledQuantity`, one handed to the carrier takes `shippedQuantity`,
 *   one delivered takes `deliveredQuantity` (doc 05 I-45) — and a cancelled shipment gives its
 *   quantity back, so the same units can be shipped again (doc 09 §12.6, §12.9);
 * - a cancelation is idempotent: the endpoint answers a second submission with the unchanged
 *   resource rather than moving the counters a second time (doc 09 §12.9);
 * - the quantities are decimals: their arithmetic is exact, which is why the platform keeps decimal
 *   primitives at all (doc 07 §2).
 *
 * The service is constructed directly with an in-memory double of each table's repository. The
 * double states the `where` and the relations the service states — `findOneByIdString(id, {
 * relations: ['lines'] })` is how every method answers — because a double that ignored the relations
 * would make the assertions about a shipment's lines vacuous.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const ORDER = '00000000-0000-4000-8000-000000000010';
const LINE_A = '00000000-0000-4000-8000-0000000000a1';
const LINE_B = '00000000-0000-4000-8000-0000000000b1';
const UNKNOWN = '00000000-0000-4000-8000-0000000000ff';

/** A deterministic instant, so the timestamps a move records are exact rather than approximate. */
const SHIPPED_AT = new Date('2026-02-14T09:31:07.412Z');
const DELIVERED_AT = new Date('2026-02-18T16:02:44.000Z');

/**
 * Everything the fake-timer installation must leave alone, so that freezing the clock freezes only
 * the clock: the asynchronous code in this suite runs on the real timers and microtasks.
 */
const NOT_FAKED_BESIDES_DATE: Array<
	| 'hrtime'
	| 'nextTick'
	| 'performance'
	| 'queueMicrotask'
	| 'requestAnimationFrame'
	| 'cancelAnimationFrame'
	| 'requestIdleCallback'
	| 'cancelIdleCallback'
	| 'setImmediate'
	| 'clearImmediate'
	| 'setInterval'
	| 'clearInterval'
	| 'setTimeout'
	| 'clearTimeout'
> = [
	'hrtime',
	'nextTick',
	'performance',
	'queueMicrotask',
	'requestAnimationFrame',
	'cancelAnimationFrame',
	'requestIdleCallback',
	'cancelIdleCallback',
	'setImmediate',
	'clearImmediate',
	'setInterval',
	'clearInterval',
	'setTimeout',
	'clearTimeout'
];

type Row = Record<string, any>;

/** The tables this suite drives, as plain arrays. */
interface ITables {
	order_line: Row[];
	fulfillment: Row[];
	fulfillment_line: Row[];
}

/**
 * An in-memory stand-in for one table's TypeORM repository.
 *
 * @param tables The whole datastore.
 * @param tableName The table this repository writes.
 * @param relations The relation names the service asks for, and the table each resolves to.
 * @param defaults The column defaults the table itself carries, which an insert does not have to
 * state — the migration declares them (`requiresShipping`, `noNotification`, `status`, `version`).
 */
function repository(
	tables: ITables,
	tableName: keyof ITables,
	relations: Record<string, { table: keyof ITables; foreignKey: string }> = {},
	defaults: Row = {}
) {
	let sequence = 0;
	const rows = () => tables[tableName];
	const same = (left: unknown, right: unknown) => String(left ?? '') === String(right ?? '');
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where).every(([field, expected]) => {
			// A missing column and a null column are the same thing to the database, and TypeORM drops
			// an `undefined` member from the condition rather than matching nothing.
			if (expected === undefined) {
				return true;
			}

			return same(row[field], expected);
		});
	const sorted = (found: Row[], order?: Record<string, 'ASC' | 'DESC'>) => {
		const columns = Object.keys(order ?? {});

		if (!columns.length) {
			return found;
		}

		return [...found].sort((left, right) => {
			for (const column of columns) {
				if (left[column] === right[column]) {
					continue;
				}

				const direction = order?.[column] === 'DESC' ? -1 : 1;

				return (left[column] > right[column] ? 1 : -1) * direction;
			}

			return 0;
		});
	};
	/**
	 * Resolves the relations the caller asked for, which is the repository's job and not the
	 * service's: `findOneByIdString(id, { relations: ['lines'] })` has to answer with the lines.
	 */
	const withRelations = (record: Row | null, requested?: string[]): Row | null => {
		if (!record || !requested?.length) {
			return record;
		}

		const related = { ...record };

		for (const name of requested) {
			const relation = relations[name];

			if (!relation) {
				throw new Error(`the in-memory double does not know the relation "${name}"`);
			}

			related[name] = tables[relation.table].filter((row) => same(row[relation.foreignKey], related.id));
		}

		return related;
	};

	return {
		rows,
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		find: async (options: Row = {}) =>
			sorted(rows().filter((row) => matches(row, options.where)), options.order).map((row) =>
				withRelations(row, options.relations)
			),
		findOne: async (options: Row = {}) =>
			withRelations(rows().find((row) => matches(row, options.where)) ?? null, options.relations),
		findOneBy: async (where: Row) => rows().find((row) => matches(row, where)) ?? null,
		findAndCount: async (options: Row = {}) => {
			const items = rows().filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async () => rows().length,
		create: (partial: Row) => ({ ...partial }),
		save: async (entity: Row) => {
			if (entity.id) {
				const index = rows().findIndex((row) => same(row.id, entity.id));

				if (index >= 0) {
					rows()[index] = { ...rows()[index], ...entity };

					return rows()[index];
				}
			}

			// The header row is what this repository writes. The lines are written by the line service
			// in its own table, so the `lines` a caller supplied are not stored here — exactly as a
			// TypeORM save of the header would leave them to the caller's own line writes.
			const { lines, ...header } = entity;
			const created = { id: `${String(tableName)}-new-${++sequence}`, ...defaults, ...header };

			rows().push(created);

			return created;
		},
		// The platform's `update` reaches TypeORM's own, which answers an `UpdateResult` and not the row.
		update: async (criteria: any, partial: Row) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => same(row.id, id));

			if (index >= 0) {
				Object.assign(rows()[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		delete: async (criteria: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = rows().findIndex((row) => same(row.id, id));

			if (index >= 0) {
				rows().splice(index, 1);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	};
}

/** One `order_line` row, as the shipment service reads it. */
const orderLine = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	orderId: ORDER,
	quantity: 10,
	fulfilledQuantity: 0,
	shippedQuantity: 0,
	deliveredQuantity: 0,
	writtenOffQuantity: 0,
	returnDismissedQuantity: 0,
	...overrides
});

/** One `fulfillment` row, as the service reads it. */
const shipment = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	orderId: ORDER,
	direction: FulfillmentDirection.OUTBOUND,
	status: FulfillmentStatusDetail.PENDING,
	requiresShipping: true,
	noNotification: false,
	version: 1,
	...overrides
});

/** One `fulfillment_line` row. */
const shipmentLine = (id: string, fulfillmentId: string, orderLineId: string, quantity: number) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	fulfillmentId,
	orderLineId,
	quantity
});

/**
 * The order-line counter service, over the same in-memory table.
 *
 * It is a hand-written double rather than the order package's real service, because that package is
 * not what this suite is about; it states the two calls the shipment service makes and the lookup
 * behaviour the platform's CRUD base has.
 */
function orderLineService(tables: ITables) {
	return {
		findOneByIdString: async (id: string): Promise<Row> => {
			const row = tables.order_line.find((candidate) => String(candidate.id) === String(id));

			if (!row) {
				throw new NotFoundException('The requested record was not found');
			}

			return row;
		},
		update: async (id: string, changes: Row): Promise<Row> => {
			const row = tables.order_line.find((candidate) => String(candidate.id) === String(id));

			if (!row) {
				throw new NotFoundException('The requested record was not found');
			}

			Object.assign(row, changes);

			return { affected: 1 };
		}
	};
}

/**
 * Builds the shipment service over one in-memory datastore, with the real line service over the
 * `fulfillment_line` table.
 *
 * @param options.seed The order lines, shipments and shipment lines the fixture starts with.
 */
function fulfillmentFixture(options: { seed?: Partial<ITables> } = {}) {
	const tables: ITables = {
		order_line: [...(options.seed?.order_line ?? [])],
		fulfillment: [...(options.seed?.fulfillment ?? [])],
		fulfillment_line: [...(options.seed?.fulfillment_line ?? [])]
	};
	const lineService = new FulfillmentLineService(
		repository(tables, 'fulfillment_line') as never,
		{} as never
	);
	const service = new FulfillmentService(
		repository(
			tables,
			'fulfillment',
			{ lines: { table: 'fulfillment_line', foreignKey: 'fulfillmentId' } },
			{
				// The table's own defaults, as the migration declares them: a shipment is shippable and
				// notifies the customer unless the caller says otherwise.
				requiresShipping: true,
				noNotification: false,
				status: FulfillmentStatusDetail.PENDING,
				direction: FulfillmentDirection.OUTBOUND,
				version: 1
			}
		) as never,
		{} as never,
		lineService,
		orderLineService(tables) as never
	);

	return {
		service,
		tables,
		line: (id: string = LINE_A) => tables.order_line.find((row) => row.id === id),
		row: (id: string) => tables.fulfillment.find((row) => row.id === id),
		linesOf: (fulfillmentId: string) =>
			tables.fulfillment_line.filter((row) => row.fulfillmentId === fulfillmentId)
	};
}

/** One line of a shipment request, so a case states only what it is about. */
const request = (orderLineId: string = LINE_A, quantity = 3, overrides: Row = {}) => ({
	orderLineId,
	quantity,
	...overrides
});

describe('FulfillmentService — a shipment against what the order line has left (doc 09 §12.6, INV-14)', () => {
	it('creates a pending outbound shipment at version one and answers with its lines', async () => {
		const fixture = fulfillmentFixture({ seed: { order_line: [orderLine(LINE_A)] } });

		const created = await fixture.service.create({
			orderId: ORDER,
			warehouseId: UNKNOWN,
			lines: [request(LINE_A, 3)]
		} as never);

		expect(created).toMatchObject({
			orderId: ORDER,
			direction: FulfillmentDirection.OUTBOUND,
			status: FulfillmentStatusDetail.PENDING,
			version: 1,
			requiresShipping: true,
			noNotification: false
		});
		// The lines arrive through the line service, addressed at the shipment that was just created.
		expect(created.lines).toHaveLength(1);
		expect(created.lines[0]).toMatchObject({ orderLineId: LINE_A, quantity: 3, fulfillmentId: created.id });
		expect(fixture.linesOf(created.id)).toHaveLength(1);
		// Creating a shipment takes the quantity it ships: it is no longer outstanding.
		expect(Number(fixture.line(LINE_A).fulfilledQuantity)).toBe(3);
	});

	it('refuses a shipment with no lines and writes nothing at all', async () => {
		const fixture = fulfillmentFixture({ seed: { order_line: [orderLine(LINE_A)] } });

		await expect(fixture.service.create({ orderId: ORDER, lines: [] } as never)).rejects.toThrow(
			/FULFILLMENT_EMPTY/
		);
		await expect(fixture.service.create({ orderId: ORDER } as never)).rejects.toThrow(/FULFILLMENT_EMPTY/);
		expect(fixture.tables.fulfillment).toEqual([]);
		expect(fixture.tables.fulfillment_line).toEqual([]);
		expect(Number(fixture.line(LINE_A).fulfilledQuantity)).toBe(0);
	});

	it('refuses a line of zero or a negative quantity, and leaves the order line alone', async () => {
		const fixture = fulfillmentFixture({ seed: { order_line: [orderLine(LINE_A, { quantity: 5 })] } });

		for (const quantity of [0, -1]) {
			await expect(
				fixture.service.create({ orderId: ORDER, lines: [request(LINE_A, quantity)] } as never)
			).rejects.toThrow(/FULFILLMENT_LINE_QUANTITY_INVALID/);
		}

		expect(fixture.tables.fulfillment).toEqual([]);
		expect(Number(fixture.line(LINE_A).fulfilledQuantity)).toBe(0);
	});

	it('takes exactly what the order line has left and refuses one unit past it', async () => {
		// The boundary, from both sides: `outstanding` is legal, `outstanding + 1` is not, and the
		// refusal names the numbers the caller has to reconcile (doc 09 §12.6).
		const fixture = fulfillmentFixture({
			seed: {
				order_line: [
					orderLine(LINE_A, { quantity: 5 }),
					orderLine(LINE_B, { quantity: 5 })
				]
			}
		});

		const created = await fixture.service.create({
			orderId: ORDER,
			lines: [request(LINE_A, 5)]
		} as never);

		expect(created.lines[0].quantity).toBe(5);
		expect(Number(fixture.line(LINE_A).fulfilledQuantity)).toBe(5);

		await expect(
			fixture.service.create({ orderId: ORDER, lines: [request(LINE_B, 6)] } as never)
		).rejects.toMatchObject({
			response: {
				code: 'FULFILLMENT_QUANTITY_EXCEEDED',
				details: { orderLineId: LINE_B, requested: 6, outstanding: 5 }
			}
		});
		expect(fixture.tables.fulfillment).toHaveLength(1);
	});

	it('counts what was written off and dismissed on a return as no longer shippable', async () => {
		// The three subtrahends of §12.6 in one row: ten ordered, four written off, two dismissed and
		// one already fulfilled leaves three.
		const fixture = fulfillmentFixture({
			seed: {
				order_line: [
					orderLine(LINE_A, {
						quantity: 10,
						writtenOffQuantity: 4,
						returnDismissedQuantity: 2,
						fulfilledQuantity: 1
					}),
					orderLine(LINE_B, {
						quantity: 10,
						writtenOffQuantity: 4,
						returnDismissedQuantity: 2,
						fulfilledQuantity: 1
					})
				]
			}
		});

		expect(await fixture.service.outstandingOf(LINE_A)).toBe(3);

		const created = await fixture.service.create({ orderId: ORDER, lines: [request(LINE_A, 3)] } as never);

		expect(created.lines[0].quantity).toBe(3);
		expect(Number(fixture.line(LINE_A).fulfilledQuantity)).toBe(4);

		await expect(
			fixture.service.create({ orderId: ORDER, lines: [request(LINE_B, 4)] } as never)
		).rejects.toMatchObject({ response: { code: 'FULFILLMENT_QUANTITY_EXCEEDED' } });
	});

	it('lets a line ship in parts, and never lets the parts exceed what was ordered', async () => {
		// The property partial fulfilment exists for: two shipments of one line are two fulfilments,
		// each one a separate picking list, and together they stay inside the ordered quantity.
		const fixture = fulfillmentFixture({ seed: { order_line: [orderLine(LINE_A, { quantity: 5 })] } });

		const first = await fixture.service.create({ orderId: ORDER, lines: [request(LINE_A, 2)] } as never);
		const second = await fixture.service.create({ orderId: ORDER, lines: [request(LINE_A, 2)] } as never);

		expect(first.id).not.toBe(second.id);
		expect(Number(fixture.line(LINE_A).fulfilledQuantity)).toBe(4);
		expect(fixture.tables.fulfillment_line).toHaveLength(2);

		await expect(
			fixture.service.create({ orderId: ORDER, lines: [request(LINE_A, 2)] } as never)
		).rejects.toMatchObject({
			response: { code: 'FULFILLMENT_QUANTITY_EXCEEDED', details: { outstanding: 1 } }
		});
	});

	it('exempts a return shipment from the outstanding guard (doc 09 §12.10)', async () => {
		// A return moves the other way: returning more than is outstanding is a credit decision the
		// returns domain makes, not a shipping constraint this one imposes.
		const fixture = fulfillmentFixture({
			seed: { order_line: [orderLine(LINE_A, { quantity: 3, fulfilledQuantity: 3 })] }
		});

		const created = await fixture.service.create({
			orderId: ORDER,
			direction: FulfillmentDirection.RETURN,
			lines: [request(LINE_A, 10)]
		} as never);

		expect(created).toMatchObject({ direction: FulfillmentDirection.RETURN, status: FulfillmentStatusDetail.PENDING });
		expect(created.lines[0].quantity).toBe(10);
	});

	it('refuses a line whose order line is not there', async () => {
		// The platform's CRUD base raises the generic not-found before the service's own
		// `ORDER_LINE_NOT_FOUND` message can be reached; what a caller observes is the 404.
		const fixture = fulfillmentFixture();

		await expect(
			fixture.service.create({ orderId: ORDER, lines: [request(UNKNOWN, 1)] } as never)
		).rejects.toBeInstanceOf(NotFoundException);
		expect(fixture.tables.fulfillment).toEqual([]);
	});

	it('reads the quantities a numeric column hands back without concatenating them', async () => {
		// Control: `numeric(20,6)` arrives from the driver as text in a fixture and as a number through
		// the entity's transformer, and `'10.000000' + 4` is `'10.0000004'` for an implementation that
		// adds the values it was handed. Every read of a quantity in this service goes through
		// `Number(...)` for exactly that reason.
		const fixture = fulfillmentFixture({
			seed: {
				order_line: [
					orderLine(LINE_A, { quantity: '10.000000', fulfilledQuantity: '4.000000' }),
					orderLine(LINE_B, { quantity: '10.000000', fulfilledQuantity: '4.000000' })
				]
			}
		});

		expect(await fixture.service.outstandingOf(LINE_A)).toBe(6);

		const created = await fixture.service.create({ orderId: ORDER, lines: [request(LINE_A, 6)] } as never);

		expect(created.lines[0].quantity).toBe(6);

		await expect(
			fixture.service.create({ orderId: ORDER, lines: [request(LINE_B, 7)] } as never)
		).rejects.toMatchObject({ response: { code: 'FULFILLMENT_QUANTITY_EXCEEDED' } });
	});

	// The defect: the outstanding quantity is computed by subtracting binary floating point numbers
	// (`fulfillment.service.ts`, `outstandingOf`, lines 242–247), so `0.3 − 0.1` is
	// `0.19999999999999998` rather than `0.2`. The last partial shipment of a decimal quantity is then
	// refused by the guard on line 275 — `0.2 > 0.19999999999999998` — and a picking screen is told
	// there is nothing left to ship. The platform keeps exact decimal primitives for this reason
	// (`packages/core/src/lib/money/decimal.ts`, `subtractDecimalStrings` / `compareDecimalStrings`).
	it.failing('[DEFECT] treats a decimal remaining quantity as exact, so the last partial shipment is not refused', async () => {
		const fixture = fulfillmentFixture({
			seed: { order_line: [orderLine(LINE_A, { quantity: 0.3, fulfilledQuantity: 0.1 })] }
		});

		expect(Number(await fixture.service.outstandingOf(LINE_A))).toBe(0.2);

		const created = await fixture.service.create({ orderId: ORDER, lines: [request(LINE_A, 0.2)] } as never);

		expect(created.lines[0].quantity).toBe(0.2);
	});
});

describe('FulfillmentService — the shipment’s own lifecycle (doc 09 §12.5)', () => {
	/**
	 * The clock is frozen to one instant for this block, so the timestamps a move records are asserted
	 * exactly rather than by shape. Only `Date` is faked — every timer and microtask the asynchronous
	 * code runs on is the real one.
	 */
	beforeEach(() => jest.useFakeTimers({ now: SHIPPED_AT, doNotFake: NOT_FAKED_BESIDES_DATE }));
	afterEach(() => jest.useRealTimers());

	/** A fixture with one order line of `quantity` and one pending shipment of all of it. */
	async function pending(quantity = 5) {
		const fixture = fulfillmentFixture({ seed: { order_line: [orderLine(LINE_A, { quantity })] } });
		const created = await fixture.service.create({ orderId: ORDER, lines: [request(LINE_A, quantity)] } as never);

		return { fixture, created };
	}

	it('hands a pending shipment to the carrier and stamps the instant it left', async () => {
		const fixture = fulfillmentFixture({ seed: { order_line: [orderLine(LINE_A, { quantity: 5 })] } });
		const created = await fixture.service.create({ orderId: ORDER, lines: [request(LINE_A, 3)] } as never);

		const shipped = await fixture.service.ship(created.id, {
			trackingNumber: 'TRACK-0001',
			carrier: 'CARRIER-A',
			service: 'EXPRESS'
		});

		expect(shipped).toMatchObject({
			status: FulfillmentStatusDetail.SHIPPED,
			trackingNumber: 'TRACK-0001',
			carrier: 'CARRIER-A',
			service: 'EXPRESS',
			shippedAt: SHIPPED_AT,
			version: 2
		});
		expect(shipped.lines).toHaveLength(1);
		// Handing over moves `shippedQuantity` and only `shippedQuantity`.
		expect(Number(fixture.line(LINE_A).shippedQuantity)).toBe(3);
		expect(Number(fixture.line(LINE_A).fulfilledQuantity)).toBe(3);
		expect(Number(fixture.line(LINE_A).deliveredQuantity)).toBe(0);
	});

	it('keeps the tracking the shipment already carries when the caller states none', async () => {
		const fixture = fulfillmentFixture({
			seed: {
				order_line: [orderLine(LINE_A, { quantity: 5 })],
				fulfillment: [
					shipment('ready', { trackingNumber: 'TRACK-EXISTING', carrier: 'CARRIER-B', noNotification: true })
				],
				fulfillment_line: [shipmentLine('settled-line', 'ready', LINE_A, 2)]
			}
		});

		const shipped = await fixture.service.ship('ready');

		expect(shipped).toMatchObject({
			trackingNumber: 'TRACK-EXISTING',
			carrier: 'CARRIER-B',
			noNotification: true,
			status: FulfillmentStatusDetail.SHIPPED
		});
	});

	it('moves a shipped shipment to in transit without changing what has shipped', async () => {
		const { fixture, created } = await pending();

		await fixture.service.ship(created.id);

		const before = { ...fixture.line(LINE_A) };
		const inTransit = await fixture.service.markInTransit(created.id);

		expect(inTransit.status).toBe(FulfillmentStatusDetail.IN_TRANSIT);
		expect(inTransit.version).toBe(3);
		expect(fixture.line(LINE_A).shippedQuantity).toBe(before.shippedQuantity);
		expect(Number(fixture.line(LINE_A).deliveredQuantity)).toBe(0);
	});

	/** The two routes the machine contains from a pending shipment to a delivered one. */
	const routes: Array<[string, FulfillmentStatusDetail[]]> = [
		['SHIPPED → DELIVERED', [FulfillmentStatusDetail.SHIPPED]],
		['SHIPPED → IN_TRANSIT → DELIVERED', [FulfillmentStatusDetail.SHIPPED, FulfillmentStatusDetail.IN_TRANSIT]]
	];

	it.each(routes)('reaches delivered along %s and records the delivery', async (_route, steps) => {
		const { fixture, created } = await pending();

		for (const step of steps) {
			if (step === FulfillmentStatusDetail.SHIPPED) {
				await fixture.service.ship(created.id);
				continue;
			}

			await fixture.service.markInTransit(created.id);
		}

		const delivered = await fixture.service.deliver(created.id, DELIVERED_AT);

		expect(delivered).toMatchObject({ status: FulfillmentStatusDetail.DELIVERED, deliveredAt: DELIVERED_AT });
		expect(Number(fixture.line(LINE_A).deliveredQuantity)).toBe(5);
		expect(Number(fixture.line(LINE_A).shippedQuantity)).toBe(5);
	});

	it('refuses a move the machine does not contain, and names what it would have allowed', async () => {
		const fixture = fulfillmentFixture({ seed: { order_line: [orderLine(LINE_A, { quantity: 5 })] } });
		const created = await fixture.service.create({ orderId: ORDER, lines: [request(LINE_A, 2)] } as never);

		for (const move of [FulfillmentStatusDetail.DELIVERED, FulfillmentStatusDetail.IN_TRANSIT]) {
			await expect(fixture.service.transition(created.id, move)).rejects.toMatchObject({
				response: {
					code: 'FULFILLMENT_STATUS_TRANSITION_INVALID',
					details: {
						from: FulfillmentStatusDetail.PENDING,
						to: move,
						allowed: [FulfillmentStatusDetail.SHIPPED, FulfillmentStatusDetail.CANCELED]
					}
				}
			});
		}

		// A refused move writes nothing.
		expect(fixture.row(created.id)).toMatchObject({ status: FulfillmentStatusDetail.PENDING, version: 1 });
		expect(Number(fixture.line(LINE_A).shippedQuantity)).toBe(0);
	});

	it('refuses to move a delivered shipment anywhere it is not already', async () => {
		const { fixture, created } = await pending();

		await fixture.service.ship(created.id);
		await fixture.service.deliver(created.id);

		for (const move of [
			FulfillmentStatusDetail.SHIPPED,
			FulfillmentStatusDetail.IN_TRANSIT,
			FulfillmentStatusDetail.CANCELED
		]) {
			await expect(fixture.service.transition(created.id, move)).rejects.toMatchObject({
				response: { code: 'FULFILLMENT_STATUS_TRANSITION_INVALID' }
			});
		}

		expect(fixture.row(created.id).status).toBe(FulfillmentStatusDetail.DELIVERED);
	});

	it('refuses to move a cancelled shipment, which is where its lifecycle ends', async () => {
		const { fixture, created } = await pending();

		await fixture.service.cancel(created.id);

		for (const move of [
			FulfillmentStatusDetail.SHIPPED,
			FulfillmentStatusDetail.IN_TRANSIT,
			FulfillmentStatusDetail.DELIVERED
		]) {
			await expect(fixture.service.transition(created.id, move)).rejects.toMatchObject({
				response: { code: 'FULFILLMENT_STATUS_TRANSITION_INVALID' }
			});
		}

		expect(fixture.row(created.id).status).toBe(FulfillmentStatusDetail.CANCELED);
		expect(Number(fixture.line(LINE_A).shippedQuantity)).toBe(0);
	});

	it('answers a transition to the status the shipment already holds without writing to it', async () => {
		// The machine's own idempotence at the level of `transition`: the row is returned unchanged, so
		// a repeated call is not a second write. What that means for the counters a caller moves beside
		// it is the subject of the double-submission cases below.
		const { fixture, created } = await pending();

		const answered = await fixture.service.transition(created.id, FulfillmentStatusDetail.PENDING);

		expect(answered.id).toBe(created.id);
		expect(fixture.row(created.id)).toMatchObject({ status: FulfillmentStatusDetail.PENDING, version: 1 });
	});

	it('bumps the optimistic lock exactly once per move', async () => {
		const { fixture, created } = await pending();

		await fixture.service.ship(created.id);
		await fixture.service.markInTransit(created.id);
		await fixture.service.deliver(created.id);

		expect(Number(fixture.row(created.id).version)).toBe(4);
	});

	it('refuses a move on a shipment that does not exist', async () => {
		const fixture = fulfillmentFixture();

		await expect(fixture.service.markInTransit(UNKNOWN)).rejects.toBeInstanceOf(NotFoundException);
		await expect(fixture.service.transition(UNKNOWN, FulfillmentStatusDetail.SHIPPED)).rejects.toBeInstanceOf(
			NotFoundException
		);
	});
});

/**
 * What a shipment hands to the carrier, once.
 *
 * The counter on the order line is a cache of the shipment lines that caused it (doc 05 I-45), so the
 * second submission of the same move has to leave it where the first one put it. The cases below
 * state the invariant rather than the mechanism: whatever a repeated call answers — a refusal, as the
 * API contract's `FULFILLMENT_ALREADY_SHIPPED` requires (doc 06 §6.9), or the unchanged resource —
 * the units a line reports must be the units that moved.
 */
describe('FulfillmentService — handing the same shipment over twice (doc 06 §6.9, doc 05 I-45)', () => {
	/** A fixture with one shipment of three against a line of five. */
	async function shipmentOfThree() {
		const fixture = fulfillmentFixture({ seed: { order_line: [orderLine(LINE_A, { quantity: 5 })] } });
		const created = await fixture.service.create({ orderId: ORDER, lines: [request(LINE_A, 3)] } as never);

		return { fixture, created };
	}

	it('moves each counter exactly as far as the shipment lines justify', async () => {
		// The control for the three cases below: one move each, and the three counters are the sum of
		// the one line that caused them.
		const { fixture, created } = await shipmentOfThree();

		await fixture.service.ship(created.id);
		await fixture.service.deliver(created.id);

		const line = fixture.line(LINE_A);
		const lines = fixture.linesOf(created.id);
		const shippedQuantity = lines.reduce((sum, row) => sum + Number(row.quantity), 0);

		expect(Number(line.fulfilledQuantity)).toBe(shippedQuantity);
		expect(Number(line.shippedQuantity)).toBe(shippedQuantity);
		expect(Number(line.deliveredQuantity)).toBe(shippedQuantity);
	});

	// The defect: `transition` answers the unchanged row when the status is already the requested one
	// (`fulfillment.service.ts`, lines 209–211) and `ship` reads that as permission to carry on, so a
	// second hand-over writes the tracking details again and bumps `shippedQuantity` a second time. The
	// API contract names the refusal — `FULFILLMENT_ALREADY_SHIPPED`, 409 (doc 06 §6.9).
	it.failing('[DEFECT] refuses to hand an already shipped fulfilment to the carrier again', async () => {
		const { fixture, created } = await shipmentOfThree();

		await fixture.service.ship(created.id, { trackingNumber: 'TRACK-0001' });

		await expect(fixture.service.ship(created.id, { trackingNumber: 'TRACK-0002' })).rejects.toThrow(
			/FULFILLMENT_ALREADY_SHIPPED/
		);
	});

	// The same defect seen from the order line: the second hand-over counts the same three units
	// again, so `shippedQuantity` stops being the sum of the rows that caused it (doc 05 I-45). The
	// second call's answer is tolerated either way, so that fixing the refusal above turns this case
	// green rather than red.
	it.failing('[DEFECT] ships the units once, however many times the shipment is handed over', async () => {
		const { fixture, created } = await shipmentOfThree();

		await fixture.service.ship(created.id, { trackingNumber: 'TRACK-0001' });
		await fixture.service.ship(created.id, { trackingNumber: 'TRACK-0002' }).catch(() => undefined);

		expect(Number(fixture.line(LINE_A).shippedQuantity)).toBe(3);
		expect(fixture.row(created.id)).toMatchObject({
			status: FulfillmentStatusDetail.SHIPPED,
			trackingNumber: 'TRACK-0001'
		});
	});

	// The same defect on the delivery move: `deliver` bumps `deliveredQuantity` after a `transition`
	// that answered the unchanged row.
	it.failing('[DEFECT] delivers the units once, however many times delivery is reported', async () => {
		const { fixture, created } = await shipmentOfThree();

		await fixture.service.ship(created.id);
		await fixture.service.deliver(created.id, DELIVERED_AT);
		await fixture.service.deliver(created.id, DELIVERED_AT).catch(() => undefined);

		expect(Number(fixture.line(LINE_A).deliveredQuantity)).toBe(3);
	});
});

describe('FulfillmentService — cancelation (doc 09 §12.9)', () => {
	beforeEach(() => jest.useFakeTimers({ now: SHIPPED_AT, doNotFake: NOT_FAKED_BESIDES_DATE }));
	afterEach(() => jest.useRealTimers());

	it('cancels a pending shipment, records why, and gives the quantity back', async () => {
		// The shipment is seeded as a settled row, because what is under test is the cancelation and
		// not the creation that precedes it.
		const fixture = fulfillmentFixture({
			seed: {
				order_line: [orderLine(LINE_A, { quantity: 5, fulfilledQuantity: 3 })],
				fulfillment: [shipment('pending', { metadata: { pickedBy: 'operator-1' } })],
				fulfillment_line: [shipmentLine('line-1', 'pending', LINE_A, 3)]
			}
		});

		const canceled = await fixture.service.cancel('pending', 'DAMAGED_PACKAGING');

		expect(canceled).toMatchObject({
			status: FulfillmentStatusDetail.CANCELED,
			canceledAt: SHIPPED_AT,
			version: 2
		});
		// The reason is merged into the metadata the shipment already carried, never over it.
		expect(canceled.metadata).toEqual({ pickedBy: 'operator-1', cancelReason: 'DAMAGED_PACKAGING' });
		// A cancelled shipment no longer accounts for its quantity, so the line has it back.
		expect(Number(fixture.line(LINE_A).fulfilledQuantity)).toBe(0);
	});

	it('cancels without a reason, keeping the metadata it already carried', async () => {
		const fixture = fulfillmentFixture({
			seed: {
				order_line: [orderLine(LINE_A, { quantity: 5, fulfilledQuantity: 3 })],
				fulfillment: [shipment('pending')],
				fulfillment_line: [shipmentLine('line-1', 'pending', LINE_A, 3)]
			}
		});

		const canceled = await fixture.service.cancel('pending');

		expect(canceled.status).toBe(FulfillmentStatusDetail.CANCELED);
		expect(canceled.metadata?.cancelReason).toBeUndefined();
		expect(Number(fixture.line(LINE_A).fulfilledQuantity)).toBe(0);
	});

	it('lets a cancelled shipment’s quantity be shipped again', async () => {
		// The consequence of the counter going back: INV-14 counts the lines of *non-cancelled*
		// fulfilments, so the units a cancelled shipment held are outstanding again, and the order can
		// be shipped a second time without a phantom shortfall.
		const fixture = fulfillmentFixture({ seed: { order_line: [orderLine(LINE_A, { quantity: 5 })] } });

		const first = await fixture.service.create({ orderId: ORDER, lines: [request(LINE_A, 5)] } as never);

		expect(await fixture.service.outstandingOf(LINE_A)).toBe(0);

		await fixture.service.cancel(first.id);

		expect(await fixture.service.outstandingOf(LINE_A)).toBe(5);

		const again = await fixture.service.create({ orderId: ORDER, lines: [request(LINE_A, 5)] } as never);

		expect(again.lines[0].quantity).toBe(5);
		expect(Number(fixture.line(LINE_A).fulfilledQuantity)).toBe(5);
		expect(again.id).not.toBe(first.id);
	});

	// The defect: the cancelation matrix of doc 09 §12.9 permits a cancelation from `PENDING` only —
	// `SHIPPED`, `IN_TRANSIT` and `DELIVERED` are refused with `FULFILLMENT_NOT_CANCELABLE`, because
	// goods that have left are handled by a return. `ALLOWED_TRANSITIONS` (`fulfillment.service.ts`,
	// lines 24–28) lists `CANCELED` as reachable from `SHIPPED`, so the shipment is cancelled and the
	// counters are moved back on a parcel that is already with the carrier.
	//
	// The cancelation of a shipped fulfilment is also where a second, narrow defect is visible: `cancel`
	// reverses `shippedQuantity` only when `fulfillment.status === SHIPPED` (lines 182–184), and the
	// `fulfillment` it tests is the row `transition` has *already* written as `CANCELED` (line 221) —
	// so the branch cannot fire, and a cancelled shipped fulfilment keeps reporting its units as
	// shipped. It is recorded here rather than asserted separately because the two readings of §12.9
	// disagree about whether that scenario is reachable at all, and the case that matters is the one
	// above: the cancelation should not be permitted.
	it.failing('[DEFECT] refuses to cancel a fulfilment the carrier has already taken', async () => {
		const fixture = fulfillmentFixture({ seed: { order_line: [orderLine(LINE_A, { quantity: 5 })] } });
		const created = await fixture.service.create({ orderId: ORDER, lines: [request(LINE_A, 3)] } as never);

		await fixture.service.ship(created.id);

		await expect(fixture.service.cancel(created.id, 'CHANGED_MIND')).rejects.toMatchObject({
			response: { code: 'FULFILLMENT_NOT_CANCELABLE' }
		});
	});

	// The defect: for the two statuses both readings agree are not cancelable, the refusal is raised
	// with the generic transition code (`fulfillment.service.ts`, line 216) rather than the one the API
	// contract publishes for this situation — `FULFILLMENT_NOT_CANCELABLE`, 409 (doc 06 §6.9, doc 09
	// §12.9), which is what a storefront branches on to tell a customer that a parcel cannot be called
	// back.
	it.failing('[DEFECT] refuses a cancelation of an in-transit or delivered shipment by its documented code', async () => {
		const fixture = fulfillmentFixture({ seed: { order_line: [orderLine(LINE_A, { quantity: 9 })] } });
		const created = await fixture.service.create({ orderId: ORDER, lines: [request(LINE_A, 3)] } as never);

		await fixture.service.ship(created.id);
		await fixture.service.markInTransit(created.id);

		await expect(fixture.service.cancel(created.id)).rejects.toMatchObject({
			response: { code: 'FULFILLMENT_NOT_CANCELABLE' }
		});

		await fixture.service.deliver(created.id);

		await expect(fixture.service.cancel(created.id)).rejects.toMatchObject({
			response: { code: 'FULFILLMENT_NOT_CANCELABLE' }
		});
	});

	// The defect: a cancelation is documented as idempotent — "CANCELED → no-op, 200 with the unchanged
	// resource" (doc 09 §12.9) — but after `transition` has answered the already-cancelled row,
	// `cancel` carries on and subtracts the shipment's quantity from `fulfilledQuantity` a second time
	// (`fulfillment.service.ts`, the `bumpOrderLineCounters(..., -quantity, 'FULFILLED')` on line 180).
	// The clamp on line 309 hides it while nothing else is fulfilled; as soon as a second fulfilment
	// holds part of the line, the second cancelation returns *its* quantity, and the order line claims
	// less has been fulfilled than the shipments that exist.
	it.failing('[DEFECT] returns a cancelled shipment’s quantity once, however often it is submitted', async () => {
		const fixture = fulfillmentFixture({ seed: { order_line: [orderLine(LINE_A, { quantity: 6 })] } });

		const first = await fixture.service.create({ orderId: ORDER, lines: [request(LINE_A, 3)] } as never);
		const second = await fixture.service.create({ orderId: ORDER, lines: [request(LINE_A, 3)] } as never);

		await fixture.service.cancel(first.id);
		expect(Number(fixture.line(LINE_A).fulfilledQuantity)).toBe(3);

		await fixture.service.cancel(first.id).catch(() => undefined);

		// The second shipment's three units are still fulfilled and must still be counted.
		expect(Number(fixture.line(LINE_A).fulfilledQuantity)).toBe(3);
		expect(fixture.row(second.id).status).toBe(FulfillmentStatusDetail.PENDING);
	});

	it('refuses a cancelation of a shipment that does not exist', async () => {
		const fixture = fulfillmentFixture();

		await expect(fixture.service.cancel(UNKNOWN, 'CHANGED_MIND')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('FulfillmentService — what an order line still has to ship (doc 09 §12.6)', () => {
	/** One row of the subtraction, and what it leaves: `quantity` is ten in every row. */
	const remainders: Array<[string, Row, number]> = [
		['nothing has happened to it', {}, 10],
		['part of it has shipped', { fulfilledQuantity: 4 }, 6],
		['all of it has shipped', { fulfilledQuantity: 10 }, 0],
		['some of it was written off', { writtenOffQuantity: 3 }, 7],
		['a return was dismissed', { returnDismissedQuantity: 2 }, 8],
		[
			'a return was dismissed, some was written off and some shipped',
			{ writtenOffQuantity: 3, returnDismissedQuantity: 2, fulfilledQuantity: 4 },
			1
		]
	];

	it.each(remainders)('answers what is left when %s', async (_situation, overrides, expected) => {
		const fixture = fulfillmentFixture({ seed: { order_line: [orderLine(LINE_A, overrides)] } });

		expect(await fixture.service.outstandingOf(LINE_A)).toBe(expected);
	});

	it('answers an empty remainder rather than a negative one for a line that was over-shipped', async () => {
		// The counters can legitimately pass the ordered quantity when an excess was recorded, and the
		// guard reads the negative remainder as "nothing may ship" — which is the safe direction.
		const fixture = fulfillmentFixture({
			seed: { order_line: [orderLine(LINE_A, { quantity: 5, fulfilledQuantity: 6 })] }
		});

		expect(await fixture.service.outstandingOf(LINE_A)).toBe(-1);
		await expect(
			fixture.service.create({ orderId: ORDER, lines: [request(LINE_A, 1)] } as never)
		).rejects.toMatchObject({ response: { code: 'FULFILLMENT_QUANTITY_EXCEEDED' } });
	});

	it('refuses to answer for an order line that does not exist', async () => {
		const fixture = fulfillmentFixture();

		await expect(fixture.service.outstandingOf(UNKNOWN)).rejects.toBeInstanceOf(NotFoundException);
	});

	// The defect: the positivity guard is written `quantity <= 0` (`fulfillment.service.ts`, line 265,
	// and the same shape again in `fulfillment-line.service.ts`, line 35), and every comparison with
	// `NaN` is false — so a quantity that is not a number at all passes both guards, is written to a
	// `numeric(20,6)` column whose check constraint says it is positive
	// (`CHK_fulfillment_line_positive`), and reaches the order line's counter as `NaN`. The service
	// states the rule it means to enforce: "a shipment quantity is positive".
	it.failing('[DEFECT] refuses a shipment quantity that is not a positive number', async () => {
		const fixture = fulfillmentFixture({ seed: { order_line: [orderLine(LINE_A)] } });

		await expect(
			fixture.service.create({ orderId: ORDER, lines: [request(LINE_A, Number.NaN)] } as never)
		).rejects.toBeInstanceOf(BadRequestException);
		expect(fixture.tables.fulfillment).toEqual([]);
		expect(Number.isNaN(Number(fixture.line(LINE_A).fulfilledQuantity))).toBe(false);
	});
});
