import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { declareStreamedEvents, GraphqlSubscriptionConsumer, SubscriptionCatalogue } from '@gauzy/core';

/**
 * The shipment facts `Subscription.events` may select: created, shipped, in transit, delivered, canceled —
 * the lifecycle moves the fulfillment service appends to the outbox.
 *
 * The payload is the shipment's identity, status, carrier and tracking number; the carrier label is
 * deliberately not in it. `Subscription.fulfillmentCreated` can follow `fulfillment.created` on the tenant
 * topics without declaring it again.
 *
 * The names are stated here as the appending code states them (`fulfillment.types.ts`), and the suite
 * beside this file fails if one of them stops being appended under that name.
 */
export const FULFILLMENT_STREAMED_EVENTS: readonly string[] = [
	'fulfillment.created',
	'fulfillment.shipped',
	'fulfillment.in_transit',
	'fulfillment.delivered',
	'fulfillment.canceled'
];

/**
 * Declares {@link FULFILLMENT_STREAMED_EVENTS} with the subscription catalogue when the module starts.
 *
 * The outbox consumer forwards to subscribers exactly the names the catalogue holds, so until this ran the
 * events above were appended, dispatched to every other consumer, and never reached a subscriber of
 * `Subscription.events`. Each one is delivered on its own tenant's topic, and only to a subscriber holding
 * the grant the outbox listing states.
 */
@Injectable()
export class FulfillmentStreamedEvents implements OnModuleInit {
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
		declareStreamedEvents(this.catalogue, this.consumer, ...FULFILLMENT_STREAMED_EVENTS);
	}
}
