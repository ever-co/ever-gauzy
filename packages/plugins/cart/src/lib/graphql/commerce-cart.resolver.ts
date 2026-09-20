import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
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
import { CART_PERMISSIONS } from '../cart.permissions';
import { CART_STATUSES, isCartStatus } from './filters';
import { Cart, ICartConnection } from './types';

/**
 * The cart root fields.
 *
 * The resolver is a thin adapter: it authenticates and authorises with the same guards and the same
 * permissions the REST controller uses, then calls the same service. A GraphQL caller and a REST
 * caller therefore cannot diverge in what they are allowed to do, and there is no second
 * implementation of any rule here.
 *
 * The same two conventions the controller adopts are adopted here, with the same scope names, so the
 * two protocols answer a retry and a stale version identically. A GraphQL operation always travels
 * over `POST`, so a query states `write: false` explicitly — nothing about the transport says it.
 * The version a caller read and the key it retries under ride beside the input, because one request
 * may select several mutations and neither a header nor the transport could say which of them they
 * belong to.
 */
@Resolver('Cart')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(CART_PERMISSIONS.CARTS_VIEW)
export class CommerceCartResolver {
	constructor(private readonly commerceCartService: CommerceCartService) {}

	/**
	 * Lists carts.
	 *
	 * @param filter The filter arguments.
	 * @returns A page of carts.
	 * @throws BadRequestException when a status is given that the cart does not have.
	 */
	@Versioned({ resource: CommerceCartService, write: false })
	@Query(() => Object, { name: 'carts' })
	async carts(
		@Args('status', { type: () => String, nullable: true }) status?: string,
		@Args('customerId', { type: () => ID, nullable: true }) customerId?: string,
		@Args('email', { type: () => String, nullable: true }) email?: string
	): Promise<ICartConnection> {
		const where: FindOptionsWhere<CommerceCart> = {};

		if (status) {
			if (!isCartStatus(status)) {
				throw new BadRequestException(`The cart status "${status}" is not one of: ${CART_STATUSES.join(', ')}.`);
			}

			where.status = status;
		}
		if (customerId) {
			where.customerId = customerId;
		}
		if (email) {
			where.email = email;
		}

		const page = (await this.commerceCartService.findAll({ where })) as IPagination<Cart>;

		return { items: page.items, total: page.total };
	}

	/**
	 * Reads one cart.
	 *
	 * @param id The cart.
	 * @returns The cart.
	 */
	@Versioned({ resource: CommerceCartService, write: false })
	@Query(() => Object, { name: 'cart', nullable: true })
	async cart(@Args('id', { type: () => ID }) id: string): Promise<CommerceCart> {
		return this.commerceCartService.findOneWithContent(id);
	}

	/**
	 * Creates a cart.
	 *
	 * @param input The cart to create.
	 * @returns The created cart.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Idempotent({ scope: 'cart.create', required: false, resourceType: 'cart' })
	@Versioned({ resource: CommerceCartService, required: false })
	@Mutation(() => Object, { name: 'createCart' })
	async createCart(@Args('input', { type: () => Object }) input: Record<string, any>): Promise<CommerceCart> {
		return this.commerceCartService.create(input);
	}

	/**
	 * Changes a cart's contact details, addresses or note.
	 *
	 * @param id The cart.
	 * @param input The fields to change.
	 * @param context The operation context, which carries the version the caller read the cart at.
	 * @returns The cart after the change.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Versioned({ resource: CommerceCartService })
	@Mutation(() => Object, { name: 'updateCart' })
	async updateCart(
		@Args('id', { type: () => ID }) id: string,
		@Args('input', { type: () => Object }) input: Record<string, any>,
		@Context() context: any
	): Promise<CommerceCart> {
		return this.commerceCartService.applyChanges(id, input as any, versionExpectationOf(context?.req));
	}

	/**
	 * Deletes a cart.
	 *
	 * A deletion is a write to a versioned record even though it overwrites no column, so the caller
	 * states the version it read and a cart that has moved on since is refused rather than removed
	 * from under the change that moved it. The refusal is the guard's: a deletion has no update
	 * statement for the conditional write to predicate.
	 *
	 * @param id The cart.
	 * @returns True when the cart was removed.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_DELETE)
	@Versioned({ resource: CommerceCartService })
	@Mutation(() => Boolean, { name: 'deleteCart' })
	async deleteCart(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
		const result = await this.commerceCartService.delete(id);

		return Boolean(result);
	}

	/**
	 * Attaches a cart to a customer.
	 *
	 * Assigning the buyer is what the cart's expiry, its ownership and its abandonment follow-up are
	 * computed from, so it is a write to the cart like any other and is predicated on the version the
	 * caller read.
	 *
	 * @param id The cart.
	 * @param contactId The customer.
	 * @param context The operation context, which carries the version the caller read the cart at.
	 * @returns The cart after the association.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Versioned({ resource: CommerceCartService })
	@Mutation(() => Object, { name: 'associateCartWithContact' })
	async associateCartWithContact(
		@Args('id', { type: () => ID }) id: string,
		@Args('contactId', { type: () => ID }) contactId: string,
		@Context() context: any
	): Promise<CommerceCart> {
		return this.commerceCartService.applyChanges(
			id,
			{ customerId: contactId } as any,
			versionExpectationOf(context?.req),
			'CUSTOMER_CHANGED'
		);
	}

	/**
	 * Merges one cart into another.
	 *
	 * The guard is told where this mutation names the cart it writes — `targetCartId` rather than the
	 * `id` argument an update uses — so the surviving cart's version is the one compared and the one
	 * published.
	 *
	 * @param targetCartId The cart that survives.
	 * @param sourceCartId The cart that is merged away.
	 * @param context The operation context, which carries the version the caller read the cart at.
	 * @returns The merged cart.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Idempotent({ scope: 'cart.merge', required: false, resourceType: 'cart' })
	@Versioned({
		resource: CommerceCartService,
		identify: (_request: any, context: any) => context?.getArgByIndex?.(1)?.targetCartId
	})
	@Mutation(() => Object, { name: 'mergeCarts' })
	async mergeCarts(
		@Args('targetCartId', { type: () => ID }) targetCartId: string,
		@Args('sourceCartId', { type: () => ID }) sourceCartId: string,
		@Context() context: any
	): Promise<CommerceCart> {
		return this.commerceCartService.merge(targetCartId, sourceCartId, versionExpectationOf(context?.req));
	}
}
