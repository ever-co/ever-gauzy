import { BadRequestException } from '@nestjs/common';
import { FulfillmentStatus, OrderStatus, OrderPaymentStatus } from '@gauzy/contracts';
import { compareDecimalStrings, subtractDecimalStrings } from '@gauzy/core';

/**
 * An amount as the decimal string it is compared as.
 *
 * The values arrive as `number` — that is what the totals chain hands over — and this does not pretend
 * otherwise: `String` renders the number the engine already rounded to the currency's scale, and the
 * decimal kernel then compares those renderings exactly. What it must not do is the *arithmetic* in
 * binary floating point, which is what the caller used to do and what a comparison of money cannot
 * survive.
 *
 * @param value The amount as it arrives.
 * @returns The same amount as a decimal string.
 */
function decimal(value: number): string {
	return Number.isFinite(value) ? String(value) : '0';
}

/** Whether a decimal string is greater than zero. */
function isPositive(value: string): boolean {
	return compareDecimalStrings(value, '0') > 0;
}

/** Whether a decimal string is exactly zero. */
function isZero(value: string): boolean {
	return compareDecimalStrings(value, '0') === 0;
}

/** Who is asking for the transition. */
export type OrderActor = 'STAFF' | 'CUSTOMER' | 'SYSTEM' | 'PROVIDER';

/**
 * What the guard needs to know besides the two states.
 */
export interface IOrderTransitionContext {
	/** The actor asking for the move. */
	readonly actor: OrderActor;
	/** Whether any capture exists against the order. */
	readonly hasCapture: boolean;
	/** Whether anything has shipped: a fulfilment past `PENDING`. */
	readonly hasShipped: boolean;
	/** Whether every line is fulfilled and the payment side is settled. */
	readonly isSettled: boolean;
	/** Whether an approval is outstanding. */
	readonly hasOpenApproval: boolean;
	/** Whether the order has any line that requires shipping. */
	readonly hasShippableLines: boolean;
	/** The current fulfilment status, which decides whether a cancellation is still allowed. */
	readonly fulfillmentStatus: FulfillmentStatus;
	/** The materialised money state of the order, which decides whether it may be confirmed. */
	readonly paymentStatus: OrderPaymentStatus;
}

/**
 * The money states a confirmation may leave behind.
 *
 * Confirmation is the platform's promise that the money question is answered: the payment is
 * authorised, it is captured, or it is not due — a zero total or an on-account order (doc 10 §5.2).
 * Every other state means the question is still open, and an order in one of them is confirmed only
 * once the money moves.
 */
const CONFIRMABLE_PAYMENT_STATUSES: OrderPaymentStatus[] = [
	OrderPaymentStatus.AUTHORIZED,
	OrderPaymentStatus.CAPTURED,
	OrderPaymentStatus.NOT_PAID
];

/** The transitions the order lifecycle allows. */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
	[OrderStatus.DRAFT]: [OrderStatus.DRAFT, OrderStatus.PENDING, OrderStatus.CANCELED],
	[OrderStatus.PENDING]: [
		OrderStatus.CONFIRMED,
		OrderStatus.REQUIRES_ACTION,
		OrderStatus.CANCELED
	],
	[OrderStatus.REQUIRES_ACTION]: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.CANCELED],
	[OrderStatus.CONFIRMED]: [
		OrderStatus.PROCESSING,
		OrderStatus.REQUIRES_ACTION,
		OrderStatus.COMPLETED,
		OrderStatus.CANCELED
	],
	[OrderStatus.PROCESSING]: [OrderStatus.REQUIRES_ACTION, OrderStatus.COMPLETED, OrderStatus.CANCELED],
	[OrderStatus.COMPLETED]: [OrderStatus.ARCHIVED],
	[OrderStatus.CANCELED]: [OrderStatus.ARCHIVED],
	[OrderStatus.ARCHIVED]: []
};

/**
 * The order lifecycle, in one place.
 *
 * `status` is written here and nowhere else. Every service that wants to move an order asks this class,
 * which is what keeps a rule like "a delivered order is never cancelled, a return is created instead"
 * from being re-implemented — and re-implemented slightly differently — in each of them.
 */
