import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { ReturnsFeatures } from '../../returns.features';
import { toUserError } from '../wire';
import { buildConnection, IPageSelection, resolvePageWindow } from '../pagination';
import { IOrderReturnReason } from '../../returns.types';
import { ReturnsPermissions } from '../../returns.permissions';
import { OrderReturnReason } from '../../order-return-reason/order-return-reason.entity';
import { OrderReturnReasonService } from '../../order-return-reason/order-return-reason.service';

/** The definition of a governed reason, as the schema declares it. */
interface IOrderReturnReasonArgs {
	code: string;
	label: string;
	description?: string;
	parentId?: ID;
	isActive?: boolean;
}

/**
 * Governed return reasons over GraphQL.
 *
 * The delete field deactivates rather than removes, exactly as the REST route does: a reason that has
 * explained a return has to stay readable for as long as that return exists.
 *
 * **Authorisation is the controller's, restated field by field.** The class carries what the reason
 * controller class carries — both protocol guards, the platform's feature gate and the read permission
 * its reads run under — and every field then states the permission its own route states: the two reads
 * carry `RETURNS_VIEW`, creating, updating and deactivating a reason all carry `RETURNS_CREATE`, which
 * is the value the plugin's catalogue gives the maintenance of the governed list rather than a separate
 * administration permission, and both halves of the inherited soft-delete pair carry `RETURNS_CREATE`
 * as well, which is the grant the controller's own `DELETE /order-return-reasons/:id/soft` and
 * `PUT /order-return-reasons/:id/recover` overrides state. The field that resolves a reason's variants
 * answers under the permission the reason is read with, which is the route it is selected through.
 *
 *
 * **The gate is the catalogue's.** `FeatureFlagGuard` is appended to the two permission guards — after
 * them, so a caller with no credential is refused as a credential problem before a tenant's switches are
 * consulted — and the code it reads is `FEATURE_GRAPHQL`, the commerce catalogue's own entry for "the
 * GraphQL endpoint and its resolvers, under the same guards and permissions as REST". The code is
 * imported rather than restated because nothing checks one string against another: a literal that
 * drifted names a code no catalogue row carries, which the guard resolves as disabled, and every field
 * here would then answer `Cannot query field <name>` for every caller with nothing red anywhere.
 *
 * **The plugin's own gate is stated beside it.** The class also declares `ReturnsFeatures.RETURNS`, the
 * flag every controller of this plugin declares, so a tenant that switched returns off is refused here
 * exactly as `FeatureFlagGuard` refuses its REST routes: before it, a refund, a receipt or a deletion
 * that REST answered with a 404 still ran over GraphQL. The two `@FeatureFlag` statements accumulate on
 * the class, and the guard requires every flag the class declares when a field declares none — which no
 * field here does, because a field-level flag would replace both class-level ones.
 */
@Resolver('OrderReturnReason')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(ReturnsFeatures.RETURNS)
@Permissions(ReturnsPermissions.RETURNS_VIEW)
export class OrderReturnReasonResolver {
	constructor(private readonly orderReturnReasonService: OrderReturnReasonService) {}

	/**
	 * Lists the reasons as a two-level tree.
	 *
	 * @param filter The reason filter.
	 * @param page The page.
	 * @param withDeleted Whether retired reasons are included, as the REST list route's own
	 * `withDeleted` is.
	 * @returns One page of reasons.
	 */
	@Query('orderReturnReasons')
	@Permissions(ReturnsPermissions.RETURNS_VIEW)
	async orderReturnReasons(
		@Args('filter') filter?: { isActive?: boolean; parentId?: ID; code?: string },
		@Args('page') page?: IPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	) {
		const { skip, take } = resolvePageWindow(page);
		const result = await this.orderReturnReasonService.findTree({
			where: {
				...(filter?.isActive !== undefined ? { isActive: filter.isActive } : {}),
				...(filter?.parentId ? { parentId: filter.parentId } : {}),
				...(filter?.code ? { code: filter.code } : {})
			},
			skip,
			take,
			order: { code: 'ASC' },
			...(withDeleted ? { withDeleted: true } : {})
		} as any);

		return buildConnection(result, skip);
	}

