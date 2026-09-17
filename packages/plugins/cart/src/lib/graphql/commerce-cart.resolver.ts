import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { IPagination } from '@gauzy/contracts';
import { Permissions, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { CommerceCartService } from '../commerce-cart/commerce-cart.service';
import { CART_PERMISSIONS } from '../cart.permissions';
import { Cart, ICartConnection } from './types';

/**
 * The cart root fields.
 *
 * The resolver is a thin adapter: it authenticates and authorises with the same guards and the same
 * permissions the REST controller uses, then calls the same service. A GraphQL caller and a REST
 * caller therefore cannot diverge in what they are allowed to do, and there is no second
 * implementation of any rule here.
 */
@Resolver(() => Cart)
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(CART_PERMISSIONS.CARTS_VIEW)
export class CommerceCartResolver {
	constructor(private readonly commerceCartService: CommerceCartService) {}

	/**
	 * Lists carts.
	 *
	 * @param filter The filter arguments.
	 * @returns A page of carts.
	 */
	@Query(() => Object, { name: 'carts' })
	async carts(
		@Args('status', { type: () => String, nullable: true }) status?: string,
		@Args('customerId', { type: () => ID, nullable: true }) customerId?: string,
		@Args('email', { type: () => String, nullable: true }) email?: string
	): Promise<ICartConnection> {
		const where = {
			...(status ? { status } : {}),
			...(customerId ? { customerId } : {}),
			...(email ? { email } : {})
		};
		const page = (await this.commerceCartService.findAll({ where })) as IPagination<Cart>;

		return { items: page.items, total: page.total };
	}

	/**
	 * Reads one cart.
	 *
	 * @param id The cart.
	 * @returns The cart.
	 */
	@Query(() => Object, { name: 'cart', nullable: true })
	async cart(@Args('id', { type: () => ID }) id: string): Promise<Cart> {
		return this.commerceCartService.findOneWithContent(id);
	}

	/**
	 * Creates a cart.
	 *
	 * @param input The cart to create.
	 * @returns The created cart.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Mutation(() => Object, { name: 'createCart' })
	async createCart(@Args('input', { type: () => Object }) input: Record<string, any>): Promise<Cart> {
		return this.commerceCartService.create(input);
	}

	/**
	 * Changes a cart's contact details, addresses or note.
	 *
	 * @param id The cart.
	 * @param input The fields to change.
	 * @returns The cart after the change.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Mutation(() => Object, { name: 'updateCart' })
	async updateCart(
		@Args('id', { type: () => ID }) id: string,
		@Args('input', { type: () => Object }) input: Record<string, any>
	): Promise<Cart> {
		await this.commerceCartService.update(id, input as any);

		return this.commerceCartService.recalculate(id, 'CART_UPDATED');
	}

	/**
	 * Deletes a cart.
	 *
	 * @param id The cart.
	 * @returns True when the cart was removed.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_DELETE)
	@Mutation(() => Boolean, { name: 'deleteCart' })
	async deleteCart(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
		const result = await this.commerceCartService.delete(id);

		return Boolean(result);
	}

	/**
	 * Attaches a cart to a customer.
	 *
	 * @param id The cart.
	 * @param contactId The customer.
	 * @returns The cart after the association.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Mutation(() => Object, { name: 'associateCartWithContact' })
	async associateCartWithContact(
		@Args('id', { type: () => ID }) id: string,
		@Args('contactId', { type: () => ID }) contactId: string
	): Promise<Cart> {
		await this.commerceCartService.update(id, { customerId: contactId } as any);

		return this.commerceCartService.recalculate(id, 'CUSTOMER_CHANGED');
	}

	/**
	 * Merges one cart into another.
	 *
	 * @param targetCartId The cart that survives.
	 * @param sourceCartId The cart that is merged away.
	 * @returns The merged cart.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Mutation(() => Object, { name: 'mergeCarts' })
	async mergeCarts(
		@Args('targetCartId', { type: () => ID }) targetCartId: string,
		@Args('sourceCartId', { type: () => ID }) sourceCartId: string
	): Promise<Cart> {
		return this.commerceCartService.merge(targetCartId, sourceCartId);
	}
}
