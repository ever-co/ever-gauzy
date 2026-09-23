import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { CommerceCheckoutSessionStatus, IPagination } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	IConnectionPageSelection,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	Versioned,
	connectionFromOffsetPage,
	resolveConnectionWindow,
	versionExpectationOf
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { CommerceCartService } from '../commerce-cart/commerce-cart.service';
import { CommerceCheckoutSession } from '../commerce-checkout-session/commerce-checkout-session.entity';
import { CommerceCheckoutSessionService } from '../commerce-checkout-session/commerce-checkout-session.service';
import { CART_PERMISSIONS } from '../cart.permissions';
import { CHECKOUT_SESSION_STATUSES, isCheckoutSessionStatus } from './filters';
import { ICheckoutResult, ICheckoutSessionConnection } from './types';

/**
 * The checkout root fields.
 *
 * Completing a checkout is a `CARTS_CHECKOUT` action, not a `CARTS_EDIT` one: it is the point at which
 * a cart becomes a financial document, and the permission exists so that preparing a cart and placing
 * it can be granted separately.
 *
 * A checkout session is not itself optimistically locked — a session is a single writer's progress
 * record — but the cart it completes is, so completing a checkout is versioned against the cart and
 * the caller states the version it read. The mutations a client is expected to retry adopt
 * `@Idempotent(...)` under the same scope names the REST routes declare, which is what makes a retry
 * over either protocol cost one order rather than two.
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
@Resolver('CheckoutSession')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
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
	 * @param page The page.
	 * @param withDeleted Whether retired rows are included.
	 * @returns A page of sessions.
	 * @throws BadRequestException when a status is given that a checkout session does not have.
	 */
	@Versioned({ resource: CommerceCartService, write: false })
	@Query(() => Object, { name: 'checkoutSessions' })
	async checkoutSessions(
		@Args('cartId', { type: () => ID, nullable: true }) cartId?: string,
		@Args('status', { type: () => String, nullable: true }) status?: string,
		@Args('page', { type: () => Object, nullable: true }) page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<ICheckoutSessionConnection> {
		const where: FindOptionsWhere<CommerceCheckoutSession> = {};
		const { skip, take } = resolveConnectionWindow(page);

		if (cartId) {
			where.cartId = cartId;
		}
		if (status) {
			if (!isCheckoutSessionStatus(status)) {
				throw new BadRequestException(
					`The checkout session status "${status}" is not one of: ${CHECKOUT_SESSION_STATUSES.join(', ')}.`
				);
			}

			where.status = status;
		}

		const listing = (await this.commerceCheckoutSessionService.findAll({
			where,
			skip,
			take,
			...(withDeleted ? { withDeleted: true } : {})
		})) as IPagination<CommerceCheckoutSession>;

		return connectionFromOffsetPage(listing, skip);
	}

	/**
	 * Reads one checkout session.
	 *
	 * @param id The session.
	 * @returns The session.
	 */
	@Versioned({ resource: CommerceCartService, write: false })
	@Query(() => Object, { name: 'checkoutSession', nullable: true })
	async checkoutSession(@Args('id', { type: () => ID }) id: string): Promise<CommerceCheckoutSession> {
		return this.commerceCheckoutSessionService.findOneByIdString(id);
	}

	/**
	 * Starts a checkout session, or returns the one already open for the cart.
	 *
	 * @param input The cart and the step.
	 * @returns The session.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_CHECKOUT)
	@Idempotent({ scope: 'checkout.session.create', required: false, resourceType: 'checkout_session' })
	@Mutation(() => Object, { name: 'startCheckout' })
	async startCheckout(@Args('input', { type: () => Object }) input: Record<string, any>): Promise<CommerceCheckoutSession> {
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
	 * The version is the *cart's*: the order the checkout places is made from the cart, and a cart that
	 * has been edited since the caller read it would place an order for contents the caller never saw.
	 * The retry key is what stands between a lost response and a second order, which is why the REST
	 * route of the same operation makes one mandatory.
	 *
	 * @param input The cart and the checkout request.
	 * @param context The operation context, which carries the cart version the caller read.
	 * @returns The order the cart became.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_CHECKOUT)
	@Idempotent({ scope: 'checkout.complete', required: true, resourceType: 'order' })
	@Versioned({
		resource: CommerceCartService,
		identify: (_request: any, context: any) => context?.getArgByIndex?.(1)?.input?.cartId
	})
	@Mutation(() => Object, { name: 'completeCheckout' })
	async completeCheckout(
		@Args('input', { type: () => Object }) input: Record<string, any>,
		@Context() context: any
	): Promise<ICheckoutResult> {
		const result = await this.commerceCartService.complete(
			input.cartId,
			{
				idempotencyKey: input.idempotencyKey,
				paymentSessionId: input.paymentSessionId
			},
			versionExpectationOf(context?.req)
		);

		return { orderId: result.orderId, orderNumber: result.orderNumber, cart: result.cart };
	}

	/**
	 * Abandons a checkout by marking its cart abandoned.
	 *
	 * @param cartId The cart.
	 * @param context The operation context, which carries the version the caller read the cart at.
	 * @returns The abandoned cart.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_CHECKOUT)
	@Versioned({
		resource: CommerceCartService,
		identify: (_request: any, context: any) => context?.getArgByIndex?.(1)?.cartId
	})
	@Mutation(() => Object, { name: 'abandonCheckout' })
	async abandonCheckout(@Args('cartId', { type: () => ID }) cartId: string, @Context() context: any) {
		return this.commerceCartService.abandon(cartId, versionExpectationOf(context?.req));
	}

	/**
	 * Retires a checkout session recoverably, keeping the progress it recorded.
	 *
	 * The route it mirrors is `DELETE /checkout-sessions/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A session is the
	 * record of how far a multi-step or externally hosted checkout got and of the durable operation it
	 * started, which is why the row is retired rather than dropped and the recovery below puts it back.
	 *
	 * The permission is the controller's own for the route — `CARTS_DELETE` — which is the cart's own
	 * deletion grant, because a session is a child row of the cart it converts.
	 *
	 * @param id The session to retire.
	 * @returns The session, as the soft delete left it.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_DELETE)
	@Mutation(() => Object, { name: 'softDeleteCommerceCheckoutSession' })
	async softDeleteCommerceCheckoutSession(@Args('id', { type: () => ID }) id: string): Promise<CommerceCheckoutSession> {
		return this.commerceCheckoutSessionService.softRemove(id);
	}

	/**
	 * Restores a checkout session that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /checkout-sessions/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A restored session
	 * is readable again with the steps it had completed, so a checkout that was retired by mistake can be
	 * resumed rather than restarted.
	 *
	 * @param id The session to restore.
	 * @returns The restored session.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_DELETE)
	@Mutation(() => Object, { name: 'recoverCommerceCheckoutSession' })
	async recoverCommerceCheckoutSession(
		@Args('id', { type: () => ID }) id: string
	): Promise<CommerceCheckoutSession> {
		return this.commerceCheckoutSessionService.softRecover(id);
	}
}
