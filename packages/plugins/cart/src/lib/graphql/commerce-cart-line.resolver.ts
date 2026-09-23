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
@Resolver('Cart')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
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
	 * The routing members are taken out of the input before the rest of it is handed to the service:
	 * `cartId` names the aggregate the mutation writes and is not a field of the change set, and this
	 * mutation's argument is declared `Object` rather than a validated input type, so nothing else
	 * strips it. See {@link updateCartLine} for what that cost on the sibling mutation.
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
		const { cartId, ...line } = input ?? {};

		return this.commerceCartService.addLine(cartId, line as any, versionExpectationOf(context?.req));
	}

	/**
	 * Changes a line.
	 *
	 * **`lineId` is a routing member and never a column.** The whole input object used to be forwarded
	 * as the change set, so it reached the ORM's update builder carrying a property `CommerceCartLine`
	 * has no column for — `cartId` is a column, `lineId` is not — and TypeORM raised
	 * `EntityPropertyNotFoundError`, which `CrudService.update` rethrows as a 400. Every well-formed
	 * `updateCartLine` mutation therefore failed, naming a property the caller never meant as a field,
	 * while the REST sibling worked because its validation pipe whitelists the body against a DTO. The
	 * destructure here is the GraphQL half of that guarantee; the service whitelists the change set to
	 * the line's editable columns as the other half, so neither surface can smuggle an unmapped
	 * property into a write.
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
		const { cartId, lineId, ...changes } = input ?? {};

		return this.commerceCartService.updateLine(
			cartId,
			lineId,
			changes as any,
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

	/**
	 * Retires a cart line recoverably, keeping its price snapshot.
	 *
	 * The route it mirrors is `DELETE /cart-lines/:id/soft` — the line addressed by its own id, on the
	 * line's own controller — inherited from `CrudController` and overridden there only to state the
	 * permission the base left unstated. It is deliberately not the cart-level `removeCartLine` above:
	 * that mutation reaches the cart service, which re-prices the cart as it removes the line, while this
	 * pair mirrors the line's own inherited routes and so reaches the line's service, exactly as the two
	 * routes do. A line carries the price the buyer was quoted, so the row is retired rather than dropped
	 * and the recovery below puts it back.
	 *
	 * The permission is the line controller's own for the route — `CARTS_EDIT` — and not the class-level
	 * view grant, because retiring a line changes what the cart costs.
	 *
	 * @param id The cart line to retire.
	 * @returns The line, as the soft delete left it.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Mutation(() => Object, { name: 'softDeleteCommerceCartLine' })
	async softDeleteCommerceCartLine(@Args('id', { type: () => ID }) id: string): Promise<CommerceCartLine> {
		return this.commerceCartLineService.softRemove(id);
	}

	/**
	 * Restores a cart line that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /cart-lines/:id/recover`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. A restored line
	 * is counted into the cart again the next time the cart is read or recalculated.
	 *
	 * @param id The cart line to restore.
	 * @returns The restored line.
	 */
	@Permissions(CART_PERMISSIONS.CARTS_EDIT)
	@Mutation(() => Object, { name: 'recoverCommerceCartLine' })
	async recoverCommerceCartLine(@Args('id', { type: () => ID }) id: string): Promise<CommerceCartLine> {
		return this.commerceCartLineService.softRecover(id);
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
