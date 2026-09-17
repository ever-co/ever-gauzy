import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
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
 */
@Resolver('PaymentSession')
@UseGuards(TenantPermissionGuard, PermissionGuard)
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
		@Args('offset') offset?: number
	): Promise<IPaymentSessionConnection> {
		const page = await this.paymentSessionService.findSessions({
			where: withoutRange(filter as Record<string, unknown>),
			order: toOrder(sort, PAYMENT_SESSION_SORT_FIELDS),
			...(limit ? { take: limit } : {}),
			...(offset ? { skip: offset } : {})
		});

		return toConnection(page, (row) => row.id);
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
