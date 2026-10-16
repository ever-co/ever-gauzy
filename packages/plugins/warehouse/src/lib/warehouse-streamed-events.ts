import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { declareStreamedEvents, GraphqlSubscriptionConsumer, SubscriptionCatalogue } from '@gauzy/core';

/**
 * The warehouse facts `Subscription.events` may select: the moves of a pick list the pick-list service appends to
 * the outbox — created, assigned, started, picked, canceled.
 *
 * Each is one move of one list, made by a person on the floor or by the release of a wave, so the stream fires at
 * the rate work moves; and the payload is the list's identity, location, wave, status and assignee — no stock
 * figure and no line. `Subscription.pickListChanged` follows these names on the tenant topics without declaring them
 * again.
 *
 * The names are stated here as the appending code states them (`pick-list/pick-list.service.ts`,
 * `PICK_LIST_EVENTS`), and the suite beside this file fails if the two sets differ or the service stops appending
 * one of them. They stay string literals rather than `Object.values(PICK_LIST_EVENTS)` on purpose:
 * `tools/scripts/subscription-parity-check.mjs` reads every `*_STREAMED_EVENTS` catalogue statically, and refuses a
 * declaration it cannot resolve to literals — the subscription dimension is measured from these names.
 */
export const WAREHOUSE_STREAMED_EVENTS: readonly string[] = [
	'pick_list.created',
	'pick_list.assigned',
	'pick_list.started',
	'pick_list.picked',
	'pick_list.canceled'
];

/**
 * Declares {@link WAREHOUSE_STREAMED_EVENTS} with the subscription catalogue when the module starts.
 *
 * The outbox consumer forwards to subscribers exactly the names the catalogue holds, so a fact appended and never
 * declared is dispatched to every other consumer and never reaches a subscriber of `Subscription.events` or
 * `Subscription.pickListChanged`. Each one is delivered on its own tenant's topic, and only to a subscriber holding
 * the grant the outbox listing states.
 */
@Injectable()
export class WarehouseStreamedEvents implements OnModuleInit {
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
		declareStreamedEvents(this.catalogue, this.consumer, ...WAREHOUSE_STREAMED_EVENTS);
	}
}
