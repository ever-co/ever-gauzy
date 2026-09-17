/**
 * `@gauzy/core` boots the whole application graph from its barrel — the configuration, the ORM, the
 * job registry, the module scanner — none of which a line service needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary,
 * exactly as the catalogue and inventory packages' service specs do, and **the service under test is
 * the real one**: only the base CRUD class, the request context and the entity base classes are
 * substituted.
 *
 * The base-class double mirrors `TenantAwareCrudService` where the behaviour is observable to a
 * caller: a lookup by a missing id raises `NotFoundException`, `create` answers with the saved row,
 * and `softDelete` marks the row rather than erasing it.
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

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(this.typeOrmRepository.create(entity));
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
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		SequenceService: class {},
		Warehouse: class Warehouse {},
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

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { OrderReturnStatus } from '../returns.types';
import { OrderReturn } from '../order-return/order-return.entity';
import { OrderReturnLineService } from './order-return-line.service';

/**
 * The lines of a return, and the ceiling they are measured against.
 *
 * The rule the package exists for is stated in doc 10 §11.5 step 1 — *"per line:
 * `requested <= fulfilledQuantity - returnRequestedQuantity - writtenOffQuantity -
 * returnDismissedQuantity`"* — and it is a **ceiling checked before anything is written**, not a
 * validation detail: a return that covers goods which never shipped is a refund the tenant does not
 * owe. This suite pins it as an invariant rather than as a message:
 *
 * - the request is measured against what was fulfilled, and the check is **exact**: the quantities
 *   are compared as scaled integers, so `0.1 + 0.2` is accepted against a ceiling of `0.3` where a
 *   floating-point comparison answers `0.30000000000000004 > 0.3` and refuses it;
 * - one order line may be returned more than once, so what is measured is the **sum of every live
 *   return** on that line plus the request — never the request alone (doc 10 §11.5, and the class's
 *   own statement that the aggregate is "the second half of the rule");
 * - a return that was rejected or cancelled no longer counts against the order, which is what lets
 *   the customer ask again with a corrected request (doc 10 §11.5, §11.7 "returnRequestedQuantity
 *   reverted");
 * - a receipt may never claim more than the line was requested for — `receivedQuantity +
 *   damagedQuantity <= quantity`, the invariant the entity states verbatim — and a damaged unit
 *   counts against the request exactly like a good one, because an item that arrived broken arrived;
 * - without the order capability there is **no ceiling**, so the request is refused rather than
 *   waved through (doc 10 §11.5 step 1 has nothing to check against).
 *
 * The service is constructed directly with in-memory doubles of its three repositories. The doubles
 * state the `where` the service states — equality, `In` and the nested `Not(In(...))` the live-return
 * read builds — because a double that returned every row regardless would make the aggregate cases
 * vacuous.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const ORDER = '00000000-0000-4000-8000-000000000010';
const ORDER_LINE = '00000000-0000-4000-8000-000000000020';
const OTHER_ORDER_LINE = '00000000-0000-4000-8000-000000000021';
const VARIANT = '00000000-0000-4000-8000-000000000030';
const WAREHOUSE = '00000000-0000-4000-8000-000000000040';

type Row = Record<string, any>;

/** The tables this suite drives, as plain arrays. */
interface ITables {
	order_return: Row[];
	order_return_line: Row[];
}

/**
 * The in-memory stand-in for one table's TypeORM repository.
 *
 * @param tables The whole datastore.
 * @param tableName The table this repository writes.
 */
