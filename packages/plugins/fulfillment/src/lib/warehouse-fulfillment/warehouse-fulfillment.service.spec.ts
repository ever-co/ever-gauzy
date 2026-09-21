/**
 * Two module boundaries are doubled here, and the reason is the same for both.
 *
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a read of a shipment needs and none of which is
 * available outside a running application. `@gauzy/plugin-order`'s barrel re-exports the whole order
 * and cart domain, and the only thing this capability wants from it is the variant an order line
 * names. Both seams are therefore doubled at the module boundary and **the services under test are
 * the real ones**: the capability the location reads, and the real shipment service it composes and
 * the real shipment-line service it reads through.
 *
 * The base-class double mirrors `CrudService` / `TenantAwareCrudService` exactly where the behaviour
 * is observable to a caller: `find` and `findOneByWhereOptions` narrow by the stated `where`, and
 * `update` accepts either an identifier or a criteria object, which is the form the freeze uses so
 * that the row it writes is the row the caller's scope selected.
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
		normalizeDecimalString: decimals.normalizeDecimalString,
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
			// The scope the fixture's rows are stamped with. A case about tenancy re-points it with a spy,
			// so the scope is never a constant of this specification.
			currentTenantId: () => '00000000-0000-4000-8000-000000000001',
			currentOrganizationId: () => '00000000-0000-4000-8000-000000000002',
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

jest.mock('@gauzy/plugin-order', () => ({
	// The variant lives on the order line, which is another package's row: the suite hands the
	// capability its own reader below, so the class here is only the module's identity.
	OrderLineService: class OrderLineService {}
}));

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { FulfillmentDirection, FulfillmentStatusDetail } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { FulfillmentLineService } from '../fulfillment-line/fulfillment-line.service';
import { FulfillmentService } from '../fulfillment/fulfillment.service';
import { WarehouseFulfillmentService } from './warehouse-fulfillment.service';

/**
 * The shipments a location works from, as the location reads them.
 *
 * What this suite is about is the *answer*, and each case pins something that would make it wrong
 * rather than merely inconvenient:
 *
 * - **Only work is reported as work.** A shipment that has already left, one that is cancelled, a
 *   return leg and a digital delivery are all absent from the lines a picking list is derived from,
 *   and a shipment held at another location is absent from this location's work — the quantity,
 *   though, is the shipment's own, because that is what the list may ask for.
 * - **A parcel leaves once.** The manifest claim is what freezes membership, so a shipment another
 *   manifest already holds is refused — not skipped — and no membership is written at all when one of
 *   the named parcels cannot be frozen. A release only ever clears this manifest's own membership.
 * - **Absence is an answer.** A location with nothing to pick reports nothing, a pool with nothing
 *   shipped reports nothing, and a claim or a release that names no shipment writes nothing and
 *   answers zero.
 * - **Every read is scoped.** A shipment of another organization is not found, is never counted, and
 *   its lines are not even read — an answer across tenants would be a data leak rather than a
 *   feature.
 *
 * The capability is constructed directly over in-memory doubles of the tables' repositories, and the
 * doubles answer the statements the services actually issue: the `where` narrowing, the ordering and
 * the two operator forms the reads and the freeze use.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000003';
const OTHER_ORG = '00000000-0000-4000-8000-000000000004';

const WAREHOUSE = '00000000-0000-4000-8000-0000000000a0';
const OTHER_WAREHOUSE = '00000000-0000-4000-8000-0000000000a1';
const ORDER = '00000000-0000-4000-8000-000000000010';
const OTHER_ORDER = '00000000-0000-4000-8000-000000000011';
const CARRIER = 'carrier-1';
const SERVICE = 'express';

const SHIPPED_AT = new Date('2026-02-14T09:31:07.412Z');
const IN_WINDOW = new Date('2026-02-14T12:00:00.000Z');
const OUT_OF_WINDOW = new Date('2026-03-01T12:00:00.000Z');

type Row = Record<string, any>;

/**
 * @param actual The stored value.
 * @param expected The value the service stated.
 * @returns Whether the database would have treated them as equal. A column that is absent and one that
 * is null are the same thing to a database, which is why both compare as the empty string.
 */
