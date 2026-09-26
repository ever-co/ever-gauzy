import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
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
import { ReturnsFeatures } from '../../returns.features';
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
 * **The resource's own write routes are answered too, and they are the two the statement above does not
 * cover: this resolver declared no mutation before them.** `softDeleteOrderReturnLine` and
 * `recoverOrderReturnLine` are the `DELETE /order-return-lines/:id/soft` and `PUT
 * /order-return-lines/:id/recover` pair the controller inherits and overrides to state a permission,
 * and they are named after the resource rather than qualified by the return because they act on one
 * line by its own identifier, exactly as those routes do. They are declared here rather than beside
 * `orderReturnLines` because a line's retirement is about the line, not about the page it is read on.
 *
 * **Authorisation is the controller's.** The class carries the guard chain, the platform's feature gate
 * and the read permission the return-line controller class carries, and its read field states the
 * permission that controller's own list route states — `RETURNS_VIEW`, the same value the return is read
 * with, because a line is read through its return — while the two fields of the inherited soft-delete
 * pair state `RETURNS_CREATE`, which is the grant the controller's own `softRemove` and `softRecover`
 * overrides state, because retiring a line changes what the return it belongs to is owed. The platform
 * gate is `FEATURE_GRAPHQL`, imported from the catalogue rather than restated: a literal that drifted
 * would name a code no catalogue row carries, which the guard resolves as disabled and which would
 * refuse every field here for every caller with nothing red anywhere.
 *
 * **The plugin's own gate is stated beside it.** The class also declares `ReturnsFeatures.RETURNS`, the
 * flag every controller of this plugin declares, so a tenant that switched returns off is refused here
 * exactly as `FeatureFlagGuard` refuses its REST routes: before it, a refund, a receipt or a deletion
 * that REST answered with a 404 still ran over GraphQL. The two `@FeatureFlag` statements accumulate on
 * the class, and the guard requires every flag the class declares when a field declares none — which no
 * field here does, because a field-level flag would replace both class-level ones.
 */
@Resolver('OrderReturnLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(ReturnsFeatures.RETURNS)
@Permissions(ReturnsPermissions.RETURNS_VIEW)
export class OrderReturnLineResolver {
	constructor(private readonly orderReturnLineService: OrderReturnLineService) {}

	/**
	 * Lists the lines of a return.
	 *
	 * `findForReturn` answers every line of the return, oldest first, and takes no window of its own, so
	 * the page is cut here. A field that declared a page and answered the whole set would leave a client
	 * walking a `pageInfo` that never moves. The soft-delete flag travels into that read rather than
	 * being applied to the rows afterwards: a line replaced by a later write is retired, and whether the
	 * caller may see it is a decision the store makes.
	 *
	 * @param returnId The return.
	 * @param page The page.
	 * @param withDeleted Whether retired lines are included, as the REST list route's own `withDeleted`
	 * is.
	 * @returns A page of lines, oldest first.
	 */
	@Query('orderReturnLines')
	@Permissions(ReturnsPermissions.RETURNS_VIEW)
	async orderReturnLines(
		@Args('returnId') returnId: ID,
		@Args('page') page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<OrderReturnLine>> {
		const { skip, take } = resolveConnectionWindow(page);
		const rows = await this.orderReturnLineService.findForReturn(returnId, withDeleted);

		return connectionFromOffsetPage(paginateRows(rows, take, skip), skip);
	}

	/**
	 * Retires a return line recoverably, so the quantities the return was received against survive.
	 *
	 * The route it mirrors is `DELETE /order-return-lines/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. This resolver
	 * declared no mutation at all before this field, so a line could be corrected over GraphQL but not
	 * withdrawn — while the REST surface served both routes, and a line removed destructively would take
	 * the received and damaged quantities the return's own arithmetic is computed from with it.
	 *
	 * The permission is the controller's own for the route — `RETURNS_CREATE`, because the plugin
	 * declares no `RETURNS_DELETE` and a line is maintained under the grant that writes its return.
	 *
	 * A row-answering field answers the row rather than a payload, which is what the REST route answers
	 * and what a line has to answer here: the payloads this document declares carry a return, a claim, an
	 * exchange or a governed reason, and none of them has a slot for a line.
	 *
	 * @param id The return line to retire.
	 * @returns The line, as the soft delete left it.
	 */
	@Mutation('softDeleteOrderReturnLine')
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	async softDeleteOrderReturnLine(@Args('id') id: ID): Promise<OrderReturnLine> {
		return await this.orderReturnLineService.softRemove(id);
	}

	/**
	 * Restores a return line that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /order-return-lines/:id/recover`, whose override states the same
	 * `RETURNS_CREATE` its soft-delete sibling states — a restored line is counted again by the return it
	 * belongs to, which is the same write read the other way. Without this field a line retired over
	 * GraphQL could only be brought back over REST, so one lifecycle would be completable on one protocol
	 * and not the other.
	 *
	 * @param id The return line to restore.
	 * @returns The restored line.
	 */
	@Mutation('recoverOrderReturnLine')
	@Permissions(ReturnsPermissions.RETURNS_CREATE)
	async recoverOrderReturnLine(@Args('id') id: ID): Promise<OrderReturnLine> {
		return await this.orderReturnLineService.softRecover(id);
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
