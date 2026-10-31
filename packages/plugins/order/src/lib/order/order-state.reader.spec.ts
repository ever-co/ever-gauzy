/**
 * `@gauzy/core` is doubled at the module boundary, as the order package's other suites do: its barrel boots
 * the whole application graph, and the one question this reader asks of it — which ORM the installation is
 * configured for — is a switch a test has to be able to throw. MikroORM itself is **not** doubled: whether the
 * read runs inside a fork is what MikroORM's own `RequestContext` answers. The entities and the repositories are
 * doubled because the reader only hands them a criteria and reads back a few columns.
 */
jest.mock('@gauzy/core', () => ({
	...jest.requireActual('@gauzy/core/src/lib/money/decimal'),
	MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
	getORMType: jest.fn(() => 'typeorm')
}));
jest.mock('./order.entity', () => ({ Order: class Order {} }));
jest.mock('./repository/type-orm-order.repository', () => ({
	TypeOrmOrderRepository: class TypeOrmOrderRepository {}
}));
jest.mock('./repository/mikro-orm-order.repository', () => ({
	MikroOrmOrderRepository: class MikroOrmOrderRepository {}
}));
jest.mock('../order-line/order-line.entity', () => ({ OrderLine: class OrderLine {} }));
jest.mock('../order-line/repository/type-orm-order-line.repository', () => ({
	TypeOrmOrderLineRepository: class TypeOrmOrderLineRepository {}
}));
jest.mock('../order-line/repository/mikro-orm-order-line.repository', () => ({
	MikroOrmOrderLineRepository: class MikroOrmOrderLineRepository {}
}));

import { RequestContext as MikroOrmRequestContext } from '@mikro-orm/core';
import { getORMType } from '@gauzy/core';
import { FulfillmentStatus, OrderPaymentStatus, OrderStatus } from '@gauzy/contracts';
import { OrderUnitOfWork } from '../order-totals/order-unit-of-work';
import { OrderStateReader } from './order-state.reader';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const ORDER = '00000000-0000-4000-8000-000000000020';

const COMPLETED_AT = new Date('2026-10-01T10:00:00Z');

/** An order row, with columns the reader must not hand on. */
const ORDER_ROW = {
	id: ORDER,
	tenantId: TENANT,
	organizationId: ORG,
	status: OrderStatus.COMPLETED,
	paymentStatus: OrderPaymentStatus.PARTIALLY_REFUNDED,
	fulfillmentStatus: FulfillmentStatus.FULFILLED,
	completedAt: COMPLETED_AT,
	canceledAt: null,
	refundedTotal: 100.1,
	customerId: 'customer-1',
	total: '120.00',
	metadata: { note: 'internal' }
};

/** The order's line rows, with columns the reader must not hand on and a quantity the driver answered as text. */
const LINE_ROWS = [
	{
		id: 'line-1',
		orderId: ORDER,
		quantity: 1,
		refundedQuantity: 1,
		refundedAmount: 100,
		unitPrice: '100.00',
		productName: 'Pro'
	},
	{
		id: 'line-2',
		orderId: ORDER,
		quantity: '2.000000',
		refundedQuantity: null,
		refundedAmount: 0.1,
		unitPrice: '10.00'
	}
];

/** What the reader answers for {@link ORDER_ROW} and {@link LINE_ROWS}. */
const SNAPSHOT = {
	id: ORDER,
	status: OrderStatus.COMPLETED,
	paymentStatus: OrderPaymentStatus.PARTIALLY_REFUNDED,
	fulfillmentStatus: FulfillmentStatus.FULFILLED,
	completedAt: COMPLETED_AT,
	canceledAt: null,
	lines: [
		{ id: 'line-1', quantity: 1, refundedQuantity: 1 },
		{ id: 'line-2', quantity: 2, refundedQuantity: 0 }
	]
};

/**
 * @param row What the configured ORM's order repository finds.
 * @param lines What the configured ORM's order-line repository finds.
 * @returns The four repositories, each recording the criteria it was handed and the context it was read in.
 */