function repository(tables: ITables, tableName: keyof ITables) {
	let sequence = 0;
	const rows = () => tables[tableName].filter((row) => !row.deletedAt);
	const same = (left: unknown, right: unknown) => String(left ?? '') === String(right ?? '');
	/** Every operator the service actually builds, and nothing else: an unknown one throws. */
	const matchesOperator = (value: unknown, operator: FindOperator<any>): boolean => {
		switch (operator.type) {
			case 'in':
				return (operator.value ?? []).some((candidate: unknown) => matchesValue(value, candidate));
			case 'not':
				// TypeORM's `value` accessor unwraps a nested operator, so `Not(In(...))` arrives here as
				// the raw array: the double reads it the way the ORM does, which is what makes the
				// live-status read below a statement about the service rather than about the double.
				return Array.isArray(operator.value)
					? !operator.value.some((candidate: unknown) => same(value, candidate))
					: !same(value, operator.value);
			case 'lessThanOrEqual':
				return String(value ?? '') <= String(operator.value ?? '');
			default:
				throw new Error(`the in-memory double does not implement the "${operator.type}" operator`);
		}
	};
	const matchesValue = (value: unknown, expected: unknown): boolean => {
		if (expected instanceof FindOperator) {
			return matchesOperator(value, expected);
		}

		// A missing column and a null column are the same thing to the database, and TypeORM drops an
		// `undefined` member from the condition rather than matching nothing.
		if (expected === undefined) {
			return true;
		}

		return same(value, expected);
	};
	const matches = (row: Row, where: Row = {}): boolean =>
		Object.entries(where ?? {}).every(([field, expected]) => matchesValue(row[field], expected));
	const sorted = (found: Row[], order?: Record<string, 'ASC' | 'DESC'>) => {
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

	return {
		rows,
		all: () => tables[tableName],
		metadata: { tableName, hasColumnWithPropertyPath: () => false },
		find: async (options: any = {}) => sorted(rows().filter((row) => matches(row, options.where)), options.order),
		findOne: async (options: any = {}) => rows().find((row) => matches(row, options.where)) ?? null,
		findOneBy: async (where: any) => rows().find((row) => matches(row, where)) ?? null,
		findAndCount: async (options: any = {}) => {
			const items = rows().filter((row) => matches(row, options.where));

			return [items, items.length];
		},
		count: async (options: any = {}) => rows().filter((row) => matches(row, options.where)).length,
		create: (partial: any) => ({
			// The platform's own `create` stamps the tenant the request carries onto the row it writes —
			// `TenantAwareCrudService.create` reads `RequestContext.currentTenantId()` — and every read below
			// filters by it. A double that did not would make "write a line and read it straight back"
			// impossible, which is what a set rewrite does.
			...(partial.tenantId === undefined ? { tenantId: RequestContext.currentTenantId() } : {}),
			...(partial.organizationId === undefined ? { organizationId: RequestContext.currentOrganizationId() } : {}),
			...partial
		}),
		save: async (rowOrRows: any) => {
			const list = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];

			for (const entity of list) {
				if (entity.id) {
					const index = tables[tableName].findIndex((row) => same(row.id, entity.id));

					if (index >= 0) {
						tables[tableName][index] = { ...tables[tableName][index], ...entity };
						continue;
					}
				}

				// Generated ids carry an infix, so one can never collide with an id a fixture seeded.
				entity.id = `${String(tableName)}-new-${++sequence}`;
				tables[tableName].push(entity);
			}

			return Array.isArray(rowOrRows) ? list : list[0];
		},
		// The platform's `update` reaches TypeORM's own, which answers an `UpdateResult` and not the row.
		update: async (criteria: any, partial: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = tables[tableName].findIndex((row) => same(row.id, id));

			if (index >= 0) {
				Object.assign(tables[tableName][index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		softDelete: async (criteria: any) => {
			const matching = tables[tableName].filter((row) => matches(row, criteria));

			for (const row of matching) {
				row.deletedAt = new Date();
			}

			return { affected: matching.length };
		},
		delete: async (criteria: any) => {
			const id = typeof criteria === 'string' ? criteria : criteria?.id;
			const index = tables[tableName].findIndex((row) => same(row.id, id));

			if (index >= 0) {
				tables[tableName].splice(index, 1);
			}

			return { affected: index >= 0 ? 1 : 0 };
		}
	};
}

/** One `order_return` row, as the service reads it. */
const returnRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	orderId: ORDER,
	number: `RET-${id}`,
	status: OrderReturnStatus.OPEN,
	currency: 'USD',
	noNotification: false,
	...overrides
});

/** One `order_return_line` row, as the service reads it. */
const lineRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	returnId: 'return-1',
	orderLineId: ORDER_LINE,
	quantity: '5.000000',
	receivedQuantity: '0',
	damagedQuantity: '0',
	restock: true,
	createdAt: `2026-01-01T00:00:0${id.length % 10}.000Z`,
	...overrides
});

