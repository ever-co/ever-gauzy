import { Args, ID, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { IPagination } from '@gauzy/contracts';
import { Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { CommerceCartService } from '../commerce-cart/commerce-cart.service';
import { CommerceCartShippingMethodService } from '../commerce-cart-shipping-method/commerce-cart-shipping-method.service';
import { CART_PERMISSIONS } from '../cart.permissions';
import { Cart, CartShippingMethod } from './types';

/**
 * The cart's delivery fields and the delivery mutations.
 *
 * The price is the shipping calculation's, never this resolver's; setting a delivery choice replaces
 * whatever was there, which is why the mutation takes the whole choice rather than a patch.
 */
@Resolver(() => Cart)
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(CART_PERMISSIONS.CARTS_VIEW)
export class CommerceCartShippingMethodResolver {
	constructor(
		private readonly commerceCartService: CommerceCartService,
		private readonly commerceCartShippingMethodService: CommerceCartShippingMethodService
	) {}

	/**
	 * Resolves a cart's delivery choices.
	 *
	 * @param cart The parent cart.
	 * @returns The cart's delivery choices.
	 */
	@ResolveField('shippingMethods', () => [Object], { nullable: true })
	async shippingMethods(@Parent() cart: Cart): Promise<CartShippingMethod[]> {
		const page = (await this.commerceCartShippingMethodService.findAll({
			where: { cartId: cart.id }
		})) as IPagination<CartShippingMethod>;

		return page.items;
	}

	/**
	 * Sets the delivery choice.
	 *
	 * @param input The chosen method.
	 * @returns The cart after the choice.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Mutation(() => Object, { name: 'setCartShippingMethod' })
	async setCartShippingMethod(@Args('input', { type: () => Object }) input: Record<string, any>): Promise<Cart> {
		return this.commerceCartService.setShippingMethod(input.cartId, input as any);
	}

	/**
	 * Clears the delivery choice.
	 *
	 * @param cartId The cart.
	 * @returns The cart after the removal.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Mutation(() => Object, { name: 'removeCartShippingMethod' })
	async removeCartShippingMethod(@Args('cartId', { type: () => ID }) cartId: string): Promise<Cart> {
		const page = (await this.commerceCartShippingMethodService.findAll({
			where: { cartId }
		})) as IPagination<CartShippingMethod>;

		for (const method of page.items) {
			await this.commerceCartShippingMethodService.delete(method.id);
		}

		return this.commerceCartService.recalculate(cartId, 'SHIPPING_REMOVED');
	}
}
