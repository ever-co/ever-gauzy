import { BaseEvent } from '@gauzy/core';
import { DecimalString, ID } from '@gauzy/contracts';
import { Coupon } from '../coupon/coupon.entity';
import { GiftCard } from '../gift-card/gift-card.entity';
import { Promotion } from '../promotion/promotion.entity';

/**
 * Raised when a promotion is created, activated or expired.
 *
 * The event carries the promotion's identity and the state it moved to, not the whole row: a
 * subscriber that needs the row reads it through the service, so an event never becomes a second,
 * staler copy of a record that has already moved on by the time it is handled. A subscriber that
 * caches a promotion set — the cart and checkout path does — purges on this event rather than on a
 * timer, because a promotion that has expired must stop applying at the instant it expired, not at
 * the next refresh.
 */
export class PromotionChangedEvent extends BaseEvent {
	/**
	 * @param promotionId The promotion that changed.
	 * @param status The state it moved to.
	 * @param organizationId The organization the promotion belongs to.
	 */
	constructor(
		public readonly promotionId: ID,
		public readonly status: string,
		public readonly organizationId: ID
	) {
		super();
	}

	/**
	 * @param promotion The promotion that changed.
	 * @returns The event describing it.
	 */
	static from(promotion: Promotion): PromotionChangedEvent {
		return new PromotionChangedEvent(promotion.id, promotion.status, promotion.organizationId);
	}
}

/**
 * Raised when a campaign budget reaches its ceiling.
 *
 * It is emitted by the evaluation path when a reservation is refused, which is the moment an operator
 * can still act: a budget reported as spent at the end of the month cannot be topped up in time.
 */
export class PromotionBudgetExhaustedEvent extends BaseEvent {
	/**
	 * @param promotionId The promotion whose budget is spent.
	 * @param budgetId The budget that refused the reservation.
	 * @param limit The ceiling.
	 * @param used What has been consumed, including reservations.
	 * @param organizationId The organization the budget belongs to.
	 */
	constructor(
		public readonly promotionId: ID,
		public readonly budgetId: ID,
		public readonly limit: DecimalString,
		public readonly used: DecimalString,
		public readonly organizationId: ID
	) {
		super();
	}
}

/**
 * Raised when a code is redeemed.
 *
 * The code is carried because the usage counters and any mailing report are keyed on it, and the
 * amount is carried because that is the figure the campaign's spend is reconciled against.
 */
export class CouponRedeemedEvent extends BaseEvent {
	/**
	 * @param couponId The coupon that was redeemed.
	 * @param code The code as presented.
	 * @param amount The discount the redemption granted.
	 * @param currency The currency of the discount.
	 * @param orderId The order the redemption was registered against, when it has one yet.
	 * @param organizationId The organization the coupon belongs to.
	 */
	constructor(
		public readonly couponId: ID,
		public readonly code: string,
		public readonly amount: DecimalString,
		public readonly currency: string,
		public readonly orderId: ID | undefined,
		public readonly organizationId: ID
	) {
		super();
	}

	/**
	 * @param coupon The coupon that was redeemed.
	 * @param amount The discount the redemption granted.
	 * @param orderId The order the redemption was registered against.
	 * @returns The event describing it.
	 */
	static from(coupon: Coupon, amount: DecimalString, orderId?: ID): CouponRedeemedEvent {
		return new CouponRedeemedEvent(
			coupon.id,
			coupon.code,
			amount,
			(coupon as { currency?: string }).currency ?? '',
			orderId,
			coupon.organizationId
		);
	}
}

/**
 * Raised when stored value is spent.
 *
 * The balance after the movement travels with the event, because the consumer that reacts to a
 * redemption — a notification, a balance display — needs the figure the customer will see next, and
 * reading it separately would race with the next movement on the same card.
 */
export class GiftCardRedeemedEvent extends BaseEvent {
	/**
	 * @param giftCardId The card that was debited.
	 * @param amount The amount taken off the card.
	 * @param balanceAfter The balance the card holds afterwards.
	 * @param orderId The order the value settled.
	 * @param organizationId The organization the card belongs to.
	 */
	constructor(
		public readonly giftCardId: ID,
		public readonly amount: DecimalString,
		public readonly balanceAfter: DecimalString,
		public readonly orderId: ID | undefined,
		public readonly organizationId: ID
	) {
		super();
	}

	/**
	 * @param card The card that was debited.
	 * @param amount The amount taken off it.
	 * @param balanceAfter The balance it holds afterwards.
	 * @param orderId The order the value settled.
	 * @returns The event describing it.
	 */
	static from(card: GiftCard, amount: DecimalString, balanceAfter: DecimalString, orderId?: ID): GiftCardRedeemedEvent {
		return new GiftCardRedeemedEvent(card.id, amount, balanceAfter, orderId, card.organizationId);
	}
}
