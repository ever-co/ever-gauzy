import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { GraphqlPubSub } from './graphql-pubsub.service';
import { SubscriptionCatalogue } from './subscription-catalogue';
import {
	SubscriptionDelivery,
	SubscriptionClock,
	SubscriptionMessage,
	systemSubscriptionClock
} from './subscription-delivery';
import {
	SubscriptionBudget,
	SubscriptionLimits,
	DEFAULT_SUBSCRIPTION_LIMITS,
	SubscriptionLimitError
} from './subscription-limits';
import {
	AuthorizedSubscription,
	SubscriptionAuthorizer,
	SubscriptionEventLike,
	SubscriptionScopeInput,
	resolveSubscriptionScope
} from './subscription-scope';

/**
 * A catalogued event on its way to subscribers.
 */
export interface SubscriptionEnvelope extends SubscriptionEventLike {
	/** The event identity. */
	readonly eventId: string;
	/** When the fact happened. */
	readonly occurredAt: Date | string;
	/** The catalogued payload. */
	readonly data: unknown;
	/** Monotonic within the tenant. */
	readonly sequence?: number;
}

/**
 * One open subscription.
 */
interface OpenSubscription {
	readonly id: string;
	readonly authorized: AuthorizedSubscription;
	readonly delivery: SubscriptionDelivery;
	readonly iterators: AsyncIterableIterator<unknown>[];
	readonly pumps: Promise<void>[];
}

/**
 * What a subscriber is handed when a subscription opens.
 */
export interface OpenSubscriptionSummary {
	readonly id: string;
	readonly subscriberId: string;
	readonly tenantId: string;
	readonly connectionId: string;
	readonly eventNames: readonly string[];
}

/**
 * The one place a subscription is opened, fed and closed.
 *
 * Events reach it by two routes, and both are the platform's existing buses rather than a new one:
 * the outbox consumer for a durable catalogued event, and the bus bridge for a domain that publishes
 * in process. Whichever route an event takes, it arrives here, is published on
 * `<eventName>:<tenantId>`, and is then delivered to each open subscription **after** a per-event
 * authorisation check.
 *
 * The topic separates tenants; the check separates everything else — a revoked permission, a channel
 * narrowing, an aggregate the client asked for, a subscription whose selection does not cover the
 * event.
 */
@Injectable()
export class GraphqlSubscriptionHub implements OnModuleDestroy {
	private readonly open = new Map<string, OpenSubscription>();
	private readonly budget: SubscriptionBudget;
	private readonly limits: SubscriptionLimits;
	private readonly clock: SubscriptionClock;
	private sequence = 0;

	/**
	 * @param pubSub The fan-out.
	 * @param authorizer The delivery decision.
	 * @param catalogue The events this installation streams.
	 * @param limits The connection and message limits.
	 * @param clock The time source the coalescing window runs on.
	 */
	constructor(
		private readonly pubSub: GraphqlPubSub,
		private readonly authorizer: SubscriptionAuthorizer,
		private readonly catalogue: SubscriptionCatalogue,
		limits: SubscriptionLimits = DEFAULT_SUBSCRIPTION_LIMITS,
		clock: SubscriptionClock = systemSubscriptionClock
	) {
		this.limits = limits;
		this.clock = clock;
		this.budget = new SubscriptionBudget(limits);
	}

	/**
	 * The connection budget, so the transport can refuse a connection before it subscribes.
	 */
	get connections(): SubscriptionBudget {
		return this.budget;
	}

	/**
	 * Takes a connection slot.
	 *
	 * @param connectionId The connection.
	 * @param tenantId The tenant the credential belongs to.
	 * @param credentialId The user or API key identity.
	 */
	openConnection(connectionId: string, tenantId: string, credentialId: string): void {
		this.budget.openConnection(connectionId, tenantId, credentialId);
	}

	/**
	 * Releases a connection and everything it held.
	 *
	 * @param connectionId The connection.
	 */
	closeConnection(connectionId: string): void {
		for (const subscription of Array.from(this.open.values())) {
			if (subscription.authorized.scope.connectionId === connectionId) {
				this.close(subscription.id);
			}
		}

		this.budget.closeConnection(connectionId);
	}

