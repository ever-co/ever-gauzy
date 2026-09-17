/**
 * The events this package publishes.
 *
 * A domain declares the events it emits, and the subscription consumer registers for exactly those
 * names, so the platform keeps one list of event names — the one the producers write. The six here
 * are the six a client genuinely has to react to within seconds: an authorisation, a capture, a
 * failure, a cancellation, a refund that succeeded, and a refund that was recorded and is waiting for
 * an approver.
 *
 * Everything else this domain does stays on the read APIs and on webhooks: a session that was merely
 * created, a collection whose status was re-derived and a callback that was logged are facts a client
 * reads when it needs them, and streaming them would make a busy checkout a load generator.
 */
export {
	PaymentAuthorizedEvent,
	PaymentCapturedEvent,
	PaymentCanceledEvent,
	PaymentFailedEvent,
	PaymentRefundedEvent,
	RefundCreatedEvent
} from './payment.events';