function equals(actual: unknown, expected: unknown): boolean {
	return String(actual ?? '') === String(expected ?? '');
}

/**
 * @param row A stored row.
 * @param value The condition the service stated.
 * @returns Whether the database would have matched the row.
 */
function matchesValue(row: Row, field: string, value: unknown): boolean {
	return value instanceof FindOperator ? matchesOperator(row[field], value) : equals(row[field], value);
}

/**
 * @param actual The stored value.
 * @param operator The operator the service stated.
 * @returns Whether the operand holds for the value.
 */
function matchesOperator(actual: unknown, operator: FindOperator<unknown>): boolean {
	const operand = operator.value as any;

	switch (operator.type) {
		case 'in':
			return (operand as unknown[]).some((entry) => equals(actual, entry));
		case 'not':
			return !(operand instanceof FindOperator ? matchesOperator(actual, operand) : equals(actual, operand));
		case 'isNull':
			return actual === null || actual === undefined;
		case 'between':
			return actual >= operand[0] && actual <= operand[1];
		case 'moreThanOrEqual':
			return actual >= operand;
		case 'lessThanOrEqual':
			return actual <= operand;
		default:
			throw new Error(`the in-memory double does not know the operator '${operator.type}'`);
	}
}

/**
 * @param row A stored row.
 * @param where The condition the service stated.
 * @returns Whether the database would have returned the row. An `undefined` member is not a
 * condition at all — TypeORM drops it — which is why it matches.
 */
function matches(row: Row, where: Row = {}): boolean {
	return Object.entries(where ?? {}).every(
		([field, value]) => value === undefined || matchesValue(row, field, value)
	);
}

/**
 * @param rows The rows of one table.
 * @returns A repository double that narrows by the stated `where`, honours the stated `order`, and
 * records nothing: every assertion below is about state.
 */
function repository(rows: Row[]) {
	const select = (options: Row = {}): Row[] => {
		const selected = rows.filter((row) => matches(row, options.where));
		const order = options.order ?? {};

		return selected.sort((left, right) => {
			for (const [field, direction] of Object.entries(order)) {
				const left_ = left[field];
				const right_ = right[field];

				if (left_ === right_) {
					continue;
				}

				return (left_ > right_ ? 1 : -1) * (String(direction).toUpperCase() === 'DESC' ? -1 : 1);
			}

			return 0;
		});
	};
	const identify = (criteria: any) => (typeof criteria === 'string' ? criteria : criteria?.id);

	return {
		rows,
		find: async (options: Row = {}) => select(options),
		findOne: async (options: Row = {}) => select(options)[0] ?? null,
		findOneBy: async (where: Row = {}) => rows.find((row) => matches(row, where)) ?? null,
		findAndCount: async (options: Row = {}) => {
			const items = select(options);

			return [items, items.length];
		},
		create: (partial: Row) => ({ ...partial }),
		save: async (row: Row) => {
			if (row.id) {
				const index = rows.findIndex((stored) => stored.id === row.id);

				if (index >= 0) {
					rows[index] = { ...rows[index], ...row };

					return rows[index];
				}
			}

			const created = { id: `fulfillment-${rows.length + 1}`, ...row };

			rows.push(created);

			return created;
		},
		update: async (criteria: any, partial: Row) => {
			const index =
				typeof criteria === 'string'
					? rows.findIndex((row) => row.id === criteria)
					: rows.findIndex((row) => matches(row, criteria));

			if (index >= 0) {
				Object.assign(rows[index], partial);
			}

			return { affected: index >= 0 ? 1 : 0 };
		},
		delete: async () => ({ affected: 0 })
	};
}

/** One `fulfillment` row, as this capability reads it. */
const shipmentRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	orderId: ORDER,
	warehouseId: WAREHOUSE,
	direction: FulfillmentDirection.OUTBOUND,
	status: FulfillmentStatusDetail.PENDING,
	requiresShipping: true,
	carrier: CARRIER,
	service: SERVICE,
	shippedAt: null,
	trackingNumber: `TRACK-${id}`,
	version: 1,
	...overrides
});

