/**
 * `@gauzy/core` is doubled at the module boundary, as the order package's other suites do: its barrel boots
 * the whole application graph, and the one question this reader asks of it — which ORM the installation is
 * configured for — is a switch a test has to be able to throw. MikroORM itself is **not** doubled: whether the
 * read runs inside a fork is what MikroORM's own `RequestContext` answers. The entity and the repositories are
 * doubled because the reader only hands them a criteria and reads back four columns.
 */
jest.mock('@gauzy/core', () => ({
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

import { RequestContext as MikroOrmRequestContext } from '@mikro-orm/core';
import { getORMType } from '@gauzy/core';
import { FulfillmentStatus, OrderPaymentStatus, OrderStatus } from '@gauzy/contracts';
import { OrderUnitOfWork } from '../order-totals/order-unit-of-work';
import { OrderStateReader } from './order-state.reader';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const ORDER = '00000000-0000-4000-8000-000000000020';

/** An order row, with columns the reader must not hand on. */
const ORDER_ROW = {
	id: ORDER,
	tenantId: TENANT,
	organizationId: ORG,
	status: OrderStatus.COMPLETED,
	paymentStatus: OrderPaymentStatus.CAPTURED,
	fulfillmentStatus: FulfillmentStatus.FULFILLED,
	customerId: 'customer-1',
	total: '120.00',
	metadata: { note: 'internal' }
};

/**
 * @param row What the configured ORM's repository finds.
 * @returns Both repositories, each recording the criteria it was handed and the context it was read in.
 */
function repositories(row: Record<string, unknown> | null = ORDER_ROW) {
	const typeOrmReads: unknown[] = [];
	const mikroOrmReads: Array<{ where: unknown; context: unknown }> = [];

	return {
		typeOrmReads,
		mikroOrmReads,
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
		}
	};
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

	it('reads the order under the tenant and organization stated, and answers its three statuses only', async () => {
		const repos = repositories();
		const reader = new OrderStateReader(
			repos.typeOrm as never,
			repos.mikroOrm as never,
			new OrderUnitOfWork(undefined)
		);

		const state = await reader.findState(ORDER, { tenantId: TENANT, organizationId: ORG });

		expect(state).toEqual({
			id: ORDER,
			status: OrderStatus.COMPLETED,
			paymentStatus: OrderPaymentStatus.CAPTURED,
			fulfillmentStatus: FulfillmentStatus.FULFILLED
		});
		expect(repos.typeOrmReads).toEqual([{ where: { id: ORDER, tenantId: TENANT, organizationId: ORG } }]);
		expect(repos.mikroOrm.findOne).not.toHaveBeenCalled();
	});

	it('reads across the tenant’s organizations when no organization is stated, but never across tenants', async () => {
		const repos = repositories();
		const reader = new OrderStateReader(repos.typeOrm as never, repos.mikroOrm as never);

		await reader.findState(ORDER, { tenantId: TENANT });
		await reader.findState(ORDER, { tenantId: TENANT, organizationId: null });

		expect(repos.typeOrmReads).toEqual([
			{ where: { id: ORDER, tenantId: TENANT } },
			{ where: { id: ORDER, tenantId: TENANT } }
		]);
	});

	it('answers null without reading when no tenant or no order is named', async () => {
		const repos = repositories();
		const reader = new OrderStateReader(repos.typeOrm as never, repos.mikroOrm as never);

		await expect(reader.findState(ORDER, {})).resolves.toBeNull();
		await expect(reader.findState(ORDER, { tenantId: null, organizationId: ORG })).resolves.toBeNull();
		await expect(reader.findState(ORDER, undefined as never)).resolves.toBeNull();
		await expect(reader.findState('' as never, { tenantId: TENANT })).resolves.toBeNull();
		expect(repos.typeOrm.findOne).not.toHaveBeenCalled();
		expect(repos.mikroOrm.findOne).not.toHaveBeenCalled();
	});

	it('answers null when no such order exists in that scope', async () => {
		const repos = repositories(null);
		const reader = new OrderStateReader(repos.typeOrm as never, repos.mikroOrm as never);

		await expect(reader.findState(ORDER, { tenantId: TENANT })).resolves.toBeNull();
	});

	it('reads through MikroORM inside a fork of its own when MikroORM is configured', async () => {
		(getORMType as jest.Mock).mockReturnValue('mikro-orm');

		const repos = repositories();
		const reader = new OrderStateReader(
			repos.typeOrm as never,
			repos.mikroOrm as never,
			new OrderUnitOfWork(mikroOrmConnection())
		);

		const state = await reader.findState(ORDER, { tenantId: TENANT, organizationId: ORG });

		expect(state?.status).toBe(OrderStatus.COMPLETED);
		expect(repos.mikroOrmReads).toEqual([
			{
				where: { id: ORDER, tenantId: TENANT, organizationId: ORG },
				context: expect.objectContaining({ fork: 1 })
			}
		]);
		expect(repos.typeOrm.findOne).not.toHaveBeenCalled();
		// The consumer that asks has no request, and the context is closed again once the read is done.
		expect(MikroOrmRequestContext.getEntityManager()).toBeUndefined();
	});

	it('lets a failed read fail the caller, so an event delivery is retried rather than deciding on nothing', async () => {
		const reader = new OrderStateReader(
			{ findOne: async () => Promise.reject(new Error('connection reset')) } as never,
			{} as never
		);

		await expect(reader.findState(ORDER, { tenantId: TENANT })).rejects.toThrow('connection reset');
	});
});