export class OrderStateMachine {
	/**
	 * @param from The current status.
	 * @returns The statuses that may follow it.
	 */
	static allowedFrom(from: OrderStatus): OrderStatus[] {
		return ALLOWED_TRANSITIONS[from] ?? [];
	}

	/**
	 * @param from The current status.
	 * @param to The requested status.
	 * @param context What the guard needs to know.
	 * @returns True when the move is allowed.
	 */
	static canTransition(from: OrderStatus, to: OrderStatus, context: IOrderTransitionContext): boolean {
		if (from === to) {
			// A draft is edited in place through a change; any other order repeats no state.
			return from === OrderStatus.DRAFT;
		}

		if (!this.allowedFrom(from).includes(to)) {
			return false;
		}

		switch (to) {
			case OrderStatus.PENDING:
				// Placing a draft needs at least something to sell and no capture already taken.
				return !context.hasCapture;

			case OrderStatus.CONFIRMED:
				// Confirmation needs the money side answered and no open approval: an order whose
				// payment is still with the buyer, failed, or only partly authorised or captured is
				// placed but not confirmed — that is what `REQUIRES_ACTION` is for.
				return !context.hasOpenApproval && CONFIRMABLE_PAYMENT_STATUSES.includes(context.paymentStatus);

			case OrderStatus.PROCESSING:
				return true;

			case OrderStatus.COMPLETED:
				return context.isSettled;

			case OrderStatus.CANCELED:
				// Nothing may be cancelled once it has shipped; a delivered order is returned instead.
				if (context.hasShipped) {
					return false;
				}

				return ![
					FulfillmentStatus.RETURNED,
					FulfillmentStatus.PARTIALLY_RETURNED
				].includes(context.fulfillmentStatus);

			case OrderStatus.ARCHIVED:
				return context.actor === 'STAFF' || context.actor === 'SYSTEM';

			default:
				return true;
		}
	}

	/**
	 * Moves an order to a new status, or refuses with the reason.
	 *
	 * @param order The order, as the caller holds it.
	 * @param to The requested status.
	 * @param context What the guard needs to know.
	 * @returns The fields the caller must write, which is the status and the timestamp that goes with it.
	 * @throws BadRequestException with `ORDER_STATUS_TRANSITION_INVALID` and the allowed set, so a caller
	 * learns what it could have asked for instead of only that it was refused.
	 */
	static transition(
		order: { status: OrderStatus },
		to: OrderStatus,
		context: IOrderTransitionContext
	): { status: OrderStatus; placedAt?: Date; completedAt?: Date; canceledAt?: Date } {
		if (!this.canTransition(order.status, to, context)) {
			throw new BadRequestException({
				message: `An order in ${order.status} cannot move to ${to}.`,
				code: 'ORDER_STATUS_TRANSITION_INVALID',
				details: { from: order.status, to, allowed: this.allowedFrom(order.status) }
			});
		}

		const now = new Date();

		switch (to) {
			case OrderStatus.PENDING:
				return { status: to, placedAt: now };
			case OrderStatus.COMPLETED:
				return { status: to, completedAt: now };
			case OrderStatus.CANCELED:
				return { status: to, canceledAt: now };
			default:
				return { status: to };
		}
	}

