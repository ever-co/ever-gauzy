import { UseGuards } from '@nestjs/common';
import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, Money, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
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
 * **Authorisation is the controller's.** The class carries the guard chain, the platform's feature gate
 * and the read permission the exchange-line controller class carries, and both fields state the
 * permission that controller's own list route states — `EXCHANGES_VIEW`, the same value the exchange is
 * read with, because a line is read through its exchange. The platform gate is `FEATURE_GRAPHQL`,
 * imported from the catalogue rather than restated: a literal that drifted would name a code no
 * catalogue row carries, which the guard resolves as disabled and which would refuse every field here
 * for every caller with nothing red anywhere.
 */
@Resolver('OrderExchangeLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(ReturnsPermissions.EXCHANGES_VIEW)
export class OrderExchangeLineResolver {
	constructor(private readonly orderExchangeLineService: OrderExchangeLineService) {}

	/**
	 * Lists the outbound lines of an exchange.
	 *
	 * @param exchangeId The exchange.
	 * @returns The lines.
	 */
	@Query('orderExchangeLines')
	@Permissions(ReturnsPermissions.EXCHANGES_VIEW)
	async orderExchangeLines(@Args('exchangeId') exchangeId: ID): Promise<OrderExchangeLine[]> {
		return await this.orderExchangeLineService.findForExchange(exchangeId);
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