/** One `fulfillment_line` row. */
const lineRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	fulfillmentId: 'shipment-1',
	orderLineId: 'order-line-1',
	quantity: 3,
	...overrides
});

/** One `order_line` row: the variant the shipment line is for. */
const orderLineRow = (id: string, overrides: Row = {}): Row => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	orderId: ORDER,
	variantId: `variant-of-${id}`,
	...overrides
});

/**
 * @param options The rows the fixture starts with.
 * @returns The capability, wired to the real services over the doubles, and the tables themselves.
 */
function fixture(
	options: { shipments?: Row[]; lines?: Row[]; orderLines?: Row[] } = {}
) {
	const shipments = options.shipments ?? [];
	const lines = options.lines ?? [];
	const orderLines = options.orderLines ?? [];
	const shipmentRepository = repository(shipments);
	const lineRepository = repository(lines);
	const orderLineRepository = repository(orderLines);
	const lineService = new FulfillmentLineService(lineRepository as never, {} as never);
	const orderLineService = {
		find: async (findOptions: Row = {}) => orderLineRepository.find(findOptions)
	};
	const fulfillmentService = new FulfillmentService(
		shipmentRepository as never,
		{} as never,
		lineService,
		orderLineService as never,
		// The outbox the service appends its state changes to, stubbed for the same reason the return
		// shipment suite stubs it: the constructor gained it when the lifecycle started announcing
		// itself, and a double that stops matching the constructor fails to compile.
		{ append: jest.fn() } as never
	);
	const service = new WarehouseFulfillmentService(
		fulfillmentService,
		lineService,
		orderLineService as never
	);

	return { service, shipments, lines, orderLines, lineRepository };
}

