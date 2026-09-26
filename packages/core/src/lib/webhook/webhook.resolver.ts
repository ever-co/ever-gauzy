import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, JsonData, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionFieldKind,
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
// Imported from the files that declare them rather than from this domain's barrel: the barrel exports
// the module, the module declares this resolver, and a resolver that reached its own module through
// the barrel would close a require cycle the boot would then have to survive.
import {
	IRedactedWebhookSubscription,
	IWebhookSubscriptionCredential,
	WebhookSubscriptionService
} from './webhook-subscription.service';
import { IRedactedWebhookDelivery, WebhookDeliveryService } from './webhook-delivery.service';
import {
	IWebhookDeliveryFailedEnvelope,
	IWebhookSubscriptionDisabledEnvelope,
	WEBHOOK_EVENT_NAMES
} from './webhook-event.publisher';

/** The members `CreateWebhookSubscriptionInput` declares in the schema. */
export interface ICreateWebhookSubscriptionInput {
	name: string;
	url: string;
	events: string[];
	channelId?: Id;
	description?: string;
	headers?: Record<string, string>;
	apiVersion?: string;
	metadata?: JsonData;
}

/**
 * The members `UpdateWebhookSubscriptionInput` declares in the schema.
 *
 * The switch, the counters and the secret are deliberately not among them: each has an operation of
 * its own, because each is a different decision from editing an endpoint — and a body that could set
 * `isActive` would switch an endpoint on while keeping the failure count that switched it off.
 */
export interface IUpdateWebhookSubscriptionInput {
	id: Id;
	name?: string;
	url?: string;
	events?: string[];
	channelId?: Id | null;
	description?: string;
	headers?: Record<string, string>;
	apiVersion?: string;
	metadata?: JsonData;
}

/**
 * The fields a subscription list may be filtered and sorted by, and the order it is returned in when
 * the caller states none.
 *
 * This declaration is the resolver's half of the SDL: `WebhookSubscriptionFilter` and
 * `WebhookSubscriptionSortField` are its two renderings, and keeping the three in one file is what
 * makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * **The secret is a member of neither.** It is not filterable, not sortable and not answered: a
 * condition on a value no read produces could only ever be a condition a client cannot verify, and a
 * sort on one would be an order over material the surface refuses to return. The fingerprint is not
 * offered either — it identifies a secret rather than describing a subscription, and the question it
 * answers is asked once, by an operator comparing two rows by eye.
 *
 * `deletedAt` is absent because the delivered list read answers live rows only. The tenant and the
 * organization are absent because both are applied to the criterion from the credential rather than
 * from the caller, so a member here would suggest a scope decision the caller does not have.
 */
const WEBHOOK_SUBSCRIPTION_FILTERABLE: Readonly<Record<string, ConnectionFieldKind>> = {
	id: 'ID',
	name: 'STRING',
	url: 'STRING',
	events: 'JSON',
	channelId: 'ID',
	description: 'STRING',
	headers: 'JSON',
	apiVersion: 'STRING',
	failureCount: 'NUMBER',
	lastSuccessAt: 'DATE',
	lastFailureAt: 'DATE',
	disabledAt: 'DATE',
	isActive: 'BOOLEAN',
	metadata: 'JSON',
	createdAt: 'DATE',
	updatedAt: 'DATE'
};

/** The fields the subscription sort enum offers. */
const WEBHOOK_SUBSCRIPTION_SORTABLE = [
	'createdAt',
	'updatedAt',
	'name',
	'failureCount',
	'lastSuccessAt',
	'lastFailureAt',
	'isActive'
] as const;

/**
 * The fields a delivery list may be filtered and sorted by.
 *
 * Every member is a column of the row, and the one column the row carries that is absent is the
 * stored body: this surface does not answer it, so a condition on it could only ever be a condition a
 * client cannot verify.
 */
const WEBHOOK_DELIVERY_FILTERABLE: Readonly<Record<string, ConnectionFieldKind>> = {
	id: 'ID',
	subscriptionId: 'ID',
	eventId: 'ID',
	eventName: 'STRING',
	status: 'ENUM',
	attemptCount: 'NUMBER',
	responseStatus: 'NUMBER',
	responseBody: 'STRING',
	durationMs: 'NUMBER',
	nextAttemptAt: 'DATE',
	deliveredAt: 'DATE',
	lastError: 'STRING',
	createdAt: 'DATE',
	updatedAt: 'DATE'
};