	/**
	 * Materialises the money state from the order's own ledger.
	 *
	 * The order of the rules is the specification: the first one that matches wins, which is what makes
	 * "captured and partly refunded" resolve to `PARTIALLY_REFUNDED` rather than to `CAPTURED`.
	 *
	 * **The money is compared as decimals, never as the numbers it arrives in.** A payment status is a
	 * decision about money, and money that has passed through a JavaScript `number` has already lost the
	 * exactness the decision needs: `0.05 - 0.02` is `0.030000000000000002` in binary floating point, so
	 * an order whose grand total is `0.05`, whose credit is `0.02` and which was captured for exactly
	 * `0.03` compares as *underpaid* and is reported `PARTIALLY_CAPTURED`. The two subtractions and the
	 * comparisons therefore go through the platform's decimal kernel, which works on the scaled integers
	 * these values actually are. The parameters stay `number` because that is what the totals chain
	 * hands over; what changes is that the arithmetic no longer trusts them.
	 *
	 * @param input The derived inputs.
	 * @returns The payment status.
	 */
	static derivePaymentStatus(input: {
		orderStatus: OrderStatus;
		grandTotal: number;
		creditTotal: number;
		authorized: number;
		voided: number;
		captured: number;
		refunded: number;
		hasRequiresMoreSession: boolean;
		hasPendingSession: boolean;
		hasFailedAttempt: boolean;
		hasTransactions: boolean;
	}): OrderPaymentStatus {
		const payable = subtractDecimalStrings(decimal(input.grandTotal), decimal(input.creditTotal));
		const authorized = subtractDecimalStrings(decimal(input.authorized), decimal(input.voided));
		const captured = decimal(input.captured);
		const refunded = decimal(input.refunded);
		const hasCaptured = isPositive(captured);
		const hasRefunded = isPositive(refunded);

		if (input.orderStatus === OrderStatus.CANCELED && isZero(captured)) {
			return OrderPaymentStatus.CANCELED;
		}
		if (hasCaptured && compareDecimalStrings(refunded, captured) >= 0) {
			return OrderPaymentStatus.REFUNDED;
		}
		if (hasCaptured && hasRefunded) {
			return OrderPaymentStatus.PARTIALLY_REFUNDED;
		}
		if (isPositive(payable) && compareDecimalStrings(captured, payable) >= 0) {
			return OrderPaymentStatus.CAPTURED;
		}
		if (hasCaptured && compareDecimalStrings(captured, payable) < 0) {
			return OrderPaymentStatus.PARTIALLY_CAPTURED;
		}
		if (isPositive(payable) && isZero(captured) && compareDecimalStrings(authorized, payable) >= 0) {
			return OrderPaymentStatus.AUTHORIZED;
		}
		if (isPositive(authorized) && compareDecimalStrings(authorized, payable) < 0 && isZero(captured)) {
			return OrderPaymentStatus.PARTIALLY_AUTHORIZED;
		}
		if (
			input.hasFailedAttempt &&
			isZero(captured) &&
			isZero(authorized) &&
			[OrderStatus.PENDING, OrderStatus.REQUIRES_ACTION].includes(input.orderStatus)
		) {
			return OrderPaymentStatus.FAILED;
		}
		if (input.hasRequiresMoreSession || input.hasPendingSession) {
			return OrderPaymentStatus.AWAITING;
		}

		return OrderPaymentStatus.NOT_PAID;
	}

	/**
	 * Materialises the fulfilment state from the order's lines.
	 *
	 * @param input The derived quantities and counters.
	 * @returns The fulfilment status.
	 */
	static deriveFulfillmentStatus(input: {
		orderStatus: OrderStatus;
		orderedQuantity: number;
		writtenOffQuantity: number;
		dismissedQuantity: number;
		fulfilledQuantity: number;
		receivedReturnQuantity: number;
	}): FulfillmentStatus {
		if (input.orderStatus === OrderStatus.CANCELED) {
			return FulfillmentStatus.CANCELED;
		}

		const netTarget =
			input.orderedQuantity - input.writtenOffQuantity - input.dismissedQuantity;

		if (netTarget > 0 && input.receivedReturnQuantity >= netTarget) {
			return FulfillmentStatus.RETURNED;
		}
		if (input.receivedReturnQuantity > 0) {
			return FulfillmentStatus.PARTIALLY_RETURNED;
		}
		if (netTarget > 0 && input.fulfilledQuantity >= netTarget) {
			return FulfillmentStatus.FULFILLED;
		}
		if (netTarget === 0) {
			return FulfillmentStatus.FULFILLED;
		}
		if (input.fulfilledQuantity > 0) {
			return FulfillmentStatus.PARTIALLY_FULFILLED;
		}

		return FulfillmentStatus.NOT_FULFILLED;
	}
}