/** What the order domain reports about one order line. */
interface IFulfilledLine {
	orderLineId: string;
	fulfilledQuantity: string;
	variantId?: string;
	unitPrice?: string;
}

/**
 * Builds the line service over in-memory tables and one order capability.
 *
 * @param options.lines The return lines the fixture starts with.
 * @param options.returns The returns the fixture starts with.
 * @param options.fulfilled What the order domain reports as fulfilled, by order line.
 * @param options.withFulfillment Whether an order capability is registered at all.
 */
function lineFixture(
	options: {
		lines?: Row[];
		returns?: Row[];
		fulfilled?: IFulfilledLine[];
		withFulfillment?: boolean;
	} = {}
) {
	const tables: ITables = {
		order_return: [...(options.returns ?? [returnRow('return-1')])],
		order_return_line: [...(options.lines ?? [])]
	};
	const typeOrmOrderReturnLineRepository = repository(tables, 'order_return_line');
	const typeOrmOrderReturnRepository = repository(tables, 'order_return');
	const readOrderIds: string[] = [];
	const fulfilled: IFulfilledLine[] = options.fulfilled ?? [
		{ orderLineId: ORDER_LINE, fulfilledQuantity: '5.000000', variantId: VARIANT, unitPrice: '12.00' }
	];
	const withFulfillment = options.withFulfillment ?? true;
	const fulfillment = withFulfillment
		? {
				getFulfilledLines: async (orderId: string) => {
					readOrderIds.push(orderId);

					return fulfilled;
				}
		  }
		: undefined;
	const service = new OrderReturnLineService(
		typeOrmOrderReturnLineRepository as never,
		{} as never,
		typeOrmOrderReturnRepository as never,
		fulfillment as never
	);

	return {
		service,
		tables,
		readOrderIds,
		line: (id: string) => tables.order_return_line.find((row) => row.id === id),
		liveLines: (returnId: string) => tables.order_return_line.filter((row) => row.returnId === returnId)
	};
}

