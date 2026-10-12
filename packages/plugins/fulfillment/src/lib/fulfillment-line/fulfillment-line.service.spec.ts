/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a line's own guards need and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary,
 * exactly as the sibling package's service specs do, and **the service under test is the real one**:
 * only the CRUD base class, the request context and the entity base classes are substituted.
 *
 * The base-class double mirrors `CrudService` / `TenantAwareCrudService` where the behaviour is
 * observable to a caller: `findAll` answers `{ items, total }`, a lookup that matches nothing raises
 * `NotFoundException` rather than answering `null` (`packages/core/src/lib/core/crud/crud.service.ts`,
 * the `if (!record)` branch of `findOneByIdString` on line 409), and `update` answers TypeORM's
 * `UpdateResult` after loading the row, which is what `TenantAwareCrudService.update` does.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	// The platform's exact decimal primitives are pulled through the seam rather than restated: this
	// double replaces the application graph the barrel boots, not the arithmetic the assertions below
	// turn on.
	const decimals = jest.requireActual('@gauzy/core/src/lib/money/decimal');

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
		compareDecimalStrings: decimals.compareDecimalStrings,
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		VersionedColumn: decorator,
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

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
// The request context of the module mock above, so a case can state which organization it runs in.
import { RequestContext } from '@gauzy/core';
import { FulfillmentLineService } from './fulfillment-line.service';

/**
 * What is in a shipment.
 *
 * One row per shipment and order line — the shape that makes partial fulfilment unambiguous — and the
 * properties the specification fixes are the ones this suite pins:
 *
 * - a line's quantity is **positive**: a zero or negative shipment is refused with
 *   `FULFILLMENT_LINE_QUANTITY_INVALID`, which is also what the table's own check constraint says
 *   (`CHK_fulfillment_line_positive`, the migration of this package);
 * - **one row per `(fulfillment, orderLineId)`**, because a second partial shipment of the same line
 *   is a second fulfilment and not a second row here — the rule `UQ_fulfillment_line` expresses and
 *   the reason a picking list never has to ask which of two rows is the one being picked (doc 09
 *   §12.6);
 * - the same order line in *another* fulfilment is legal, and is what partial fulfilment is;
 * - the row's quantity is what the shipment service reads back when it moves the order line's
 *   counters, so a line is the evidence and the counter is the cache of it (doc 05 I-45);
 * - the counters themselves are **not** written here: the shipment service moves them in the same
 *   transaction as the row that causes them, so there is one writer and one opinion about how much of
 *   a line has shipped (doc 09 §12.5).
 *
 * The service is constructed directly with an in-memory double of its repository. The double states
 * the `where` the service states — the pair of ids the duplicate guard is built from — because a
 * double that matched every row regardless would make that guard vacuous.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const ORDER = '00000000-0000-4000-8000-000000000010';
const SHIPMENT_ONE = '00000000-0000-4000-8000-0000000000f1';
const SHIPMENT_TWO = '00000000-0000-4000-8000-0000000000f2';
const LINE_A = '00000000-0000-4000-8000-0000000000a1';
const LINE_B = '00000000-0000-4000-8000-0000000000b1';
const UNKNOWN = '00000000-0000-4000-8000-0000000000ff';

type Row = Record<string, any>;

/** The tables this suite drives, as plain arrays. */
interface ITables {
	order_line: Row[];
	/** The shipments the lines belong to, which the removal reads through the line's `fulfillment`. */
	fulfillment: Row[];
	fulfillment_line: Row[];
}

/**
 * An in-memory stand-in for one table's TypeORM repository.
 *
 * @param tables The whole datastore.
 * @param tableName The table this repository writes.
 */
