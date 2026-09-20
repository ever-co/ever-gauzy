import { UseGuards } from '@nestjs/common';
import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { IOrderReturnLine } from '../../returns.types';
import { ReturnsPermissions } from '../../returns.permissions';
import { subtractQuantities, sumQuantities, toQuantityUnits } from '../../returns.quantity';
import { OrderReturnLine } from '../../order-return-line/order-return-line.entity';
import { OrderReturnLineService } from '../../order-return-line/order-return-line.service';

/**
 * Return lines over GraphQL.
 *
 * The list field is qualified (`orderReturnLines`) rather than named `orderReturnLine` alone, because
 * a line is meaningful only in the context of the return it belongs to, and the fields that need
 * arithmetic — what is still expected back — are resolved here rather than stored, so a line can
 * never disagree with its own quantities.
 *
 * **Authorisation is the controller's.** The class carries the guard chain, the platform's feature gate
 * and the read permission the return-line controller class carries, and both fields state the permission
 * that controller's own list route states — `RETURNS_VIEW`, the same value the return is read with,
 * because a line is read through its return. The platform gate is `FEATURE_GRAPHQL`, imported from the
 * catalogue rather than restated: a literal that drifted would name a code no catalogue row carries,
 * which the guard resolves as disabled and which would refuse every field here for every caller with
 * nothing red anywhere.
 */
@Resolver('OrderReturnLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(ReturnsPermissions.RETURNS_VIEW)
export class OrderReturnLineResolver {
	constructor(private readonly orderReturnLineService: OrderReturnLineService) {}

	/**
	 * Lists the lines of a return.
	 *
	 * @param returnId The return.
	 * @returns The lines.
	 */
	@Query('orderReturnLines')
	@Permissions(ReturnsPermissions.RETURNS_VIEW)
	async orderReturnLines(@Args('returnId') returnId: ID): Promise<OrderReturnLine[]> {
		return await this.orderReturnLineService.findForReturn(returnId);
	}

	/**
	 * Resolves the quantity still expected back on a line.
	 *
	 * @param line The line being read.
	 * @returns The outstanding quantity as an exact decimal string.
	 */
	@ResolveField('outstandingQuantity')
	@Permissions(ReturnsPermissions.RETURNS_VIEW)
	async outstandingQuantity(@Parent() line: IOrderReturnLine): Promise<string> {
		const settled = sumQuantities([line.receivedQuantity, line.damagedQuantity]);

		return toQuantityUnits(settled) >= toQuantityUnits(line.quantity) ? '0' : subtractQuantities(line.quantity, settled);
	}
}