function repositories(row: Record<string, unknown> | null = ORDER_ROW, lines: unknown[] = LINE_ROWS) {
	const typeOrmReads: unknown[] = [];
	const typeOrmLineReads: unknown[] = [];
	const mikroOrmReads: Array<{ where: unknown; context: unknown }> = [];
	const mikroOrmLineReads: Array<{ where: unknown; context: unknown }> = [];

	return {
		typeOrmReads,
		typeOrmLineReads,
		mikroOrmReads,
		mikroOrmLineReads,
		typeOrm: {
			findOne: jest.fn(async (options: unknown) => {
				typeOrmReads.push(options);

				return row;
			})
		},
		mikroOrm: {
			findOne: jest.fn(async (where: unknown) => {
				mikroOrmReads.push({ where, context: MikroOrmRequestContext.getEntityManager() });

				return row;
			})
		},
		typeOrmLines: {
			find: jest.fn(async (options: unknown) => {
				typeOrmLineReads.push(options);

				return lines;
			})
		},
		mikroOrmLines: {
			find: jest.fn(async (where: unknown) => {
				mikroOrmLineReads.push({ where, context: MikroOrmRequestContext.getEntityManager() });

				return lines;
			})
		}
	};
}

/**
 * @param repos The repositories {@link repositories} built.
 * @param unitOfWork The unit of work, when the test states one.
 * @returns A reader over them.
 */
function readerOver(repos: ReturnType<typeof repositories>, unitOfWork?: OrderUnitOfWork): OrderStateReader {
	return new OrderStateReader(
		repos.typeOrm as never,
		repos.mikroOrm as never,
		repos.typeOrmLines as never,
		repos.mikroOrmLines as never,
		unitOfWork
	);
}

/** A MikroORM connection reduced to a global entity manager that can be forked. */
function mikroOrmConnection() {
	let forks = 0;
	const em = { name: 'default', fork: jest.fn(() => ({ name: 'default', fork: ++forks })) };

	return { em } as never;
}

