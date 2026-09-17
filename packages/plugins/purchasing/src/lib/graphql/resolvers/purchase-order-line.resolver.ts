import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { IGoodsReceipt, IPurchaseOrder, IPurchaseOrderLine, PurchaseBillingPolicy } from '../../purchasing.types';
import { isGreaterThanQuantity, negateQuantity, sumQuantity } from '../../purchasing.quantity';
import { PurchaseOrderLine } from '../../purchase-order-line/purchase-order-line.entity';
import { PurchaseOrderLineService } from '../../purchase-order-line/purchase-order-line.service';
import { PurchaseOrder } from '../../purchase-order/purchase-order.entity';
import { PurchaseOrderService } from '../../purchase-order/purchase-order.service';

/**
 * The purchase-order line's own fields.
 *
 * The line has no root field of its own — it is always read through its order — so this resolver
 * exists for the three members that are derived rather than stored: how much of the line is still
 * expected, what is still unbilled under the policy the caller names, and the order it belongs to when
 * a caller reached it without one.
 */
@Resolver('PurchaseOrderLine')
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
}
