import { Injectable, OnModuleInit } from '@nestjs/common';
import { ContactGroupSource, IContactGroup, ID } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
// Imported from the files that declare them rather than from the subscriptions barrel: a domain that
// publishes needs the fan-out and the catalogue, not the hub, the consumer and the transport, and the
// narrower import keeps this domain's own test surface from loading the whole subscription surface.
import { GraphqlPubSub } from '../graphql/subscriptions/graphql-pubsub.service';
import { SubscriptionCatalogue } from '../graphql/subscriptions/subscription-catalogue';
import type { SubscriptionEnvelope } from '../graphql/subscriptions/subscription-hub.service';

/**
 * The facts this domain streams.
 *
 * An event name is `<aggregate>.<action>` in lower case, which is the shape the catalogue asserts and
 * the shape a client selects with a prefix pattern. The leading segment is the aggregate that owns the
 * change, written in the spelling the event catalogue gives it: a multi-word aggregate is snake_case,
 * matching its table.
 *
 * **The membership facts keep the catalogue's own names.** `contact_group.assigned` and
 * `contact_group.unassigned` are the two events the platform's catalogue states for this aggregate,
 * carrying `groupId`, `customerIds[]` and `source`, and the subscription announces those facts rather
 * than a second vocabulary for them.
 *
 * **The group's own definition change has no catalogued name**, because nothing inside the platform
 * consumes it: the group row is read through the read APIs, and the catalogued membership events are
 * what the price-list and promotion caches invalidate on. A subscriber does have to hear about it —
 * a client caching a group list must see a group appear, change or be removed — so it is announced on
 * the aggregate-level name this platform's concept subscriptions already use (`channel.changed`,
 * `region.changed`), in the catalogue's own spelling of this aggregate rather than in a third one.
 */
export const CONTACT_GROUP_EVENT_NAMES = {
	/** A group's own definition changed: it was created, edited or soft-deleted. */
	CONTACT_GROUP_CHANGED: 'contact_group.changed',
	/** One or more parties became members of a group. */
	CONTACT_GROUP_ASSIGNED: 'contact_group.assigned',
	/** One or more parties stopped being members of a group. */
	CONTACT_GROUP_UNASSIGNED: 'contact_group.unassigned'
} as const;

/**
 * Every fact the `contactGroupChanged` subscription carries.
 *
 * The order is the order the subscription opens its topics in, and it is stated once so the resolver
 * and the publisher cannot disagree about which facts the field covers.
 */
export const CONTACT_GROUP_SUBSCRIBED_EVENT_NAMES: readonly string[] = [
	CONTACT_GROUP_EVENT_NAMES.CONTACT_GROUP_CHANGED,
	CONTACT_GROUP_EVENT_NAMES.CONTACT_GROUP_ASSIGNED,
	CONTACT_GROUP_EVENT_NAMES.CONTACT_GROUP_UNASSIGNED
];

/**
 * What a subscriber receives for `contactGroupChanged`.
 *
 * The envelope is the platform's own — the same shape the outbox consumer hands the hub — with the
 * group the fact is about attached, so a subscriber's selection needs no second read. The scoping
 * members (`tenantId`, `organizationId`, `channelId`) travel beside it because the delivery decision
 * is made on them, and a group is a tenant-wide fact rather than a channel-scoped one.
 */
export interface IContactGroupChangedEnvelope extends SubscriptionEnvelope {
	/** The action that produced the fact: `created`, `updated`, `deleted`, `assigned`, `unassigned`. */
	readonly action: string;
	/** The group in its post-write state. */
	readonly group: IContactGroup;
	/** The parties the membership fact is about, on the two membership facts only. */
	readonly customerIds?: readonly string[];
	/** Which membership rows the fact is about, on the two membership facts only. */
	readonly source?: ContactGroupSource;
}

/**
 * Publishes this domain's changes to the subscription surface.
 *
 * **Why the publisher is a provider rather than a line in each handler.** A subscription is fed from
 * one place or it is fed inconsistently: the REST route and the GraphQL mutation that perform the same
 * write must both announce it, and a client must not be able to tell which protocol wrote a row by
 * whether it received an event. Both surfaces call the same service, so the announcements are made
 * there and neither surface knows how a subscriber is reached.
 *
 * **Why this domain publishes rather than mapping an existing event.** The platform's subscription
 * module offers two routes: a domain publishes a fact of its own, or it declares how an event it
 * already emits maps to a subscription envelope. This domain emits nothing today — the group and its
 * pivot are written through their services and no bus event carries them — so there is no existing
 * event to declare a mapping for, and the writer publishes, exactly as the sales-context domain does.
 *
 * **The tenant comes from the request context**, never from an argument: a fact is published on
 * `<eventName>:<tenantId>`, so an event can only ever reach the tenant it belongs to. The row's own
 * tenancy is the fallback, for a write that runs outside a request — the platform's seeding, for
 * instance. Without either, nothing is published, which is the fail-closed answer rather than a
 * broadcast.
 */