function repository(tables: ITables, tableName: keyof ITables) {
	let sequence = 0;
	const rows = () => tables[tableName];
	const same = (left: unknown, right: unknown) => String(left ?? '') === String(right ?? '');
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where).every(([field, expected]) => {
			// TypeORM drops an `undefined` member from the condition rather than matching nothing.
			if (expected === undefined) {
				return true;
			}

			return same(row[field], expected);
		});

	/**
	 * Resolves the one relation the service asks for — a line's shipment, which is many-to-one through
	 * `fulfillmentId` — because the removal decides on the shipment's status and direction, and a double
	 * that ignored the relation would make every such case answer "shipment unknown".
	 */
	const withRelations = (record: Row, requested?: string[]): Row => {
		if (!requested?.includes('fulfillment')) {
			return record;
		}

		return {
			...record,
			fulfillment: tables.fulfillment.find((shipment) => same(shipment.id, record.fulfillmentId)) ?? null
		};
	};

	return {
		rows,
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		find: async (options: Row = {}) =>
			rows()
				.filter((row) => matches(row, options.where))
				.map((row) => withRelations(row, options.relations)),
		findOne: async (options: Row = {}) => {
			const found = rows().find((row) => matches(row, options.where));

			return found ? withRelations(found, options.relations) : null;
		},
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

			const created = { id: `${String(tableName)}-new-${++sequence}`, ...entity };

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
		// TypeORM's `delete` applies the whole criteria it is handed. The removal states the caller's
		// organization beside the id, so a double that matched on the id alone would make that case vacuous.
		delete: async (criteria: any) => {
			const where = typeof criteria === 'string' ? { id: criteria } : (criteria ?? {});
			const index = rows().findIndex((row) => matches(row, where));

			if (index >= 0) {
				rows().splice(index, 1);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	};
}

/** One `order_line` row, which this service must never write to. */
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

/** One `fulfillment` row, which is what decides whether its lines may be removed. */
const shipmentOf = (id: string, status: string = 'PENDING', direction: string = 'OUTBOUND') => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	orderId: ORDER,
	status,
	direction
});

/** One `fulfillment_line` row, as a settled part of the fixture. */
const settled = (id: string, fulfillmentId: string, orderLineId: string, quantity: number) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	fulfillmentId,
	orderLineId,
	quantity
});

/**
 * Builds the line service over one in-memory `fulfillment_line` table.
 *
 * @param seed.fulfillment_line The rows the fixture starts with.
 * @param seed.order_line The order lines, so the cases that assert this service leaves them alone can.
 * @param seed.fulfillment The shipments the lines belong to.
 */
function lineFixture(seed: { fulfillment_line?: Row[]; order_line?: Row[]; fulfillment?: Row[] } = {}) {
	const tables: ITables = {
		order_line: [...(seed.order_line ?? [orderLine(LINE_A), orderLine(LINE_B)])],
		fulfillment: [...(seed.fulfillment ?? [])],
		fulfillment_line: [...(seed.fulfillment_line ?? [])]
	};
	const service = new FulfillmentLineService(repository(tables, 'fulfillment_line') as never, {} as never);

	return {
		service,
		tables,
		row: (id: string) => tables.fulfillment_line.find((row) => row.id === id),
		line: (id: string = LINE_A) => tables.order_line.find((row) => row.id === id),
		linesOf: (fulfillmentId: string) =>
			tables.fulfillment_line.filter((row) => row.fulfillmentId === fulfillmentId),
		linesFor: (orderLineId: string) =>
			tables.fulfillment_line.filter((row) => row.orderLineId === orderLineId)
	};
}

/** One line to write, so a case states only what it is about. */
const line = (overrides: Row = {}) => ({
	fulfillmentId: SHIPMENT_ONE,
	orderLineId: LINE_A,
	quantity: 3,
	...overrides
});

