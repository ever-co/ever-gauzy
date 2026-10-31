/**
 * What the entitlement consumer does with an `order.placed` delivered after the order settled (#11023).
 *
 * The consumer is reorderable, so `order.completed` can be handled before a retried `order.placed`: it finds
 * nothing `PENDING` to put into force, and the rights the late placement grants would wait for a settlement
 * that has already come and gone. Where the order-state port is bound, the placement asks the order whether
 * it settled since and puts what it granted into force itself. Where it is not, nothing changes.
 *
 * The consumer is the real one. `@gauzy/core` and the entitlement service are doubled at the module
 * boundary, as the package's other consumer suite does: what is under test is the decision the consumer
 * takes, and the grant and the activation it hands that decision to have suites of their own.
 */
jest.mock('@gauzy/core', () => ({
	EventConsumerRegistry: class EventConsumerRegistry {}
}));

jest.mock('../entitlement/entitlement.service', () => ({
	EntitlementService: class EntitlementService {}
}));

import { IEventEnvelope, OrderPaymentStatus, OrderStatus } from '@gauzy/contracts';
import { IEntitlementOrderState, IEntitlementOrderStatePort } from '../entitlement.types';
import { EntitlementGrantConsumer } from './entitlement-grant.consumer';

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const ORDER = '00000000-0000-4000-8000-000000000020';
const SCOPE = { tenantId: TENANT, organizationId: ORG };

/** A line that carries an entitlement policy, so the placement grants a right for it. */
const GRANTING_LINE = {
	orderLineId: 'line-1',
	productId: 'product-1',
	quantity: 1,
	entitlement: { activationLimit: 2 }
};

/** A line of ordinary goods, which grants nothing. */
const PLAIN_LINE = { orderLineId: 'line-2', productId: 'product-2', quantity: 3 };

/**
 * Delivers one `order.placed` to a consumer built with the port (or without it).
 *
 * @param options What the order port answers, whether it is bound at all, and the lines the placement carries.
 * @returns What the consumer granted, activated and read.
 */
async function place(options: {
	state?: IEntitlementOrderState | null;
	bound?: boolean;
	lines?: unknown[];
	readError?: Error;
	order?: string[];
}) {
	const order = options.order ?? [];
	const granted: unknown[][] = [];
	const activated: unknown[][] = [];
	const reads: unknown[][] = [];
	const entitlementService = {
		grant: async (...args: unknown[]) => {
			order.push('grant');
			granted.push(args);

			return { entitlement: { id: `entitlement-${granted.length}` }, created: true };
		},
		activateGranted: async (...args: unknown[]) => {
			order.push('activate');
			activated.push(args);

			return [];
		}
	};
	const port: IEntitlementOrderStatePort = {
		findState: async (...args) => {
			order.push('read');
			reads.push(args);

			if (options.readError) {
				throw options.readError;
			}

			return options.state === undefined ? null : options.state;
		}
	};
	const event = {
		id: 'event-1',
		name: 'order.placed',
		tenantId: TENANT,
		organizationId: ORG,
		aggregate: { type: 'ORDER', id: ORDER },
		data: { orderId: ORDER, customerId: 'customer-1', lines: options.lines ?? [GRANTING_LINE] }
	} as unknown as IEventEnvelope;

	const consumer = new EntitlementGrantConsumer(
		entitlementService as never,
		undefined,
		options.bound === false ? undefined : port
	);

	await consumer.handle(event, {
		assertOrder: async () => undefined,
		alreadyDelivered: async () => false
	} as never);

	return { granted, activated, reads, order };
}

