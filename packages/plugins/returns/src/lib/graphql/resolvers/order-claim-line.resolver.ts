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
 * **Authorisation is the controller's.** The class carries the guard chain, the platform's feature gate
 * and the read permission the claim-line controller class carries, and the list field states the
 * permission the controller's own list route states — `CLAIMS_VIEW`, the same value the claim itself is
 * read with, because a line is read through its claim. The platform gate is `FEATURE_GRAPHQL`, imported
 * from the catalogue rather than restated: a literal that drifted would name a code no catalogue row
 * carries, which the guard resolves as disabled and which would refuse every field here for every
 * caller with nothing red anywhere.
 */
@Resolver('OrderClaimLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
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