describe('FulfillmentLineService — the quantity a shipment line may carry (doc 09 §12.5, §12.6)', () => {
	it('writes the line it was handed and answers with it', async () => {
		const fixture = lineFixture();

		const created = await fixture.service.create(line() as never);

		expect(created).toMatchObject({ fulfillmentId: SHIPMENT_ONE, orderLineId: LINE_A });
		expect(Number(created.quantity)).toBe(3);
		expect(fixture.tables.fulfillment_line).toHaveLength(1);
		expect(fixture.row(created.id)).toMatchObject({ fulfillmentId: SHIPMENT_ONE, orderLineId: LINE_A });
	});

	it('refuses a quantity of zero and a negative quantity, writing neither', async () => {
		const fixture = lineFixture();

		for (const quantity of [0, -1]) {
			await expect(fixture.service.create(line({ quantity }) as never)).rejects.toMatchObject({
				response: {
					code: 'FULFILLMENT_LINE_QUANTITY_INVALID',
					details: { quantity }
				}
			});
		}

		expect(fixture.tables.fulfillment_line).toEqual([]);
	});

	it('accepts a quantity of a fraction of a unit, which is what a measured good ships in', async () => {
		// The column is `numeric(20,6)`, so a shipment of 0.25 kg is a positive quantity and not a
		// rounding error to be refused.
		const fixture = lineFixture();

		const created = await fixture.service.create(line({ quantity: 0.25 }) as never);

		expect(Number(created.quantity)).toBe(0.25);
	});

	// The defect: the guard is written `Number(entity.quantity) <= 0`
	// (`fulfillment-line.service.ts`, line 35 — and the same shape again in the shipment service's
	// `assertQuantityAvailable`, line 265), and every comparison with `NaN` is false. A quantity that
	// is absent, `NaN`, or text that is not a number therefore passes the guard, is written to a column
	// whose check constraint says it is positive (`CHK_fulfillment_line_positive`), and reaches the
	// order line's counter as `NaN` — a shipment whose quantity nothing can reconcile. The rule the
	// service states is "a fulfilment line quantity must be positive", and `NaN` is not.
	it('[DEFECT] refuses a quantity that is not a positive number at all', async () => {
		const fixture = lineFixture();

		await expect(fixture.service.create(line({ quantity: Number.NaN }) as never)).rejects.toBeInstanceOf(
			BadRequestException
		);
		await expect(fixture.service.create(line({ quantity: undefined }) as never)).rejects.toBeInstanceOf(
			BadRequestException
		);
		expect(fixture.tables.fulfillment_line).toEqual([]);
	});

	it('imposes no ceiling of its own, because the ceiling is what the order line has left', async () => {
		// Control for the guard above: this service checks positivity and the pair, and nothing else. The
		// quantity that may ship is decided against the order line's outstanding quantity by the
		// shipment service (doc 09 §12.6), so a line written here may legitimately exceed what is left —
		// and a service that refused it here would be a second opinion about the order.
		const fixture = lineFixture();

		const created = await fixture.service.create(line({ quantity: 1_000_000 }) as never);

		expect(Number(created.quantity)).toBe(1_000_000);
	});
});