describe('WarehouseFulfillmentService — the lines a pick list is derived from', () => {
	afterEach(() => jest.restoreAllMocks());

	it('reports the lines of a shipment that has not left, with the variant the order line names', async () => {
		const { service } = fixture({
			shipments: [shipmentRow('shipment-1')],
			lines: [
				lineRow('line-1', { orderLineId: 'order-line-1', quantity: 2.5 }),
				lineRow('line-2', { orderLineId: 'order-line-2', quantity: 2.675 })
			],
			orderLines: [orderLineRow('order-line-1'), orderLineRow('order-line-2')]
		});

		const shippable = await service.listShippableLines({
			warehouseId: WAREHOUSE,
			fulfillmentIds: ['shipment-1']
		});

		expect(shippable).toEqual([
			{
				fulfillmentLineId: 'line-1',
				fulfillmentId: 'shipment-1',
				orderLineId: 'order-line-1',
				orderId: ORDER,
				variantId: 'variant-of-order-line-1',
				quantity: '2.5',
				warehouseId: WAREHOUSE
			},
			{
				fulfillmentLineId: 'line-2',
				fulfillmentId: 'shipment-1',
				orderLineId: 'order-line-2',
				orderId: ORDER,
				variantId: 'variant-of-order-line-2',
				quantity: '2.675',
				warehouseId: WAREHOUSE
			}
		]);
		// The quantities are exact decimal text: `2.675` is the shape a binary float cannot hold, and a
		// comparison at that boundary is what the orders of magnitude above would get wrong.
		expect(typeof shippable[1].quantity).toBe('string');
	});

	it('reports nothing for a location with no shipment and for a shipment with no line', async () => {
		const empty = fixture({});
		const lineLess = fixture({ shipments: [shipmentRow('shipment-1')] });

		expect(await empty.service.listShippableLines({ warehouseId: WAREHOUSE })).toEqual([]);
		expect(
			await lineLess.service.listShippableLines({ warehouseId: WAREHOUSE, fulfillmentIds: ['shipment-1'] })
		).toEqual([]);
	});

	it('reads no line at all when the caller named no shipment', async () => {
		// An empty list of shipments is a statement about no shipment, not an absent filter: the answer is
		// nothing, and the lines are never read.
		const { service, lineRepository } = fixture({
			shipments: [shipmentRow('shipment-1')],
			lines: [lineRow('line-1')],
			orderLines: [orderLineRow('order-line-1')]
		});
		const asks = jest.spyOn(lineRepository, 'find');

		expect(await service.listShippableLines({ warehouseId: WAREHOUSE, fulfillmentIds: [] })).toEqual([]);
		expect(asks).not.toHaveBeenCalled();
	});

	it('leaves out a shipment that has left, one that was cancelled and one with nothing to ship', async () => {
		const { service } = fixture({
			shipments: [
				shipmentRow('pending'),
				shipmentRow('shipped', {
					status: FulfillmentStatusDetail.SHIPPED,
					shippedAt: SHIPPED_AT
				}),
				shipmentRow('cancelled', { status: FulfillmentStatusDetail.CANCELED }),
				shipmentRow('digital', { requiresShipping: false }),
				shipmentRow('return-leg', { direction: FulfillmentDirection.RETURN })
			],
			lines: [
				lineRow('line-pending', { fulfillmentId: 'pending' }),
				lineRow('line-shipped', { fulfillmentId: 'shipped' }),
				lineRow('line-cancelled', { fulfillmentId: 'cancelled' }),
				lineRow('line-digital', { fulfillmentId: 'digital' }),
				lineRow('line-return', { fulfillmentId: 'return-leg' })
			],
			orderLines: [orderLineRow('order-line-1')]
		});

		const shippable = await service.listShippableLines({ warehouseId: WAREHOUSE });

		expect(shippable.map((line) => line.fulfillmentLineId)).toEqual(['line-pending']);
	});

	it('reports only the lines that leave from the named location', async () => {
		// A shipment spanning two locations is picked at both: what is held here is fetched here, and what
		// is held elsewhere is fetched there.
		const { service } = fixture({
			shipments: [shipmentRow('shipment-1')],
			lines: [
				lineRow('here', { warehouseId: WAREHOUSE }),
				lineRow('elsewhere', { warehouseId: OTHER_WAREHOUSE }),
				lineRow('inherits-the-shipment', { warehouseId: null })
			],
			orderLines: [orderLineRow('order-line-1')]
		});

		const shippable = await service.listShippableLines({ warehouseId: WAREHOUSE, fulfillmentIds: ['shipment-1'] });

		expect(shippable.map((line) => line.fulfillmentLineId)).toEqual(['here', 'inherits-the-shipment']);
		expect(shippable.map((line) => line.warehouseId)).toEqual([WAREHOUSE, WAREHOUSE]);
	});

	it('leaves out a line whose order line names no variant, because nothing can be allocated for it', async () => {
		const { service } = fixture({
			shipments: [shipmentRow('shipment-1')],
			lines: [lineRow('line-1', { orderLineId: 'order-line-without-variant' })],
			orderLines: [orderLineRow('order-line-without-variant', { variantId: null })]
		});

		expect(
			await service.listShippableLines({ warehouseId: WAREHOUSE, fulfillmentIds: ['shipment-1'] })
		).toEqual([]);
	});

	it('scopes the read to the caller and does not find a shipment of another organization', async () => {
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);
		const { service, lineRepository } = fixture({
			shipments: [shipmentRow('shipment-1')],
			lines: [lineRow('line-1')],
			orderLines: [orderLineRow('order-line-1')]
		});
		const asks = jest.spyOn(lineRepository, 'find');

		expect(await service.listShippableLines({ warehouseId: WAREHOUSE, fulfillmentIds: ['shipment-1'] })).toEqual(
			[]
		);
		// A foreign shipment's contents never leave the database: its lines are not read at all.
		expect(asks).not.toHaveBeenCalled();
	});

	it('scopes the read to the caller and does not report a variant of another organization', async () => {
		// The shipment is the caller's and the order line it satisfies is not: the variant is not answered,
		// and the line is left out rather than reported with a variant the caller may not see.
		const { service } = fixture({
			shipments: [shipmentRow('shipment-1')],
			lines: [lineRow('line-1')],
			orderLines: [orderLineRow('order-line-1', { organizationId: OTHER_ORG })]
		});

		expect(
			await service.listShippableLines({ warehouseId: WAREHOUSE, fulfillmentIds: ['shipment-1'] })
		).toEqual([]);
	});

	it('refuses to answer when no location was named', async () => {
		const { service, lineRepository } = fixture({});
		const asks = jest.spyOn(lineRepository, 'find');

		await expect(service.listShippableLines({} as never)).rejects.toThrow(/SHIPMENT_LOCATION_REQUIRED/);
		expect(asks).not.toHaveBeenCalled();
	});
});

