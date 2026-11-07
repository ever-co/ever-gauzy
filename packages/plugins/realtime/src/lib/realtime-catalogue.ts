import { Injectable, Logger, OnModuleInit, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { REALTIME_SIGNAL_EVENTS, REALTIME_STREAMED_EVENTS } from '@gauzy/contracts';
import { declareStreamedEvents, GraphqlSubscriptionConsumer, SubscriptionCatalogue } from '@gauzy/core';

/**
 * Declares the collaboration events with the platform's subscription catalogue, where this process serves
 * subscriptions.
 *
 * The streamed names (`task.*`, `comment.*`, `mention.created`, `employee_notification.created`,
 * `document.updated`) are appended to the outbox by {@link RealtimeHintsService}; declaring them is what makes the
 * outbox consumer forward them to subscribers and `Subscription.events` / `Subscription.collaborationEvents`
 * resolve a selection against them. The signal names (`presence.changed`, `typing.signalled`) are published
 * straight to the pub/sub by {@link RealtimeSignalsService}; they are declared too so a selection by name is
 * accepted, and the outbox consumer simply never sees a row for them.
 *
 * The platform pieces are looked up, not injected: the plugin also loads in a process without a subscription
 * surface, where nothing is declared and nothing fails.
 */
@Injectable()
export class RealtimeCatalogue implements OnModuleInit {
	private readonly logger = new Logger('RealtimeCatalogue');
	private declared = false;

	constructor(private readonly moduleRef: ModuleRef) {}

	/** Whether this process declared the catalogue, which is whether it serves subscriptions. */
	get servesSubscriptions(): boolean {
		return this.declared;
	}

	onModuleInit(): void {
		const catalogue = this.find(SubscriptionCatalogue);
		if (!catalogue) {
			return;
		}
		try {
			declareStreamedEvents(
				catalogue,
				this.find(GraphqlSubscriptionConsumer),
				...REALTIME_STREAMED_EVENTS,
				...REALTIME_SIGNAL_EVENTS
			);
			this.declared = true;
		} catch (error) {
			this.logger.warn(`The collaboration events could not be declared for subscriptions: ${(error as Error)?.message}`);
		}
	}

	/** A platform provider of this process, or `undefined` when it has none. */
	private find<T>(token: Type<T> | undefined): T | undefined {
		if (!token) return undefined;
		try {
			return this.moduleRef.get(token, { strict: false }) ?? undefined;
		} catch {
			return undefined;
		}
	}
}
