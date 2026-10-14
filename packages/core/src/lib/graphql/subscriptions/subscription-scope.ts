import { SubscriptionCatalogue, matchesEventSelection } from './subscription-catalogue';

/**
 * Who a subscription belongs to, and what it may receive.
 *
 * This is the authorisation half of the subscription surface, and it is the substance of the
 * feature: a stream that is not scoped is a data leak with a socket in front of it. The scope is
 * resolved once, when the `subscribe` message arrives, from the connection's credential — never from
 * an argument — and then re-checked **per event**, because a permission can be revoked while a
 * connection is open and a connection that keeps delivering after that is worse than one that never
 * delivered at all.
 *
 * The topic a message travels on is `<eventName>:<tenantId>`, so a subscription is structurally
 * incapable of receiving another tenant's message even if a filter is wrong. The checks below are the
 * second line: they are what makes a channel narrowing, a revoked permission and a guessed topic all
 * behave.
 */

/**
 * How the connection authenticated.
 */
export type SubscriptionCredentialKind = 'jwt' | 'api-key';

/**
 * What a caller asks to subscribe to.
 */
export interface SubscriptionScopeInput {
	/** The subscription's identity, used to correlate and to revoke. */
	readonly subscriberId: string;
	/** The connection the subscription belongs to. */
	readonly connectionId?: string;
	/** The tenant the credential belongs to. Required: there is no anonymous subscription. */
	readonly tenantId?: string;
	/** The organization the caller is acting in, when it is scoped to one. */
	readonly organizationId?: string;
	/** The channel the caller narrowed to, when it did. */
	readonly channelId?: string;
	/** The channels this credential may use. A narrowing argument outside it is refused. */
	readonly allowedChannelIds?: readonly string[];
	/** How the connection authenticated. */
	readonly credentialKind?: SubscriptionCredentialKind;
	/** The user id or API key id, for the connection budget. */
	readonly credentialId?: string;
	/** The permission the subscribed resource requires. Re-checked on every event. */
	readonly requiredPermission?: string;
	/**
	 * The permissions the credential held when the subscription opened.
	 *
	 * A snapshot is what makes the per-event check answerable at all: an event arrives from a worker
	 * with no request context behind it, so the credential's permissions have to travel with the
	 * subscription rather than be looked up from the request that is no longer there.
	 */
	readonly permissions?: readonly string[];
	/**
	 * How to ask the live permission source, when the transport has one.
	 *
	 * Supplying it is what makes a revocation take effect on the next event rather than at the next
	 * reconnect; without it the snapshot above decides, and the snapshot cannot change.
	 */
	readonly permissionEvaluator?: (permission: string) => boolean | Promise<boolean>;
	/** The event names or prefix patterns the caller selected. At least one is required. */
	readonly eventNames: readonly string[];
	/** Narrows the stream to one aggregate. It can never widen it. */
	readonly aggregateId?: string;
}

/**
 * A resolved, validated scope.
 */
export interface SubscriptionScope {
	readonly subscriberId: string;
	readonly connectionId: string;
	readonly tenantId: string;
	readonly organizationId?: string;
	readonly channelId?: string;
	readonly allowedChannelIds: readonly string[];
	readonly credentialKind: SubscriptionCredentialKind;
	readonly credentialId: string;
	readonly requiredPermission?: string;
	readonly permissions: readonly string[];
	readonly permissionEvaluator?: (permission: string) => boolean | Promise<boolean>;
	readonly eventNames: readonly string[];
	readonly aggregateId?: string;
}

/**
 * The codes a refused subscription carries. They are the same strings the REST surface returns for
 * the same conditions, so a client that already branches on them does not learn a second vocabulary.
 */
export type SubscriptionScopeCode =
	| 'UNAUTHENTICATED'
	| 'PERMISSION_DENIED'
	| 'SUBSCRIPTION_NO_MATCHING_EVENTS'
	| 'CHANNEL_SCOPE_VIOLATION';

/**
 * Raised when a subscription is refused. A refusal is never silent: a subscription accepted and then
 * quietly dropped is indistinguishable from a system where nothing happened.
 */
export class SubscriptionScopeError extends Error {
	constructor(
		readonly code: SubscriptionScopeCode,
		message: string,
		readonly details?: Readonly<Record<string, unknown>>
	) {
		super(message);
		this.name = 'SubscriptionScopeError';
	}
}

/**
 * The part of an event a delivery decision needs.
 */
