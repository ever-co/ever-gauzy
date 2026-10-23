import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { declareStreamedEvents, GraphqlSubscriptionConsumer, SubscriptionCatalogue } from '@gauzy/core';

/**
 * The entitlement facts `Subscription.events` may select: every name the entitlement services append to
 * the outbox except `entitlement_key.issued`.
 *
 * **`entitlement_key.issued` is withheld** because its payload carries the e-mail address the key was
 * assigned to — a buyer's personal data — and a stream pushes it to every connected operator of the tenant
 * rather than to the one who asks for it. It stays readable where it is today, in the outbox listing and
 * through a webhook. No payload carries key material: only the key's display prefix travels.
 *
 * The names are stated here as the appending code states them (`entitlement.types.ts`), and the suite
 * beside this file fails if one of them stops being appended under that name.
 */
export const ENTITLEMENT_STREAMED_EVENTS: readonly string[] = [
	'entitlement.created',
	'entitlement.activated',
	'entitlement.deactivated',
	'entitlement.suspended',
	'entitlement.renewed',
	'entitlement.reduced',
	'entitlement.revoked',
	'entitlement.expired',
	'entitlement_key.revoked'
];

/**
 * Declares {@link ENTITLEMENT_STREAMED_EVENTS} with the subscription catalogue when the module starts.
 *
 * The outbox consumer forwards to subscribers exactly the names the catalogue holds, so until this ran the
 * events above were appended, dispatched to every other consumer, and never reached a subscriber of
 * `Subscription.events`. Each one is delivered on its own tenant's topic, and only to a subscriber holding
 * the grant the outbox listing states.
 */
@Injectable()
export class EntitlementStreamedEvents implements OnModuleInit {
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
		declareStreamedEvents(this.catalogue, this.consumer, ...ENTITLEMENT_STREAMED_EVENTS);
	}
}
