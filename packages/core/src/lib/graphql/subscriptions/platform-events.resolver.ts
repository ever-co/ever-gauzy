import { randomUUID } from 'crypto';
import { BadRequestException, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, ID, Resolver, Subscription } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context/request-context';
import { ApiErrorCode } from '../../core/errors/api-error-codes';
import { ApiException } from '../../core/errors/api-exception';
import { FEATURE_GRAPHQL } from '../../feature/graphql-feature.code';
import { RolePermissionService } from '../../role-permission/role-permission.service';
import { Permissions } from '../../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { currentSubscriberScope, deliverPayloadAsIs } from './plugin-subscription';
import { SubscriptionMessage } from './subscription-delivery';
import { GraphqlSubscriptionHub, SubscriptionEnvelope } from './subscription-hub.service';
import { DEFAULT_SUBSCRIPTION_LIMITS, SubscriptionLimitError } from './subscription-limits';
import { SubscriptionScopeError, SubscriptionScopeInput } from './subscription-scope';

/**
 * What a subscriber of `Subscription.events` receives for one event: the kernel schema's `EventEnvelope`.
 */
export interface IPlatformEventEnvelope {
	/** The event identity, which a consumer applies its effects under. */
	readonly eventId: string;
	/** `<aggregate>.<action>`. */
	readonly eventName: string;
	/** When the fact happened. */
	readonly occurredAt: Date | string;
	/** The aggregate that changed. */
	readonly aggregate: { readonly type: string; readonly id: string };
	/** Monotonic within the tenant, when the event has a sequence that fits the schema's `Int`. */
	readonly sequence: number | null;
	/** The catalogued payload. */
	readonly data: unknown;
}

/** The largest value the schema's `Int` carries. A sequence past it is served as null, never truncated. */
const GRAPHQL_INT_MAX = 2 ** 31 - 1;

/** How long a permission answer is reused before the role is asked again. */
const PERMISSION_ANSWER_TTL_MS = 60_000;

/**
 * The kernel's own subscription field: the platform event stream, selected by name.
 *
 * `Subscription.events` was declared in `common.type.gql` with nothing bound to it, so a client that
 * subscribed was accepted by validation and then answered nothing — the one failure a stream cannot be
 * told apart from a quiet platform. It is served here over `GraphqlSubscriptionHub`, the place every
 * subscription of the catalogued events is opened, fed and closed: the outbox consumer forwards each
 * durable event a package declared, and a domain's publisher publishes its in-process facts, onto
 * `<eventName>:<tenantId>`; the hub opens the subscriber's own tenant topics and decides on every event
 * again (tenant, organization, channel, aggregate, selection, permission) before it is delivered.
 *
 * **Its REST twin is `GET /events/outbox`**, which lists the same events with the same `data`, and the
 * field states the same grant (`EVENT_OUTBOX_VIEW`) — so the stream is never a way to read an event the
 * listing would withhold. The listing answers the caller's organization **and** the tenant-wide events
 * (no organization); the hub alone would hand an organization-less caller every organization's events,
 * so that case is narrowed here to the tenant-wide ones, which is what the listing answers it.
 *
 * The scope is the credential's, never an argument's: the tenant and the organization are captured from
 * the request context when the subscription opens (and a caller without a tenant is refused), and the
 * arguments only narrow — `channelId` to one channel the credential may use, `aggregateId` to one
 * aggregate. The permission is asked again, live, as events arrive, so a role that loses the grant stops
 * receiving within a minute rather than at its next reconnect.
 */