	/**
	 * Opens a subscription.
	 *
	 * @param input What the caller asked for.
	 * @param sink Where its messages go: the connection's writer.
	 * @returns The subscription's identity and the events it covers.
	 * @throws SubscriptionScopeError when the subscription is refused.
	 * @throws SubscriptionLimitError when the connection already holds its maximum.
	 */
	async subscribe(
		input: SubscriptionScopeInput,
		sink: (message: SubscriptionMessage) => void | Promise<void>
	): Promise<{ readonly id: string; readonly eventNames: readonly string[] }> {
		const scope = resolveSubscriptionScope(input);
		const authorized = await this.authorizer.authorize(scope, this.catalogue);

		this.budget.openSubscription(scope.connectionId);

		this.sequence += 1;
		const id = `${scope.subscriberId}#${this.sequence}`;

		const delivery = new SubscriptionDelivery({
			subscriberId: scope.subscriberId,
			limits: this.limits,
			sink,
			clock: this.clock,
			onClose: () => this.forget(id)
		});

		const iterators: AsyncIterableIterator<unknown>[] = [];
		const pumps: Promise<void>[] = [];

		for (const eventName of authorized.eventNames) {
			const topic = this.pubSub.topicFor(eventName, scope.tenantId);
			const iterator = this.pubSub.asyncIterableIterator<unknown>(topic);
			iterators.push(iterator);
			pumps.push(this.pump(iterator, authorized, delivery));
		}

		this.open.set(id, { id, authorized, delivery, iterators, pumps });

		return { id, eventNames: authorized.eventNames };
	}

	/**
	 * Publishes an event to the tenants' subscribers.
	 *
	 * An envelope without a tenant or a name is refused rather than broadcast: every catalogued event
	 * carries both, and a topic nobody can be scoped to is the one thing this design must not have.
	 *
	 * @param event The envelope.
	 * @returns True when it was published.
	 */
	async publish(event: SubscriptionEnvelope): Promise<boolean> {
		if (!event?.name || !event.tenantId) {
			return false;
		}

		await this.pubSub.publish(event.name, event.tenantId, event);
		return true;
	}

	/**
	 * Closes one subscription.
	 *
	 * @param id The subscription's identity.
	 */
	close(id: string): void {
		const subscription = this.open.get(id);
		if (!subscription) {
			return;
		}

		subscription.delivery.close();
		for (const iterator of subscription.iterators) {
			void iterator.return?.(undefined);
		}

		this.forget(id);
	}

	/**
	 * Closes every subscription of a subscriber.
	 *
	 * @param subscriberId The subscriber's identity.
	 */
	closeSubscriber(subscriberId: string): void {
		for (const subscription of Array.from(this.open.values())) {
			if (subscription.authorized.scope.subscriberId === subscriberId) {
				this.close(subscription.id);
			}
		}
	}

	/**
	 * The subscriptions that are open right now.
	 */
	get subscriptions(): readonly OpenSubscriptionSummary[] {
		return Array.from(this.open.values()).map((subscription) => ({
			id: subscription.id,
			subscriberId: subscription.authorized.scope.subscriberId,
			tenantId: subscription.authorized.scope.tenantId,
			connectionId: subscription.authorized.scope.connectionId,
			eventNames: subscription.authorized.eventNames
		}));
	}

	/**
	 * Emits everything buffered and waits for the writes to settle.
	 *
	 * @returns A promise that resolves when nothing is outstanding.
	 */
	async drain(): Promise<void> {
		await Promise.all(Array.from(this.open.values()).map((subscription) => subscription.delivery.drain()));
	}

	/**
	 * Closes everything, for a shutdown.
	 */
	onModuleDestroy(): void {
		for (const id of Array.from(this.open.keys())) {
			this.close(id);
		}

		this.budget.reset();
	}

	/**
	 * Consumes one topic stream for one subscription.
	 *
	 * @param iterator The topic stream.
	 * @param authorized The subscription.
	 * @param delivery Its outbound path.
	 */
	private async pump(
		iterator: AsyncIterableIterator<unknown>,
		authorized: AuthorizedSubscription,
		delivery: SubscriptionDelivery
	): Promise<void> {
		try {
			for await (const payload of iterator) {
				const event = payload as SubscriptionEnvelope;
				if (!event || typeof event.name !== 'string') {
					continue;
				}

				await delivery.offer(event, () => this.authorizer.mayDeliver(authorized, event));
			}
		} catch {
			// A stream that ended because the connection went away is not an error worth escalating:
			// the delivery is closed by its own path and the client reconnects.
		}
	}

	/**
	 * Forgets a closed subscription and releases its slot.
	 *
	 * @param id The subscription's identity.
	 */
	private forget(id: string): void {
		const subscription = this.open.get(id);
		if (!subscription) {
			return;
		}

		this.open.delete(id);
		this.budget.closeSubscription(subscription.authorized.scope.connectionId);
	}
}

/**
 * Raised when a subscription is refused, re-exported here so a resolver imports one module for the
 * whole surface.
 */
export { SubscriptionLimitError };
