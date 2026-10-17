/**
 * R3-10, the order side of the checkout: a cart that already has a placed order is answered with it.
 *
 * A checkout that placed the order and died before the cart recorded it leaves a placed order behind; the
 * cart's claim lapses and the buyer completes again. Placing a second order would be the double order the
 * claim exists to prevent — and `UQ_order_cart` refuses its placement, which would leave the cart impossible
 * to complete. The handler therefore answers with the order that exists. A draft (a checkout that failed
 * before placing) or a cancelled order is not the cart's order, so the next completion places a new one.
 *
 * The two collaborators are doubled at the module boundary: the cart package's barrel and the order service
 * would load the whole application graph, and the handler only calls them.
 */
jest.mock('@gauzy/plugin-cart', () => ({ CommerceCart: class {}, CommerceCartService: class {} }));
jest.mock('../order/order.service', () => ({ OrderService: class {} }));

import { CommerceCartStatus } from '@gauzy/contracts';
import { OrderCheckoutHandler } from './order-checkout.handler';

/** The handler over doubled collaborators, with the cart it reads and the placed order the cart already has. */
function fixture(placed: { id: string; number: string } | null) {
	const cart = { id: 'cart-1', status: CommerceCartStatus.ACTIVE, lines: [] };
	const orderService = {
		canCreateFromCart: jest.fn(() => true),
		findPlacedForCart: jest.fn(async () => placed),
		createFromCart: jest.fn(async () => ({ id: 'order-new', number: 'ORD-NEW' }))
	};
	const cartService = { findOneWithContent: jest.fn(async () => cart) };
	const handler = new OrderCheckoutHandler(orderService as never, cartService as never);

	return { handler, orderService, cart };
}

describe('OrderCheckoutHandler — one placed order per cart (R3-10)', () => {
	it('answers with the order a previous checkout placed, and places no second one', async () => {
		const { handler, orderService, cart } = fixture({ id: 'order-1', number: 'ORD-1' });

		const result = await handler.complete({ cart: cart as never, idempotencyKey: 'key-2' });

		expect(result).toEqual({ orderId: 'order-1', orderNumber: 'ORD-1' });
		expect(orderService.findPlacedForCart).toHaveBeenCalledWith('cart-1');
		expect(orderService.createFromCart).not.toHaveBeenCalled();
	});

	it('places the order when the cart has no placed order yet', async () => {
		const { handler, orderService, cart } = fixture(null);

		const result = await handler.complete({ cart: cart as never, idempotencyKey: 'key-1' });

		expect(result).toEqual({ orderId: 'order-new', orderNumber: 'ORD-NEW' });
		expect(orderService.createFromCart).toHaveBeenCalledTimes(1);
	});
});
