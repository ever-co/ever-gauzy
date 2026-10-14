import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { declareStreamedEvents, GraphqlSubscriptionConsumer, SubscriptionCatalogue } from '@gauzy/core';

/**
 * The recurring-billing facts `Subscription.events` may select: the lifecycle moves the subscription
 * service appends to the outbox, by the names it appends them under (`subscription.service.ts`).
 *
 * Each fires once per subscription per move or per billing cycle, and the payload is the subscription's
 * identity, period and amounts — a failed payment carries the gateway's decline code, never card data.
 *
 * The names are stated here as the appending code states them (`subscription/subscription.service.ts`),
 * and the suite beside this file fails if one of them stops being appended under that name.
 */
export const SUBSCRIPTION_STREAMED_EVENTS: readonly string[] = [
	'subscription.created',
	'subscription.activated',
	'subscription.paused',
	'subscription.resumed',
	'subscription.canceled',
	'subscription.expired',
	'subscription.payment-failed',
	'subscription.renewed'
];

/**
 * Declares {@link SUBSCRIPTION_STREAMED_EVENTS} with the subscription catalogue when the module starts.
 *
 * The outbox consumer forwards to subscribers exactly the names the catalogue holds, so until this ran the
 * events above were appended, dispatched to every other consumer, and never reached a subscriber of
 * `Subscription.events`. Each one is delivered on its own tenant's topic, and only to a subscriber holding
 * the grant the outbox listing states.
 */
@Injectable()
export class SubscriptionStreamedEvents implements OnModuleInit {
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
		declareStreamedEvents(this.catalogue, this.consumer, ...SUBSCRIPTION_STREAMED_EVENTS);
	}
}
