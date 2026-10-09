import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { declareStreamedEvents, GraphqlSubscriptionConsumer, SubscriptionCatalogue } from '@gauzy/core';

/**
 * The order facts `Subscription.events` may select: the five lifecycle moves the order service appends to
 * the outbox in the transaction that makes them — placed, confirmed, canceled, completed, archived.
 *
 * They are moves, not edits (a totals refresh appends nothing), so the stream fires at the rate orders
 * move; and the payload is the order's identity, status and totals, with no address, e-mail or payment
 * detail. `Subscription.checkoutCompleted` rides `order.placed` and needs no declaration of its own.
 *
 * The names are stated here as the appending code states them (`order.types.ts`), and the suite beside
 * this file fails if one of them stops being appended under that name.
 */
export const ORDER_STREAMED_EVENTS: readonly string[] = [
	'order.placed',
	'order.confirmed',
	'order.canceled',
	'order.completed',
	'order.archived'
];

/**
 * Declares {@link ORDER_STREAMED_EVENTS} with the subscription catalogue when the module starts.
 *
 * The outbox consumer forwards to subscribers exactly the names the catalogue holds, so until this ran the
 * events above were appended, dispatched to every other consumer, and never reached a subscriber of
 * `Subscription.events`. Each one is delivered on its own tenant's topic, and only to a subscriber holding
 * the grant the outbox listing states.
 */
@Injectable()
export class OrderStreamedEvents implements OnModuleInit {
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
		declareStreamedEvents(this.catalogue, this.consumer, ...ORDER_STREAMED_EVENTS);
	}
}
