import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DecimalString, ID } from '@gauzy/contracts';
import { PromotionService } from '../promotion/promotion.service';
import { PromotionUsageService } from '../promotion-usage/promotion-usage.service';
import { PromotionUsageStatus } from '../promotion.types';

/** One promotion a cart carries into checkout, as the order states it to this package. */
export interface IPromotionOrderUsageReservation {
	/** The cart the promotion was granted to. */
	cartId: ID;
	/** The promotion. */
	promotionId: ID;
	/** The coupon that unlocked it, when one did. */
	couponId?: ID;
	/** The code the buyer entered, when there was one. */
	code?: string;
	/** The customer, for the per-customer limit. */
	customerId?: ID;
	/** What the engine granted, as an exact decimal. */
	amount: DecimalString | string;
	/** The cart's currency. */
	currency: string;
}

/**
 * The redemption half of the promotion engine, as an order's checkout and cancellation reach it (Q7-W1c).
 *
 * **Why it exists.** The cart asks the engine what a promotion grants (R3-07, `CART_PROMOTION_EVALUATION`),
 * and nothing ever recorded that the promotion was *used*: `reserveUsage`, `register` and `revertUsage`
 * were called by nothing outside this package, so `promotion_usage` stayed empty, `usageCount` never moved
 * and a promotion's `usageLimit` — "the first hundred orders" — could be redeemed without limit.
 *
 * The order package calls this through its `ORDER_PROMOTION_USAGE` port (bound by the installation's
 * composition module, so neither package imports the other):
 * - **reserve** before the order row is written — the use is taken, and a promotion whose limit is
 *   reached refuses the checkout instead of granting a discount it no longer has (`PROMOTION_USAGE_LIMIT_REACHED`);
 *   a reservation the cart already holds is reused and costs nothing further, so a retried checkout is free;
 * - **register** once the order is placed — the reservations move to `REGISTERED` against the order;
 * - **revert** when the order is cancelled — every redemption of the order is reverted and its use given back.
 */
@Injectable()
export class PromotionOrderUsageAdapter {
	constructor(
		private readonly promotionService: PromotionService,
		private readonly promotionUsageService: PromotionUsageService
	) {}

	/**
	 * Reserves the use of one promotion a cart carries into checkout.
	 *
	 * @param input The promotion, the cart and what was granted.
	 * @returns The reservation row's id.
	 * @throws ConflictException with `PROMOTION_USAGE_LIMIT_REACHED` when the promotion's limit is reached.
	 */
	async reserveForCart(input: IPromotionOrderUsageReservation): Promise<ID> {
		try {
			const usage = await this.promotionService.reserveUsage({
				promotionId: input.promotionId,
				cartId: input.cartId,
				...(input.couponId ? { couponId: input.couponId } : {}),
				...(input.code ? { code: input.code } : {}),
				...(input.customerId ? { customerId: input.customerId } : {}),
				amount: String(input.amount) as DecimalString,
				currency: input.currency
			});

			return usage.id;
		} catch (error) {
			if (error instanceof BadRequestException && /PROMOTION_USAGE_LIMIT_EXCEEDED/.test(error.message)) {
				throw new ConflictException({
					message: `PROMOTION_USAGE_LIMIT_REACHED: promotion ${input.promotionId} has no use left; the cart has to be re-priced without it.`,
					code: 'PROMOTION_USAGE_LIMIT_REACHED',
					details: { promotionId: input.promotionId, cartId: input.cartId, code: input.code ?? null }
				});
			}

			throw error;
		}
	}

	/**
	 * Registers a placed order's reservations against it.
	 *
	 * @param orderId The order.
	 * @param cartId The cart it came from.
	 * @returns How many redemptions the order now holds.
	 */
	async registerForOrder(orderId: ID, cartId: ID): Promise<number> {
		return (await this.promotionUsageService.register(orderId, cartId)).length;
	}

	/**
	 * Reverts every redemption of a cancelled order and gives back the uses they took.
	 *
	 * @param orderId The order.
	 * @returns How many redemptions were reverted.
	 */
	async revertForOrder(orderId: ID): Promise<number> {
		let reverted = 0;

		for (const usage of await this.promotionUsageService.findByOrder(orderId)) {
			if (usage.status === PromotionUsageStatus.REVERTED) {
				continue;
			}

			await this.promotionService.revertUsage(usage.promotionId, orderId);
			reverted++;
		}

		return reverted;
	}
}
