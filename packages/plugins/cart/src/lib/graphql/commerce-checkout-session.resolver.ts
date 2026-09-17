import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { CommerceCheckoutSessionStatus, IPagination } from '@gauzy/contracts';
import { Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { CommerceCartService } from '../commerce-cart/commerce-cart.service';
import { CommerceCheckoutSessionService } from '../commerce-checkout-session/commerce-checkout-session.service';
import { CART_PERMISSIONS } from '../cart.permissions';
import { CheckoutSession, ICheckoutResult, ICheckoutSessionConnection } from './types';

/**
 * The checkout root fields.
 *
 * Completing a checkout is a `CARTS_CHECKOUT` action, not a `CARTS_EDIT` one: it is the point at which
 * a cart becomes a financial document, and the permission exists so that preparing a cart and placing
 * it can be granted separately.
 */
@Resolver(() => CheckoutSession)
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(CART_PERMISSIONS.CARTS_VIEW)
export class CommerceCheckoutSessionResolver {
	constructor(
		private readonly commerceCartService: CommerceCartService,
		private readonly commerceCheckoutSessionService: CommerceCheckoutSessionService
	) {}

	/**
	 * Lists checkout sessions.
	 *
	 * @param cartId Optional cart filter.
	 * @param status Optional status filter.
	 * @returns A page of sessions.
	 */
	@Query(() => Object, { name: 'checkoutSessions' })
	async checkoutSessions(
		@Args('cartId', { type: () => ID, nullable: true }) cartId?: string,
		@Args('status', { type: () => String, nullable: true }) status?: string
	): Promise<ICheckoutSessionConnection> {
		const where = { ...(cartId ? { cartId } : {}), ...(status ? { status } : {}) };
		const page = (await this.commerceCheckoutSessionService.findAll({
			where
		})) as IPagination<CheckoutSession>;

		return { items: page.items, total: page.total };
	}

	/**
	 * Reads one checkout session.
	 *
	 * @param id The session.
	 * @returns The session.
	 */
	@Query(() => Object, { name: 'checkoutSession', nullable: true })
	async checkoutSession(@Args('id', { type: () => ID }) id: string): Promise<CheckoutSession> {
		return this.commerceCheckoutSessionService.findOneByIdString(id);
	}

	/**
	 * Starts a checkout session, or returns the one already open for the cart.
	 *
	 * @param input The cart and the step.
	 * @returns The session.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_CHECKOUT)
	@Mutation(() => Object, { name: 'startCheckout' })
	async startCheckout(@Args('input', { type: () => Object }) input: Record<string, any>): Promise<CheckoutSession> {
		const open = await this.commerceCheckoutSessionService.findOpenForCart(input.cartId);

		if (open) {
			return open;
		}

		return this.commerceCheckoutSessionService.create({
			cartId: input.cartId,
			step: input.step,
			status: CommerceCheckoutSessionStatus.STARTED
		} as any);
	}

	/**
	 * Completes a checkout and places the order.
	 *
	 * @param input The cart and the checkout request.
	 * @returns The order the cart became.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_CHECKOUT)
	@Mutation(() => Object, { name: 'completeCheckout' })
	async completeCheckout(@Args('input', { type: () => Object }) input: Record<string, any>): Promise<ICheckoutResult> {
		const result = await this.commerceCartService.complete(input.cartId, {
			idempotencyKey: input.idempotencyKey,
			paymentSessionId: input.paymentSessionId
		});

		return { orderId: result.orderId, orderNumber: result.orderNumber, cart: result.cart };
	}

	/**
	 * Abandons a checkout by marking its cart abandoned.
	 *
	 * @param cartId The cart.
	 * @returns The abandoned cart.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_CHECKOUT)
	@Mutation(() => Object, { name: 'abandonCheckout' })
	async abandonCheckout(@Args('cartId', { type: () => ID }) cartId: string) {
		return this.commerceCartService.abandon(cartId);
	}
}