describe('OrderStateReader — where an order is now, for another package (#11023)', () => {
	afterEach(() => {
		(getORMType as jest.Mock).mockReturnValue('typeorm');
	});

	it('reads the order and its lines under the tenant and organization stated, and answers its state only', async () => {
		const repos = repositories();
		const reader = readerOver(repos, new OrderUnitOfWork(undefined));

		const state = await reader.findState(ORDER, { tenantId: TENANT, organizationId: ORG });

		expect(state).toEqual(SNAPSHOT);
		expect(repos.typeOrmReads).toEqual([{ where: { id: ORDER, tenantId: TENANT, organizationId: ORG } }]);
		expect(repos.typeOrmLineReads).toEqual([{ where: { orderId: ORDER, tenantId: TENANT, organizationId: ORG } }]);
		expect(repos.mikroOrm.findOne).not.toHaveBeenCalled();
		expect(repos.mikroOrmLines.find).not.toHaveBeenCalled();
	});

	it('answers when the order completed or was cancelled, which archiving keeps', async () => {
		const canceledAt = new Date('2026-10-02T10:00:00Z');
		const repos = repositories(
			{ ...ORDER_ROW, status: OrderStatus.ARCHIVED, completedAt: undefined, canceledAt, refundedTotal: 0 },
			[]
		);

		const state = await readerOver(repos).findState(ORDER, { tenantId: TENANT });

		expect(state).toMatchObject({ status: OrderStatus.ARCHIVED, completedAt: null, canceledAt, lines: [] });
	});

	it('answers no lines when their refund register does not account for every refund the ledger records (Copilot on #11577)', async () => {
		// A line report lost after the refund committed, or a refund made against no line: the lines would
		// understate what was refunded, so the caller is told they cannot decide per line.
		const lost = repositories({ ...ORDER_ROW, refundedTotal: '100.100001' });
		const nothingOnLines = repositories({ ...ORDER_ROW, refundedTotal: 5 }, [
			{ id: 'line-1', quantity: 1, refundedQuantity: 0, refundedAmount: 0 }
		]);

		await expect(readerOver(lost).findState(ORDER, { tenantId: TENANT })).resolves.toMatchObject({ lines: null });
		await expect(readerOver(nothingOnLines).findState(ORDER, { tenantId: TENANT })).resolves.toMatchObject({
			lines: null
		});
	});

	it('answers the lines when they account for at least what the ledger records, exactly and not by float sums', async () => {
		// 0.1 + 0.2 is not 0.3 in floating point; the register is summed as decimals.
		const exact = repositories({ ...ORDER_ROW, refundedTotal: 0.3 }, [
			{ id: 'line-1', quantity: 1, refundedQuantity: 0, refundedAmount: 0.1 },
			{ id: 'line-2', quantity: 1, refundedQuantity: 0, refundedAmount: 0.2 }
		]);
		const ahead = repositories({ ...ORDER_ROW, refundedTotal: 0 }, [
			{ id: 'line-1', quantity: 1, refundedQuantity: 1, refundedAmount: 10 }
		]);
		const unrefunded = repositories({ ...ORDER_ROW, refundedTotal: undefined }, [
			{ id: 'line-1', quantity: 1, refundedQuantity: undefined, refundedAmount: undefined }
		]);

		expect((await readerOver(exact).findState(ORDER, { tenantId: TENANT }))?.lines).toHaveLength(2);
		expect((await readerOver(ahead).findState(ORDER, { tenantId: TENANT }))?.lines).toEqual([
			{ id: 'line-1', quantity: 1, refundedQuantity: 1 }
		]);
		expect((await readerOver(unrefunded).findState(ORDER, { tenantId: TENANT }))?.lines).toEqual([
			{ id: 'line-1', quantity: 1, refundedQuantity: 0 }
		]);
	});

	it('reads across the tenant’s organizations when no organization is stated, but never across tenants', async () => {
		const repos = repositories();
		const reader = readerOver(repos);

		await reader.findState(ORDER, { tenantId: TENANT });
		await reader.findState(ORDER, { tenantId: TENANT, organizationId: null });

		expect(repos.typeOrmReads).toEqual([
			{ where: { id: ORDER, tenantId: TENANT } },
			{ where: { id: ORDER, tenantId: TENANT } }
		]);
		expect(repos.typeOrmLineReads).toEqual([
			{ where: { orderId: ORDER, tenantId: TENANT } },
			{ where: { orderId: ORDER, tenantId: TENANT } }
		]);
	});

	it('answers null without reading when no tenant or no order is named', async () => {
		const repos = repositories();
		const reader = readerOver(repos);

		await expect(reader.findState(ORDER, {})).resolves.toBeNull();
		await expect(reader.findState(ORDER, { tenantId: null, organizationId: ORG })).resolves.toBeNull();
		await expect(reader.findState(ORDER, undefined as never)).resolves.toBeNull();
		await expect(reader.findState('' as never, { tenantId: TENANT })).resolves.toBeNull();
		expect(repos.typeOrm.findOne).not.toHaveBeenCalled();
		expect(repos.mikroOrm.findOne).not.toHaveBeenCalled();
		expect(repos.typeOrmLines.find).not.toHaveBeenCalled();
		expect(repos.mikroOrmLines.find).not.toHaveBeenCalled();
	});

	it('answers null, and reads no line, when no such order exists in that scope', async () => {
		const repos = repositories(null);

		await expect(readerOver(repos).findState(ORDER, { tenantId: TENANT })).resolves.toBeNull();
		expect(repos.typeOrmLines.find).not.toHaveBeenCalled();
	});

	it('reads through MikroORM inside a fork of its own when MikroORM is configured', async () => {
		(getORMType as jest.Mock).mockReturnValue('mikro-orm');

		const repos = repositories();
		const reader = readerOver(repos, new OrderUnitOfWork(mikroOrmConnection()));

		const state = await reader.findState(ORDER, { tenantId: TENANT, organizationId: ORG });

		expect(state).toEqual(SNAPSHOT);
		// The order and its lines are read in the same fork.
		expect(repos.mikroOrmReads).toEqual([
			{
				where: { id: ORDER, tenantId: TENANT, organizationId: ORG },
				context: expect.objectContaining({ fork: 1 })
			}
		]);
		expect(repos.mikroOrmLineReads).toEqual([
			{
				where: { orderId: ORDER, tenantId: TENANT, organizationId: ORG },
				context: expect.objectContaining({ fork: 1 })
			}
		]);
		expect(repos.typeOrm.findOne).not.toHaveBeenCalled();
		expect(repos.typeOrmLines.find).not.toHaveBeenCalled();
		// The consumer that asks has no request, and the context is closed again once the read is done.
		expect(MikroOrmRequestContext.getEntityManager()).toBeUndefined();
	});

	it('lets a failed read fail the caller, so an event delivery is retried rather than deciding on nothing', async () => {
		const failedOrder = new OrderStateReader(
			{ findOne: async () => Promise.reject(new Error('connection reset')) } as never,
			{} as never,
			{} as never,
			{} as never
		);
		const failedLines = new OrderStateReader(
			{ findOne: async () => ORDER_ROW } as never,
			{} as never,
			{ find: async () => Promise.reject(new Error('lines unavailable')) } as never,
			{} as never
		);

		await expect(failedOrder.findState(ORDER, { tenantId: TENANT })).rejects.toThrow('connection reset');
		await expect(failedLines.findState(ORDER, { tenantId: TENANT })).rejects.toThrow('lines unavailable');
	});
});
