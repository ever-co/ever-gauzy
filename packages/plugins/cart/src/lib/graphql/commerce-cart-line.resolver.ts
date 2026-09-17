import { Args, ID, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { IPagination } from '@gauzy/contracts';
import { Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { CommerceCartService } from '../commerce-cart/commerce-cart.service';
import { CommerceCartLineService } from '../commerce-cart-line/commerce-cart-line.service';
import { CART_PERMISSIONS } from '../cart.permissions';
import { Cart, CartLine } from './types';

/**
 * The cart's line fields and the line mutations.
 *
 * A line is a child of its cart, so it is reached through the cart's own `lines` field and changed
 * through the cart's mutations. The resolver delegates every rule to the cart service, which is what
 * keeps a GraphQL edit and a REST edit from behaving differently.
 */
@Resolver(() => Cart)
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(CART_PERMISSIONS.CARTS_VIEW)
export class CommerceCartLineResolver {
	constructor(
		private readonly commerceCartService: CommerceCartService,
		private readonly commerceCartLineService: CommerceCartLineService
	) {}

	/**
	 * Resolves a cart's lines.
	 *
	 * @param cart The parent cart.
	 * @returns The cart's lines.
	 */
	@ResolveField('lines', () => [Object], { nullable: true })
	async lines(@Parent() cart: Cart): Promise<CartLine[]> {
		const page = (await this.commerceCartLineService.findAll({
			where: { cartId: cart.id }
		})) as IPagination<CartLine>;

		return page.items;
	}

	/**
	 * Adds a line.
	 *
	 * @param input The line to add.
	 * @returns The cart after the addition.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Mutation(() => Object, { name: 'addCartLine' })
	async addCartLine(@Args('input', { type: () => Object }) input: Record<string, any>): Promise<Cart> {
		return this.commerceCartService.addLine(input.cartId, input as any);
	}

	/**
	 * Changes a line.
	 *
	 * @param input The line and the fields to change.
	 * @returns The cart after the change.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Mutation(() => Object, { name: 'updateCartLine' })
	async updateCartLine(@Args('input', { type: () => Object }) input: Record<string, any>): Promise<Cart> {
		return this.commerceCartService.updateLine(input.cartId, input.lineId, input as any);
	}

	/**
	 * Removes a line.
	 *
	 * @param cartId The cart.
	 * @param lineId The line.
	 * @returns The cart after the removal.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Mutation(() => Object, { name: 'removeCartLine' })
	async removeCartLine(
		@Args('cartId', { type: () => ID }) cartId: string,
		@Args('lineId', { type: () => ID }) lineId: string
	): Promise<Cart> {
		return this.commerceCartService.removeLine(cartId, lineId);
	}
}