export interface SubscriptionEventLike {
	/** `<aggregate>.<action>`. */
	readonly name: string;
	/** The tenant the fact belongs to. An event without one is never delivered. */
	readonly tenantId?: string;
	/** The organization the fact belongs to, when it is organization scoped. */
	readonly organizationId?: string;
	/** The channel the fact belongs to; `null` for a tenant-wide fact. */
	readonly channelId?: string | null;
	/** The aggregate that changed. */
	readonly aggregate?: { readonly type: string; readonly id: string };
}

/**
 * A subscription that passed authorisation, with the concrete events it covers.
 */
export interface AuthorizedSubscription {
	readonly scope: SubscriptionScope;
	/** The catalogue names the scope's selections resolve to, fixed at subscribe time. */
	readonly eventNames: readonly string[];
}

/**
 * Validates and normalises what a caller asked to subscribe to.
 *
 * @param input The request.
 * @returns The scope.
 * @throws SubscriptionScopeError when the request cannot be scoped.
 */
export function resolveSubscriptionScope(input: SubscriptionScopeInput): SubscriptionScope {
	if (!input?.subscriberId) {
		throw new SubscriptionScopeError('UNAUTHENTICATED', 'A subscription must identify its connection.');
	}

	const tenantId = input.tenantId?.trim();
	if (!tenantId) {
		// No tenant, no stream: events are tenant scoped, and a scope without a tenant would either
		// receive nothing or receive everything, and only one of those is acceptable to ship.
		throw new SubscriptionScopeError(
			'UNAUTHENTICATED',
			'The connection carries no tenant, so no event can be delivered to it.'
		);
	}

	const eventNames = (input.eventNames ?? []).map((name) => String(name).trim()).filter((name) => name.length > 0);
	if (eventNames.length === 0) {
		throw new SubscriptionScopeError(
			'SUBSCRIPTION_NO_MATCHING_EVENTS',
			'A subscription must select at least one event name or prefix pattern.'
		);
	}

	const allowedChannelIds = input.allowedChannelIds ?? [];
	if (input.channelId && allowedChannelIds.length > 0 && !allowedChannelIds.includes(input.channelId)) {
		throw new SubscriptionScopeError(
			'CHANNEL_SCOPE_VIOLATION',
			`This credential may not read channel "${input.channelId}".`,
			{ allowed: allowedChannelIds }
		);
	}

	return {
		subscriberId: input.subscriberId,
		connectionId: input.connectionId ?? input.subscriberId,
		tenantId,
		organizationId: input.organizationId,
		channelId: input.channelId,
		allowedChannelIds,
		credentialKind: input.credentialKind ?? 'jwt',
		credentialId: input.credentialId ?? input.subscriberId,
		requiredPermission: input.requiredPermission,
		permissions: input.permissions ?? [],
		permissionEvaluator: input.permissionEvaluator,
		eventNames,
		aggregateId: input.aggregateId
	};
}

/**
 * Decides what a subscription may receive.
 *
 * The permission evaluator is injected rather than read from a global so that the decision is a
 * function of the caller's credential at the moment it is asked. That is what makes a revocation
 * take effect on the next event instead of at the next reconnect.
 */
export class SubscriptionAuthorizer {
	private readonly revoked = new Set<string>();

	/**
	 * @param hasPermission How to ask whether the current credential holds a permission. When it is
	 * absent a scope that declares no required permission is still authorised, and a scope that does
	 * declare one is refused: an unanswerable authorisation question is not a yes.
	 */
	constructor(private readonly hasPermission?: (permission: string) => boolean | Promise<boolean>) {}

	/**
	 * Stops delivering to a subscriber.
	 *
	 * @param subscriberId The subscription's identity.
	 */
	revoke(subscriberId: string): void {
		this.revoked.add(subscriberId);
	}

	/**
	 * Allows delivery to a subscriber again.
	 *
	 * @param subscriberId The subscription's identity.
	 */
	restore(subscriberId: string): void {
		this.revoked.delete(subscriberId);
	}

	/**
	 * Whether a subscriber has been revoked.
	 *
	 * @param subscriberId The subscription's identity.
	 * @returns True when delivery must stop.
	 */
	isRevoked(subscriberId: string): boolean {
		return this.revoked.has(subscriberId);
	}

