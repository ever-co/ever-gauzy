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
import { CommerceCartLine } from '../commerce-cart-line/commerce-cart-line.entity';
import { CommerceCartLineService } from '../commerce-cart-line/commerce-cart-line.service';
import { CART_PERMISSIONS } from '../cart.permissions';
import { Cart } from './types';

/**
 * The cart's line fields and the line mutations.
 *
 * A line is a child of its cart, so it is reached through the cart's own `lines` field and changed
 * through the cart's mutations. The resolver delegates every rule to the cart service, which is what
 * keeps a GraphQL edit and a REST edit from behaving differently.
 *
 * Every one of these mutations writes the *cart* — adding a line re-prices it, and the re-priced
 * totals are the cart's columns — so each is versioned against the cart and each names the cart in
 * its own `cartId` member rather than in the `id` argument the guard looks for by default.
 */
@Resolver('Cart')
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
	async lines(@Parent() cart: Cart): Promise<CommerceCartLine[]> {
		const page = (await this.commerceCartLineService.findAll({
			where: { cartId: cart.id }
		})) as IPagination<CommerceCartLine>;

		return page.items;
	}

	/**
	 * Adds a line.
	 *
	 * @param input The line to add.
	 * @param context The operation context, which carries the version the caller read the cart at.
	 * @returns The cart after the addition.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Idempotent({ scope: 'cart.line.create', required: false, resourceType: 'cart_line' })
	@Versioned({ resource: CommerceCartService, identify: cartOfInput })
	@Mutation(() => Object, { name: 'addCartLine' })
	async addCartLine(
		@Args('input', { type: () => Object }) input: Record<string, any>,
		@Context() context: any
	): Promise<CommerceCart> {
		return this.commerceCartService.addLine(input.cartId, input as any, versionExpectationOf(context?.req));
	}

	/**
	 * Changes a line.
	 *
	 * @param input The line and the fields to change.
	 * @param context The operation context, which carries the version the caller read the cart at.
	 * @returns The cart after the change.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Versioned({ resource: CommerceCartService, identify: cartOfInput })
	@Mutation(() => Object, { name: 'updateCartLine' })
	async updateCartLine(
		@Args('input', { type: () => Object }) input: Record<string, any>,
		@Context() context: any
	): Promise<CommerceCart> {
		return this.commerceCartService.updateLine(
			input.cartId,
			input.lineId,
			input as any,
			versionExpectationOf(context?.req)
		);
	}

	/**
	 * Removes a line.
	 *
	 * @param cartId The cart.
	 * @param lineId The line.
	 * @param context The operation context, which carries the version the caller read the cart at.
	 * @returns The cart after the removal.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Versioned({
		resource: CommerceCartService,
		identify: (_request: any, context: any) => context?.getArgByIndex?.(1)?.cartId
	})
	@Mutation(() => Object, { name: 'removeCartLine' })
	async removeCartLine(
		@Args('cartId', { type: () => ID }) cartId: string,
		@Args('lineId', { type: () => ID }) lineId: string,
		@Context() context: any
	): Promise<CommerceCart> {
		return this.commerceCartService.removeLine(cartId, lineId, versionExpectationOf(context?.req));
	}
}

/**
 * The cart a line mutation writes.
 *
 * A line lives inside its cart, and it is the cart's version that moves when a line changes, so the
 * guard is pointed at `input.cartId` — the id these mutations actually name — rather than at the
 * `id` argument it looks for by default.
 *
 * @param _request The transport request, which carries nothing this needs.
 * @param context The execution context, whose arguments carry the input.
 * @returns The cart's id, or undefined when the mutation did not name one.
 */
function cartOfInput(_request: any, context: any): string | undefined {
	return context?.getArgByIndex?.(1)?.input?.cartId;
}
