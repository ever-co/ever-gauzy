import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
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
 * carry `RETURNS_VIEW`, and creating, updating and deactivating a reason all carry `RETURNS_CREATE`,
 * which is the value the plugin's catalogue gives the maintenance of the governed list rather than a
 * separate administration permission. The field that resolves a reason's variants answers under the
 * permission the reason is read with, which is the route it is selected through.
 *
 *
 * **The gate is the catalogue's.** `FeatureFlagGuard` is appended to the two permission guards — after
 * them, so a caller with no credential is refused as a credential problem before a tenant's switches are
 * consulted — and the code it reads is `FEATURE_GRAPHQL`, the commerce catalogue's own entry for "the
 * GraphQL endpoint and its resolvers, under the same guards and permissions as REST". The code is
 * imported rather than restated because nothing checks one string against another: a literal that
 * drifted names a code no catalogue row carries, which the guard resolves as disabled, and every field
 * here would then answer `Cannot query field <name>` for every caller with nothing red anywhere.
 */
@Resolver('OrderReturnReason')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
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