	/**
	 * Decides whether a subscription may open at all.
	 *
	 * @param scope The resolved scope.
	 * @param catalogue The events this installation streams.
	 * @returns The scope with the concrete events it covers.
	 * @throws SubscriptionScopeError when the subscription is refused.
	 */
	async authorize(
		scope: SubscriptionScope,
		catalogue: SubscriptionCatalogue
	): Promise<AuthorizedSubscription> {
		if (this.isRevoked(scope.subscriberId)) {
			throw new SubscriptionScopeError('PERMISSION_DENIED', 'This connection is no longer authorised.');
		}

		const eventNames = catalogue.resolve(scope.eventNames);
		if (eventNames.length === 0) {
			throw new SubscriptionScopeError(
				'SUBSCRIPTION_NO_MATCHING_EVENTS',
				`No event matches ${scope.eventNames.map((name) => `"${name}"`).join(', ')}.`,
				{ selection: scope.eventNames, available: catalogue.names() }
			);
		}

		if (scope.channelId && scope.credentialKind === 'api-key' && scope.allowedChannelIds.length === 0) {
			// An API key always carries a channel scope. A key that declares none cannot be validated
			// against the channel it asked for, so the narrowing is refused rather than accepted and
			// then ignored — which would deliver a wider stream than the caller asked for.
			throw new SubscriptionScopeError(
				'CHANNEL_SCOPE_VIOLATION',
				'A channel-scoped subscription is not available to a credential with no channel scope.'
			);
		}

		if (scope.requiredPermission) {
			const allowed = await this.ask(scope, scope.requiredPermission);
			if (!allowed) {
				throw new SubscriptionScopeError(
					'PERMISSION_DENIED',
					`This credential does not hold "${scope.requiredPermission}".`,
					{ permission: scope.requiredPermission }
				);
			}
		}

		return { scope, eventNames };
	}

	/**
	 * Decides whether one event may be delivered to one subscription, at the moment of delivery.
	 *
	 * Every check narrows. None of them can widen what the connection resolved at subscribe time, and
	 * a check that cannot be answered refuses.
	 *
	 * @param subscription The authorised subscription.
	 * @param event The event.
	 * @returns True when the event may be delivered.
	 */
	async mayDeliver(subscription: AuthorizedSubscription, event: SubscriptionEventLike): Promise<boolean> {
		const { scope } = subscription;

		if (this.isRevoked(scope.subscriberId)) {
			return false;
		}

		if (!event?.tenantId) {
			return false;
		}

		if (event.tenantId !== scope.tenantId) {
			return false;
		}

		if (scope.organizationId && event.organizationId && event.organizationId !== scope.organizationId) {
			return false;
		}

		// A channel narrowing excludes another channel's facts but not the tenant-wide ones, which
		// carry no channel at all.
		if (scope.channelId && event.channelId && event.channelId !== scope.channelId) {
			return false;
		}

		if (scope.aggregateId && event.aggregate?.id !== scope.aggregateId) {
			return false;
		}

		if (!subscription.eventNames.includes(event.name)) {
			return false;
		}

		if (!scope.eventNames.some((selection) => matchesEventSelection(selection, event.name))) {
			return false;
		}

		if (scope.requiredPermission) {
			return this.ask(scope, scope.requiredPermission);
		}

		return true;
	}

	/**
	 * Asks whether the credential holds a permission.
	 *
	 * The live evaluator the transport supplied wins, so a revoked permission stops the next event.
	 * Without one the snapshot taken at subscribe time decides — which is the honest answer, because
	 * an event arrives with no request context to re-resolve the credential from. An unanswerable
	 * question is a refusal, never a yes.
	 *
	 * @param scope The subscription's scope.
	 * @param permission The permission.
	 * @returns True when the credential holds it.
	 */
	private async ask(scope: SubscriptionScope, permission: string): Promise<boolean> {
		if (scope.permissionEvaluator) {
			try {
				return Boolean(await scope.permissionEvaluator(permission));
			} catch {
				return false;
			}
		}

		if (scope.permissions.length > 0) {
			return scope.permissions.includes(permission);
		}

		if (this.hasPermission) {
			return this.askCredential(permission);
		}

		return false;
	}

	/**
	 * Asks the evaluator the authorizer was constructed with.
	 *
	 * @param permission The permission.
	 * @returns True when the credential holds it.
	 */
	private async askCredential(permission: string): Promise<boolean> {
		try {
			return Boolean(await this.hasPermission?.(permission));
		} catch {
			return false;
		}
	}
}
