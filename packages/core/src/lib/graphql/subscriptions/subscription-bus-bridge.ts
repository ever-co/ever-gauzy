import { Injectable, OnModuleDestroy, OnModuleInit, Optional, Type } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { EventBus } from '../../event-bus/event-bus';
import { BaseEvent } from '../../event-bus/base-event';
import { GraphqlSubscriptionHub, SubscriptionEnvelope } from './subscription-hub.service';

/**
 * How to read an envelope out of an in-process event.
 */
export type SubscriptionEnvelopeReducer<T> = (event: T) => SubscriptionEnvelope | undefined;

/**
 * Feeds in-process events to subscribers.
 *
 * The platform has two event buses and a domain may publish on either:
 *
 * - the RxJS bus in `packages/core/src/lib/event-bus`, whose subscribers filter by event class;
 * - the CQRS bus, whose handlers declare the event class they handle.
 *
 * The durable route — a domain that writes its fact to the transactional outbox — is covered by the
 * outbox consumer. This bridge is the other half: a domain that publishes in process today keeps
 * publishing exactly as it does, and *declares* here how its event maps to a subscription envelope.
 * No domain is asked to change which bus it uses, and no second bus is introduced.
 *
 * Both routes end in the same place and pass through the same authorisation, so whether an event was
 * durable or in-process is not observable to a subscriber — and cannot become a way around the
 * tenant check.
 */
@Injectable()
export class GraphqlSubscriptionBusBridge implements OnModuleInit, OnModuleDestroy {
	private readonly rxjsSubscriptions = new Map<Type<BaseEvent>, Subscription>();
	private readonly rxjsReducers = new Map<Type<BaseEvent>, SubscriptionEnvelopeReducer<never>>();
	private readonly cqrsReducers = new Map<Type<object>, SubscriptionEnvelopeReducer<never>>();
	private cqrsSubscription?: { unsubscribe(): void };

	/**
	 * @param hub Where declared events are published.
	 * @param rxjsBus The in-process bus, when the module graph provides it.
	 * @param cqrsBus The CQRS bus, when the module graph provides it.
	 */
	constructor(
		private readonly hub: GraphqlSubscriptionHub,
		@Optional() private readonly rxjsBus?: EventBus,
		@Optional() private readonly cqrsBus?: unknown
	) {}

	/**
	 * Subscribes to one event class on the in-process bus.
	 *
	 * @param eventType The event class the domain publishes.
	 * @param reduce How to read a subscription envelope out of it. Returning `undefined` means "this
	 * occurrence is not publishable", which is how a domain keeps an internal event internal.
	 */
	follow<T extends BaseEvent>(eventType: Type<T>, reduce: SubscriptionEnvelopeReducer<T>): void {
		if (!this.rxjsBus || this.rxjsSubscriptions.has(eventType)) {
			return;
		}

		this.rxjsReducers.set(eventType, reduce as SubscriptionEnvelopeReducer<never>);
		this.rxjsSubscriptions.set(
			eventType,
			this.rxjsBus.ofType(eventType).subscribe((event) => {
				void this.forward(event, this.rxjsReducers.get(eventType));
			})
		);
	}

	/**
	 * Subscribes to one event class on the CQRS bus.
	 *
	 * @param eventType The event class.
	 * @param reduce How to read a subscription envelope out of it.
	 */
	followCqrs<T extends object>(eventType: Type<T>, reduce: SubscriptionEnvelopeReducer<T>): void {
		this.cqrsReducers.set(eventType, reduce as SubscriptionEnvelopeReducer<never>);
	}

	/**
	 * Attaches to the CQRS bus, when it exposes the observable surface the framework gives it.
	 */
	onModuleInit(): void {
		const bus = this.cqrsBus as { subscribe?: (handler: (event: unknown) => void) => { unsubscribe(): void } } | undefined;

		if (!bus || typeof bus.subscribe !== 'function') {
			// Without the bus there is nothing to follow; the outbox route and the in-process bus are
			// unaffected, so this is not a boot failure.
			return;
		}

		this.cqrsSubscription = bus.subscribe((event: unknown) => {
			if (!event || typeof event !== 'object') {
				return;
			}

			const reduce = this.cqrsReducers.get(event.constructor as Type<object>);
			if (!reduce) {
				return;
			}

			void this.forward(event, reduce);
		});
	}

	/**
	 * Detaches from everything.
	 */
	onModuleDestroy(): void {
		for (const subscription of this.rxjsSubscriptions.values()) {
			subscription.unsubscribe();
		}

		this.rxjsSubscriptions.clear();
		this.cqrsSubscription?.unsubscribe();
		this.cqrsSubscription = undefined;
	}

	/**
	 * Reduces an event and publishes it.
	 *
	 * @param event The bus event.
	 * @param reduce The reducer the domain declared.
	 */
	private async forward<T>(
		event: T,
		reduce: SubscriptionEnvelopeReducer<T> | undefined
	): Promise<void> {
		if (!reduce) {
			return;
		}

		try {
			const envelope = reduce(event);
			if (envelope) {
				await this.hub.publish(envelope);
			}
		} catch {
			// A reducer that throws must not take the publisher's transaction with it: the event is
			// dropped for subscribers and every other consumer of the bus is unaffected.
		}
	}
}