describe('EntitlementGrantConsumer — order.placed after the order settled (#11023)', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('puts the rights it granted into force when the order already completed', async () => {
		const { granted, activated, reads, order } = await place({
			state: { status: OrderStatus.COMPLETED, paymentStatus: OrderPaymentStatus.CAPTURED }
		});

		expect(granted).toHaveLength(1);
		expect(reads).toEqual([[ORDER, SCOPE]]);
		expect(activated).toEqual([[{ orderId: ORDER }, SCOPE]]);
		// The order is read after every grant, so what the activation finds includes them all.
		expect(order).toEqual(['grant', 'read', 'activate']);
	});

	it('puts them into force when the money was captured in full', async () => {
		const { activated } = await place({
			state: { status: OrderStatus.CONFIRMED, paymentStatus: OrderPaymentStatus.CAPTURED }
		});

		expect(activated).toEqual([[{ orderId: ORDER }, SCOPE]]);
	});

	it('leaves them PENDING when the order has not settled', async () => {
		for (const state of [
			{ status: OrderStatus.CONFIRMED, paymentStatus: OrderPaymentStatus.AUTHORIZED },
			{ status: OrderStatus.PENDING, paymentStatus: OrderPaymentStatus.NOT_PAID },
			{ status: OrderStatus.PROCESSING, paymentStatus: OrderPaymentStatus.PARTIALLY_CAPTURED }
		]) {
			const { granted, activated, reads } = await place({ state });

			expect(granted).toHaveLength(1);
			expect(reads).toHaveLength(1);
			expect(activated).toEqual([]);
		}
	});

	it('leaves them PENDING when the order was cancelled or refunded in full, whatever it recorded before', async () => {
		for (const state of [
			{ status: OrderStatus.CANCELED, paymentStatus: OrderPaymentStatus.CAPTURED },
			{ status: OrderStatus.COMPLETED, paymentStatus: OrderPaymentStatus.REFUNDED }
		]) {
			const { activated } = await place({ state });

			expect(activated).toEqual([]);
		}
	});

	it('leaves them PENDING when the order port does not find the order', async () => {
		const { granted, activated, reads } = await place({ state: null });

		expect(granted).toHaveLength(1);
		expect(reads).toHaveLength(1);
		expect(activated).toEqual([]);
	});

	it('does exactly what it did before when the port is not bound: it grants, and reads and activates nothing', async () => {
		const { granted, activated, reads } = await place({
			bound: false,
			state: { status: OrderStatus.COMPLETED, paymentStatus: OrderPaymentStatus.CAPTURED }
		});

		expect(granted).toHaveLength(1);
		expect(reads).toEqual([]);
		expect(activated).toEqual([]);
	});

	it('does not read the order when the placement granted nothing', async () => {
		const { granted, activated, reads } = await place({
			lines: [PLAIN_LINE],
			state: { status: OrderStatus.COMPLETED, paymentStatus: OrderPaymentStatus.CAPTURED }
		});

		expect(granted).toEqual([]);
		expect(reads).toEqual([]);
		expect(activated).toEqual([]);
	});

	it('reads the order once for a placement that granted several lines', async () => {
		const { granted, activated, reads } = await place({
			lines: [GRANTING_LINE, PLAIN_LINE, { ...GRANTING_LINE, orderLineId: 'line-3' }],
			state: { status: OrderStatus.COMPLETED, paymentStatus: OrderPaymentStatus.CAPTURED }
		});

		expect(granted).toHaveLength(2);
		expect(reads).toHaveLength(1);
		expect(activated).toHaveLength(1);
	});

	it('lets a failed read fail the delivery, so it is retried rather than leaving the rights PENDING', async () => {
		await expect(place({ readError: new Error('connection reset') })).rejects.toThrow('connection reset');
	});

	it('does not read the order on a settlement event, which activates as it always did', async () => {
		const activated: unknown[][] = [];
		const findState = jest.fn();
		const consumer = new EntitlementGrantConsumer(
			{ activateGranted: async (...args: unknown[]) => activated.push(args) } as never,
			undefined,
			{ findState } as never
		);

		await consumer.handle(
			{
				id: 'event-2',
				name: 'order.completed',
				tenantId: TENANT,
				organizationId: ORG,
				aggregate: { type: 'ORDER', id: ORDER },
				data: { orderId: ORDER }
			} as unknown as IEventEnvelope,
			{ assertOrder: async () => undefined, alreadyDelivered: async () => false } as never
		);

		expect(activated).toEqual([[{ orderId: ORDER }, SCOPE]]);
		expect(findState).not.toHaveBeenCalled();
	});
});