describe('WarehouseFulfillmentService — what has shipped from a location', () => {
	afterEach(() => jest.restoreAllMocks());

	it('reports the shipments that left, oldest first, with the carrier that took them', async () => {
		const { service } = fixture({
			shipments: [
				shipmentRow('later', {
					status: FulfillmentStatusDetail.DELIVERED,
					shippedAt: IN_WINDOW
				}),
				shipmentRow('earlier', {
					status: FulfillmentStatusDetail.SHIPPED,
					shippedAt: SHIPPED_AT
				})
			]
		});

		const shipped = await service.listShipped({
			warehouseId: WAREHOUSE,
			carrier: CARRIER,
			service: SERVICE
		});

		expect(shipped).toEqual([
			{
				fulfillmentId: 'earlier',
				warehouseId: WAREHOUSE,
				orderId: ORDER,
				carrier: CARRIER,
				service: SERVICE,
				shippedAt: SHIPPED_AT,
				trackingNumber: 'TRACK-earlier'
			},
			{
				fulfillmentId: 'later',
				warehouseId: WAREHOUSE,
				orderId: ORDER,
				carrier: CARRIER,
				service: SERVICE,
				shippedAt: IN_WINDOW,
				trackingNumber: 'TRACK-later'
			}
		]);
	});

	it('reports nothing when nothing has left, and nothing outside the stated window', async () => {
		const nothingShipped = fixture({ shipments: [shipmentRow('pending')] });
		const windowed = fixture({
			shipments: [
				shipmentRow('inside', { shippedAt: IN_WINDOW }),
				shipmentRow('outside', { shippedAt: OUT_OF_WINDOW })
			]
		});

		expect(await nothingShipped.service.listShipped({ warehouseId: WAREHOUSE })).toEqual([]);
		expect(
			(
				await windowed.service.listShipped({
					warehouseId: WAREHOUSE,
					windowFrom: SHIPPED_AT,
					windowTo: IN_WINDOW
				})
			).map((shipment) => shipment.fulfillmentId)
		).toEqual(['inside']);
	});

	it('leaves out the parcels another manifest already froze, and only those', async () => {
		const { service } = fixture({
			shipments: [
				shipmentRow('claimed', { shippedAt: SHIPPED_AT, metadata: { manifestId: 'manifest-1' } }),
				shipmentRow('free', { shippedAt: IN_WINDOW })
			]
		});

		const unclaimed = await service.listShipped({ warehouseId: WAREHOUSE, unclaimedOnly: true });
		const pool = await service.listShipped({ warehouseId: WAREHOUSE });

		expect(unclaimed.map((shipment) => shipment.fulfillmentId)).toEqual(['free']);
		// The control: without the filter both are reported, so the case is about the claim and not about
		// the read being too narrow.
		expect(pool.map((shipment) => shipment.fulfillmentId)).toEqual(['claimed', 'free']);
	});

	it('leaves out a parcel another carrier took and one sent on another service', async () => {
		const { service } = fixture({
			shipments: [
				shipmentRow('ours', { shippedAt: SHIPPED_AT }),
				shipmentRow('another-carrier', { shippedAt: SHIPPED_AT, carrier: 'carrier-2' }),
				shipmentRow('another-service', { shippedAt: SHIPPED_AT, service: 'standard' }),
				shipmentRow('another-order', { shippedAt: SHIPPED_AT, orderId: OTHER_ORDER })
			]
		});

		const shipped = await service.listShipped({
			warehouseId: WAREHOUSE,
			carrier: CARRIER,
			service: SERVICE,
			windowFrom: SHIPPED_AT
		});

		expect(shipped.map((shipment) => shipment.fulfillmentId)).toEqual(['another-order', 'ours']);
		// The order is carried, not filtered: a manifest covers what left, whichever order it settled.
		expect(shipped.map((shipment) => shipment.orderId)).toEqual([OTHER_ORDER, ORDER]);
	});

	it('scopes the pool to the caller and reports nothing of another organization', async () => {
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);
		const { service } = fixture({ shipments: [shipmentRow('ours', { shippedAt: SHIPPED_AT })] });

		expect(await service.listShipped({ warehouseId: WAREHOUSE })).toEqual([]);
	});

	it('refuses to answer when no location was named', async () => {
		const { service } = fixture({});

		await expect(service.listShipped({} as never)).rejects.toThrow(/SHIPMENT_LOCATION_REQUIRED/);
	});
});