/** The fields the delivery sort enum offers. */
const WEBHOOK_DELIVERY_SORTABLE = [
	'createdAt',
	'updatedAt',
	'nextAttemptAt',
	'deliveredAt',
	'attemptCount',
	'responseStatus',
	'eventName',
	'status'
] as const;

/**
 * The order the delivered list methods mean when the caller states none.
 *
 * Neither service states an order of its own — both hand the store a criterion and take the rows as
 * they come back — so this is a decision the connection has to make rather than one it reproduces. It
 * is the log's own order: newest first, which is what an operator reads a delivery log in, with the
 * identifier as the second key so the order is total and a cursor walk over it is stable. The
 * delivery log's work-list order is `nextAttemptAt` ascending, and it is offered as a sort key rather
 * than made the default: what is due first is the right order for a queue and the wrong one for a
 * history.
 */
const WEBHOOK_SUBSCRIPTION_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/** The delivery log's default order: newest first, for the reason stated above. */
const WEBHOOK_DELIVERY_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The webhook kernel over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same service method the route behind it calls, with the same
 * payload and the same request facts. Two resources are served here — the endpoints an operator
 * configures and the log of what the platform sent them — and the two streamed facts beside them.
 *
 * **The guard chain and the permission are the controllers'.** The class carries what both
 * controllers carry — both guards, and the class-level read permission — and every field then states
 * the permission its own route runs under, so a field is never narrower or wider than the route it
 * mirrors. The two contending cases read oddly and are nevertheless the parity: the redelivery
 * carries `WEBHOOK_DELIVERIES_RETRY` rather than the edit permission its neighbour carries, because
 * that is what its route carries, and the two subscription fields carry the read permission, because
 * a subscription's authorisation is the subscribed resource's `*_VIEW` permission and nothing weaker.
 *
 * **The gate is the catalogue's, and it is declared once for every field.** `FeatureFlagGuard` is
 * appended to the chain above — after the controllers' two, so a caller with no credential is refused
 * as a credential problem before a tenant's switches are consulted — and the code it reads is
 * `FEATURE_GRAPHQL`, the commerce catalogue's own entry for "the GraphQL endpoint and its resolvers,
 * under the same guards and permissions as REST". The code is imported rather than restated because
 * a literal that drifted names a code no catalogue row carries, which the guard resolves as disabled
 * — so every field below would answer `Cannot query field <name>` for every caller with nothing red
 * anywhere. One statement on the class is what puts every field behind it: the guard reads the
 * metadata with `getAllAndOverride` over the handler and then the class.
 *
 * **The secret is never a field.** Every read below answers the projection the subscription service's
 * own `redact` produces, in which the secret is replaced by a fingerprint; the two operations that
 * generate a secret answer `WebhookSubscriptionCredential`, which is a mutation answer rather than a
 * type, and so cannot be selected by any read. The delivery log's stored body is withheld in the same
 * way, by the projection the delivery service produces.
 *
 * This resolver is declared by `WebhookModule`, beside the services it calls, so the GraphQL host can
 * scan that module for it — a resolver injects services, and a module is what reaches them.
 */
@Resolver('WebhookSubscription')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.WEBHOOKS_VIEW)
export class WebhookResolver {
	constructor(
		private readonly webhookSubscriptionService: WebhookSubscriptionService,
		private readonly webhookDeliveryService: WebhookDeliveryService,
		private readonly pubSub: GraphqlPubSub
	) {}