@Resolver()
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class PlatformEventsResolver {
	constructor(
		private readonly hub: GraphqlSubscriptionHub,
		private readonly rolePermissionService: RolePermissionService
	) {}

	/**
	 * Streams the catalogued events the subscriber selected, one event per message.
	 *
	 * @param names Exact event names or one-segment prefix patterns (`order.*`).
	 * @param aggregateId One aggregate to narrow the stream to.
	 * @param channelId One channel of the credential's scope to narrow the stream to.
	 * @returns The stream.
	 * @throws UnauthorizedException when the operation carries no tenant.
	 * @throws BadRequestException when the selection matches no catalogued event.
	 * @throws ApiException `PERMISSION_DENIED`, `CHANNEL_SCOPE_VIOLATION` or `RATE_LIMITED` when the hub
	 * refuses the subscription.
	 */
	@Subscription('events', { resolve: deliverPayloadAsIs })
	@Permissions(PermissionsEnum.EVENT_OUTBOX_VIEW)
	async events(
		@Args('names', { type: () => [String] }) names: string[],
		@Args('aggregateId', { type: () => ID, nullable: true }) aggregateId?: Id,
		@Args('channelId', { type: () => ID, nullable: true }) channelId?: Id
	): Promise<AsyncIterableIterator<IPlatformEventEnvelope>> {
		const scope = currentSubscriberScope();
		const userId = RequestContext.currentUserId();
		const roleId = RequestContext.currentRoleId();

		return openPlatformEventStream(this.hub, {
			subscriberId: `${userId ?? 'credential'}#${randomUUID()}`,
			tenantId: scope.tenantId,
			organizationId: scope.organizationId,
			channelId: channelId ? String(channelId) : undefined,
			credentialKind: presentsApiKey() ? 'api-key' : 'jwt',
			credentialId: userId ? String(userId) : undefined,
			requiredPermission: PermissionsEnum.EVENT_OUTBOX_VIEW,
			permissionEvaluator: rolePermissionEvaluator(this.rolePermissionService, scope.tenantId, roleId),
			eventNames: names ?? [],
			aggregateId: aggregateId ? String(aggregateId) : undefined
		});
	}
}

/**
 * Opens a hub subscription and adapts its messages to the async iterator a subscription field returns.
 *
 * The hub writes to a sink — one message per coalescing window, which may carry several envelopes of one
 * event name — and graphql-js pulls from an iterator; each envelope becomes one `EventEnvelope`, so a
 * message never merges unrelated facts. Envelopes the subscriber has not pulled yet are buffered up to the
 * subscription limit's queue depth; past it the stream ends so the client reconnects and re-reads.
 * Ending the iterator closes the hub subscription, which releases its topics and its slot.
 *
 * @param hub The hub.
 * @param input The subscription, scoped from the credential.
 * @returns The stream.
 * @throws The refusal the hub answered, as the HTTP-shaped error the GraphQL error contract renders.
 */
export async function openPlatformEventStream(
	hub: GraphqlSubscriptionHub,
	input: SubscriptionScopeInput
): Promise<AsyncIterableIterator<IPlatformEventEnvelope>> {
	const buffered: IPlatformEventEnvelope[] = [];
	const waiting: Array<(result: IteratorResult<IPlatformEventEnvelope>) => void> = [];
	let closed = false;
	let subscriptionId: string | undefined;

	const end = (): void => {
		if (closed) {
			return;
		}

		closed = true;
		buffered.length = 0;

		if (subscriptionId) {
			hub.close(subscriptionId);
		}

		for (const resolve of waiting.splice(0)) {
			resolve({ value: undefined, done: true });
		}
	};

	const sink = (message: SubscriptionMessage): void => {
		for (const payload of message?.payloads ?? []) {
			const envelope = toPlatformEventEnvelope(payload as SubscriptionEnvelope, input);

			if (!envelope || closed) {
				continue;
			}

			const resolve = waiting.shift();
			if (resolve) {
				resolve({ value: envelope, done: false });
				continue;
			}

			if (buffered.length >= DEFAULT_SUBSCRIPTION_LIMITS.maxQueueDepth) {
				end();
				return;
			}

			buffered.push(envelope);
		}
	};

	try {
		subscriptionId = (await hub.subscribe(input, sink)).id;
	} catch (error) {
		throw asRefusal(error);
	}

	const iterator: AsyncIterableIterator<IPlatformEventEnvelope> = {
		next: (): Promise<IteratorResult<IPlatformEventEnvelope>> => {
			if (buffered.length > 0) {
				return Promise.resolve({ value: buffered.shift() as IPlatformEventEnvelope, done: false });
			}

			if (closed) {
				return Promise.resolve({ value: undefined, done: true });
			}

			return new Promise((resolve) => waiting.push(resolve));
		},
		return: (): Promise<IteratorResult<IPlatformEventEnvelope>> => {
			end();
			return Promise.resolve({ value: undefined, done: true });
		},
		throw: (error?: unknown): Promise<IteratorResult<IPlatformEventEnvelope>> => {
			end();
			return Promise.reject(error);
		},
		[Symbol.asyncIterator]() {
			return iterator;
		}
	};

	return iterator;
}