describe('OrderReturnLineService — the fulfilled ceiling (doc 10 §11.5 step 1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('accepts a request that is exactly what was fulfilled', async () => {
		// The boundary itself: `requested <= fulfilledQuantity` is satisfied by equality, so a customer
		// may return every unit that shipped.
		const fixture = lineFixture();

		const fulfilled = await fixture.service.assertReturnable(ORDER, [
			{ orderLineId: ORDER_LINE, quantity: '5.000000' }
		]);

		expect(fulfilled.get(ORDER_LINE)).toMatchObject({ fulfilledQuantity: '5.000000', variantId: VARIANT });
		expect(fixture.readOrderIds).toEqual([ORDER]);
	});

	it('refuses one unit past what was fulfilled, naming both numbers', async () => {
		const fixture = lineFixture();

		await expect(
			fixture.service.assertReturnable(ORDER, [{ orderLineId: ORDER_LINE, quantity: '5.000001' }])
		).rejects.toBeInstanceOf(BadRequestException);

		await expect(
			fixture.service.assertReturnable(ORDER, [{ orderLineId: ORDER_LINE, quantity: '6' }])
		).rejects.toThrow(/would exceed the 5\.000000 that was fulfilled/);
	});

	it('refuses a line for an order line that was never fulfilled', async () => {
		// "A customer cannot claim about an item that never shipped" — the sibling rule of the ceiling,
		// and the reason the order capability is read at all.
		const fixture = lineFixture();

		await expect(
			fixture.service.assertReturnable(ORDER, [{ orderLineId: OTHER_ORDER_LINE, quantity: '1' }])
		).rejects.toThrow(/was not fulfilled on this order/);
	});

	it('refuses a line that names no order line, and one with a non-positive quantity', async () => {
		const fixture = lineFixture();

		await expect(
			fixture.service.assertReturnable(ORDER, [{ orderLineId: undefined as never, quantity: '1' }])
		).rejects.toThrow(/must name the order line it returns/);

		await expect(
			fixture.service.assertReturnable(ORDER, [{ orderLineId: ORDER_LINE, quantity: '0' }])
		).rejects.toThrow(/non-positive quantity/);

		await expect(
			fixture.service.assertReturnable(ORDER, [{ orderLineId: ORDER_LINE, quantity: '-1' }])
		).rejects.toThrow(/non-positive quantity/);
	});

	it('refuses a request with no order to measure it against', async () => {
		const fixture = lineFixture();

		await expect(
			fixture.service.assertReturnable(undefined as never, [{ orderLineId: ORDER_LINE, quantity: '1' }])
		).rejects.toThrow(/must name the order it is against/);
	});

	it('refuses when no order capability is registered, because there is then no ceiling', async () => {
		const fixture = lineFixture({ withFulfillment: false });

		await expect(
			fixture.service.assertReturnable(ORDER, [{ orderLineId: ORDER_LINE, quantity: '1' }])
		).rejects.toThrow(/RETURN_FULFILLMENT_UNAVAILABLE/);
	});

	it('measures the request against every live return on the same order line, not against the request alone', async () => {
		// The aggregate half of the rule. A line fulfilled 10 units and already claimed by a live return
		// for 6 may be returned by 4 more, and by no more than 4.
		const fixture = lineFixture({
			fulfilled: [{ orderLineId: ORDER_LINE, fulfilledQuantity: '10.000000', variantId: VARIANT }],
			returns: [returnRow('return-1'), returnRow('return-2', { status: OrderReturnStatus.APPROVED })],
			lines: [lineRow('line-1', { returnId: 'return-2', quantity: '6.000000' })]
		});

		await expect(
			fixture.service.assertReturnable(ORDER, [{ orderLineId: ORDER_LINE, quantity: '4.000001' }])
		).rejects.toThrow(/Returning 10\.000001 of order line/);

		const fulfilled = await fixture.service.assertReturnable(ORDER, [
			{ orderLineId: ORDER_LINE, quantity: '4.000000' }
		]);

		expect(fulfilled.get(ORDER_LINE)?.fulfilledQuantity).toBe('10.000000');
	});

	it('does not count a rejected or cancelled return against the ceiling', async () => {
		// Control for the aggregate above: only the statuses in `LIVE_STATUSES` claim anything, so a
		// return that was refused releases its quantity and the customer may ask again (doc 10 §11.7).
		const fixture = lineFixture({
			fulfilled: [{ orderLineId: ORDER_LINE, fulfilledQuantity: '10.000000', variantId: VARIANT }],
			returns: [
				returnRow('return-2', { status: OrderReturnStatus.REJECTED }),
				returnRow('return-3', { status: OrderReturnStatus.CANCELED })
			],
			lines: [
				lineRow('line-1', { returnId: 'return-2', quantity: '6.000000' }),
				lineRow('line-2', { returnId: 'return-3', quantity: '4.000000' })
			]
		});

		const fulfilled = await fixture.service.assertReturnable(ORDER, [
			{ orderLineId: ORDER_LINE, quantity: '10.000000' }
		]);

		expect(fulfilled).toBeInstanceOf(Map);
	});

	it('does not count the return being edited against itself', async () => {
		// `excludeReturnId` is what makes an in-place edit possible: rewriting a return's own lines must
		// not be measured against the lines it is replacing.
		const fixture = lineFixture({
			fulfilled: [{ orderLineId: ORDER_LINE, fulfilledQuantity: '5.000000', variantId: VARIANT }],
			lines: [lineRow('line-1', { returnId: 'return-1', quantity: '5.000000' })]
		});

		await expect(
			fixture.service.assertReturnable(ORDER, [{ orderLineId: ORDER_LINE, quantity: '5.000000' }])
		).rejects.toThrow(/would exceed/);

		const fulfilled = await fixture.service.assertReturnable(
			ORDER,
			[{ orderLineId: ORDER_LINE, quantity: '5.000000' }],
			'return-1'
		);

		expect(fulfilled.get(ORDER_LINE)?.fulfilledQuantity).toBe('5.000000');
	});

	it('compares the quantities exactly, where a floating point sum would refuse a legal request', async () => {
		// The case the domain's quantity arithmetic exists for. `0.1 + 0.2` is `0.30000000000000004` in
		// binary floating point, so an implementation that summed the two as numbers would refuse a
		// return of the last 0.2 of a 0.3-unit line — at the boundary, which is exactly where a customer
		// notices. The scaled-integer comparison answers the question the column will.
		const fixture = lineFixture({
			fulfilled: [{ orderLineId: ORDER_LINE, fulfilledQuantity: '0.300000', variantId: VARIANT }],
			returns: [returnRow('return-2', { status: OrderReturnStatus.APPROVED })],
			lines: [lineRow('line-1', { returnId: 'return-2', quantity: '0.100000' })]
		});

		const naive = 0.1 + 0.2;

		expect(naive).toBeGreaterThan(0.3);
		expect(naive).not.toBe(0.3);

		const fulfilled = await fixture.service.assertReturnable(ORDER, [
			{ orderLineId: ORDER_LINE, quantity: '0.200000' }
		]);

		expect(fulfilled.get(ORDER_LINE)?.fulfilledQuantity).toBe('0.300000');

		// And one storage unit past the boundary is still refused.
		await expect(
			fixture.service.assertReturnable(ORDER, [{ orderLineId: ORDER_LINE, quantity: '0.200001' }])
		).rejects.toThrow(/would exceed/);
	});
});