describe('WarehouseFulfillmentService — freezing a manifest and returning its parcels', () => {
	afterEach(() => jest.restoreAllMocks());

	it('writes the manifest onto every named shipment and keeps the payload it found', async () => {
		const { service, shipments } = fixture({
			shipments: [
				shipmentRow('a', { shippedAt: SHIPPED_AT, metadata: { carrierNote: 'left at dock 2' } }),
				shipmentRow('b', { shippedAt: SHIPPED_AT })
			]
		});

		const claimed = await service.claimForManifest({ manifestId: 'manifest-1', fulfillmentIds: ['a', 'b'] });

		expect(claimed).toBe(2);
		expect(shipments[0].metadata).toEqual({ carrierNote: 'left at dock 2', manifestId: 'manifest-1' });
		expect(shipments[1].metadata).toEqual({ manifestId: 'manifest-1' });
	});

	it('answers the unchanged count when the same manifest claims its own parcels again', async () => {
		const { service, shipments } = fixture({
			shipments: [
				shipmentRow('a', { shippedAt: SHIPPED_AT, metadata: { manifestId: 'manifest-1' } }),
				shipmentRow('b', { shippedAt: SHIPPED_AT, metadata: { manifestId: 'manifest-1' } })
			]
		});

		expect(await service.claimForManifest({ manifestId: 'manifest-1', fulfillmentIds: ['a', 'b'] })).toBe(2);
		expect(shipments.map((shipment) => shipment.metadata)).toEqual([
			{ manifestId: 'manifest-1' },
			{ manifestId: 'manifest-1' }
		]);
	});

	it('refuses a shipment that another manifest froze, and freezes none of them', async () => {
		// The membership is written for every named parcel or for none: a manifest that covers three of the
		// five parcels it named is a manifest nobody can hand to a carrier.
		const { service, shipments } = fixture({
			shipments: [
				shipmentRow('free', { shippedAt: SHIPPED_AT }),
				shipmentRow('taken', { shippedAt: SHIPPED_AT, metadata: { manifestId: 'manifest-2' } })
			]
		});

		await expect(
			service.claimForManifest({ manifestId: 'manifest-1', fulfillmentIds: ['free', 'taken'] })
		).rejects.toBeInstanceOf(ConflictException);
		expect(shipments[0].metadata).toBeUndefined();
		expect(shipments[1].metadata).toEqual({ manifestId: 'manifest-2' });
	});

	it('refuses a parcel that has not left, and freezes none of them', async () => {
		const { service, shipments } = fixture({
			shipments: [shipmentRow('left', { shippedAt: SHIPPED_AT }), shipmentRow('still-here')]
		});

		await expect(
			service.claimForManifest({ manifestId: 'manifest-1', fulfillmentIds: ['left', 'still-here'] })
		).rejects.toThrow(/SHIPMENT_NOT_DEPARTED/);
		expect(shipments[0].metadata).toBeUndefined();
	});

	it('refuses a shipment that is not the caller and freezes none of them', async () => {
		const { service, shipments } = fixture({
			shipments: [
				shipmentRow('mine', { shippedAt: SHIPPED_AT }),
				shipmentRow('theirs', { shippedAt: SHIPPED_AT, organizationId: OTHER_ORG })
			]
		});

		await expect(
			service.claimForManifest({ manifestId: 'manifest-1', fulfillmentIds: ['mine', 'theirs'] })
		).rejects.toBeInstanceOf(NotFoundException);
		expect(shipments[0].metadata).toBeUndefined();
		expect(shipments[1].metadata).toBeUndefined();
	});

	it('writes nothing and answers zero when no shipment was named, and refuses no manifest', async () => {
		const { service, shipments } = fixture({ shipments: [shipmentRow('a', { shippedAt: SHIPPED_AT })] });

		expect(await service.claimForManifest({ manifestId: 'manifest-1', fulfillmentIds: [] })).toBe(0);
		await expect(service.claimForManifest({ manifestId: '', fulfillmentIds: ['a'] } as never)).rejects.toThrow(
			/MANIFEST_REFERENCE_REQUIRED/
		);
		expect(shipments[0].metadata).toBeUndefined();
	});

	it('clears the manifest on release, leaving the rest of the payload in place', async () => {
		const { service, shipments } = fixture({
			shipments: [
				shipmentRow('a', { shippedAt: SHIPPED_AT, metadata: { manifestId: 'manifest-1', carrierNote: 'ok' } }),
				shipmentRow('b', { shippedAt: SHIPPED_AT, metadata: { manifestId: 'manifest-1' } })
			]
		});

		const released = await service.releaseFromManifest({ manifestId: 'manifest-1', fulfillmentIds: ['a', 'b'] });

		expect(released).toBe(2);
		expect(shipments[0].metadata).toEqual({ carrierNote: 'ok' });
		// The member is gone rather than set to null: an absent claim is what returns a parcel to the pool.
		expect('manifestId' in shipments[0].metadata).toBe(false);
		expect(shipments[1].metadata).toEqual({});
	});

	it('leaves another manifest\'s parcels alone when releasing', async () => {
		const { service, shipments } = fixture({
			shipments: [
				shipmentRow('mine', { shippedAt: SHIPPED_AT, metadata: { manifestId: 'manifest-1' } }),
				shipmentRow('theirs', { shippedAt: SHIPPED_AT, metadata: { manifestId: 'manifest-2' } }),
				shipmentRow('never-claimed', { shippedAt: SHIPPED_AT })
			]
		});

		const released = await service.releaseFromManifest({
			manifestId: 'manifest-1',
			fulfillmentIds: ['mine', 'theirs', 'never-claimed']
		});

		// Clearing another manifest's membership would take a parcel off a manifest the carrier has
		// already signed for, so a parcel this manifest does not hold is not released and not counted.
		expect(released).toBe(1);
		expect(shipments[0].metadata).toEqual({});
		expect(shipments[1].metadata).toEqual({ manifestId: 'manifest-2' });
		expect(shipments[2].metadata).toBeUndefined();
	});

	it('releases nothing of another organization', async () => {
		const { service, shipments } = fixture({
			shipments: [
				shipmentRow('theirs', {
					shippedAt: SHIPPED_AT,
					organizationId: OTHER_ORG,
					metadata: { manifestId: 'manifest-1' }
				})
			]
		});

		expect(await service.releaseFromManifest({ manifestId: 'manifest-1', fulfillmentIds: ['theirs'] })).toBe(0);
		expect(shipments[0].metadata).toEqual({ manifestId: 'manifest-1' });
	});

	it('releases nothing when no shipment was named, and refuses no manifest', async () => {
		const { service } = fixture({});

		expect(await service.releaseFromManifest({ manifestId: 'manifest-1', fulfillmentIds: [] })).toBe(0);
		await expect(
			service.releaseFromManifest({ manifestId: '', fulfillmentIds: ['a'] } as never)
		).rejects.toThrow(/MANIFEST_REFERENCE_REQUIRED/);
	});

	it('scopes the tenant as well as the organization', async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(OTHER_TENANT);
		const { service, shipments } = fixture({
			shipments: [shipmentRow('a', { shippedAt: SHIPPED_AT })]
		});

		await expect(
			service.claimForManifest({ manifestId: 'manifest-1', fulfillmentIds: ['a'] })
		).rejects.toBeInstanceOf(NotFoundException);
		expect(shipments[0].metadata).toBeUndefined();
	});
});