/**
 * Reads one hub envelope as the schema's `EventEnvelope`, or nothing when it may not be delivered.
 *
 * The hub has already decided on the tenant, the organization, the channel and the selection. The checks
 * repeated here are the ones that are this field's own: an organization-less subscriber receives only
 * tenant-wide events (what its REST twin answers it), and an envelope that cannot fill the schema's
 * non-null members is withheld rather than delivered as an error frame.
 *
 * @param payload The hub envelope.
 * @param scope The subscription.
 * @returns The envelope to deliver, or undefined.
 */
export function toPlatformEventEnvelope(
	payload: SubscriptionEnvelope | undefined,
	scope: Pick<SubscriptionScopeInput, 'tenantId' | 'organizationId'>
): IPlatformEventEnvelope | undefined {
	if (!payload || typeof payload.name !== 'string' || !payload.eventId) {
		return undefined;
	}

	if (!payload.tenantId || String(payload.tenantId) !== String(scope.tenantId)) {
		return undefined;
	}

	if (!scope.organizationId && payload.organizationId) {
		return undefined;
	}

	const aggregate = payload.aggregate;
	if (!aggregate?.type || !aggregate?.id) {
		return undefined;
	}

	const sequence = payload.sequence;

	return {
		eventId: String(payload.eventId),
		eventName: payload.name,
		occurredAt: payload.occurredAt ?? new Date(),
		aggregate: { type: String(aggregate.type), id: String(aggregate.id) },
		sequence:
			typeof sequence === 'number' && Number.isInteger(sequence) && Math.abs(sequence) <= GRAPHQL_INT_MAX
				? sequence
				: null,
		data: payload.data ?? {}
	};
}

/**
 * The live permission question the hub asks on every event: the same role-permission check
 * `PermissionGuard` makes, answered from a short-lived memo so a busy stream does not query the role table
 * once per event.
 *
 * @param service The role-permission service.
 * @param tenantId The subscriber's tenant.
 * @param roleId The subscriber's role, when it has one.
 * @returns The evaluator.
 */
export function rolePermissionEvaluator(
	service: Pick<RolePermissionService, 'checkRolePermission'>,
	tenantId: string,
	roleId: Id | null | undefined
): (permission: string) => Promise<boolean> {
	const answers = new Map<string, { at: number; allowed: Promise<boolean> }>();

	return (permission: string): Promise<boolean> => {
		if (!roleId) {
			return Promise.resolve(false);
		}

		const remembered = answers.get(permission);
		if (remembered && Date.now() - remembered.at < PERMISSION_ANSWER_TTL_MS) {
			return remembered.allowed;
		}

		const allowed = service
			.checkRolePermission(tenantId, String(roleId), [permission], true)
			.then(Boolean, () => false);
		answers.set(permission, { at: Date.now(), allowed });

		return allowed;
	};
}

/**
 * Whether the operation authenticated with an API key pair rather than a bearer token.
 *
 * @returns True for a key pair.
 */
function presentsApiKey(): boolean {
	const headers = (RequestContext.currentRequest()?.headers ?? {}) as Record<string, unknown>;

	return Boolean(headers['x-app-id']) && Boolean(headers['x-api-key']) && !headers['authorization'];
}

/**
 * The hub's refusal, in the shape the GraphQL error contract renders with a stable code.
 *
 * @param error What the hub threw.
 * @returns The error to throw.
 */
function asRefusal(error: unknown): unknown {
	if (error instanceof SubscriptionScopeError) {
		switch (error.code) {
			case 'UNAUTHENTICATED':
				return new UnauthorizedException(error.message);
			case 'SUBSCRIPTION_NO_MATCHING_EVENTS':
				return new BadRequestException({ message: error.message, ...(error.details ?? {}) });
			case 'CHANNEL_SCOPE_VIOLATION':
				return new ApiException(403, ApiErrorCode.CHANNEL_SCOPE_VIOLATION, error.message, error.details);
			default:
				return new ApiException(403, ApiErrorCode.PERMISSION_DENIED, error.message, error.details);
		}
	}

	if (error instanceof SubscriptionLimitError) {
		return new ApiException(429, ApiErrorCode.RATE_LIMITED, error.message, { code: error.code });
	}

	return error;
}