describe('FulfillmentLineService — one row per shipment and order line (doc 09 §12.6)', () => {
	it('refuses a second row for the order line it already carries', async () => {
		// `UQ_fulfillment_line` claims `(fulfillmentId, orderLineId)`, and the refusal names both halves
		// so a caller can tell which shipment already holds the line.
		const fixture = lineFixture({ fulfillment_line: [settled('existing', SHIPMENT_ONE, LINE_A, 2)] });

		await expect(fixture.service.create(line({ quantity: 1 }) as never)).rejects.toMatchObject({
			response: {
				code: 'FULFILLMENT_LINE_DUPLICATE',
				details: { orderLineId: LINE_A, fulfillmentId: SHIPMENT_ONE }
			}
		});
		expect(fixture.tables.fulfillment_line).toHaveLength(1);
	});

	it('takes the same order line in a second shipment, which is what partial fulfilment is', async () => {
		// The control for the refusal above: a further partial shipment is a *second fulfilment*, so the
		// same order line legitimately appears once in each of them.
		const fixture = lineFixture({ fulfillment_line: [settled('first', SHIPMENT_ONE, LINE_A, 2)] });

		const second = await fixture.service.create(line({ fulfillmentId: SHIPMENT_TWO, quantity: 3 }) as never);

		expect(second.fulfillmentId).toBe(SHIPMENT_TWO);
		expect(fixture.linesFor(LINE_A)).toHaveLength(2);
		expect(fixture.linesFor(LINE_A).map((row) => Number(row.quantity))).toEqual([2, 3]);
	});

	it('takes a second order line in the same shipment', async () => {
		const fixture = lineFixture({ fulfillment_line: [settled('first', SHIPMENT_ONE, LINE_A, 2)] });

		const second = await fixture.service.create(line({ orderLineId: LINE_B, quantity: 4 }) as never);

		expect(second.orderLineId).toBe(LINE_B);
		expect(fixture.linesOf(SHIPMENT_ONE)).toHaveLength(2);
	});

	it('reads back exactly the lines of the shipment it is asked about', async () => {
		// How the shipment service reads what to move when it ships or delivers: a shipment moves the
		// counters of its own lines and of nobody else's.
		const fixture = lineFixture({
			fulfillment_line: [
				settled('one-a', SHIPMENT_ONE, LINE_A, 2),
				settled('one-b', SHIPMENT_ONE, LINE_B, 1),
				settled('two-a', SHIPMENT_TWO, LINE_A, 3)
			]
		});

		const page = await fixture.service.findAll({ where: { fulfillmentId: SHIPMENT_ONE } } as never);

		expect(page.items).toHaveLength(2);
		expect(page.total).toBe(2);
		expect(page.items.map((row: Row) => row.id).sort()).toEqual(['one-a', 'one-b']);
	});

	it('answers an empty page for a shipment with no lines', async () => {
		const fixture = lineFixture();

		const page = await fixture.service.findAll({ where: { fulfillmentId: SHIPMENT_ONE } } as never);

		expect(page).toEqual({ items: [], total: 0 });
	});

	it('keeps the per-line payload a picker or a carrier wrote on it', async () => {
		// The row is where a per-line exception lives: the bin the units came from, the short-pick note,
		// the parcel's own tracking when one shipment travels as several.
		const fixture = lineFixture();

		const created = await fixture.service.create(
			line({ metadata: { binLocation: 'A-12-3', shortReason: null, serials: ['S-1', 'S-2'] } }) as never
		);

		expect(created.metadata).toEqual({ binLocation: 'A-12-3', shortReason: null, serials: ['S-1', 'S-2'] });
	});

	it('writes the line without touching the order line it belongs to', async () => {
		// The division of responsibility the package states: the counters live on the order line and are
		// moved by the shipment service, in the same transaction as the row that causes them — so a line
		// written here alone leaves the order exactly as it was.
		const fixture = lineFixture();

		await fixture.service.create(line({ quantity: 4 }) as never);

		expect(fixture.line(LINE_A)).toMatchObject({
			fulfilledQuantity: 0,
			shippedQuantity: 0,
			deliveredQuantity: 0
		});
	});
});

