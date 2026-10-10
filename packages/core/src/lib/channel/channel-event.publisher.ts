import { Injectable, OnModuleInit } from '@nestjs/common';
import { IChannel, IRegion, ID } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
// Imported from the files that declare them rather than from the subscriptions barrel: a domain that
// publishes needs the fan-out and the catalogue, not the hub, the consumer and the transport, and the
// narrower import keeps this domain's own test surface from loading the whole subscription surface.
import { GraphqlPubSub } from '../graphql/subscriptions/graphql-pubsub.service';
import { SubscriptionCatalogue } from '../graphql/subscriptions/subscription-catalogue';
import type { SubscriptionEnvelope } from '../graphql/subscriptions/subscription-hub.service';

/**
 * The two facts this domain streams.
 *
 * An event name is `<aggregate>.<action>` in lower case, which is the shape the catalogue asserts
 * and the shape a client selects with a prefix pattern. The names are the aggregates' own: a channel
 * changing is `channel.changed` whether the write was an edit, a status move or a set-default.
 */
export const CHANNEL_EVENT_NAMES = {
	/** A channel of the caller's organization changed. */
	CHANNEL_CHANGED: 'channel.changed',
	/** A region of the caller's organization changed. */
	REGION_CHANGED: 'region.changed'
} as const;

/**
 * What a subscriber receives for `channelChanged`.
 *
 * The envelope is the platform's own — the same shape the outbox consumer hands the hub — with the
 * channel the fact is about attached, so a subscriber's selection needs no second read. The
 * scoping members (`tenantId`, `organizationId`, `channelId`) travel beside it because the delivery
 * decision is made on them.
 */
export interface IChannelChangedEnvelope extends SubscriptionEnvelope {
	/** The action that produced the fact: `created`, `updated`, `archived`, `default-changed`, … */
	readonly action: string;
	/** The channel in its post-write state. */
	readonly channel: IChannel;
}

/**
 * What a subscriber receives for `regionChanged`.
 */
export interface IRegionChangedEnvelope extends SubscriptionEnvelope {
	/** The action that produced the fact. */
	readonly action: string;
	/** The region in its post-write state. */
	readonly region: IRegion;
}

/**
 * Publishes this domain's changes to the subscription surface.
 *
 * **Why the publisher is a provider rather than a line in each handler.** A subscription is fed from
 * one place or it is fed inconsistently: the REST route and the GraphQL mutation that perform the
 * same write must both announce it, and a client must not be able to tell which protocol wrote a
 * row by whether it received an event. Both surfaces therefore call this collaborator, and neither
 * knows how a subscriber is reached.
 *
 * **Why `data` carries the row as well as the named member.** `SubscriptionEnvelope.data` is the
 * catalogued payload — what the kernel's own `events` field hands a subscriber — while `channel` and
 * `region` are what a concept-shaped subscription field resolves against. They are the same row, and
 * a client reads whichever of the two its selection names.
 *
 * **The tenant comes from the request context**, never from an argument: a fact is published on
 * `<eventName>:<tenantId>`, so an event can only ever reach the tenant it belongs to. Without a
 * resolved tenant nothing is published, which is the fail-closed answer rather than a broadcast.
 */
@Injectable()
export class ChannelEventPublisher implements OnModuleInit {
	constructor(
		private readonly pubSub: GraphqlPubSub,
		private readonly catalogue: SubscriptionCatalogue
	) {}

	/**
	 * Declares the events this domain streams.
	 *
	 * The catalogue is what the subscription surface offers and what the kernel's `events` field can
	 * resolve a selection against, so an event a domain publishes but never declares is an event no
	 * client can ask for. Declaring is idempotent: `Set.add` is what the catalogue does with a name
	 * it already holds, so a second boot in the same process is not a failure.
	 */
	onModuleInit(): void {
		this.catalogue.declare(CHANNEL_EVENT_NAMES.CHANNEL_CHANGED, CHANNEL_EVENT_NAMES.REGION_CHANGED);
	}

	/**
	 * Announces that a channel changed.
	 *
	 * @param channel The channel in its post-write state.
	 * @param action The action that produced the change.
	 * @returns True when the fact was published.
	 */
	async channelChanged(channel: IChannel, action: string): Promise<boolean> {
		return this.publish(CHANNEL_EVENT_NAMES.CHANNEL_CHANGED, action, channel.tenantId, channel.organizationId, String(channel.id), {
			aggregate: { type: 'Channel', id: String(channel.id) },
			channel
		});
	}

	/**
	 * Announces that a region changed.
	 *
	 * @param region The region in its post-write state.
	 * @param action The action that produced the change.
	 * @returns True when the fact was published.
	 */
	async regionChanged(region: IRegion, action: string): Promise<boolean> {
		return this.publish(CHANNEL_EVENT_NAMES.REGION_CHANGED, action, region.tenantId, region.organizationId, null, {
			aggregate: { type: 'Region', id: String(region.id) },
			region
		});
	}

	/**
	 * Publishes one envelope on the topic its event and tenant name.
	 *
	 * @param eventName The catalogued event name.
	 * @param action The action that produced the fact.
	 * @param tenantId The tenant the fact belongs to, as the row carries it.
	 * @param organizationId The organization the fact belongs to.
	 * @param channelId The channel the fact belongs to, when it belongs to one.
	 * @param payload The concept-shaped members the subscription field resolves against.
	 * @returns True when the fact was published.
	 */
	private async publish(
		eventName: string,
		action: string,
		tenantId: ID | undefined,
		organizationId: ID | undefined,
		channelId: string | null,
		payload: { aggregate: { type: string; id: string }; channel?: IChannel; region?: IRegion }
	): Promise<boolean> {
		// The caller's own tenant is preferred and the row's is the fallback: a write always runs
		// inside a request, and the row's tenancy is what the write stored. Publishing is skipped
		// when neither is known, because an envelope without a tenant has no topic to travel on.
		const tenant = RequestContext.currentTenantId() ?? tenantId;

		if (!tenant) {
			return false;
		}

		const envelope: SubscriptionEnvelope & Record<string, unknown> = {
			eventId: `${eventName}:${payload.aggregate.id}:${Date.now()}`,
			name: eventName,
			occurredAt: new Date(),
			tenantId: String(tenant),
			organizationId: organizationId ? String(organizationId) : undefined,
			channelId,
			aggregate: payload.aggregate,
			action,
			data: payload.channel ?? payload.region,
			...payload
		};

		return this.pubSub.publish(eventName, String(tenant), envelope);
	}
}
