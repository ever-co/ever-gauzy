import { BaseEvent } from '@gauzy/core';
import { DecimalString, ID } from '@gauzy/contracts';

/**
 * Raised when a provider authorises an attempt.
 *
 * The event carries the session, the payment row it produced and the amount reserved — not the whole
 * row. A subscriber that needs more reads it through the service, so the stream never becomes a
 * second, staler copy of a record that has already moved on by the time it is handled; what travels
 * here is what a consumer needs in order to decide whether to react at all.
 */
export class PaymentAuthorizedEvent extends BaseEvent {
	/**
	 * @param sessionId The session that was authorised.
	 * @param amount The amount the provider authorised.
	 * @param currency The currency of the authorisation.
	 * @param collectionId The collection the authorisation was reserved on.
	 * @param organizationId The organization the session belongs to.
	 */
	constructor(
		public readonly sessionId: ID,
		public readonly amount: DecimalString,
		public readonly currency: string,
		public readonly collectionId: ID,
		public readonly organizationId: ID
	) {
		super();
	}
}

/**
 * Raised when money is taken.
 *
 * It is emitted inside the transaction that writes the capture, so a consumer that reacts to it —
 * a fulfillment that may now ship, a notification, a reconciliation — reacts to a movement that is
 * already on record rather than to one that might still fail.
 */
export class PaymentCapturedEvent extends BaseEvent {
	/**
	 * @param captureId The capture that was written.
	 * @param paymentId The payment row it was taken against.
	 * @param amount The amount captured.
	 * @param currency The currency of the capture.
	 * @param organizationId The organization the payment belongs to.
	 */
	constructor(
		public readonly captureId: ID,
		public readonly paymentId: ID,
		public readonly amount: DecimalString,
		public readonly currency: string,
		public readonly organizationId: ID
	) {
		super();
	}
}

/**
 * Raised when an attempt fails.
 *
 * The reason travels as the code the refusal was recorded with, because that is what a client
 * branches on, and the provider's own code travels beside it for the operator who has to explain the
 * decline to the customer.
 */
export class PaymentFailedEvent extends BaseEvent {
	/**
	 * @param sessionId The session that failed.
	 * @param collectionId The collection the attempt belonged to.
	 * @param amount The amount that was attempted.
	 * @param currency The currency of the attempt.
	 * @param reason The code the failure was recorded with.
	 * @param organizationId The organization the session belongs to.
	 */
	constructor(
		public readonly sessionId: ID,
		public readonly collectionId: ID,
		public readonly amount: DecimalString,
		public readonly currency: string,
		public readonly reason: string,
		public readonly organizationId: ID
	) {
		super();
	}
}

/**
 * Raised when an attempt is voided and its authorisation released.
 */
export class PaymentCanceledEvent extends BaseEvent {
	/**
	 * @param sessionId The session that was cancelled.
	 * @param collectionId The collection the authorisation was released from.
	 * @param amount The amount released, which is zero when nothing had been authorised yet.
	 * @param currency The currency of the attempt.
	 * @param organizationId The organization the session belongs to.
	 */
	constructor(
		public readonly sessionId: ID,
		public readonly collectionId: ID,
		public readonly amount: DecimalString,
		public readonly currency: string,
		public readonly organizationId: ID
	) {
		super();
	}
}

/**
 * Raised when a refund succeeds and the money has gone back.
 *
 * A refund that is created is not this event: the intention and the movement are different facts, and
 * a consumer that reacts to money moving must not be woken by a refund that is still pending. The
 * creation carries {@link RefundCreatedEvent} instead.
 */
export class PaymentRefundedEvent extends BaseEvent {
	/**
	 * @param refundId The refund that succeeded.
	 * @param paymentId The payment that was given back, when the refund names one.
	 * @param amount The amount refunded.
	 * @param currency The currency of the refund.
	 * @param organizationId The organization the refund belongs to.
	 */
	constructor(
		public readonly refundId: ID,
		public readonly paymentId: ID | undefined,
		public readonly amount: DecimalString,
		public readonly currency: string,
		public readonly organizationId: ID
	) {
		super();
	}
}

/**
 * Raised when a refund is recorded, before anything has moved.
 *
 * It exists so that the record-keeping side of a refund — a return that has to show what it will give
 * back, a queue an approver works through — does not have to poll for pending refunds, while the
 * money-moving side keeps waiting for {@link PaymentRefundedEvent}.
 */
export class RefundCreatedEvent extends BaseEvent {
	/**
	 * @param refundId The refund that was recorded.
	 * @param orderId The order it will give money back against.
	 * @param amount The amount requested.
	 * @param currency The currency of the refund.
	 * @param organizationId The organization the refund belongs to.
	 */
	constructor(
		public readonly refundId: ID,
		public readonly orderId: ID,
		public readonly amount: DecimalString,
		public readonly currency: string,
		public readonly organizationId: ID
	) {
		super();
	}
}
