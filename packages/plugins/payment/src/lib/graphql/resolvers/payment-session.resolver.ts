import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlagGuard, Idempotent, PermissionGuard, Permissions, TenantPermissionGuard,
	IConnectionPageSelection,
	resolveConnectionWindow
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PaymentSessionService } from '../../payment-session/payment-session.service';
import { IPaymentSession } from '../../payment.types';
import { PaymentPermission } from '../../payment.permissions';
import { rejection, toConnection, toOrder } from '../types/connection';
import {
	IAuthorizePaymentSessionGraphInput,
	IAuthorizePaymentSessionPayload,
	IOpenPaymentSessionGraphInput,
	IOpenPaymentSessionPayload,
	IPaymentSessionConnection,
	IPaymentSessionFilter,
	IPaymentSort,
	IRecoverPaymentSessionPayload,
	IRefreshPaymentSessionPayload,
	ISoftDeletePaymentSessionPayload,
	IUpdatePaymentSessionGraphInput,
	IUpdatePaymentSessionPayload,
	IVoidPaymentSessionGraphInput,
	IVoidPaymentSessionPayload,
	PAYMENT_SESSION_SORT_FIELDS,
	withoutRange
} from '../types/payment.types';

/**
 * Payment sessions over GraphQL.
 *
 * The three mutations are the three acts of an attempt — opening it, recording the provider's approval
 * of it and voiding it — and each carries the permission its REST route carries, so a role that may
 * read a session still cannot reserve money with one. The `clientSecret` a session may hold is not part
 * of any projection this resolver answers with: it is a bearer value for the duration of one payment
 * and it belongs to the caller's own client-side flow, not to an authenticated read.
 *
 * Nothing here decides anything. The one active attempt per `(collection, provider)`, the off-session
 * shape, the terminal statuses and the collection's amounts are all rules of the service, which is why
 * the resolver is a transport adapter and the two surfaces cannot drift apart.
 *
 * **The gate is the catalogue's.** `FeatureFlagGuard` is appended to the guard chain this resolver
 * already carried, and the code it reads is `FEATURE_GRAPHQL` — the commerce catalogue's entry for "the
 * GraphQL endpoint and its resolvers, under the same guards and permissions as REST". The code is
 * imported rather than restated because the value has to agree with the catalogue's `code` and nothing
 * checks one string against another: a literal that drifted names a code no catalogue row carries, which
 * the guard resolves as disabled, so every field here would answer `Cannot query field <name>` for every
 * caller with nothing red anywhere. One statement on the class puts every field behind it, and a tenant
 * that switched the capability off is answered the refusal a disabled capability's routes answer with a
 * 404.
 */
