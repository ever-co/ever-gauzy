import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ContactGroupType, IContactGroup, ID as Id, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { RequestContext } from '../core/context/request-context';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { GraphqlPubSub } from '../graphql/subscriptions/graphql-pubsub.service';
import { ContactGroupService } from './contact-group.service';
import {
	CONTACT_GROUP_SUBSCRIBED_EVENT_NAMES,
	IContactGroupChangedEnvelope
} from './contact-group-event.publisher';

/**
 * The members `CreateContactGroupInput` declares in the schema.
 *
 * `isSystem` is absent by construction: the flag is what makes a group undeletable and un-recordable,
 * so it is written by the platform's own seeding path and never by a request.
 */
export interface ICreateContactGroupInput {
	organizationId: Id;
	name: string;
	code: string;
	description?: string;
	type?: ContactGroupType;
	priceListId?: Id;
	discountPercent?: number;
	metadata?: Record<string, unknown>;
}

/**
 * The members `UpdateContactGroupInput` declares in the schema.
 */
export interface IUpdateContactGroupInput extends Partial<ICreateContactGroupInput> {
	id: Id;
}

/**
 * The fields a group list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `ContactGroupFilter` and `ContactGroupSortField`
 * are its two renderings, and keeping the three in one file is what makes a field that is filterable in
 * the schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 */
const CONTACT_GROUP_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	code: 'STRING',
	description: 'STRING',
	type: 'ENUM',
	priceListId: 'ID',
	isSystem: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const CONTACT_GROUP_SORTABLE = [
	'createdAt',
	'updatedAt',
	'name',
	'code',
	'type',
	'isSystem',
	'discountPercent'
] as const;

/**
 * The order the delivered list method means: newest first. The connection reproduces it rather than
 * replacing it, so the REST answer and this one list the same rows in the same order when neither
 * caller states a sort.
 */
const CONTACT_GROUP_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * One stream out of several: the aggregate's facts travel on one topic per event name, and a
 * subscription is one iterable, so the topics are merged here.
 *
 * The merge is a race over each source's next message rather than a buffer, so a slow topic cannot
 * delay a fast one and nothing is queued twice. Each source is opened with `next()` before the first
 * message is awaited, because a topic only hands a payload to a reader that is already waiting; every
 * source is closed in the `finally`, which is what detaches a subscription GraphQL has stopped reading
 * — a client that unsubscribes, or a connection that goes away — from the fan-out.
 *
 * A fact's place in its own topic is preserved and no order is promised *across* topics: three topics
 * are three streams, and a subscription is a notification rather than a ledger a client replays.
 *
 * @param sources The topic streams to merge.
 * @returns One iterator carrying every source's payloads as they arrive.
 */
async function* mergeSubscriptionStreams<T>(
	sources: readonly AsyncIterableIterator<T>[]
): AsyncIterableIterator<T> {
	const waiting = new Map<AsyncIterableIterator<T>, Promise<{ source: AsyncIterableIterator<T>; result: IteratorResult<T> }>>();

	for (const source of sources) {
		waiting.set(source, source.next().then((result) => ({ source, result })));
	}

	try {
		while (waiting.size > 0) {
			const { source, result } = await Promise.race(waiting.values());

			if (result.done) {
				waiting.delete(source);
				continue;
			}

			waiting.set(source, source.next().then((next) => ({ source, result: next })));

			yield result.value;
		}
	} finally {
		for (const source of sources) {
			await source.return?.(undefined);
		}
	}
}

