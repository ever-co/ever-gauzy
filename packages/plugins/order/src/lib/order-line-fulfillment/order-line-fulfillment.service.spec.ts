/**
 * One module boundary is doubled here, for the same reason and in the same way as the package's
 * other suites: `@gauzy/core` boots the whole application graph from its barrel — configuration,
 * the ORM, the job registry, the module scanner — none of which a read of two columns needs and
 * none of which is available outside a running application. The service under test is the real one,
 * and so are the two entities it reads through, which is why the double below answers with the
 * numeric transformer's own output rather than with a text value the database would never produce.
 */
jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	return {
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
		Idempotent: decorator,
		Versioned: decorator,
		VersionedColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		// Added with the received-return counter's writer: the counter is moved by adding two exact
		// decimals, and a double that omits the helper makes the code under test call nothing — which
		// fails the suite for a reason that is not its own.
		addDecimalStrings: jest.requireActual('@gauzy/core/src/lib/money/decimal').addDecimalStrings,
		compareDecimalStrings: jest.requireActual('@gauzy/core/src/lib/money/decimal').compareDecimalStrings,
		normalizeDecimalString: jest.requireActual('@gauzy/core/src/lib/money/decimal').normalizeDecimalString,
		// The double answers with the fixture's scope, which is what a request-scoped read resolves to.
		// A case that is about tenancy re-points it with a spy, so the scope is never a constant of this
		// specification.
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

import { NotFoundException } from '@nestjs/common';
import { RequestContext } from '@gauzy/core';
import { OrderLineFulfillmentService } from './order-line-fulfillment.service';

/**
 * The fulfilled quantities of an order, as a package that does not own the order reads them.
 *
 * What this suite is about is the *answer*, not the query: a caller measures a request against the
 * number reported here, so the cases below assert the three things that would make the answer
 * wrong rather than merely inconvenient.
 *
 * - **The ceiling is what was fulfilled, never what was ordered.** A partially fulfilled line
 *   reports the part that left, and the ordered quantity appears nowhere in the report.
 * - **A line with nothing fulfilled on it is absent.** Absence is the caller's answer to "may this
 *   be acted on?", so a never-fulfilled line — and a line whose fulfilments were all cancelled —
 *   must not be reported as a zero the caller would have to interpret.
 * - **Both numbers are exact.** The quantity is the column's exact decimal text and the price is
 *   the snapshot the line was sold at, at the storage scale, so a comparison at the ceiling and a
 *   multiplication into an amount are both exact.
 *
 * Tenancy is asserted as well, because a read that answered across organizations would be a data
 * leak rather than a bug in a feature: the order is read inside the caller's scope, and a foreign
 * order is not found at all — its lines are never even read.
 */

const TENANT = 'tenant-1';
const ORG = 'organization-1';
const OTHER_TENANT = 'tenant-2';
const OTHER_ORG = 'organization-2';
const ORDER = 'order-1';
const OTHER_ORDER = 'order-2';

/**
 * The tenancy cases below re-point `RequestContext` with a spy, and a spy on a module-level object
 * outlives the case that set it: without this, everything after the first tenancy case runs scoped to
 * whichever organization that case named, and a later case fails for a reason that is not its own.
 */
afterEach(() => jest.restoreAllMocks());

/** The price the fixture's lines were sold at, as the numeric transformer reads a `numeric(20,6)`. */
const SOLD_AT = 12.5;
const SECOND_SOLD_AT = 19.99;

/** One `order_line` row, as this service reads it. */
interface ILineRow {
	id: string;
	orderId: string;
	tenantId?: string;
	organizationId?: string;
	variantId?: string;
	position?: number;
	fulfilledQuantity?: number;
	returnReceivedQuantity?: number;
	unitPrice?: number;
}

/**
 * @param row A stored row.
 * @param where The condition the service stated.
 * @returns Whether the database would have returned the row.
 */
function matches(row: object, where: Record<string, unknown> | undefined): boolean {
	const fields = row as Record<string, unknown>;

	return Object.entries(where ?? {}).every(
		([field, expected]) => expected === undefined || String(expected ?? '') === String(fields[field] ?? '')
	);
}

/**
 * @param rows The rows of one table.
 * @returns A repository double that narrows by the stated `where`, and the options it was asked with.
 */
function repository(rows: object[]) {
	const options: Array<Record<string, unknown>> = [];
	const updates: Array<{ id: unknown; partial: Record<string, unknown> }> = [];

	return {
		options,
		updates,
		find: async (stated: Record<string, unknown> = {}) => {
			options.push(stated);

			return rows.filter((row) => matches(row, stated.where as Record<string, unknown>));
		},
		findOne: async (stated: Record<string, unknown> = {}) => {
			options.push(stated);

			return rows.filter((row) => matches(row, stated.where as Record<string, unknown>))[0] ?? null;
		},
		// The one write this service performs. It narrows by the same criteria a read does, so a case
		// that points the scope at another organization sees the row it named go unwritten — which is
		// the difference between a refused write and a write that quietly missed.
		update: async (criteria: unknown, partial: Record<string, unknown>) => {
			const id = typeof criteria === 'string' ? criteria : (criteria as Record<string, unknown>)?.id;
			const row = rows.find((candidate) => String((candidate as Record<string, unknown>).id) === String(id));

			updates.push({ id, partial });

			if (!row) {
				return { affected: 0 };
			}

			Object.assign(row, partial);

			return { affected: 1 };
		}
	};
}

/**
 * @param lines The order's lines.
 * @param order The order header the read is scoped to.
 * @returns The service, wired to the two doubles, and the doubles themselves.
 */
function fixture(lines: ILineRow[], order: Record<string, unknown> = {}) {
	const orders = repository([
		{ id: ORDER, tenantId: TENANT, organizationId: ORG, currency: 'USD', channelId: 'channel-1', ...order }
	]);
	const orderLines = repository(lines);

	return {
		orders,
		orderLines,
		service: new OrderLineFulfillmentService(orders as never, orderLines as never)
	};
}

/** A line that shipped in full. */
const line = (overrides: Partial<ILineRow> & { id: string }): ILineRow => ({
	orderId: ORDER,
	tenantId: TENANT,
	organizationId: ORG,
	position: 0,
	fulfilledQuantity: 0,
	unitPrice: SOLD_AT,
	...overrides
});

describe('OrderLineFulfillmentService — the ceiling a post-purchase flow is measured against', () => {
	afterEach(() => jest.restoreAllMocks());

	it('reports what each line fulfilled, at the price it was sold at', async () => {
		const { service } = fixture([
			line({ id: 'line-1', variantId: 'variant-1', fulfilledQuantity: 5 }),
			line({ id: 'line-2', fulfilledQuantity: 2.675, unitPrice: SECOND_SOLD_AT })
		]);

		const fulfilled = await service.getFulfilledLines(ORDER);

		expect(fulfilled).toEqual([
			{ orderLineId: 'line-1', variantId: 'variant-1', fulfilledQuantity: '5', unitPrice: '12.500000' },
			{ orderLineId: 'line-2', fulfilledQuantity: '2.675', unitPrice: '19.990000' }
		]);
		// A line that names no variant reports no variant rather than an empty one, so a caller
		// branching on the variant's presence is not fooled by a falsy string.
		expect('variantId' in fulfilled[1]).toBe(false);
	});

	it('reports the fulfilled part of a partially fulfilled line, never the ordered quantity', async () => {
		// The boundary this port exists for: ten were ordered, four left the building, and a return may
		// cover four. The ordered quantity is deliberately not part of the answer.
		const { service } = fixture([line({ id: 'line-1', fulfilledQuantity: 4 })]);

		const [reported] = await service.getFulfilledLines(ORDER);

		expect(reported.fulfilledQuantity).toBe('4');
		expect(Object.keys(reported)).not.toContain('quantity');
	});

	it('reports an exact decimal for a quantity and a price that a float would round', async () => {
		// `2.675` and `1234.567891` are the shapes a binary float cannot hold exactly; both are
		// reported as the decimal text the column holds, which is what the caller compares and
		// multiplies with.
		const { service } = fixture([
			line({ id: 'line-1', fulfilledQuantity: 2.675, unitPrice: 1234.567891 })
		]);

		const [reported] = await service.getFulfilledLines(ORDER);

		expect(reported.fulfilledQuantity).toBe('2.675');
		expect(reported.unitPrice).toBe('1234.567891');
		expect(typeof reported.unitPrice).toBe('string');
	});

	it('leaves out a line that was never fulfilled, and keeps the sibling that shipped', async () => {
		// The control is the sibling: the report is filtered on what was fulfilled, not on whether the
		// line exists, so a caller asking about the missing line is told it was never fulfilled.
		const { service } = fixture([
			line({ id: 'line-shipped', fulfilledQuantity: 1 }),
			line({ id: 'line-never-shipped', fulfilledQuantity: 0 })
		]);

		const fulfilled = await service.getFulfilledLines(ORDER);

		expect(fulfilled.map((entry) => entry.orderLineId)).toEqual(['line-shipped']);
	});

	it('leaves out a line whose fulfilments were all cancelled', async () => {
		// Cancelling a fulfilment returns its quantity to the order line, so a line whose only shipment
		// was cancelled has nothing outstanding to act on — and no ceiling to measure a return against.
		const { service } = fixture([line({ id: 'line-1', fulfilledQuantity: 0 })]);

		expect(await service.getFulfilledLines(ORDER)).toEqual([]);
	});

	it('answers with nothing at all for an order that has no lines', async () => {
		const { service } = fixture([]);

		expect(await service.getFulfilledLines(ORDER)).toEqual([]);
	});

	it('scopes the read to the caller and does not find an order of another organization', async () => {
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);
		const { service, orderLines } = fixture([line({ id: 'line-1', fulfilledQuantity: 5 })]);

		await expect(service.getFulfilledLines(ORDER)).rejects.toBeInstanceOf(NotFoundException);
		// The lines are not read at all: a foreign order's quantities never leave the database.
		expect(orderLines.options).toEqual([]);
	});

	it('scopes the read to the caller and does not find an order of another tenant', async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(OTHER_TENANT);
		const { service, orderLines } = fixture([line({ id: 'line-1', fulfilledQuantity: 5 })]);

		await expect(service.getFulfilledLines(ORDER)).rejects.toThrow(/ORDER_NOT_FOUND/);
		expect(orderLines.options).toEqual([]);
	});

	it('reads only the lines of the named order', async () => {
		const { service, orderLines } = fixture([
			line({ id: 'line-1', fulfilledQuantity: 5 }),
			line({ id: 'line-of-another-order', orderId: OTHER_ORDER, fulfilledQuantity: 5 })
		]);

		const fulfilled = await service.getFulfilledLines(ORDER);

		expect(fulfilled.map((entry) => entry.orderLineId)).toEqual(['line-1']);
		// The order, the tenant and the organization are stated in SQL rather than filtered afterwards.
		expect(orderLines.options[0]).toMatchObject({
			where: { orderId: ORDER, tenantId: TENANT, organizationId: ORG }
		});
	});

	it('refuses to answer when no order was named', async () => {
		const { service, orders } = fixture([line({ id: 'line-1', fulfilledQuantity: 5 })]);

		await expect(service.getFulfilledLines(undefined as never)).rejects.toThrow(/ORDER_FULFILLMENT_ORDER_REQUIRED/);
		expect(orders.options).toEqual([]);
	});
});