describe('OrderReturnLineService — writing the line set (doc 10 §11.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('replaces the line set with the requested quantities at the storage scale', async () => {
		const fixture = lineFixture({ lines: [lineRow('stale', { quantity: '1.000000' })] });

		const written = await fixture.service.replaceLines('return-1', [
			{ orderLineId: ORDER_LINE, quantity: 2, restock: false, warehouseId: WAREHOUSE, note: 'torn seal' }
		]);

		expect(written).toHaveLength(1);
		expect(written[0]).toMatchObject({
			returnId: 'return-1',
			orderLineId: ORDER_LINE,
			quantity: '2.000000',
			receivedQuantity: '0',
			damagedQuantity: '0',
			restock: false,
			warehouseId: WAREHOUSE,
			note: 'torn seal'
		});
		// The row it replaced is soft-deleted rather than erased, so the partial unique index on the
		// pair keeps working and the superseded request stays readable.
		expect(fixture.line('stale')?.deletedAt).toBeInstanceOf(Date);
		expect(fixture.tables.order_return_line).toHaveLength(2);
	});

	it('restocks by default when the caller states no restock decision', async () => {
		const fixture = lineFixture();

		const written = await fixture.service.replaceLines('return-1', [
			{ orderLineId: ORDER_LINE, quantity: '1' }
		]);

		expect(written[0].restock).toBe(true);
	});

	it('normalises a quantity carrying more precision than the column holds, half-up', async () => {
		const fixture = lineFixture({
			fulfilled: [
				{ orderLineId: ORDER_LINE, fulfilledQuantity: '5.000000', variantId: VARIANT },
				{ orderLineId: OTHER_ORDER_LINE, fulfilledQuantity: '5.000000', variantId: VARIANT }
			]
		});

		const written = await fixture.service.replaceLines('return-1', [
			{ orderLineId: ORDER_LINE, quantity: '1.0000005' },
			{ orderLineId: OTHER_ORDER_LINE, quantity: '1.0000004' }
		]);

		expect(written.map((line) => line.quantity)).toEqual(['1.000001', '1.000000']);
	});

	it('refuses an empty line set', async () => {
		const fixture = lineFixture();

		await expect(fixture.service.replaceLines('return-1', [])).rejects.toThrow(/at least one line/);
		expect(fixture.tables.order_return_line).toEqual([]);
	});

	it('refuses to rewrite the lines of a return that has been decided', async () => {
		// Once a return is approved the customer has been told what to ship, so the set is frozen —
		// and the ceiling is no longer the only thing that would have to be re-checked.
		const fixture = lineFixture({
			returns: [returnRow('return-1', { status: OrderReturnStatus.APPROVED })],
			lines: [lineRow('line-1', { quantity: '5.000000' })]
		});

		await expect(
			fixture.service.replaceLines('return-1', [{ orderLineId: ORDER_LINE, quantity: '1' }])
		).rejects.toThrow(/cannot be changed; only an open or requested return can be edited/);
		expect(fixture.line('line-1')?.deletedAt).toBeUndefined();
	});

	it('refuses to write lines against a return of another organization', async () => {
		const fixture = lineFixture({ returns: [returnRow('return-1', { organizationId: OTHER_ORG })] });

		await expect(
			fixture.service.replaceLines('return-1', [{ orderLineId: ORDER_LINE, quantity: '1' }])
		).rejects.toBeInstanceOf(NotFoundException);
		expect(fixture.tables.order_return_line).toEqual([]);
	});
});