	/**
	 * The subscriptions of the caller's organization, newest first.
	 */
	@Query('webhookSubscriptions')
	@Permissions(PermissionsEnum.WEBHOOKS_VIEW)
	async webhookSubscriptions(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IRedactedWebhookSubscription>> {
		// The service answers the projections, so the rows this connection narrows already carry no
		// secret — there is no path through this field on which one could be read, filtered or sorted.
		const rows = await this.webhookSubscriptionService.listSubscriptions();

		return buildConnection<IRedactedWebhookSubscription>({
			rows,
			filterable: WEBHOOK_SUBSCRIPTION_FILTERABLE,
			sortable: WEBHOOK_SUBSCRIPTION_SORTABLE,
			defaultSort: WEBHOOK_SUBSCRIPTION_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One subscription of the caller's organization.
	 *
	 * A row that is not there answers `null` rather than a refusal: GraphQL has one answer for "no such
	 * row" on a field that may have none, and the REST route's `404` is that same fact stated in the
	 * other protocol's vocabulary.
	 */
	@Query('webhookSubscription')
	@Permissions(PermissionsEnum.WEBHOOKS_VIEW)
	async webhookSubscription(@Args('id', { type: () => ID }) id: Id): Promise<IRedactedWebhookSubscription | null> {
		try {
			return await this.webhookSubscriptionService.getRedactedSubscription(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * The delivery log of the caller's organization, newest first.
	 */
	@Query('webhookDeliveries')
	@Permissions(PermissionsEnum.WEBHOOKS_VIEW)
	async webhookDeliveries(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IRedactedWebhookDelivery>> {
		const rows = await this.webhookDeliveryService.listDeliveries();

		return buildConnection<IRedactedWebhookDelivery>({
			rows,
			filterable: WEBHOOK_DELIVERY_FILTERABLE,
			sortable: WEBHOOK_DELIVERY_SORTABLE,
			defaultSort: WEBHOOK_DELIVERY_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One delivery of the caller's organization.
	 */
	@Query('webhookDelivery')
	@Permissions(PermissionsEnum.WEBHOOKS_VIEW)
	async webhookDelivery(@Args('id', { type: () => ID }) id: Id): Promise<IRedactedWebhookDelivery | null> {
		try {
			return await this.webhookDeliveryService.getRedactedDelivery(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * Subscribes an endpoint and generates its signing secret.
	 *
	 * The secret is answered here and never again, which is why the answer is the credential type
	 * rather than the subscription: the members the caller states are the ones the delivered write
	 * stores, and the two the service decides — the tenant and the secret — are answered rather than
	 * asked for.
	 */
	@Mutation('createWebhookSubscription')
	@Permissions(PermissionsEnum.WEBHOOKS_CREATE)
	async createWebhookSubscription(
		@Args('input') input: ICreateWebhookSubscriptionInput
	): Promise<IWebhookSubscriptionCredential> {
		return await this.webhookSubscriptionService.createSubscription(input);
	}

	/**
	 * Changes the mutable facts of a subscription a caller names.
	 *
	 * The delivered edit touches the members the body states and leaves the rest as they are, so the
	 * identifier and the stated members are handed over as one payload. `channelId: null` is a
	 * statement rather than an absence — it widens the subscription back to every channel — and an
	 * omitted member leaves the current channel alone, which is the distinction the input's doc
	 * comment states and the service's own `!== undefined` test honours.
	 */
	@Mutation('updateWebhookSubscription')
	@Permissions(PermissionsEnum.WEBHOOKS_EDIT)
	async updateWebhookSubscription(
		@Args('input') input: IUpdateWebhookSubscriptionInput
	): Promise<IRedactedWebhookSubscription> {
		const { id, ...values } = input;

		return await this.webhookSubscriptionService.updateSubscription(id, values);
	}

	/**
	 * Removes a subscription outright, and its delivery log with it by the table's own cascade.
	 *
	 * The delivered store answers its own delete result — a statement about the write, `{ affected }` —
	 * which is not a row and not what a field named `deleteWebhookSubscription` may return; the field
	 * answers the one fact the removal establishes, that it ran.
	 */
	@Mutation('deleteWebhookSubscription')
	@Permissions(PermissionsEnum.WEBHOOKS_DELETE)
	async deleteWebhookSubscription(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.webhookSubscriptionService.delete(id);

		return true;
	}

	/**
	 * Generates a new signing secret.
	 *
	 * The previous secret stays valid for the service's own grace window, and the instant it stops
	 * being accepted is part of the answer — an operator handing a partner a new secret has to be able
	 * to say how long the old one still works, and the delivery runtime signs with both until then.
	 */
	@Mutation('rotateWebhookSecret')
	@Permissions(PermissionsEnum.WEBHOOKS_EDIT)
	async rotateWebhookSecret(@Args('id', { type: () => ID }) id: Id): Promise<IWebhookSubscriptionCredential> {
		return await this.webhookSubscriptionService.rotateSecret(id);
	}

	/**
	 * Switches a subscription back on, resetting the failure counter with it.
	 *
	 * The reset is the service's, not this field's: keeping the count that switched the endpoint off
	 * would switch it off again on its first hiccup.
	 */
	@Mutation('enableWebhookSubscription')
	@Permissions(PermissionsEnum.WEBHOOKS_EDIT)
	async enableWebhookSubscription(@Args('id', { type: () => ID }) id: Id): Promise<IRedactedWebhookSubscription> {
		return await this.webhookSubscriptionService.enable(id);
	}

	/**
	 * Switches a subscription off.
	 *
	 * The fact is announced by the service, so a subscriber of `webhookSubscriptionDisabled` learns of
	 * the switch whether it was thrown here, over REST, or by the circuit breaker in the worker.
	 */
	@Mutation('disableWebhookSubscription')
	@Permissions(PermissionsEnum.WEBHOOKS_EDIT)
	async disableWebhookSubscription(
		@Args('id', { type: () => ID }) id: Id,
		@Args('reason', { type: () => String, nullable: true }) reason?: string
	): Promise<IRedactedWebhookSubscription> {
		return await this.webhookSubscriptionService.disable(id, reason);
	}

	/**
	 * Requeues one delivery for another attempt.
	 *
	 * The answer is the requeued row rather than an attempt's outcome, and that is a property of the
	 * delivered operation rather than of this field: the retry worker is what calls an endpoint, so
	 * neither protocol ever blocks on a partner's server, and the row answers `PENDING`, due
	 * immediately, with the attempt counter reset and the stored payload untouched.
	 */
	@Mutation('redeliverWebhook')
	@Permissions(PermissionsEnum.WEBHOOK_DELIVERIES_RETRY)
	async redeliverWebhook(@Args('id', { type: () => ID }) id: Id): Promise<IRedactedWebhookDelivery> {
		return this.webhookDeliveryService.redact(await this.webhookDeliveryService.requeue(id));
	}

	/**
	 * Streams every attempt an endpoint of the caller's tenant has refused, as it is refused.
	 *
	 * The topic is `<eventName>:<tenantId>`, so a subscription is structurally incapable of receiving
	 * another tenant's event even if the filter below were wrong — the filter is the second line, and
	 * it is where the one narrowing argument is applied. The argument only ever narrows what the
	 * credential may already read: a caller without `WEBHOOKS_VIEW` is refused by the guard before the
	 * stream is opened, and the tenant is taken from the credential rather than from an argument.
	 *
	 * Without a resolved tenant nothing is subscribed to: the topic of an unauthenticated connection
	 * is one no fact is ever published on, so the stream is silent rather than wide.
	 */
	@Subscription('webhookDeliveryFailed', {
		filter: (payload: IWebhookDeliveryFailedEnvelope, variables: { subscriptionId?: Id }) =>
			Boolean(payload) &&
			payload.tenantId === RequestContext.currentTenantId() &&
			(!variables?.subscriptionId ||
				String(payload.delivery?.subscriptionId) === String(variables.subscriptionId)),
		resolve: (payload: IWebhookDeliveryFailedEnvelope) => payload.delivery
	})
	@Permissions(PermissionsEnum.WEBHOOKS_VIEW)
	webhookDeliveryFailed(
		@Args('subscriptionId', { type: () => ID, nullable: true }) subscriptionId?: Id
	): AsyncIterable<IWebhookDeliveryFailedEnvelope> {
		return this.pubSub.asyncIterableIterator<IWebhookDeliveryFailedEnvelope>(
			this.pubSub.topicFor(WEBHOOK_EVENT_NAMES.WEBHOOK_FAILED, String(RequestContext.currentTenantId() ?? ''))
		);
	}

	/**
	 * Streams every subscription of the caller's tenant that has been switched off.
	 *
	 * Both causes travel on the one fact — an operator's switch and the circuit breaker's auto-disable
	 * — because a subscriber watching an integration has to learn that its endpoint stopped being
	 * called whichever of the two decided it. The row answered carries a fingerprint in place of its
	 * secret, exactly as every other read of the resource does.
	 */
	@Subscription('webhookSubscriptionDisabled', {
		filter: (payload: IWebhookSubscriptionDisabledEnvelope, variables: { subscriptionId?: Id }) =>
			Boolean(payload) &&
			payload.tenantId === RequestContext.currentTenantId() &&
			(!variables?.subscriptionId || String(payload.subscription?.id) === String(variables.subscriptionId)),
		resolve: (payload: IWebhookSubscriptionDisabledEnvelope) => payload.subscription
	})
	@Permissions(PermissionsEnum.WEBHOOKS_VIEW)
	webhookSubscriptionDisabled(
		@Args('subscriptionId', { type: () => ID, nullable: true }) subscriptionId?: Id
	): AsyncIterable<IWebhookSubscriptionDisabledEnvelope> {
		return this.pubSub.asyncIterableIterator<IWebhookSubscriptionDisabledEnvelope>(
			this.pubSub.topicFor(WEBHOOK_EVENT_NAMES.WEBHOOK_DISABLED, String(RequestContext.currentTenantId() ?? ''))
		);
	}
}
