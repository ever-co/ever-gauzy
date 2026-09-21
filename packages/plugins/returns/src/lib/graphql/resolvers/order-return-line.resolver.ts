import { UseGuards } from '@nestjs/common';
import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	GraphqlConnection,
	IConnectionPageSelection,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	connectionFromOffsetPage,
	paginateRows,
	resolveConnectionWindow
} from '@gauzy/core';
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
	 * `findForReturn` answers every line of the return, oldest first, and takes no window of its own, so
	 * the page is cut here. A field that declared a page and answered the whole set would leave a client
	 * walking a `pageInfo` that never moves.
	 *
	 * @param returnId The return.
	 * @param page The page.
	 * @returns A page of lines, oldest first.
	 */
	@Query('orderReturnLines')
	@Permissions(ReturnsPermissions.RETURNS_VIEW)
	async orderReturnLines(
		@Args('returnId') returnId: ID,
		@Args('page') page?: IConnectionPageSelection
	): Promise<GraphqlConnection<OrderReturnLine>> {
		const { skip, take } = resolveConnectionWindow(page);
		const rows = await this.orderReturnLineService.findForReturn(returnId);

		return connectionFromOffsetPage(paginateRows(rows, take, skip), skip);
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
