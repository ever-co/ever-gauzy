import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { declareStreamedEvents, GraphqlSubscriptionConsumer, SubscriptionCatalogue } from '@gauzy/core';

/**
 * The return facts `Subscription.events` may select: the seven lifecycle moves the return service appends
 * to the outbox — requested, approved, rejected, canceled, received, refunded, closed.
 *
 * Each is one move of one return, and the payload is the return's identity, status and amounts (plus the
 * free-text reason a rejection or cancellation states). `Subscription.orderReturnChanged` can follow these
 * names on the tenant topics without declaring them again.
 *
 * The names are stated here as the appending code states them (`order-return/order-return.service.ts`),
 * and the suite beside this file fails if one of them stops being appended under that name.
 */
export const RETURNS_STREAMED_EVENTS: readonly string[] = [
	'return.requested',
	'return.approved',
	'return.rejected',
	'return.canceled',
	'return.received',
	'return.refunded',
	'return.closed'
];

/**
 * Declares {@link RETURNS_STREAMED_EVENTS} with the subscription catalogue when the module starts.
 *
 * The outbox consumer forwards to subscribers exactly the names the catalogue holds, so until this ran the
 * events above were appended, dispatched to every other consumer, and never reached a subscriber of
 * `Subscription.events`. Each one is delivered on its own tenant's topic, and only to a subscriber holding
 * the grant the outbox listing states.
 */
@Injectable()
export class ReturnsStreamedEvents implements OnModuleInit {
	/**
	 * @param catalogue The events this installation streams.
	 * @param consumer The outbox consumer that feeds subscribers; absent where nothing serves them.
	 */
	constructor(
		private readonly catalogue: SubscriptionCatalogue,
		@Optional() private readonly consumer?: GraphqlSubscriptionConsumer
	) {}

	/**
	 * Declares the names, and has the outbox consumer listen for them.
	 */
	onModuleInit(): void {
		declareStreamedEvents(this.catalogue, this.consumer, ...RETURNS_STREAMED_EVENTS);
	}
}
