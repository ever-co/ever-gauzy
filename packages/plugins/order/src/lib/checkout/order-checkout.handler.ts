import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStatus } from '@gauzy/contracts';
import {
	CommerceCart,
	CommerceCartService,
	ICartCheckoutContext,
	ICartCheckoutHandler,
	ICartCheckoutResult
} from '@gauzy/plugin-cart';
import { OrderService } from '../order/order.service';

/**
 * The one thing the cart cannot do itself.
 *
 * The dependency between the two packages runs one way — order depends on cart — so the cart publishes
 * the place where a checkout is performed and this class registers itself there at bootstrap. The cart
 * therefore never imports the order package, and an installation that loads the cart without the order
 * package keeps working: it simply has nothing registered to complete a checkout, and says so.
 *
 * The handler does no money arithmetic and no validation of its own: the cart has already validated
 * strictly and recomputed its totals, and the order copies what it is given. A second opinion here
 * would be a second place for the two aggregates to disagree.
 */
@Injectable()
export class OrderCheckoutHandler implements ICartCheckoutHandler {
	/** The key this handler registers under. */
	readonly key = 'order';

	constructor(
		private readonly orderService: OrderService,
		private readonly commerceCartService: CommerceCartService
	) {}

	/**
	 * Places the order for a validated cart.
	 *
	 * @param context The cart and the checkout request.
	 * @returns The created order's identity.
	 */
	async complete(context: ICartCheckoutContext): Promise<ICartCheckoutResult> {
		const cart: CommerceCart = await this.commerceCartService.findOneWithContent(context.cart.id);

		if (!cart) {
			throw new BadRequestException(`CART_NOT_FOUND: no cart exists with id ${context.cart.id}.`);
		}

		if (!this.orderService.canCreateFromCart(cart)) {
			throw new BadRequestException(
				`CART_STATUS_INVALID: a cart in status ${cart.status} cannot become an order.`
			);
		}

		// R3-10: a checkout that placed this cart's order and then died before the cart recorded it left a
		// placed order behind. The completion that comes next answers with that order rather than placing a
		// second one — which the unique index over a cart's placed orders would refuse at placement anyway,
		// leaving the cart impossible to complete.
		const placed = await this.orderService.findPlacedForCart(cart.id);

		if (placed) {
			// `createFromCart` places and then confirms; a checkout that died between the two left the order
			// `PENDING`, and the recovery finishes what it started rather than completing the cart over it.
			const recovered =
				placed.status === OrderStatus.PENDING ? await this.orderService.confirm(placed.id, 'SYSTEM') : placed;

			return { orderId: recovered.id, orderNumber: recovered.number };
		}

		const order = await this.orderService.createFromCart(cart as any, {
			idempotencyKey: context.idempotencyKey,
			source: 'CHANNEL'
		});

		return { orderId: order.id, orderNumber: order.number };
	}
}
