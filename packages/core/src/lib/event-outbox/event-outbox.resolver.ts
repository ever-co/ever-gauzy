import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IEventDelivery, IEventOutbox, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { RequestContext } from '../core/context/request-context';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { GraphqlPubSub } from '../graphql/subscriptions/graphql-pubsub.service';
import { Permissions } from '../shared/decorators';
import { Idempotent } from '../idempotency/idempotent.decorator';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { EventOutboxService } from './event-outbox.service';
import {
	EVENT_DELIVERY_EVENT_NAMES,
	IEventDeliveryChangedEnvelope
} from './event-delivery.publisher';

/**
 * The members `MarkEventDeliveryDeadInput` declares in the schema.
 *
 * The reason is required, for the reason the DTO states at length: a dead letter that does not say
 * why leaves the row's own error column empty, and that column is the diagnosis an operator reads
 * afterwards.
 */
export interface IMarkEventDeliveryDeadInput {
	id: Id;
	reason: string;
}

/**
 * The fields an outbox list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `EventOutboxRecordFilter` and
 * `EventOutboxRecordSortField` are its two renderings, and keeping the three in one file is what
 * makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * Every member is a column of the row. The two documents are stated through the JSON family, which
 * is the only family that can compare them: `payload` carries the event's body and `headers` its
 * correlation and causation facts, and `contains` is what answers "which events mention this
 * aggregate" without the surface pretending to know the body's shape. `deletedAt` is absent because
 * the delivered read answers live rows only, and the tenant and the organization are absent because
 * both are applied to the criterion from the credential rather than from the caller's filter.
 */
