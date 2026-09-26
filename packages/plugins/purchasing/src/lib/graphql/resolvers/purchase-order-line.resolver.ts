import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PurchasingFeatures } from '../../purchasing.features';
import { IPurchaseOrder, IPurchaseOrderLine, PurchaseBillingPolicy } from '../../purchasing.types';
import { PurchasingPermissions } from '../../purchasing.permissions';
import { isGreaterThanQuantity, negateQuantity, sumQuantity } from '../../purchasing.quantity';
import { PurchaseOrderLine } from '../../purchase-order-line/purchase-order-line.entity';
import { PurchaseOrderLineService } from '../../purchase-order-line/purchase-order-line.service';
import { PurchaseOrder } from '../../purchase-order/purchase-order.entity';
import { PurchaseOrderService } from '../../purchase-order/purchase-order.service';

/**
 * The purchase-order line's own fields.
 *
 * The line is **read** through its order rather than as a root field of its own, so this resolver exists
 * for the three members that are derived rather than stored: how much of the line is still expected, what
 * is still unbilled under the policy the caller names, and the order it belongs to when a caller reached it
 * without one.
 *
 * **It does answer two root fields, and they are the write pair rather than a read.** `DELETE
 * /purchase-order-lines/:id/soft` and `PUT /purchase-order-lines/:id/recover` are routes the line's own
 * controller serves — it overrides both to state `PURCHASE_ORDERS_EDIT`, because a controller inherits them
 * from `CrudController<T>` whether or not it declares them — and §3.1 of the GraphQL specification makes a
 * delivered write route a delivered capability on both protocols. A withdrawal a REST caller can perform and
 * a GraphQL caller cannot is the asymmetry the two-protocol rule forbids, and a read the line does not need is
 * not a reason to withhold a write it does. Nothing here reads a line by id: the pair takes one because the
 * routes take one.
 *
 * **Authorisation is the controller's.** A line with no root read is still served through the one
 * GraphQL endpoint, so the class carries the guard chain, the platform's feature gate and the read
 * permission the purchase-order-line controller class carries — `PURCHASE_ORDERS_VIEW`, which is the
 * permission that controller's own list route states, and the permission the order these fields are
 * selected through is read under. The platform gate is `FEATURE_GRAPHQL`, imported from the catalogue
 * rather than restated: a literal that drifted would name a code no catalogue row carries, which the
 * guard resolves as disabled and which would refuse every field here for every caller with nothing red
 * anywhere.
 *
 * **The plugin's own gate stands beside it.** The class also declares `PurchasingFeatures.PURCHASING`
 * (`FEATURE_PURCHASING`), the code every purchasing REST controller declares with `@FeatureFlag`, so a
 * tenant that switched purchasing off is refused here exactly as its routes refuse it — rather than finding
 * every write the routes withhold still served over GraphQL. The two codes are two questions, both of which
 * must be answered yes: the endpoint is on, and the capability is on. The platform's decorator accumulates
 * the codes stated on one target and `FeatureFlagGuard` requires every one of them.
 */
@Resolver('PurchaseOrderLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(PurchasingFeatures.PURCHASING)
@Permissions(PurchasingPermissions.PURCHASE_ORDERS_VIEW)
export class PurchaseOrderLineResolver {
	constructor(
		private readonly purchaseOrderService: PurchaseOrderService,
		private readonly purchaseOrderLineService: PurchaseOrderLineService
	) {}

	/**
	 * Resolves the quantity a line is still waiting for.
	 *
	 * Damaged units count against the ordered quantity exactly like good ones, because the supplier
	 * delivered them and the organization will be invoiced for them.
	 *
	 * @param line The line being read.
	 * @returns The outstanding quantity as an exact decimal string.
	 */
	@ResolveField('outstandingQuantity')
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_VIEW)
	outstandingQuantity(@Parent() line: IPurchaseOrderLine): string {
		const settled = sumQuantity([line.receivedQuantity, line.damagedQuantity]);

		return isGreaterThanQuantity(settled, line.quantity)
			? '0.000000'
			: sumQuantity([line.quantity, negateQuantity(settled)]);
	}

	/**
	 * Resolves what is still unbilled on a line.
	 *
	 * Derived at read rather than stored, and derived from the policy the caller names: a supplier who
	 * invoices on receipt is measured against what arrived, one who invoices on order against what was
	 * ordered. Storing the remainder would be a second source of truth for a figure the two quantities
	 * it is the difference of already answer.
	 *
	 * @param line The line being read.
	 * @param policy What the supplier's bill is matched against.
	 * @returns The unbilled quantity as an exact decimal string.
	 */
	@ResolveField('toBillQuantity')
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_VIEW)
	toBillQuantity(
		@Parent() line: IPurchaseOrderLine,
		@Args('policy') policy: PurchaseBillingPolicy
	): string {
		return this.purchaseOrderLineService.toBillQuantity(line, policy ?? PurchaseBillingPolicy.ON_ORDERED);
	}

	/**
	 * Resolves the order a line belongs to.
	 *
	 * @param line The line being read.
	 * @returns The order, or null when it cannot be read.
	 */
	@ResolveField('purchaseOrder')
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_VIEW)
	async purchaseOrder(@Parent() line: IPurchaseOrderLine): Promise<PurchaseOrder | null> {
		const attached = (line as PurchaseOrderLine).purchaseOrder as IPurchaseOrder | undefined;

		if (attached?.id) {
			return attached as PurchaseOrder;
		}

		if (!line.purchaseOrderId) {
			return null;
		}

		try {
			return await this.purchaseOrderService.findOneDetailed(line.purchaseOrderId);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Withdraws a line, clearing the order's billable quantity of it without removing the row.
	 *
	 * The permission is the route's own rather than the class's read grant: the line's controller overrides
	 * `softRemove` to state `PURCHASE_ORDERS_EDIT`, and stating the view grant here would make GraphQL wider
	 * than REST — the one direction §3.1 forbids.
	 *
	 * @param id The line to withdraw.
	 * @returns The soft-deleted line.
	 */
	@Mutation('softDeletePurchaseOrderLine')
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_EDIT)
	async softDeletePurchaseOrderLine(@Args('id') id: ID): Promise<PurchaseOrderLine> {
		return await this.purchaseOrderLineService.softRemove(id);
	}

	/**
	 * Puts a withdrawn line back.
	 *
	 * @param id The line to restore.
	 * @returns The restored line.
	 */
	@Mutation('recoverPurchaseOrderLine')
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_EDIT)
	async recoverPurchaseOrderLine(@Args('id') id: ID): Promise<PurchaseOrderLine> {
		return await this.purchaseOrderLineService.softRecover(id);
	}
}