/**
 * The received-return counter's writer, which the column never had.
 *
 * `order_line.returnReceivedQuantity` is one of the five sums `deriveFulfillmentStatus` reads to decide
 * `PARTIALLY_RETURNED` against `RETURNED`, and until this method existed nothing in the repository ever
 * assigned it — so those two states were unreachable in production and the order answered
 * `NOT_FULFILLED` for goods its own warehouse was holding. What the cases below pin is the arithmetic
 * and the four refusals, because both are what keeps the order's cache equal to the goods it describes:
 *
 * - **the counter is moved, not set.** A delivery adds its delta to what earlier deliveries recorded, so
 *   a line received in two parts ends at the sum and not at the last part;
 * - **a negative delta moves it back**, which is what the receipt's compensation sends;
 * - **it never goes below zero**, because a negative "received" is not a state the column can be in and a
 *   compensation that overshot would otherwise write one;
 * - **the scope is checked before the write**, so a foreign order or a line of another order is refused
 *   rather than quietly missed — the same scoped read the reader above performs.
 */
describe('OrderLineFulfillmentService — moving the received-return counter', () => {
	it('adds the delivery to what earlier deliveries recorded, exactly', async () => {
		const { service, orderLines } = fixture([line({ id: 'line-1', returnReceivedQuantity: 2 })]);

		await service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-1', quantityDelta: '3' }]);

		// The counter is the sum, not the delivery: `2 + 3`, written as the exact decimal the column holds.
		expect(orderLines.updates).toEqual([{ id: 'line-1', partial: { returnReceivedQuantity: '5' } }]);
	});

	it('moves the counter back when a receipt is undone', async () => {
		const { service, orderLines } = fixture([line({ id: 'line-1', returnReceivedQuantity: 5 })]);

		await service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-1', quantityDelta: '-2' }]);

		expect(orderLines.updates).toEqual([{ id: 'line-1', partial: { returnReceivedQuantity: '3' } }]);
	});

	it('moves several lines in one call, and only the lines it was given', async () => {
		const { service, orderLines } = fixture([
			line({ id: 'line-1', returnReceivedQuantity: 0.5, position: 1 }),
			line({ id: 'line-2', returnReceivedQuantity: 1, position: 2 }),
			line({ id: 'line-3', returnReceivedQuantity: 0, position: 3 })
		]);

		await service.recordReturnReceipt(ORDER, [
			{ orderLineId: 'line-1', quantityDelta: '0.25' },
			{ orderLineId: 'line-2', quantityDelta: '1' }
		]);

		expect(orderLines.updates).toEqual([
			{ id: 'line-1', partial: { returnReceivedQuantity: '0.75' } },
			{ id: 'line-2', partial: { returnReceivedQuantity: '2' } }
		]);
	});

	it('refuses a move that would leave a line having received less than nothing', async () => {
		const { service, orderLines } = fixture([line({ id: 'line-1', returnReceivedQuantity: 1 })]);

		await expect(
			service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-1', quantityDelta: '-2' }])
		).rejects.toThrow(/ORDER_LINE_RECEIPT_BELOW_ZERO/);
		// The refusal is the point: nothing is written, so the counter never reaches the invalid state.
		expect(orderLines.updates).toEqual([]);
	});

	it('refuses an order of another organization, and reads no line of it', async () => {
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);
		const { service, orderLines } = fixture([line({ id: 'line-1', returnReceivedQuantity: 1 })]);

		await expect(
			service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-1', quantityDelta: '1' }])
		).rejects.toThrow(/ORDER_NOT_FOUND/);
		expect(orderLines.updates).toEqual([]);
	});

	it('refuses a line that belongs to another order', async () => {
		const { service, orderLines } = fixture([
			line({ id: 'line-1', returnReceivedQuantity: 1 }),
			line({ id: 'line-of-another-order', orderId: OTHER_ORDER, returnReceivedQuantity: 1 })
		]);

		await expect(
			service.recordReturnReceipt(ORDER, [{ orderLineId: 'line-of-another-order', quantityDelta: '1' }])
		).rejects.toThrow(/ORDER_LINE_NOT_FOUND/);
		expect(orderLines.updates).toEqual([]);
	});

	it('refuses to move anything when no order was named', async () => {
		const { service, orderLines } = fixture([line({ id: 'line-1', returnReceivedQuantity: 1 })]);

		await expect(
			service.recordReturnReceipt(undefined as never, [{ orderLineId: 'line-1', quantityDelta: '1' }])
		).rejects.toThrow(/ORDER_FULFILLMENT_ORDER_REQUIRED/);
		expect(orderLines.updates).toEqual([]);
	});

	it('writes nothing for a delivery that moved nothing', async () => {
		// A receipt whose lines all state the quantity they already held is not an error; it is a
		// statement that nothing arrived, and the counter is left alone rather than written with its
		// own value — which would be a write on a row a concurrent delivery may be holding.
		const { service, orderLines } = fixture([line({ id: 'line-1', returnReceivedQuantity: 2 })]);

		await service.recordReturnReceipt(ORDER, []);

		expect(orderLines.updates).toEqual([]);
		expect(orderLines.options).toEqual([]);
	});
});