const EVENT_OUTBOX_FILTERABLE = {
	id: 'ID',
	eventId: 'ID',
	eventName: 'STRING',
	aggregateType: 'STRING',
	aggregateId: 'ID',
	payload: 'JSON',
	headers: 'JSON',
	status: 'STRING',
	attemptCount: 'NUMBER',
	availableAt: 'DATE',
	publishedAt: 'DATE',
	lastError: 'STRING',
	partitionKey: 'STRING',
	sequence: 'NUMBER',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the outbox sort enum offers. */
const EVENT_OUTBOX_SORTABLE = [
	'createdAt',
	'updatedAt',
	'availableAt',
	'publishedAt',
	'sequence',
	'attemptCount'
] as const;

/**
 * The order the outbox list means: the row whose turn comes first, at the head.
 *
 * The service's own read fixes this order rather than accepting one, because it is part of what the
 * listing *is* — a queue read from its head — so the connection reproduces it as its default instead
 * of inventing a second order that would make the two surfaces return the same rows in two
 * sequences. The identifier breaks the last tie, because a cursor walk is only stable if the order
 * it walks is total.
 */
const EVENT_OUTBOX_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'availableAt', direction: 'ASC' },
	{ field: 'sequence', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The fields a delivery list may be filtered and sorted by.
 *
 * `consumerKey` is the member the dead-letter runbook groups by, and `eventId` is how one event's
 * fan-out is read. There is no document column here at all: every member of a delivery record is a
 * column with a type of its own.
 */
const EVENT_DELIVERY_FILTERABLE = {
	id: 'ID',
	eventId: 'ID',
	consumerKey: 'STRING',
	status: 'STRING',
	attemptCount: 'NUMBER',
	deliveredAt: 'DATE',
	lastError: 'STRING',
	partitionKey: 'STRING',
	sequence: 'NUMBER',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the delivery sort enum offers. */
const EVENT_DELIVERY_SORTABLE = ['createdAt', 'updatedAt', 'deliveredAt', 'attemptCount', 'sequence'] as const;

/**
 * The order the delivery list means: the newest record first.
 *
 * The dead-letter listing is read by opening the newest record and reading its event name, attempt
 * count and error, so the service's read answers newest-first and the connection reproduces that
 * order. `createdAt` is the instant the record was written — before the consumer ran — so it is the
 * order in which deliveries were attempted, not the order in which they finished.
 */
const EVENT_DELIVERY_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The platform's reliability kernel over GraphQL.
 *
 * **Two resources, one resolver, because they are one mechanism.** An outbox row is the durable
 * event and a delivery record is what one consumer did with it; the design fixes four reads, two
 * moves and one stream over the pair, and splitting them across two resolvers would split the guard
 * chain and the parity story that make the two surfaces one capability. The class carries what both
 * controllers carry — both guards, and the inspect permission — and every field then states the
 * permission its own route states.
 *
 * **REST and GraphQL are two views of the same operations.** Every field below calls the same
 * `EventOutboxService` method the route behind it calls, with the same payload, the same request
 * facts and the same tenant: the service is where the caller's scope is applied, so a diagnostic
 * surface cannot become a way to read — or to move — another tenant's records over either protocol.
 *
 * **The moves are the service's, and so are their announcements.** A replay and a dead-letter are
 * written by the service and published from there, which is why no field below publishes anything: a
 * subscriber cannot tell which protocol moved a record, and a third caller of the service would be
 * announced without being asked to remember.
 *
 * **The four reads are the four the design names, and there is no count among them.** A count field
 * exists where a resource serves a count route and answers a bare number; neither of these two
 * serves one — the total a caller wants is the connection's own `totalCount` for the filters it
 * stated, which is the number the REST envelope reports as `total` — so no `Int` field is declared
 * here and none is missing.
 *
 * **The gate is the catalogue's, and it is declared once for every field.** `FeatureFlagGuard` is
 * appended to the chain above — after the controller's two, so a caller with no credential is
 * refused as a credential problem before a tenant's switches are consulted — and the code it reads is
 * `FEATURE_GRAPHQL`, imported rather than restated because a literal that drifted names a code no
 * catalogue row carries and the guard resolves that as disabled, which would close every field below
 * for every caller with nothing red anywhere.
 *
 * This resolver is declared by `EventOutboxModule`, beside the service it calls, so the GraphQL host
 * can scan that module for it — a resolver injects services, and a module is what reaches them.
 */
@Resolver('EventOutboxRecord')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.EVENT_OUTBOX_VIEW)
export class EventOutboxResolver {
	constructor(
		private readonly eventOutboxService: EventOutboxService,
		private readonly pubSub: GraphqlPubSub
	) {}

	/**
	 * The outbox rows of the caller's tenant, the row whose turn comes first at the head.
	 */
	@Query('eventOutbox')
	@Permissions(PermissionsEnum.EVENT_OUTBOX_VIEW)
	async eventOutbox(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IEventOutbox>> {
		// The reader takes the narrowing the list route binds its query string to, and this surface has
		// no query string to bind: the connection protocol states the same narrowing in `filter`, which
		// is applied to the rows the service returns, so the read runs with the route's own defaults.
		const rows = await this.eventOutboxService.listOutboxRows();

		return buildConnection<IEventOutbox>({
			rows,
			filterable: EVENT_OUTBOX_FILTERABLE,
			sortable: EVENT_OUTBOX_SORTABLE,
			defaultSort: EVENT_OUTBOX_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One outbox row of the caller's tenant, or `null` when there is none.
	 *
	 * The REST detail read is the same read, and its `expand=deliveries` member has an expression
	 * here rather than a field of its own: the delivery records of a row are the connections narrowed
	 * by that row's event id, which is the delivered rule that a sub-route is a filter and not a
	 * second root field. The event id — not the row's primary key — is what a delivery record names,
	 * because a record outlives the event it is about and the id is what the consumer, the webhook
	 * signature and a replay all carry.
	 */
	@Query('eventOutboxRecord')
	@Permissions(PermissionsEnum.EVENT_OUTBOX_VIEW)
	async eventOutboxRecord(@Args('id', { type: () => ID }) id: Id): Promise<IEventOutbox | null> {
		return this.eventOutboxService.findOutboxRow(id);
	}

	/**
	 * The delivery records of the caller's tenant, newest first.
	 */
	@Query('eventDeliveries')
	@Permissions(PermissionsEnum.EVENT_OUTBOX_VIEW)
	async eventDeliveries(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IEventDelivery>> {
		const rows = await this.eventOutboxService.listDeliveryRows();

		return buildConnection<IEventDelivery>({
			rows,
			filterable: EVENT_DELIVERY_FILTERABLE,
			sortable: EVENT_DELIVERY_SORTABLE,
			defaultSort: EVENT_DELIVERY_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One delivery record of the caller's tenant, or `null` when there is none.
	 */
	@Query('eventDelivery')
	@Permissions(PermissionsEnum.EVENT_OUTBOX_VIEW)
	async eventDelivery(@Args('id', { type: () => ID }) id: Id): Promise<IEventDelivery | null> {
		return this.eventOutboxService.findDeliveryRow(id);
	}

	/**
	 * Re-drives one consumer's record for an event.
	 *
	 * The same service method the `POST /events/deliveries/:id/replay` route calls, so the attempt
	 * budget is reset and the retry scan re-drives the record on both surfaces. The answer is the
	 * record as it stands afterwards, `PENDING`; a record that is not the caller's is refused by the
	 * service with the same not-found answer the node read gives for it.
	 */
	@Mutation('replayEventDelivery')
	@Permissions(PermissionsEnum.EVENT_OUTBOX_RETRY)
	@Idempotent({ scope: 'event.delivery.replay', resourceType: 'event_delivery' })
	async replayEventDelivery(@Args('id', { type: () => ID }) id: Id): Promise<IEventDelivery> {
		return this.eventOutboxService.replayDelivery(id);
	}

	/**
	 * Dead-letters one consumer's record for an event, with the operator's reason.
	 *
	 * The same service method the `POST /events/deliveries/:id/mark-dead` route calls, and the reason
	 * travels with it onto the record's `lastError`: the answer is the record as it stands afterwards,
	 * `DEAD`, and the reason is the diagnosis the record keeps.
	 */
	@Mutation('markEventDeliveryDead')
	@Permissions(PermissionsEnum.EVENT_OUTBOX_RETRY)
	@Idempotent({ scope: 'event.delivery.mark-dead', resourceType: 'event_delivery' })
	async markEventDeliveryDead(@Args('input') input: IMarkEventDeliveryDeadInput): Promise<IEventDelivery> {
		return this.eventOutboxService.deadLetterDelivery(input.id, input.reason);
	}

	/**
	 * Streams every operator move on a delivery record of the caller's tenant.
	 *
	 * The topic is `<eventName>:<tenantId>`, so a subscription is structurally incapable of receiving
	 * another tenant's fact even if the filter below were wrong — the filter is the second line, and
	 * it is where the two narrowing arguments are applied. Both only ever narrow what the credential
	 * may already read: a caller without `EVENT_OUTBOX_VIEW` is refused by the guard before the stream
	 * is opened, and the tenant is taken from the credential rather than from an argument.
	 *
	 * The producer is `EventOutboxService`, called by the REST route and by the mutation above alike,
	 * so the stream states what the machinery did rather than what one protocol did. Without a
	 * resolved tenant nothing is subscribed to: the topic of an unauthenticated connection is one no
	 * fact is ever published on, so the stream is silent rather than wide.
	 */
	@Subscription('eventDeliveryChanged', {
		filter: (payload: IEventDeliveryChangedEnvelope, variables: { deliveryId?: Id; action?: string }) =>
			Boolean(payload) &&
			payload.tenantId === RequestContext.currentTenantId() &&
			(!variables?.deliveryId || String(payload.delivery?.id) === String(variables.deliveryId)) &&
			(!variables?.action || payload.action === variables.action),
		resolve: (payload: IEventDeliveryChangedEnvelope) => payload.delivery
	})
	@Permissions(PermissionsEnum.EVENT_OUTBOX_VIEW)
	eventDeliveryChanged(
		@Args('deliveryId', { type: () => ID, nullable: true }) deliveryId?: Id,
		@Args('action', { type: () => String, nullable: true }) action?: string
	): AsyncIterable<IEventDeliveryChangedEnvelope> {
		return this.pubSub.asyncIterableIterator<IEventDeliveryChangedEnvelope>(
			this.pubSub.topicFor(
				EVENT_DELIVERY_EVENT_NAMES.EVENT_DELIVERY_CHANGED,
				String(RequestContext.currentTenantId() ?? '')
			)
		);
	}
}
