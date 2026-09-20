import { Args, Context, ID, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { IPagination } from '@gauzy/contracts';
import {
	Idempotent,
	Permissions,
	PermissionGuard,
	TenantPermissionGuard,
	Versioned,
	versionExpectationOf
} from '@gauzy/core';
import { CommerceCart } from '../commerce-cart/commerce-cart.entity';
import { CommerceCartService } from '../commerce-cart/commerce-cart.service';
import { CommerceCartShippingMethod } from '../commerce-cart-shipping-method/commerce-cart-shipping-method.entity';
import { CommerceCartShippingMethodService } from '../commerce-cart-shipping-method/commerce-cart-shipping-method.service';
import { CART_PERMISSIONS } from '../cart.permissions';
import { Cart } from './types';

/**
 * The cart's delivery fields and the delivery mutations.
 *
 * The price is the shipping calculation's, never this resolver's; setting a delivery choice replaces
 * whatever was there, which is why the mutation takes the whole choice rather than a patch.
 *
 * Both mutations write the cart — the choice changes what it costs to send — so both are versioned
 * against the cart, and both name it in their own argument rather than in the `id` argument the guard
 * looks for by default.
 */
@Resolver('Cart')
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
	async shippingMethods(@Parent() cart: Cart): Promise<CommerceCartShippingMethod[]> {
		const page = (await this.commerceCartShippingMethodService.findAll({
			where: { cartId: cart.id }
		})) as IPagination<CommerceCartShippingMethod>;

		return page.items;
	}

	/**
	 * Sets the delivery choice.
	 *
	 * @param input The chosen method.
	 * @param context The operation context, which carries the version the caller read the cart at.
	 * @returns The cart after the choice.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Idempotent({ scope: 'cart.shipping.set', required: false, resourceType: 'cart_shipping_method' })
	@Versioned({
		resource: CommerceCartService,
		identify: (_request: any, context: any) => context?.getArgByIndex?.(1)?.input?.cartId
	})
	@Mutation(() => Object, { name: 'setCartShippingMethod' })
	async setCartShippingMethod(
		@Args('input', { type: () => Object }) input: Record<string, any>,
		@Context() context: any
	): Promise<Cart> {
		return this.commerceCartService.setShippingMethod(input.cartId, input as any, versionExpectationOf(context?.req));
	}

	/**
	 * Clears the delivery choice.
	 *
	 * @param cartId The cart.
	 * @param context The operation context, which carries the version the caller read the cart at.
	 * @returns The cart after the removal.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Versioned({
		resource: CommerceCartService,
		identify: (_request: any, context: any) => context?.getArgByIndex?.(1)?.cartId
	})
	@Mutation(() => Object, { name: 'removeCartShippingMethod' })
	async removeCartShippingMethod(
		@Args('cartId', { type: () => ID }) cartId: string,
		@Context() context: any
	): Promise<CommerceCart> {
		const page = (await this.commerceCartShippingMethodService.findAll({
			where: { cartId }
		})) as IPagination<CommerceCartShippingMethod>;

		for (const method of page.items) {
			await this.commerceCartShippingMethodService.delete(method.id);
		}

		return this.commerceCartService.recalculate(cartId, 'SHIPPING_REMOVED', versionExpectationOf(context?.req));
	}
}
