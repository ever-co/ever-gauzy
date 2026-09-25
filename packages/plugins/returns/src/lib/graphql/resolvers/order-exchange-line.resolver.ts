import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	GraphqlConnection,
	IConnectionPageSelection,
	Money,
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
import { IOrderExchangeLine } from '../../returns.types';
import { ReturnsPermissions } from '../../returns.permissions';
import { OrderExchangeLine } from '../../order-exchange-line/order-exchange-line.entity';
import { OrderExchangeLineService } from '../../order-exchange-line/order-exchange-line.service';

/**
 * Outbound exchange lines over GraphQL.
 *
 * The line total is resolved from the snapshotted unit price rather than read from anywhere else, so
 * the value a client displays is the same value `differenceDue` was computed from — through the
 * platform money layer, so the multiplication is exact.
 *
 * **The resource's own write routes are answered too, and they are the two the statement above does not
 * cover: this resolver declared no mutation before them.** `softDeleteOrderExchangeLine` and
 * `recoverOrderExchangeLine` are the `DELETE /order-exchange-lines/:id/soft` and `PUT
 * /order-exchange-lines/:id/recover` pair the controller inherits and overrides to state a permission,
 * and they are named after the resource rather than qualified by the exchange because they act on one
 * line by its own identifier, exactly as those routes do.
 *
 * **Authorisation is the controller's.** The class carries the guard chain, the platform's feature gate
 * and the read permission the exchange-line controller class carries, and its read field states the
 * permission that controller's own list route states — `EXCHANGES_VIEW`, the same value the exchange is
 * read with, because a line is read through its exchange — while the two fields of the inherited
 * soft-delete pair state `EXCHANGES_CREATE`, which is the grant the controller's own `softRemove` and
 * `softRecover` overrides state, because withdrawing a replacement line is a write to the exchange that
 * asked for it. The platform gate is `FEATURE_GRAPHQL`, imported from the catalogue rather than
 * restated: a literal that drifted would name a code no catalogue row carries, which the guard resolves
 * as disabled and which would refuse every field here for every caller with nothing red anywhere.
 *
 * **The plugin's own gate is stated beside it.** The class also declares `ReturnsFeatures.RETURNS`, the
 * flag every controller of this plugin declares, so a tenant that switched returns off is refused here
 * exactly as `FeatureFlagGuard` refuses its REST routes: before it, a refund, a receipt or a deletion
 * that REST answered with a 404 still ran over GraphQL. The two `@FeatureFlag` statements accumulate on
 * the class, and the guard requires every flag the class declares when a field declares none — which no
 * field here does, because a field-level flag would replace both class-level ones.
 */
@Resolver('OrderExchangeLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(ReturnsFeatures.RETURNS)
@Permissions(ReturnsPermissions.EXCHANGES_VIEW)
export class OrderExchangeLineResolver {
	constructor(private readonly orderExchangeLineService: OrderExchangeLineService) {}

	/**
	 * Lists the outbound lines of an exchange.
	 *
	 * `findForExchange` answers every line of the exchange, in the order it was written, and takes no
	 * window of its own, so the page is cut here. Answering the whole set to a caller that stated a page
	 * is the failure this avoids: the client would page a connection whose `pageInfo` never advances. The
	 * soft-delete flag travels into that read, because the read is what decides which rows exist for this
	 * caller.
	 *
	 * @param exchangeId The exchange.
	 * @param page The page.
	 * @param withDeleted Whether retired lines are included, as the REST list route's own `withDeleted`
	 * is.
	 * @returns A page of lines, in the order they were written.
	 */
	@Query('orderExchangeLines')
	@Permissions(ReturnsPermissions.EXCHANGES_VIEW)
	async orderExchangeLines(
		@Args('exchangeId') exchangeId: ID,
		@Args('page') page?: IConnectionPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<OrderExchangeLine>> {
		const { skip, take } = resolveConnectionWindow(page);
		const rows = await this.orderExchangeLineService.findForExchange(exchangeId, withDeleted);

		return connectionFromOffsetPage(paginateRows(rows, take, skip), skip);
	}

	/**
	 * Retires an exchange line recoverably, so the priced difference stays explainable.
	 *
	 * The route it mirrors is `DELETE /order-exchange-lines/:id/soft`, inherited from `CrudController`
	 * and overridden by the controller only to state the permission the base left unstated. This resolver
	 * declared no mutation at all before this field, so a replacement line could not be withdrawn over
	 * GraphQL, while the REST surface served both routes — and `differenceDue` was priced from these
	 * lines, so removing the row outright would leave a charged difference nothing explains.
	 *
	 * The permission is the controller's own for the route — `EXCHANGES_CREATE`, because the plugin
	 * declares no `EXCHANGES_DELETE` and a line is maintained under the grant that requests its exchange.
	 *
	 * A row-answering field answers the row rather than a payload, which is what the REST route answers
	 * and what a line has to answer here: no payload in this document carries an exchange line.
	 *
	 * @param id The exchange line to retire.
	 * @returns The line, as the soft delete left it.
	 */
	@Mutation('softDeleteOrderExchangeLine')
	@Permissions(ReturnsPermissions.EXCHANGES_CREATE)
	async softDeleteOrderExchangeLine(@Args('id') id: ID): Promise<OrderExchangeLine> {
		return await this.orderExchangeLineService.softRemove(id);
	}

	/**
	 * Restores an exchange line that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /order-exchange-lines/:id/recover`, whose override states the same
	 * `EXCHANGES_CREATE` its soft-delete sibling states — a restored line is counted again towards the
	 * difference the exchange priced, which is the same write read the other way. Without this field a
	 * line retired over GraphQL could only be brought back over REST, so one lifecycle would be
	 * completable on one protocol and not the other.
	 *
	 * @param id The exchange line to restore.
	 * @returns The restored line.
	 */
	@Mutation('recoverOrderExchangeLine')
	@Permissions(ReturnsPermissions.EXCHANGES_CREATE)
	async recoverOrderExchangeLine(@Args('id') id: ID): Promise<OrderExchangeLine> {
		return await this.orderExchangeLineService.softRecover(id);
	}

	/**
	 * Resolves the value of one line.
	 *
	 * The currency is stated by the caller because a line belongs to an exchange and the exchange is
	 * where the currency lives; the multiplication runs through the platform money layer, so the value
	 * a client displays is the same value `differenceDue` was computed from.
	 *
	 * @param line The line being read.
	 * @param currency The currency to express the value in.
	 * @returns The line total as an exact decimal string.
	 */
	@ResolveField('lineTotal')
	@Permissions(ReturnsPermissions.EXCHANGES_VIEW)
	async lineTotal(@Parent() line: IOrderExchangeLine, @Args('currency') currency: string): Promise<string> {
		return Money.of(line.unitPrice ?? '0', currency).multiply(line.quantity ?? '0').round().toStorageString();
	}
}