describe('FulfillmentLineService — the CRUD surface its callers rely on', () => {
	it('answers a page with its total', async () => {
		const fixture = lineFixture({
			fulfillment_line: [settled('one-a', SHIPMENT_ONE, LINE_A, 2), settled('one-b', SHIPMENT_ONE, LINE_B, 1)]
		});

		const page = await fixture.service.findAll({ where: { fulfillmentId: SHIPMENT_ONE } } as never);

		expect(Object.keys(page).sort()).toEqual(['items', 'total']);
		expect(page.total).toBe(2);
	});

	it('writes an update and answers with the update result, not with the row', async () => {
		// The platform's `update` reaches TypeORM's own for the TypeORM branch, so what a caller gets
		// back is `{ affected }` — which is why every caller that wants the row reads it afterwards.
		//
		// This case used to write `{ quantity: 1.5 }` over a line of 2 and assert the new quantity. That
		// was the defect rather than the contract: the order line's counters were moved by the 2 and nothing
		// moved them again, so the line and its counter disagreed for good. The quantity is now refused (see
		// the suite below), and the update result is asserted on the payload a correction is for.
		const fixture = lineFixture({ fulfillment_line: [settled('one-a', SHIPMENT_ONE, LINE_A, 2)] });

		const answered = await fixture.service.update('one-a', { metadata: { bin: 'A-12-3' } } as never);

		expect(answered).toMatchObject({ affected: 1 });
		expect(fixture.row('one-a').metadata).toEqual({ bin: 'A-12-3' });
		expect(Number(fixture.row('one-a').quantity)).toBe(2);
	});

	it('refuses an update on a line that does not exist', async () => {
		const fixture = lineFixture();

		await expect(fixture.service.update(UNKNOWN, { quantity: 1 } as never)).rejects.toBeInstanceOf(
			NotFoundException
		);
	});

	it('deletes the line it is asked for and leaves the other lines of the shipment alone', async () => {
		// How a shipment loses a line: the row goes, and what the shipment still carries is what is left.
		// The shipment is a cancelled one: a line of a shipment the order line still counts is refused (see
		// the suite below), and this case is about which row goes, not about that rule.
		const fixture = lineFixture({
			fulfillment: [shipmentOf(SHIPMENT_ONE, 'CANCELED')],
			fulfillment_line: [settled('one-a', SHIPMENT_ONE, LINE_A, 2), settled('one-b', SHIPMENT_ONE, LINE_B, 1)]
		});

		await fixture.service.delete('one-a');

		expect(fixture.row('one-a')).toBeUndefined();
		expect(fixture.linesOf(SHIPMENT_ONE)).toHaveLength(1);
		expect(fixture.row('one-b')).toBeDefined();
	});

	it('answers a delete of a line that is already gone with nothing affected', async () => {
		// Idempotent from the caller's point of view: detaching something that is not attached is not an
		// error, and the answer says so.
		const fixture = lineFixture();

		await expect(fixture.service.delete(UNKNOWN)).resolves.toMatchObject({ affected: 0 });
	});
});

/**
 * What a line's own correction and removal may not do (C10).
 *
 * `PUT` and `DELETE /fulfillment-lines/:id` and the `updateFulfillmentLine` and `deleteFulfillmentLine`
 * fields all reach this service, and none of them can give the order line's counters back — the shipment
 * service moved those by the line's shipment, order line and quantity when the shipment was created, and
 * only its `cancel` returns them. So a correction that re-sized or re-pointed a line, or a removal that took
 * a line of a shipment the counters still count, left `fulfilledQuantity` describing a shipment that no
 * longer existed: the order stayed `FULFILLED` and the line's remainder was never shippable again. Both are
 * refused here, below both surfaces.
 */