	/**
	 * Reads one reason.
	 *
	 * @param id The reason.
	 * @returns The reason, or null when it is not the caller's.
	 */
	@Query('orderReturnReason')
	@Permissions(ReturnsPermissions.RETURNS_VIEW)
	async orderReturnReason(@Args('id') id: ID): Promise<OrderReturnReason | null> {
		try {
			return await this.orderReturnReasonService.findOneScoped(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Creates a reason.
	 *
	 * @param input The reason.
	 * @returns The payload.
	 */
	@Mutation('createOrderReturnReason')
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	async createOrderReturnReason(@Args('input') input: IOrderReturnReasonArgs) {
		try {
			return { orderReturnReason: await this.orderReturnReasonService.create(input as any), userErrors: [] };
		} catch (error) {
			return { orderReturnReason: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Updates a reason.
	 *
	 * @param id The reason.
	 * @param input The fields to change.
	 * @returns The payload.
	 */
	@Mutation('updateOrderReturnReason')
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	async updateOrderReturnReason(@Args('id') id: ID, @Args('input') input: IOrderReturnReasonArgs) {
		try {
			return { orderReturnReason: await this.orderReturnReasonService.update(id, input as any), userErrors: [] };
		} catch (error) {
			return { orderReturnReason: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Deactivates a reason.
	 *
	 * @param id The reason.
	 * @returns The payload.
	 */
	@Mutation('deleteOrderReturnReason')
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	async deleteOrderReturnReason(@Args('id') id: ID) {
		try {
			await this.orderReturnReasonService.deactivate(id);

			return { id, userErrors: [] };
		} catch (error) {
			return { id: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Removes a reason physically, which is a different act from deactivating it.
	 *
	 * Three withdrawals now sit on this resource and they are not interchangeable.
	 * `deleteOrderReturnReason` deactivates: the row stays and the returns already filed under it keep
	 * explaining themselves in a report. `softDeleteOrderReturnReason` retires the row recoverably, so it
	 * leaves every read that resolves a reason from a return's cause while remaining there to bring back.
	 * This one removes the row from the database, and it is what `DELETE /order-return-reasons/:id`
	 * serves: `06-api-specification.md` §7.14 declares that route's answer as `DeleteResult`, a
	 * deletion's shape rather than a row's, while the controller answers the same path by deactivating and
	 * keeps the physical removal at `/:id/hard`.
	 *
	 * The reason the distinction matters is the one the service does not enforce: `order_return.reasonId`
	 * is `SET NULL`, so removing a reason that has explained a return nulls the reason on every return
	 * filed under it, and a report that grouped returns by reason code loses them. The handler's own
	 * summary says the route is for "a reason that was never used"; nothing on either surface checks that,
	 * so a caller can reach it for one that was.
	 *
	 * @param id The reason to remove.
	 * @returns The payload, carrying the identifier that was removed.
	 */
	@Mutation('hardDeleteOrderReturnReason')
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	async hardDeleteOrderReturnReason(@Args('id') id: ID) {
		try {
			await this.orderReturnReasonService.delete(id);

			return { id, userErrors: [] };
		} catch (error) {
			return { id: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Retires a governed return reason recoverably, so the returns filed under it stay explainable.
	 *
	 * The route it mirrors is `DELETE /order-return-reasons/:id/soft`, inherited from `CrudController`
	 * and overridden by the controller only to state the permission the base left unstated. It is a
	 * withdrawal distinct from `deleteOrderReturnReason`, which deactivates the reason: a deactivated
	 * reason still explains the returns already filed under it, while a retired row leaves every read that
	 * resolves a reason from a return's cause with nothing to answer — which is exactly why the controller
	 * keeps both, and why the pair has to be reachable from the protocol that maintains the list.
	 *
	 * The permission is the controller's own for the route — `RETURNS_CREATE`, the grant the plugin gives
	 * the maintenance of the governed list, because it declares no `RETURNS_DELETE`.
	 *
	 * The answer is `OrderReturnReasonPayload`, the payload this resource's own write mutations answer and
	 * the only one that carries the reason: `DeleteOrderReturnReasonPayload` carries an identifier and the
	 * refused errors, which cannot answer a restore with the row it restored.
	 *
	 * @param id The reason to retire.
	 * @returns The payload, carrying the reason as the soft delete left it.
	 */
	@Mutation('softDeleteOrderReturnReason')
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	async softDeleteOrderReturnReason(@Args('id') id: ID) {
		try {
			return { orderReturnReason: await this.orderReturnReasonService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { orderReturnReason: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Restores a return reason that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /order-return-reasons/:id/recover`, whose override states the same
	 * `RETURNS_CREATE` its soft-delete sibling states — a restored reason explains the returns filed under
	 * it again and is offered to the next one, which is the same write read the other way. Without this
	 * field a reason retired over GraphQL could only be brought back over REST, so one lifecycle would be
	 * completable on one protocol and not the other.
	 *
	 * @param id The reason to restore.
	 * @returns The payload, carrying the restored reason.
	 */
	@Mutation('recoverOrderReturnReason')
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	async recoverOrderReturnReason(@Args('id') id: ID) {
		try {
			return { orderReturnReason: await this.orderReturnReasonService.softRecover(id), userErrors: [] };
		} catch (error) {
			return { orderReturnReason: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Resolves a reason's variants.
	 *
	 * @param reason The reason being read.
	 * @returns The variants.
	 */
	@ResolveField('children')
	@Permissions(ReturnsPermissions.RETURNS_VIEW)
	async children(@Parent() reason: IOrderReturnReason): Promise<IOrderReturnReason[]> {
		if (Array.isArray(reason.children)) {
			return reason.children;
		}

		return [];
	}
}