/**
 * Contact groups over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `ContactGroupService` the `/api/contact-groups` routes
 * call, under the same guard chain and the same permission. A client that reaches a capability over one
 * protocol is not given a narrower or a wider one than the client that reaches it over the other.
 *
 * **The list root field is a connection, not a bare array.** The same `filter`, `sort` and page the
 * REST route accepts, answered with the platform's own cursor codec, so a cursor obtained over REST
 * resumes here — and the same refusal codes, so a client that branches on `QUERY_SORT_NOT_ALLOWED` over
 * one surface branches on it over the other.
 *
 * **The membership of a group is not a field of this type.** Who is in a group is the pivot's answer,
 * and the pivot lives in `ContactGroupMemberModule`, which imports this module — so the field resolver
 * that answers `members` and `memberCount` is declared there, beside the service that owns the fact,
 * and a raw row count is deliberately not used in its place: a membership whose window has closed is
 * absent to every reader.
 *
 * **`withDeleted` is deliberately absent.** It is a repository option the delivered list methods do not
 * expose, and offering an argument that cannot be honoured would be worse than not offering it.
 *
 * **The subscription is the concept's, not the event catalogue's.** `contactGroupChanged` carries every
 * fact the domain announces about a group — its own definition changing, and its membership being
 * granted or withdrawn — because a client that caches a group's effect has to see all three, and a
 * client that wants one of them narrows by `action`. The events themselves are the catalogue's and are
 * published by the service layer, so a subscriber cannot tell which protocol wrote a row.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('ContactGroup')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.CONTACT_GROUPS_VIEW)
export class ContactGroupResolver {
	constructor(
		private readonly contactGroupService: ContactGroupService,
		private readonly pubSub: GraphqlPubSub
	) {}

	/**
	 * The groups of the caller's organization, newest first.
	 */
	@Query('contactGroups')
	@Permissions(PermissionsEnum.CONTACT_GROUPS_VIEW)
	async contactGroups(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IContactGroup>> {
		const rows = await this.contactGroupService.listGroups();

		return buildConnection<IContactGroup>({
			rows,
			filterable: CONTACT_GROUP_FILTERABLE,
			sortable: CONTACT_GROUP_SORTABLE,
			defaultSort: CONTACT_GROUP_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One group of the caller's organization, or `null` when there is none.
	 */
	@Query('contactGroup')
	@Permissions(PermissionsEnum.CONTACT_GROUPS_VIEW)
	async contactGroup(@Args('id', { type: () => ID }) id: Id): Promise<IContactGroup | null> {
		return this.contactGroupService.findGroup(id);
	}

	/**
	 * Creates a group an operator maintains.
	 */
	@Mutation('createContactGroup')
	@Permissions(PermissionsEnum.CONTACT_GROUPS_CREATE)
	async createContactGroup(@Args('input') input: ICreateContactGroupInput): Promise<IContactGroup> {
		return this.contactGroupService.createGroup(input as never);
	}

	/**
	 * Changes a group's descriptive facts, and its kind.
	 *
	 * The member count the service takes for its "a static group with hand-written members cannot
	 * become rule-based" refusal is passed as its own default: the count is the membership pivot's
	 * answer, and the pivot's module imports this one, so this resolver cannot reach it. The refusal
	 * remains in force for the segment materialiser, which owns the count.
	 */
	@Mutation('updateContactGroup')
	@Permissions(PermissionsEnum.CONTACT_GROUPS_EDIT)
	async updateContactGroup(@Args('input') input: IUpdateContactGroupInput): Promise<IContactGroup> {
		return this.contactGroupService.updateGroup(input.id, input as never);
	}

	/**
	 * Soft-deletes a group, which is the only removal path there is.
	 */
	@Mutation('deleteContactGroup')
	@Permissions(PermissionsEnum.CONTACT_GROUPS_DELETE)
	async deleteContactGroup(@Args('id', { type: () => ID }) id: Id): Promise<IContactGroup> {
		return this.contactGroupService.removeGroup(id);
	}

	/**
	 * Soft-deletes a group, under the spelling the soft-delete route uses.
	 *
	 * The route this field mirrors is the soft-delete route the CRUD base maps, which this domain's
	 * controller restates and routes to the domain's own removal — the same method `deleteContactGroup`
	 * calls, because removal here is soft under either spelling and one operation is not made two by
	 * having two names. Naming the field after the route is what keeps the two surfaces level: a client
	 * that reads `DELETE /contact-groups/:id/soft` finds the capability under this field, carrying the
	 * permission that route carries.
	 */
	@Mutation('softDeleteContactGroup')
	@Permissions(PermissionsEnum.CONTACT_GROUPS_DELETE)
	async softDeleteContactGroup(@Args('id', { type: () => ID }) id: Id): Promise<IContactGroup> {
		return this.contactGroupService.removeGroup(id);
	}

	/**
	 * Streams every change to a contact group of the caller's tenant: the group appearing, being edited
	 * or being removed, and its membership being granted or withdrawn.
	 *
	 * The topic is `<eventName>:<tenantId>`, so a subscription is structurally incapable of receiving
	 * another tenant's event even if the filter below were wrong — the filter is the second line, and it
	 * is where the two narrowing arguments are applied. Both only ever narrow what the credential may
	 * already read: a caller without `CONTACT_GROUPS_VIEW` is refused by the guard before the stream is
	 * opened, and the tenant is taken from the credential rather than from an argument.
	 *
	 * Without a resolved tenant nothing is subscribed to: the topic of an unauthenticated connection is
	 * one no fact is ever published on, so the stream is silent rather than wide.
	 */
	@Subscription('contactGroupChanged', {
		filter: (payload: IContactGroupChangedEnvelope, variables: { groupId?: Id; action?: string }) =>
			Boolean(payload) &&
			payload.tenantId === RequestContext.currentTenantId() &&
			(!variables?.groupId || String(payload.group?.id) === String(variables.groupId)) &&
			(!variables?.action || payload.action === variables.action),
		resolve: (payload: IContactGroupChangedEnvelope) => payload.group
	})
	@Permissions(PermissionsEnum.CONTACT_GROUPS_VIEW)
	contactGroupChanged(
		@Args('groupId', { type: () => ID, nullable: true }) groupId?: Id,
		@Args('action', { type: () => String, nullable: true }) action?: string
	): AsyncIterable<IContactGroupChangedEnvelope> {
		const tenant = String(RequestContext.currentTenantId() ?? '');

		// One topic per announced fact, merged into the one stream the field returns: the group's own
		// changes and its two membership facts are all facts about this aggregate, and a client selects
		// among them with `action` rather than by having to open three connections.
		return mergeSubscriptionStreams(
			CONTACT_GROUP_SUBSCRIBED_EVENT_NAMES.map((eventName) =>
				this.pubSub.asyncIterableIterator<IContactGroupChangedEnvelope>(
					this.pubSub.topicFor(eventName, tenant)
				)
			)
		);
	}
}