describe('OrderReturnLineService — recording what arrived (doc 10 §11.2, §11.6 step 2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('records the good and the damaged units, and carries the restock decision through', async () => {
		const fixture = lineFixture({ lines: [lineRow('line-1', { quantity: '5.000000' })] });

		const [recorded] = await fixture.service.recordReceipt('return-1', [
			{ lineId: 'line-1', receivedQuantity: '3', damagedQuantity: '1', restock: false }
		]);

		expect(recorded).toMatchObject({ receivedQuantity: '3.000000', damagedQuantity: '1.000000', restock: false });
		expect(fixture.line('line-1')).toMatchObject({ receivedQuantity: '3.000000', damagedQuantity: '1.000000' });
	});

	it('counts a damaged unit against the request exactly like a good one, at the boundary', async () => {
		// `receivedQuantity + damagedQuantity <= quantity` is the entity's own invariant. An item that
		// arrived broken still arrived, so it consumes the request exactly as a sound one does; the
		// receipt that fits exactly is accepted and the one a storage unit past it is refused.
		const fixture = lineFixture({
			lines: [lineRow('line-1', { quantity: '5.000000' }), lineRow('line-2', { quantity: '5.000000' })]
		});

		const [exact] = await fixture.service.recordReceipt('return-1', [
			{ lineId: 'line-1', receivedQuantity: '5', damagedQuantity: '0' }
		]);

		expect(exact.receivedQuantity).toBe('5.000000');

		await expect(
			fixture.service.recordReceipt('return-1', [
				{ lineId: 'line-2', receivedQuantity: '4.999999', damagedQuantity: '0.000002' }
			])
		).rejects.toThrow(/was requested for 5\.000000 but 5\.000001 was received/);
	});

	it('refuses a receipt that carries no quantity at all', async () => {
		const fixture = lineFixture({ lines: [lineRow('line-1', { quantity: '5.000000' })] });

		await expect(
			fixture.service.recordReceipt('return-1', [{ lineId: 'line-1', receivedQuantity: '0' }])
		).rejects.toThrow(/received with no quantity at all/);

		await expect(
			fixture.service.recordReceipt('return-1', [{ lineId: 'line-1', receivedQuantity: '-1' }])
		).rejects.toThrow(/received with no quantity at all/);
	});

	it('refuses a receipt naming a line that does not belong to the return', async () => {
		const fixture = lineFixture({ lines: [lineRow('line-1', { quantity: '5.000000' })] });

		await expect(
			fixture.service.recordReceipt('return-1', [{ lineId: 'line-of-another-return', receivedQuantity: '1' }])
		).rejects.toBeInstanceOf(NotFoundException);
		expect(fixture.line('line-1')).toMatchObject({ receivedQuantity: '0' });
	});

	it('refuses an empty receipt', async () => {
		const fixture = lineFixture({ lines: [lineRow('line-1', { quantity: '5.000000' })] });

		await expect(fixture.service.recordReceipt('return-1', [])).rejects.toThrow(/at least one line/);
	});
});