describe('FulfillmentLineService — a correction or a removal never strands the order line’s counters', () => {
	afterEach(() => jest.restoreAllMocks());

	it('refuses a correction that re-sizes a line, and leaves the row as it was', async () => {
		const fixture = lineFixture({ fulfillment_line: [settled('one-a', SHIPMENT_ONE, LINE_A, 5)] });

		await expect(fixture.service.update('one-a', { quantity: 1 } as never)).rejects.toMatchObject({
			response: {
				code: 'FULFILLMENT_LINE_IMMUTABLE',
				details: { fulfillmentLineId: 'one-a', columns: ['quantity'] }
			}
		});
		await expect(fixture.service.update('one-a', { quantity: 1 } as never)).rejects.toBeInstanceOf(
			BadRequestException
		);
		expect(Number(fixture.row('one-a').quantity)).toBe(5);
	});

	it('refuses a correction that re-points a line at another order line or another shipment', async () => {
		const fixture = lineFixture({ fulfillment_line: [settled('one-a', SHIPMENT_ONE, LINE_A, 5)] });

		await expect(
			fixture.service.update('one-a', { orderLineId: LINE_B, fulfillmentId: SHIPMENT_TWO } as never)
		).rejects.toMatchObject({
			response: { code: 'FULFILLMENT_LINE_IMMUTABLE', details: { columns: ['fulfillmentId', 'orderLineId'] } }
		});
		expect(fixture.row('one-a')).toMatchObject({ fulfillmentId: SHIPMENT_ONE, orderLineId: LINE_A });
	});

	it('accepts a correction that restates what the row holds, and writes the members it does change', async () => {
		// A client that echoes the row back with its payload edited is not refused for the members it did not
		// touch: the quantity is compared as the exact decimal it is, so `'5.000000'` restates `5`.
		const fixture = lineFixture({ fulfillment_line: [settled('one-a', SHIPMENT_ONE, LINE_A, 5)] });

		const answered = await fixture.service.update('one-a', {
			fulfillmentId: SHIPMENT_ONE,
			orderLineId: LINE_A,
			quantity: '5.000000',
			warehouseId: UNKNOWN,
			metadata: { bin: 'B-01-1' }
		} as never);

		expect(answered).toMatchObject({ affected: 1 });
		expect(fixture.row('one-a')).toMatchObject({ warehouseId: UNKNOWN, metadata: { bin: 'B-01-1' } });
	});

	it('refuses a quantity that is not a decimal at all rather than comparing it as one', async () => {
		const fixture = lineFixture({ fulfillment_line: [settled('one-a', SHIPMENT_ONE, LINE_A, 5)] });

		await expect(fixture.service.update('one-a', { quantity: 'five' } as never)).rejects.toMatchObject({
			response: { code: 'FULFILLMENT_LINE_IMMUTABLE' }
		});
		expect(Number(fixture.row('one-a').quantity)).toBe(5);
	});

	it('refuses to remove a line of a shipment the order line still counts, and keeps the row', async () => {
		for (const status of ['PENDING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED']) {
			const fixture = lineFixture({
				fulfillment: [shipmentOf(SHIPMENT_ONE, status)],
				fulfillment_line: [settled('one-a', SHIPMENT_ONE, LINE_A, 5)]
			});

			await expect(fixture.service.delete('one-a')).rejects.toMatchObject({
				response: {
					code: 'FULFILLMENT_LINE_NOT_DELETABLE',
					details: { fulfillmentLineId: 'one-a', fulfillmentId: SHIPMENT_ONE, status, direction: 'OUTBOUND' }
				}
			});
			await expect(fixture.service.delete('one-a')).rejects.toBeInstanceOf(ConflictException);
			expect(fixture.row('one-a')).toBeDefined();
		}
	});

	it('removes a line of a cancelled shipment or of a return leg, which count nothing', async () => {
		const fixture = lineFixture({
			fulfillment: [shipmentOf(SHIPMENT_ONE, 'CANCELED'), shipmentOf(SHIPMENT_TWO, 'PENDING', 'RETURN')],
			fulfillment_line: [settled('one-a', SHIPMENT_ONE, LINE_A, 5), settled('two-a', SHIPMENT_TWO, LINE_A, 2)]
		});

		await expect(fixture.service.delete('one-a')).resolves.toMatchObject({ affected: 1 });
		await expect(fixture.service.delete('two-a')).resolves.toMatchObject({ affected: 1 });
		expect(fixture.tables.fulfillment_line).toEqual([]);
	});

	it('refuses a line whose shipment cannot be read, rather than guessing it counts nothing', async () => {
		const fixture = lineFixture({ fulfillment_line: [settled('one-a', SHIPMENT_ONE, LINE_A, 5)] });

		await expect(fixture.service.delete('one-a')).rejects.toMatchObject({
			response: { code: 'FULFILLMENT_LINE_NOT_DELETABLE', details: { status: null, direction: null } }
		});
		expect(fixture.row('one-a')).toBeDefined();
	});

	it('selects only the organization the request states, for the check and for the removal alike', async () => {
		const fixture = lineFixture({
			fulfillment: [shipmentOf(SHIPMENT_ONE, 'CANCELED')],
			fulfillment_line: [settled('one-a', SHIPMENT_ONE, LINE_A, 5)]
		});

		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(UNKNOWN as never);

		await expect(fixture.service.delete('one-a')).resolves.toMatchObject({ affected: 0 });
		expect(fixture.row('one-a')).toBeDefined();

		// The control: under the line's own organization the same removal goes through.
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG as never);

		await expect(fixture.service.delete('one-a')).resolves.toMatchObject({ affected: 1 });
		expect(fixture.row('one-a')).toBeUndefined();
	});
});
