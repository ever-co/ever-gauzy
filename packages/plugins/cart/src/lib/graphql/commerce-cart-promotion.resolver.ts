import { Args, ID, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { IPagination } from '@gauzy/contracts';
import { Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
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
 */
@Resolver('Cart')
@UseGuards(TenantPermissionGuard, PermissionGuard)
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
	 * @returns The cart after the application.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Mutation(() => Object, { name: 'applyCartPromotion' })
	async applyCartPromotion(@Args('input', { type: () => Object }) input: Record<string, any>): Promise<CommerceCart> {
		return this.commerceCartService.applyPromotion(input.cartId, input as any);
	}

	/**
	 * Removes an applied promotion.
	 *
	 * @param cartId The cart.
	 * @param code The promotion's code or id.
	 * @returns The cart after the removal.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Mutation(() => Object, { name: 'removeCartPromotion' })
	async removeCartPromotion(
		@Args('cartId', { type: () => ID }) cartId: string,
		@Args('code', { type: () => String }) code: string
	): Promise<CommerceCart> {
		return this.commerceCartService.removePromotion(cartId, code);
	}
}