describe('OrderReturnLineService — the reads a listing is built from (doc 10 §11.7)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('reports only the orders whose return still counts, once each', async () => {
		const fixture = lineFixture({
			returns: [
				returnRow('live-1', { orderId: ORDER, status: OrderReturnStatus.APPROVED }),
				returnRow('live-2', { orderId: ORDER, status: OrderReturnStatus.PARTIALLY_RECEIVED }),
				returnRow('dead-1', { orderId: 'order-2', status: OrderReturnStatus.REJECTED }),
				returnRow('mine-of-theirs', { orderId: 'order-3', organizationId: OTHER_ORG })
			]
		});

		expect(await fixture.service.findOrderIdsWithLiveReturns([ORDER, 'order-2', 'order-3'])).toEqual([ORDER]);
		// An empty question is answered without reading anything, which is what a listing page with no
		// orders on it asks.
		expect(await fixture.service.findOrderIdsWithLiveReturns([])).toEqual([]);
	});

	it('reports the returns that no longer count, and never the live ones', async () => {
		const fixture = lineFixture({
			returns: [
				returnRow('live-1', { orderId: ORDER, status: OrderReturnStatus.RECEIVED }),
				returnRow('dead-1', { orderId: ORDER, status: OrderReturnStatus.REJECTED }),
				returnRow('dead-2', { orderId: ORDER, status: OrderReturnStatus.CANCELED }),
				returnRow('dead-3', { orderId: ORDER, status: OrderReturnStatus.CLOSED })
			]
		});

		// `CLOSED` is live: the refund is settled and the stock decision written, so the units it
		// returned are still units that did not come back to the catalogue intact.
		expect((await fixture.service.findReversedReturns(ORDER)).map((row) => row.id)).toEqual(['dead-1', 'dead-2']);
	});

	it('reads a return’s lines inside the caller’s organization only', async () => {
		const fixture = lineFixture({
			lines: [
				lineRow('line-1', { quantity: '1.000000' }),
				lineRow('line-2', { returnId: 'return-2', quantity: '1.000000' }),
				lineRow('line-3', { organizationId: OTHER_ORG, quantity: '1.000000' })
			]
		});

		expect((await fixture.service.findForReturn('return-1')).map((row) => row.id)).toEqual(['line-1']);
	});
});

/**
 * A control for the two arithmetic paths the suite above depends on: the helpers the service reads
 * the ceiling through are the real ones, so a case that passes here is a statement about the domain
 * and not about a double.
 */
describe('OrderReturnLineService — the exact quantities it measures with', () => {
	it('keeps the shipped line and the returned line indistinguishable at the storage scale', async () => {
		const fixture = lineFixture({
			fulfilled: [{ orderLineId: ORDER_LINE, fulfilledQuantity: '2.675', variantId: VARIANT }]
		});

		// A third of the line, three times, is the whole line — exactly, at the storage scale.
		for (const quantity of ['0.891667', '0.891667', '0.891666']) {
			await expect(
				fixture.service.assertReturnable(ORDER, [{ orderLineId: ORDER_LINE, quantity }])
			).resolves.toBeInstanceOf(Map);
		}
	});
});
