/**
 * What the entitlement consumer does with an `order.placed` delivered after the order's later events (#11023).
 *
 * The consumer is reorderable, so `order.completed` can be handled before a retried `order.placed`: it finds
 * nothing `PENDING` to put into force, and the rights the late placement grants would wait for a settlement
 * that has already come and gone. Likewise an `order.canceled` or a full refund handled first finds nothing to
 * withdraw. Where the order-state port is bound, the placement asks the order where it is now: it grants
 * nothing for an order already withdrawn, and puts into force what it granted for the lines still paid for on
 * an order that settled. Where it is not, nothing changes.
 *
 * The consumer is the real one. `@gauzy/core` and the entitlement service are doubled at the module
 * boundary, as the package's other consumer suite does: what is under test is the decision the consumer
 * takes, and the grant, the activation and the revocation it hands that decision to have suites of their own.
 */
jest.mock('@gauzy/core', () => ({
	EventConsumerRegistry: class EventConsumerRegistry {}
}));

jest.mock('../entitlement/entitlement.service', () => ({
	EntitlementService: class EntitlementService {}
}));

import { Logger } from '@nestjs/common';
import { IEventEnvelope, OrderPaymentStatus, OrderStatus } from '@gauzy/contracts';
import { EntitlementRevocationReason, IEntitlementOrderState, IEntitlementOrderStatePort } from '../entitlement.types';
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

/** A second granting line. */
const OTHER_GRANTING_LINE = { ...GRANTING_LINE, orderLineId: 'line-3', productId: 'product-3' };

/** A line of ordinary goods, which grants nothing. */
const PLAIN_LINE = { orderLineId: 'line-2', productId: 'product-2', quantity: 3 };

const SETTLED = { status: OrderStatus.COMPLETED, paymentStatus: OrderPaymentStatus.CAPTURED };
const OPEN = { status: OrderStatus.CONFIRMED, paymentStatus: OrderPaymentStatus.AUTHORIZED };

/**
 * Delivers one `order.placed` to a consumer built with the port (or without it).
 *
 * @param options What the order port answers — `state` on every read, or `states` read by read — whether it is
 * bound at all, the lines the placement carries, a read that fails, and the rights an earlier attempt of the
 * delivery already granted.
 * @returns What the consumer granted, reduced, activated, revoked and read, and in which order.
 */
