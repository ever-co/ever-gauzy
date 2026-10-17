import { BadRequestException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ID, OrderStatus } from '@gauzy/contracts';
import {
	CommerceCart,
	CommerceCartService,
	ICartCheckoutContext,
	ICartCheckoutHandler,
	ICartCheckoutResult
} from '@gauzy/plugin-cart';
import { OrderService } from '../order/order.service';
import { OrderPaymentLedgerService } from '../order-payment/order-payment-ledger.service';
import { IOrderCheckoutPaymentsPort, ORDER_CHECKOUT_PAYMENTS } from '../order.types';

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

	private readonly logger = new Logger(OrderCheckoutHandler.name);

	constructor(
		private readonly orderService: OrderService,
		private readonly commerceCartService: CommerceCartService,
		/** The order's money ledger (Q7-W1b). Optional and last, so a suite building the handler is unchanged. */
		@Optional()
		private readonly paymentLedger?: OrderPaymentLedgerService,
		/** The payment domain's hand-over of a cart's payments (Q7-W1b); unbound without the payment package. */
		@Optional()
		@Inject(ORDER_CHECKOUT_PAYMENTS)
		private readonly checkoutPayments?: IOrderCheckoutPaymentsPort
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

			// A checkout that died after placing may have died before handing its payments over too; the hand-over
			// is idempotent (an attached collection is not moved, a recorded fact is not written twice), so the
			// recovery finishes that step as well (Q7-W1b).
			await this.attachPayments(cart.id, recovered.id);

			return { orderId: recovered.id, orderNumber: recovered.number };
		}

		const order = await this.orderService.createFromCart(cart as any, {
			idempotencyKey: context.idempotencyKey,
			source: 'CHANNEL',
			// The buyer was quoted the cart's discounts and taxes; the order is placed with them (Q7-W1a).
			carryCartLedgers: true,
			// The promotions the cart was granted are used by this order, and their limits hold (Q7-W1c).
			recordPromotionUsage: true
		});

		await this.attachPayments(cart.id, order.id);

		return { orderId: order.id, orderNumber: order.number };
	}

	/**
	 * Hands the cart's payments to the order and records what they already did (Q7-W1b).
	 *
	 * A buyer pays before the order exists, so the money is on a collection opened for the cart. Nothing
	 * re-pointed it, which is how an order paid at checkout answered `NOT_PAID` for ever. The order is
	 * already placed when this runs, so nothing here fails the checkout: a hand-over that is refused is
	 * logged, and the payment's own capture or refund reports reach the order once the collection is
	 * attached by any later call.
	 *
	 * @param cartId The cart.
	 * @param orderId The order it became.
	 */
	private async attachPayments(cartId: ID, orderId: ID): Promise<void> {
		if (!this.checkoutPayments || !this.paymentLedger) {
			return;
		}

		try {
			const facts = await this.checkoutPayments.attachCart(cartId, orderId);

			if (facts.length > 0) {
				await this.paymentLedger.recordAll(facts);
			}
		} catch (error) {
			this.logger.warn(
				`ORDER_CHECKOUT_PAYMENTS_FAILED: the payments of cart ${cartId} were not attached to order ${orderId}: ` +
					(error instanceof Error ? error.message.split('\n')[0] : String(error))
			);
		}
	}
}
