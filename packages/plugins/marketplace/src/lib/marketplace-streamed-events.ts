import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { declareStreamedEvents, GraphqlSubscriptionConsumer, SubscriptionCatalogue } from '@gauzy/core';

/**
 * The marketplace facts `Subscription.events` may select: the seller, offering, payout, settlement and
 * ledger moves the marketplace services append to the outbox, by the names they append them under.
 *
 * **`seller_offering.updated` is withheld.** It is appended on every price write and once per item of a
 * bulk reprice — the same kind of fact as `price.updated`, which the kernel refuses to stream — so it
 * stays with the read API and webhooks. The ledger names have three segments, so `seller.*` does not
 * select them; `seller.transaction.*` does. No payload carries account numbers: verification travels as
 * statuses and a payout as its amounts and the provider's transfer reference.
 *
 * The names are stated here as the appending code states them (`seller/seller.service.ts`,
 * `seller-offering/seller-offering.service.ts`, `seller-payout/seller-payout.service.ts`,
 * `seller-settlement/seller-settlement.service.ts`, `seller-transaction/seller-transaction.service.ts`,
 * `split/seller-split.service.ts`), and the suite beside this file fails if one of them stops being
 * appended under that name.
 */
export const MARKETPLACE_STREAMED_EVENTS: readonly string[] = [
	'seller.created',
	'seller.verified',
	'seller.activated',
	'seller.suspended',
	'seller.rejected',
	'seller_offering.created',
	'seller_offering.withdrawn',
	'seller_payout.created',
	'seller_payout.paid',
	'seller_payout.failed',
	'seller_payout.canceled',
	'seller_settlement.recorded',
	'seller_settlement.closed',
	'seller.transaction.recorded',
	'seller.transaction.settleable',
	'seller.transaction.reversed'
];

/**
 * Declares {@link MARKETPLACE_STREAMED_EVENTS} with the subscription catalogue when the module starts.
 *
 * The outbox consumer forwards to subscribers exactly the names the catalogue holds, so until this ran the
 * events above were appended, dispatched to every other consumer, and never reached a subscriber of
 * `Subscription.events`. Each one is delivered on its own tenant's topic, and only to a subscriber holding
 * the grant the outbox listing states.
 */
@Injectable()
export class MarketplaceStreamedEvents implements OnModuleInit {
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
		declareStreamedEvents(this.catalogue, this.consumer, ...MARKETPLACE_STREAMED_EVENTS);
	}
}