@Injectable()
export class ContactGroupEventPublisher implements OnModuleInit {
	constructor(
		private readonly pubSub: GraphqlPubSub,
		private readonly catalogue: SubscriptionCatalogue
	) {}

	/**
	 * Declares the events this domain streams.
	 *
	 * The catalogue is what the subscription surface offers and what the kernel's `events` field
	 * resolves a selection against, so an event a domain publishes but never declares is an event no
	 * client can ask for. Declaring is idempotent: the catalogue adds a name it already holds, so a
	 * second boot in the same process is not a failure.
	 */
	onModuleInit(): void {
		this.catalogue.declare(...CONTACT_GROUP_SUBSCRIBED_EVENT_NAMES);
	}

	/**
	 * Announces that a group changed.
	 *
	 * @param group The group in its post-write state.
	 * @param action The action that produced the change.
	 * @returns True when the fact was published.
	 */
	async groupChanged(group: IContactGroup, action: string): Promise<boolean> {
		return this.publish(CONTACT_GROUP_EVENT_NAMES.CONTACT_GROUP_CHANGED, action, group, null, null, group);
	}

	/**
	 * Announces that parties became members of a group.
	 *
	 * The whole write is announced once, with the parties it named, because that is how the catalogue
	 * states the fact: one event carrying `customerIds[]`, not one per party.
	 *
	 * @param group The group the membership was granted to, in its post-write state.
	 * @param customerIds The parties that joined.
	 * @param source Which membership rows the fact is about.
	 * @returns True when the fact was published.
	 */
	async membersAssigned(
		group: IContactGroup,
		customerIds: readonly ID[],
		source: ContactGroupSource
	): Promise<boolean> {
		return this.publish(
			CONTACT_GROUP_EVENT_NAMES.CONTACT_GROUP_ASSIGNED,
			'assigned',
			group,
			customerIds,
			source,
			// The catalogued payload of a membership fact, and not the group row: a consumer of
			// `contact_group.assigned` is told which parties joined and by whose write.
			{ groupId: String(group.id), customerIds: customerIds.map((id) => String(id)), source }
		);
	}

	/**
	 * Announces that parties stopped being members of a group.
	 *
	 * @param group The group the membership was withdrawn from, in its post-write state.
	 * @param customerIds The parties that left.
	 * @param source Which membership rows the fact is about.
	 * @returns True when the fact was published.
	 */
	async membersUnassigned(
		group: IContactGroup,
		customerIds: readonly ID[],
		source: ContactGroupSource
	): Promise<boolean> {
		return this.publish(
			CONTACT_GROUP_EVENT_NAMES.CONTACT_GROUP_UNASSIGNED,
			'unassigned',
			group,
			customerIds,
			source,
			{ groupId: String(group.id), customerIds: customerIds.map((id) => String(id)), source }
		);
	}

	/**
	 * Publishes one envelope on the topic its event and tenant name.
	 *
	 * @param eventName The catalogued event name.
	 * @param action The action that produced the fact.
	 * @param group The group the fact is about.
	 * @param customerIds The parties a membership fact is about, or null for the group's own change.
	 * @param source Which membership rows a membership fact is about, or null for the group's change.
	 * @param data The catalogued payload: the group row, or the membership fact's own members.
	 * @returns True when the fact was published.
	 */
	private async publish(
		eventName: string,
		action: string,
		group: IContactGroup,
		customerIds: readonly ID[] | null,
		source: ContactGroupSource | null,
		data: unknown
	): Promise<boolean> {
		// The caller's own tenant is preferred and the row's is the fallback: a write always runs inside
		// a request, and the row's tenancy is what the write stored. Publishing is skipped when neither
		// is known, because an envelope without a tenant has no topic to travel on.
		const tenant = RequestContext.currentTenantId() ?? group?.tenantId;

		if (!tenant || !group?.id) {
			return false;
		}

		const envelope: IContactGroupChangedEnvelope = {
			eventId: `${eventName}:${group.id}:${Date.now()}`,
			name: eventName,
			occurredAt: new Date(),
			tenantId: String(tenant),
			organizationId: group.organizationId ? String(group.organizationId) : undefined,
			// A group belongs to the tenant rather than to a channel, so the fact carries no channel:
			// a channel-narrowed subscription admits it, and there is nothing here to narrow it to.
			channelId: null,
			aggregate: { type: 'ContactGroup', id: String(group.id) },
			action,
			data,
			group,
			...(customerIds ? { customerIds: customerIds.map((id) => String(id)) } : {}),
			...(source ? { source } : {})
		};

		return this.pubSub.publish(eventName, String(tenant), envelope);
	}
}