async function place(options: {
	state?: IEntitlementOrderState | null;
	states?: Array<IEntitlementOrderState | null>;
	bound?: boolean;
	lines?: unknown[];
	readError?: { onRead: number; error: Error };
	existing?: string[];
}) {
	const order: string[] = [];
	const granted: unknown[][] = [];
	const reduced: unknown[][] = [];
	const activated: unknown[][] = [];
	const revoked: unknown[][] = [];
	const reads: unknown[][] = [];
	const entitlementService = {
		grant: async (...args: unknown[]) => {
			order.push('grant');
			granted.push(args);

			const input = args[0] as { quantity: number };

			return { entitlement: { id: `entitlement-${granted.length}`, quantity: input.quantity }, created: true };
		},
		reduce: async (...args: unknown[]) => {
			order.push('reduce');
			reduced.push(args);

			return {};
		},
		activateGranted: async (...args: unknown[]) => {
			order.push('activate');
			activated.push(args);

			return [];
		},
		find: async () =>
			[...(options.existing ?? []), ...granted.map((_, index) => `entitlement-${index + 1}`)].map((id) => ({
				id
			})),
		revoke: async (...args: unknown[]) => {
			order.push('revoke');
			revoked.push(args);

			return {};
		}
	};
	const port: IEntitlementOrderStatePort = {
		findState: async (...args) => {
			order.push('read');
			reads.push(args);

			if (options.readError?.onRead === reads.length) {
				throw options.readError.error;
			}

			const state = options.states ? options.states[reads.length - 1] : options.state;

			return state === undefined ? null : state;
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

	return { granted, reduced, activated, revoked, reads, order };
}

describe('EntitlementGrantConsumer — order.placed after the order settled (#11023)', () => {
	let warn: jest.SpyInstance;
	let log: jest.SpyInstance;

	beforeEach(() => {
		warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('puts the right it granted into force, line by line, when the order already completed', async () => {
		const { granted, activated, reads, order } = await place({ state: SETTLED });

		expect(granted).toHaveLength(1);
		expect(reads).toEqual([
			[ORDER, SCOPE],
			[ORDER, SCOPE]
		]);
		expect(activated).toEqual([[{ orderId: ORDER, orderLineId: 'line-1' }, SCOPE]]);
		// The order is read before the grants (to grant nothing for a withdrawn order) and after every grant,
		// so what the activation finds includes them all.
		expect(order).toEqual(['read', 'grant', 'read', 'activate']);
		expect(log).toHaveBeenCalledWith(expect.stringContaining(`after order ${ORDER} settled`));
	});

	it('puts them into force when the money was captured in full', async () => {
		const { activated } = await place({
			state: { status: OrderStatus.CONFIRMED, paymentStatus: OrderPaymentStatus.CAPTURED }
		});

		expect(activated).toEqual([[{ orderId: ORDER, orderLineId: 'line-1' }, SCOPE]]);
	});

	it('puts them into force on an archived order that completed', async () => {
		const { activated } = await place({
			state: { status: OrderStatus.ARCHIVED, paymentStatus: OrderPaymentStatus.CAPTURED, completedAt: new Date() }
		});

		expect(activated).toEqual([[{ orderId: ORDER, orderLineId: 'line-1' }, SCOPE]]);
	});

	it('leaves them PENDING when the order has not settled', async () => {
		for (const state of [
			OPEN,
			{ status: OrderStatus.PENDING, paymentStatus: OrderPaymentStatus.NOT_PAID },
			{ status: OrderStatus.PROCESSING, paymentStatus: OrderPaymentStatus.PARTIALLY_CAPTURED },
			{ status: OrderStatus.ARCHIVED, paymentStatus: OrderPaymentStatus.CAPTURED }
		]) {
			const { granted, activated, revoked, reads } = await place({ state });

			expect(granted).toHaveLength(1);
			expect(reads).toHaveLength(2);
			expect(activated).toEqual([]);
			expect(revoked).toEqual([]);
		}
	});

	describe('an order refunded in part (Greptile/Copilot review on #11577)', () => {
		const PARTIALLY_REFUNDED = {
			status: OrderStatus.COMPLETED,
			paymentStatus: OrderPaymentStatus.PARTIALLY_REFUNDED
		};

		it('puts into force only the lines still paid for, reading each line’s refund through the port', async () => {
			const { granted, activated, revoked } = await place({
				lines: [GRANTING_LINE, PLAIN_LINE, OTHER_GRANTING_LINE],
				state: {
					...PARTIALLY_REFUNDED,
					lines: [
						{ id: 'line-1', quantity: 1, refundedQuantity: 1 },
						{ id: 'line-2', quantity: 3, refundedQuantity: 0 },
						{ id: 'line-3', quantity: 1, refundedQuantity: 0 }
					]
				}
			});

			expect(granted).toHaveLength(2);
			// line-1 was refunded in full before the placement: its right stays PENDING.
			expect(activated).toEqual([[{ orderId: ORDER, orderLineId: 'line-3' }, SCOPE]]);
			expect(revoked).toEqual([]);
			expect(log).toHaveBeenCalledWith(expect.stringContaining('1 of its 2 granting line(s)'));
		});

		it('puts nothing into force when the port cannot say which lines were refunded', async () => {
			const { granted, activated, revoked } = await place({
				lines: [GRANTING_LINE, OTHER_GRANTING_LINE],
				state: PARTIALLY_REFUNDED
			});

			expect(granted).toHaveLength(2);
			expect(activated).toEqual([]);
			expect(revoked).toEqual([]);
		});
	});

	it('lowers a right whose line was refunded in part to the seats still paid for, then puts it into force', async () => {
		const { granted, reduced, activated, order } = await place({
			lines: [{ ...GRANTING_LINE, quantity: 2 }],
			state: {
				status: OrderStatus.COMPLETED,
				paymentStatus: OrderPaymentStatus.PARTIALLY_REFUNDED,
				lines: [{ id: 'line-1', quantity: 2, refundedQuantity: 1 }]
			}
		});

		expect(granted[0][0]).toMatchObject({ orderLineId: 'line-1', quantity: 2 });
		// Copilot on #11577: the refund was handled first and found nothing to reduce, so the placement lowers
		// the right to the one seat still paid for, the way the refund handler would have, before activating it.
		expect(reduced).toEqual([['entitlement-1', 1, EntitlementRevocationReason.REFUNDED, SCOPE]]);
		expect(activated).toEqual([[{ orderId: ORDER, orderLineId: 'line-1' }, SCOPE]]);
		expect(order).toEqual(['read', 'grant', 'read', 'reduce', 'activate']);
	});

	describe('an order cancelled or refunded in full before the placement was delivered', () => {
		it('grants nothing, says why, and reads the order once', async () => {
			for (const [state, reason] of [
				[{ status: OrderStatus.CANCELED, paymentStatus: OrderPaymentStatus.CAPTURED }, 'ORDER_CANCELED'],
				[{ status: OrderStatus.COMPLETED, paymentStatus: OrderPaymentStatus.REFUNDED }, 'REFUNDED'],
				[{ status: OrderStatus.ARCHIVED, canceledAt: '2026-10-02T10:00:00.000Z' }, 'ORDER_CANCELED']
			] as Array<[IEntitlementOrderState, string]>) {
				warn.mockClear();

				const { granted, activated, revoked, reads } = await place({ state });

				expect(granted).toEqual([]);
				expect(activated).toEqual([]);
				expect(revoked).toEqual([]);
				expect(reads).toEqual([[ORDER, SCOPE]]);
				expect(warn).toHaveBeenCalledWith(
					`order.placed event-1 was delivered after order ${ORDER} was withdrawn (${reason}), so no entitlement was granted.`
				);
			}
		});

		it('finishes withdrawing what an earlier attempt granted, so a retry does not leave it in place (Copilot on #11577)', async () => {
			const { granted, revoked } = await place({
				existing: ['entitlement-early'],
				state: { status: OrderStatus.CANCELED, paymentStatus: OrderPaymentStatus.NOT_PAID }
			});

			expect(granted).toEqual([]);
			expect(revoked).toEqual([['entitlement-early', EntitlementRevocationReason.ORDER_CANCELED, SCOPE]]);
		});

		it('withdraws what it granted when the order was withdrawn while it was granting', async () => {
			const { granted, activated, revoked, order } = await place({
				lines: [GRANTING_LINE, OTHER_GRANTING_LINE],
				states: [OPEN, { status: OrderStatus.CANCELED, paymentStatus: OrderPaymentStatus.NOT_PAID }]
			});

			expect(granted).toHaveLength(2);
			expect(activated).toEqual([]);
			expect(revoked).toEqual([
				['entitlement-1', EntitlementRevocationReason.ORDER_CANCELED, SCOPE],
				['entitlement-2', EntitlementRevocationReason.ORDER_CANCELED, SCOPE]
			]);
			expect(order).toEqual(['read', 'grant', 'grant', 'read', 'revoke', 'revoke']);
			expect(warn).toHaveBeenCalledWith(expect.stringContaining('so its entitlements were withdrawn again'));
		});
	});

	it('leaves them PENDING when the order port does not find the order', async () => {
		const { granted, activated, reads } = await place({ state: null });

		expect(granted).toHaveLength(1);
		expect(reads).toHaveLength(2);
		expect(activated).toEqual([]);
	});

	it('does exactly what it did before when the port is not bound: it grants, and reads and activates nothing', async () => {
		const { granted, activated, revoked, reads } = await place({ bound: false, state: SETTLED });

		expect(granted).toHaveLength(1);
		expect(reads).toEqual([]);
		expect(activated).toEqual([]);
		expect(revoked).toEqual([]);
	});

	it('does not read the order when the placement grants nothing', async () => {
		const { granted, activated, reads } = await place({ lines: [PLAIN_LINE], state: SETTLED });

		expect(granted).toEqual([]);
		expect(reads).toEqual([]);
		expect(activated).toEqual([]);
	});

	it('reads the order twice for a placement that granted several lines, and activates each line once', async () => {
		const { granted, activated, reads } = await place({
			lines: [GRANTING_LINE, PLAIN_LINE, OTHER_GRANTING_LINE],
			state: SETTLED
		});

		expect(granted).toHaveLength(2);
		expect(reads).toHaveLength(2);
		expect(activated).toEqual([
			[{ orderId: ORDER, orderLineId: 'line-1' }, SCOPE],
			[{ orderId: ORDER, orderLineId: 'line-3' }, SCOPE]
		]);
	});

	it('lets a failed read fail the delivery, so it is retried rather than deciding on nothing', async () => {
		const error = new Error('connection reset');

		await expect(place({ readError: { onRead: 1, error } })).rejects.toThrow('connection reset');
		await expect(place({ state: SETTLED, readError: { onRead: 2, error } })).rejects.toThrow('connection reset');
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
