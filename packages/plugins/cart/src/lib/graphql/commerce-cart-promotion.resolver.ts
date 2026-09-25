import { Args, Context, ID, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { IPagination } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	Versioned,
	versionExpectationOf
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { CommerceCart } from '../commerce-cart/commerce-cart.entity';
import { CommerceCartService } from '../commerce-cart/commerce-cart.service';
import { CommerceCartPromotion } from '../commerce-cart-promotion/commerce-cart-promotion.entity';
import { CommerceCartPromotionService } from '../commerce-cart-promotion/commerce-cart-promotion.service';
import { CART_PERMISSIONS } from '../cart.permissions';
import { Cart } from './types';

/**
 * The cart's promotion fields and the promotion mutations.
 *
 * The discount amount is the promotion engine's; applying a promotion records it as a snapshot so that
 * editing the promotion afterwards cannot change what the buyer was already quoted.
 *
 * An applied promotion changes what the cart costs, so both mutations write the cart and are versioned
 * against it, naming it in their own argument rather than in the `id` argument the guard looks for by
 * default.
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
 *
 * No code of this plugin's own stands beside it, and that is deliberate: `FEATURE_CART` is
 * declared by the cart catalogue but stated by none of the controllers serving the same resources,
 * and a code stated here and not there would refuse over GraphQL what REST serves. `FeatureFlagGuard`
 * now requires every code a class states, so the day the routes state it, this class states it with them.
 */
@Resolver('Cart')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(CART_PERMISSIONS.CARTS_VIEW)
export class CommerceCartPromotionResolver {
	constructor(
		private readonly commerceCartService: CommerceCartService,
		private readonly commerceCartPromotionService: CommerceCartPromotionService
	) {}

	/**
	 * Resolves the promotions applied to a cart.
	 *
	 * @param cart The parent cart.
	 * @returns The applied promotions.
	 */
	@ResolveField('promotions', () => [Object], { nullable: true })
	async promotions(@Parent() cart: Cart): Promise<CommerceCartPromotion[]> {
		const page = (await this.commerceCartPromotionService.findAll({
			where: { cartId: cart.id }
		})) as IPagination<CommerceCartPromotion>;

		return page.items;
	}

	/**
	 * Applies a promotion.
	 *
	 * @param input The applied promotion.
	 * @param context The operation context, which carries the version the caller read the cart at.
	 * @returns The cart after the application.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Idempotent({ scope: 'cart.promotion.apply', required: false, resourceType: 'cart_promotion' })
	@Versioned({
		resource: CommerceCartService,
		identify: (_request: any, context: any) => context?.getArgByIndex?.(1)?.input?.cartId
	})
	@Mutation(() => Object, { name: 'applyCartPromotion' })
	async applyCartPromotion(
		@Args('input', { type: () => Object }) input: Record<string, any>,
		@Context() context: any
	): Promise<CommerceCart> {
		return this.commerceCartService.applyPromotion(input.cartId, input as any, versionExpectationOf(context?.req));
	}

	/**
	 * Removes an applied promotion.
	 *
	 * @param cartId The cart.
	 * @param code The promotion's code or id.
	 * @param context The operation context, which carries the version the caller read the cart at.
	 * @returns The cart after the removal.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Versioned({
		resource: CommerceCartService,
		identify: (_request: any, context: any) => context?.getArgByIndex?.(1)?.cartId
	})
	@Mutation(() => Object, { name: 'removeCartPromotion' })
	async removeCartPromotion(
		@Args('cartId', { type: () => ID }) cartId: string,
		@Args('code', { type: () => String }) code: string,
		@Context() context: any
	): Promise<CommerceCart> {
		return this.commerceCartService.removePromotion(cartId, code, versionExpectationOf(context?.req));
	}

	/**
	 * Retires an applied promotion recoverably, keeping the discount it recorded.
	 *
	 * The route it mirrors is `DELETE /cart-promotions/:id/soft` — the applied promotion addressed by its
	 * own id, on its own controller — inherited from `CrudController` and overridden there only to state
	 * the permission the base left unstated. It is deliberately not the cart-level `removeCartPromotion`
	 * above: that mutation reaches the cart service, which re-prices the cart, while this pair mirrors the
	 * applied promotion's own inherited routes and so reaches its service, exactly as the two routes do.
	 * The row is the snapshot of what the buyer was quoted, so it is retired rather than dropped.
	 *
	 * The permission is the controller's own for the route — `CARTS_EDIT` — and not the class-level view
	 * grant, because retiring an applied promotion changes what the cart costs.
	 *
	 * @param id The applied promotion to retire.
	 * @returns The applied promotion, as the soft delete left it.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Mutation(() => Object, { name: 'softDeleteCommerceCartPromotion' })
	async softDeleteCommerceCartPromotion(
		@Args('id', { type: () => ID }) id: string
	): Promise<CommerceCartPromotion> {
		return this.commerceCartPromotionService.softRemove(id);
	}

	/**
	 * Restores an applied promotion that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /cart-promotions/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A restored
	 * promotion is explained against the cart again, at the amount it recorded.
	 *
	 * @param id The applied promotion to restore.
	 * @returns The restored applied promotion.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Mutation(() => Object, { name: 'recoverCommerceCartPromotion' })
	async recoverCommerceCartPromotion(
		@Args('id', { type: () => ID }) id: string
	): Promise<CommerceCartPromotion> {
		return this.commerceCartPromotionService.softRecover(id);
	}
}
