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
import { IOrderClaimLine } from '../../returns.types';
import { ReturnsPermissions } from '../../returns.permissions';
import { OrderClaimLine } from '../../order-claim-line/order-claim-line.entity';
import { OrderClaimLineService } from '../../order-claim-line/order-claim-line.service';

/**
 * Claim lines over GraphQL.
 *
 * The list field is qualified by the claim it belongs to, because a line has no meaning on its own —
 * it is an answer to a question the claim asked.
 *
 * **The resource's own write routes are answered too, and they are the two the statement above does not
 * cover: this resolver declared no mutation before them.** `softDeleteOrderClaimLine` and
 * `recoverOrderClaimLine` are the `DELETE /order-claim-lines/:id/soft` and `PUT
 * /order-claim-lines/:id/recover` pair the controller inherits and overrides to state a permission, and
 * they are named after the resource rather than qualified by the claim because they act on one line by
 * its own identifier, exactly as those routes do.
 *
 * **Authorisation is the controller's.** The class carries the guard chain, the platform's feature gate
 * and the read permission the claim-line controller class carries, and its read field states the
 * permission the controller's own list route states — `CLAIMS_VIEW`, the same value the claim itself is
 * read with, because a line is read through its claim — while the two fields of the inherited
 * soft-delete pair state `CLAIMS_CREATE`, which is the grant the controller's own `softRemove` and
 * `softRecover` overrides state, because withdrawing a line is a write to the claim that raised it. The
 * platform gate is `FEATURE_GRAPHQL`, imported from the catalogue rather than restated: a literal that
 * drifted would name a code no catalogue row carries, which the guard resolves as disabled and which
 * would refuse every field here for every caller with nothing red anywhere.
 *
 * **The plugin's own gate is stated beside it.** The class also declares `ReturnsFeatures.RETURNS`, the
 * flag every controller of this plugin declares, so a tenant that switched returns off is refused here
 * exactly as `FeatureFlagGuard` refuses its REST routes: before it, a refund, a receipt or a deletion
 * that REST answered with a 404 still ran over GraphQL. The two `@FeatureFlag` statements accumulate on
 * the class, and the guard requires every flag the class declares when a field declares none — which no
 * field here does, because a field-level flag would replace both class-level ones.
 */
@Resolver('OrderClaimLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(ReturnsFeatures.RETURNS)
@Permissions(ReturnsPermissions.CLAIMS_VIEW)
export class OrderClaimLineResolver {
	constructor(private readonly orderClaimLineService: OrderClaimLineService) {}

	/**
	 * Lists the lines of a claim.
	 *
	 * `findForClaim` answers every line of the claim, oldest first, and takes no window of its own, so the
	 * page is cut here: a store-side window would have to restate that order, and one that re-ordered
	 * after the cut would answer a different page than the offset names. The soft-delete flag travels into
	 * that read, because it is the read that decides which rows exist for this caller.
	 *
	 * @param claimId The claim.
	 * @param page The page.
	 * @param withDeleted Whether retired lines are included, as the REST list route's own `withDeleted`
	 * is.
	 * @returns A page of lines, oldest first.
	 */
	@Query('orderClaimLines')
	@Permissions(ReturnsPermissions.CLAIMS_VIEW)
	async orderClaimLines(
		@Args('claimId') claimId: ID,
		@Args('page') page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<OrderClaimLine>> {
		const { skip, take } = resolveConnectionWindow(page);
		const rows = await this.orderClaimLineService.findForClaim(claimId, withDeleted);

		return connectionFromOffsetPage(paginateRows(rows, take, skip), skip);
	}

	/**
	 * Retires a claim line recoverably, keeping the complaint the claim records.
	 *
	 * The route it mirrors is `DELETE /order-claim-lines/:id/soft`, inherited from `CrudController` and
	 * overridden by the controller only to state the permission the base left unstated. This resolver
	 * declared no mutation at all before this field, so a line added over GraphQL could not be taken back
	 * on that protocol, while the REST surface served both routes — and the withdrawal has to be the
	 * recoverable one, because the line is what the resolution is decided from.
	 *
	 * The permission is the controller's own for the route — `CLAIMS_CREATE`, because the plugin declares
	 * no `CLAIMS_DELETE` and a line is maintained under the grant that raises its claim.
	 *
	 * A row-answering field answers the row rather than a payload, which is what the REST route answers
	 * and what a line has to answer here: no payload in this document carries a claim line.
	 *
	 * @param id The claim line to retire.
	 * @returns The line, as the soft delete left it.
	 */
	@Mutation('softDeleteOrderClaimLine')
	@Permissions(ReturnsPermissions.CLAIMS_CREATE)
	async softDeleteOrderClaimLine(@Args('id') id: ID): Promise<OrderClaimLine> {
		return await this.orderClaimLineService.softRemove(id);
	}

	/**
	 * Restores a claim line that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /order-claim-lines/:id/recover`, whose override states the same
	 * `CLAIMS_CREATE` its soft-delete sibling states — a restored line is part of what the claim asks for
	 * again, which is the same write read the other way. Without this field a line retired over GraphQL
	 * could only be brought back over REST, so one lifecycle would be completable on one protocol and not
	 * the other.
	 *
	 * @param id The claim line to restore.
	 * @returns The restored line.
	 */
	@Mutation('recoverOrderClaimLine')
	@Permissions(ReturnsPermissions.CLAIMS_CREATE)
	async recoverOrderClaimLine(@Args('id') id: ID): Promise<OrderClaimLine> {
		return await this.orderClaimLineService.softRecover(id);
	}

	/**
	 * Resolves whether a line is an additional item.
	 *
	 * The flag is derived from what the line names whenever it was not stored, so a line read from an
	 * older row still answers the question the resolution depends on.
	 *
	 * @param line The line being read.
	 * @returns True when the line asks for an item that was never on the order.
	 */
	@ResolveField('isAdditionalItem')
	@Permissions(ReturnsPermissions.CLAIMS_VIEW)
	async isAdditionalItem(@Parent() line: IOrderClaimLine): Promise<boolean> {
		return line.isAdditionalItem ?? !line.orderLineId;
	}
}
