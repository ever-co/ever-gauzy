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
	): Promise<IPaymentSessionConnection> {
		const { skip, take } = resolveConnectionWindow({ ...(page ?? {}), limit, offset });
		const listing = await this.paymentSessionService.findSessions({
			where: withoutRange(filter as Record<string, unknown>),
			order: toOrder(sort, PAYMENT_SESSION_SORT_FIELDS),
			skip,
			take
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
}