@Resolver('PaymentSession')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class PaymentSessionResolver {
	constructor(private readonly paymentSessionService: PaymentSessionService) {}

	/**
	 * Lists the attempts of the caller's organization, superseded ones included.
	 */
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_VIEW as PermissionsEnum)
	@Query('paymentSessions')
	async paymentSessions(
		@Args('filter') filter?: IPaymentSessionFilter,
		@Args('sort') sort?: IPaymentSort,
		@Args('limit') limit?: number,
		@Args('offset') offset?: number,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean,
	): Promise<IPaymentSessionConnection> {
		const { skip, take } = resolveConnectionWindow({ ...(page ?? {}), limit, offset });
		const listing = await this.paymentSessionService.findSessions({
			where: withoutRange(filter as Record<string, unknown>),
			order: toOrder(sort, PAYMENT_SESSION_SORT_FIELDS),
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		});

		return toConnection(listing, skip);
	}

	/**
	 * Reads one attempt with its status, its expiry and the provider it ran against.
	 */
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_VIEW as PermissionsEnum)
	@Query('paymentSession')
	async paymentSession(@Args('id') id: ID): Promise<IPaymentSession> {
		return this.paymentSessionService.findSessionOrFail(id);
	}

	/**
	 * Opens, or switches, the attempt of a `(collection, provider)` pair.
	 */
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_AUTHORIZE as PermissionsEnum)
	// Opening an attempt reserves nothing and the service switches the pair rather than opening a second
	// attempt, so the key is optional here exactly as it is on the REST route, under the same scope.
	@Idempotent({ scope: 'payment.session.create', required: false, resourceType: 'payment_session' })
	@Mutation('openPaymentSession')
	async openPaymentSession(@Args('input') input: IOpenPaymentSessionGraphInput): Promise<IOpenPaymentSessionPayload> {
		try {
			return { paymentSession: await this.paymentSessionService.openSession(input as never), userErrors: [] };
		} catch (error) {
			return { paymentSession: null, ...rejection<IPaymentSession>(error) };
		}
	}

	/**
	 * Records the provider's approval of an attempt and reserves its amount on the collection.
	 */
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_AUTHORIZE as PermissionsEnum)
	// Recording an approval reserves the amount on the collection and the service refuses a session that
	// is already authorised, so the key is optional here exactly as it is on the REST route.
	@Idempotent({ scope: 'payment.session.authorize', required: false, resourceType: 'payment_session' })
	@Mutation('authorizePaymentSession')
	async authorizePaymentSession(
		@Args('input') input: IAuthorizePaymentSessionGraphInput
	): Promise<IAuthorizePaymentSessionPayload> {
		try {
			return {
				paymentSession: await this.paymentSessionService.authorizeSession(input.id, input as never),
				userErrors: []
			};
		} catch (error) {
			return { paymentSession: null, ...rejection<IPaymentSession>(error) };
		}
	}

	/**
	 * Voids an attempt: it is cancelled and the authorisation it holds is released.
	 */
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_CANCEL as PermissionsEnum)
	// Voiding an attempt cancels it and releases the authorisation it holds. The scope names the
	// cancellation itself rather than the surface that carries it, so it is the same scope the REST
	// cancel route declares.
	@Idempotent({ scope: 'payment.cancel', required: false, resourceType: 'payment_session' })
	@Mutation('voidPaymentSession')
	async voidPaymentSession(@Args('input') input: IVoidPaymentSessionGraphInput): Promise<IVoidPaymentSessionPayload> {
		try {
			return {
				paymentSession: await this.paymentSessionService.voidSession(
					input.id,
					input.reason ? { reason: input.reason } : {}
				),
				userErrors: []
			};
		} catch (error) {
			return { paymentSession: null, ...rejection<IPaymentSession>(error) };
		}
	}

	/**
	 * Corrects the recorded fields of an attempt, without running any of its four verbs.
	 *
	 * The route it mirrors is `PUT /payment-sessions/:id`. Opening, authorising, refreshing and voiding
	 * are the four routes that run the operations the domain owns; this is the repair surface for a
	 * row's own fields, which is why it carries the authorising grant rather than the reading one, and
	 * why the service refuses an attempt that is already terminal with `PAYMENT_SESSION_ALREADY_CLOSED`
	 * — a closed attempt is a historical fact about what a provider answered rather than a row to edit.
	 *
	 * **The input is narrower than the route's body, and the difference is the service's own rule.** The
	 * service destructures `status`, `amount`, `currency`, `providerId` and `collectionId` out of its
	 * input and drops them, because those move through the operations that mean something; an input that
	 * promised them would be a write a caller believed it had made. `clientSecret` is the sixth member
	 * the route's DTO accepts and this input does not carry, for the reason the session type states: it
	 * is a bearer value for one caller's client-side flow rather than a fact of the row.
	 *
	 * **No retry key is declared, and that mirrors the route rather than the specification.** The route
	 * declares no `@Idempotent` scope, so a field that declared one would demand of a GraphQL caller
	 * what REST does not demand of a REST caller. `06-api-specification.md` §12.1 says the key is
	 * "Optional but honoured on every other unsafe route", so the route and that section disagree about
	 * this route; the disagreement is recorded here rather than resolved on one surface only.
	 *
	 * @param input The attempt to change and the fields to change.
	 * @returns The payload, carrying the attempt as the write left it.
	 */
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_AUTHORIZE as PermissionsEnum)
	@Mutation('updatePaymentSession')
	async updatePaymentSession(
		@Args('input') input: IUpdatePaymentSessionGraphInput
	): Promise<IUpdatePaymentSessionPayload> {
		// The identifier is separated from the changes before the call, because a path carries it on REST
		// and a GraphQL input has to state it: what the service receives is one shape from both surfaces
		// rather than the input's own `id` travelling into the payload it writes.
		const { id, ...changes } = input;

		try {
			return {
				paymentSession: await this.paymentSessionService.updateSession(id, changes as never),
				userErrors: []
			};
		} catch (error) {
			return { paymentSession: null, ...rejection<IPaymentSession>(error) };
		}
	}

	/**
	 * Re-reads the state of an attempt, closing one that has outlived its lifetime.
	 *
	 * **What the route does is narrower than what the endpoint catalogue says it does.** The route it
	 * mirrors is `POST /payment-sessions/:id/refresh`, which `06-api-specification.md` §7.12 describes
	 * as "Re-poll the provider for the session state", and the delivered service does not re-poll:
	 * `refreshSession` reads the row back and, when the attempt is still open and past its `expiresAt`,
	 * closes it through the same expiry path the sweep uses. What the provider answered is written by
	 * the call that reached the provider, never by a read of it — which is why this operation is the
	 * package's own half of the refresh and why the divergence belongs here, beside the field, rather
	 * than in a claim about a provider call that is not made.
	 *
	 * The permission is the route's own — `PAYMENT_SESSIONS_AUTHORIZE` — and it takes the identifier
	 * alone, because the route's handler takes the path member and no body. No retry key is declared,
	 * as on the route: a refresh is a read of the row plus at most one lifecycle close, and the route
	 * honours no key to mirror.
	 *
	 * @param id The attempt to re-read.
	 * @returns The payload, carrying the attempt as the read left it.
	 */
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_AUTHORIZE as PermissionsEnum)
	@Mutation('refreshPaymentSession')
	async refreshPaymentSession(@Args('id') id: ID): Promise<IRefreshPaymentSessionPayload> {
		try {
			return { paymentSession: await this.paymentSessionService.refreshSession(id), userErrors: [] };
		} catch (error) {
			return { paymentSession: null, ...rejection<IPaymentSession>(error) };
		}
	}

	/**
	 * Retires a payment attempt recoverably, keeping the authorisation it recorded.
	 *
	 * The route it mirrors is `DELETE /payment-sessions/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base declares no metadata for. An
	 * attempt is a historical fact about what a provider answered, so it is withdrawn rather than
	 * removed, and the captures and refunds that reference it keep resolving.
	 *
	 * The permission is the route's own — `PAYMENT_SESSIONS_CANCEL`, the grant the void route carries —
	 * and not the class's view grant. This class states no `@Permissions` of its own, so a field that
	 * stated none would carry no metadata at all, and `PermissionGuard` answers `true` to empty
	 * metadata.
	 *
	 * @param id The attempt to retire.
	 * @returns The payload, carrying the attempt as the soft delete left it.
	 */
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_CANCEL as PermissionsEnum)
	@Mutation('softDeletePaymentSession')
	async softDeletePaymentSession(@Args('id') id: ID): Promise<ISoftDeletePaymentSessionPayload> {
		try {
			return { paymentSession: await this.paymentSessionService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { paymentSession: null, ...rejection<IPaymentSession>(error) };
		}
	}

	/**
	 * Restores a payment attempt that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /payment-sessions/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base declares no metadata for.
	 * Restoring is the cancel grant exercised backwards, so the field states `PAYMENT_SESSIONS_CANCEL`
	 * too — a caller that may release a reservation is a caller that may undo the withdrawal of one.
	 *
	 * @param id The attempt to restore.
	 * @returns The payload, carrying the restored attempt.
	 */
	@Permissions(PaymentPermission.PAYMENT_SESSIONS_CANCEL as PermissionsEnum)
	@Mutation('recoverPaymentSession')
	async recoverPaymentSession(@Args('id') id: ID): Promise<IRecoverPaymentSessionPayload> {
		try {
			return { paymentSession: await this.paymentSessionService.softRecover(id), userErrors: [] };
		} catch (error) {
			return { paymentSession: null, ...rejection<IPaymentSession>(error) };
		}
	}
}
