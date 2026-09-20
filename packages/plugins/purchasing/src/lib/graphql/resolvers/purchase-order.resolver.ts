import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import { Idempotent } from '@gauzy/core';
import { toUserError } from '../wire';
import { buildConnection, IPageSelection, resolvePageWindow } from '../pagination';
import {
	IGoodsReceipt,
	IPurchaseOrder,
	IPurchaseOrderLine,
	PurchaseOrderStatus
} from '../../purchasing.types';
import { isGreaterThanQuantity, negateQuantity, sumQuantity } from '../../purchasing.quantity';
import { GoodsReceiptService } from '../../goods-receipt/goods-receipt.service';
import { PurchaseOrderLineService } from '../../purchase-order-line/purchase-order-line.service';
import { PurchaseOrder } from '../../purchase-order/purchase-order.entity';
import { PurchaseOrderService } from '../../purchase-order/purchase-order.service';

/** The request that raises a purchase order, as the schema declares it. */
interface ICreatePurchaseOrderArgs {
	vendorId: ID;
	warehouseId: ID;
	currency: string;
	vendorReference?: string;
	buyerUserId?: ID;
	paymentTermId?: ID;
	paymentTermsDaysSnapshot?: number;
	expectedAt?: Date;
	shippingTotal?: string;
	note?: string;
	lines: Array<{
		variantId: ID;
		quantity: string;
		unitId?: ID;
		conversionFactor?: string;
		unitCost?: string;
		taxRate?: string;
		discountTotal?: string;
		expectedAt?: Date;
		note?: string;
	}>;
	/** The client's retry key, honoured when one is presented. */
	idempotencyKey?: string;
}

/** The amendment to a draft purchase order, as the schema declares it. */
interface IUpdatePurchaseOrderArgs {
	vendorReference?: string;
	buyerUserId?: ID;
	paymentTermId?: ID;
	paymentTermsDaysSnapshot?: number;
	expectedAt?: Date;
	shippingTotal?: string;
	note?: string;
	lines?: ICreatePurchaseOrderArgs['lines'];
}

/**
 * The purchasing domain's purchase-order root fields.
 *
 * The resolvers call the same services the REST controllers call, so an order raised over GraphQL and
 * one raised over REST obey the same state machine, the same approval gate and the same derivation of
 * the money, and the two surfaces cannot drift. Authorisation is unchanged: the guards run on the HTTP
 * request that carried the operation, exactly as they do for a REST call.
 *
 * Raising an order carries the retry declaration its REST route carries, under the same scope, so a
 * client that retries presents one operation whichever protocol carried it: the key rides as the
 * `idempotencyKey` member of the mutation's input, because one GraphQL request may select several
 * mutations and a header could not say which of them a key belongs to.
 */
@Resolver('PurchaseOrder')
export class PurchaseOrderResolver {
	constructor(
		private readonly purchaseOrderService: PurchaseOrderService,
		private readonly purchaseOrderLineService: PurchaseOrderLineService,
		private readonly goodsReceiptService: GoodsReceiptService
	) {}

	/**
	 * Lists purchase orders.
	 *
	 * @param filter The order filter.
	 * @param page The page.
	 * @returns One page of purchase orders.
	 */
	@Query('purchaseOrders')
	async purchaseOrders(
		@Args('filter')
		filter?: {
			status?: PurchaseOrderStatus;
			vendorId?: ID;
			warehouseId?: ID;
			number?: string;
			expectedAt?: Date;
		},
		@Args('page') page?: IPageSelection
	) {
		const { skip, take } = resolvePageWindow(page);
		const result = await this.purchaseOrderService.findAll({
			where: {
				...(filter?.status ? { status: filter.status } : {}),
				...(filter?.vendorId ? { vendorId: filter.vendorId } : {}),
				...(filter?.warehouseId ? { warehouseId: filter.warehouseId } : {}),
				...(filter?.number ? { number: filter.number } : {}),
				...(filter?.expectedAt ? { expectedAt: filter.expectedAt } : {})
			},
			skip,
			take,
			order: { createdAt: 'DESC' }
		} as any);

		return buildConnection(result, skip);
	}

	/**
	 * Reads one purchase order.
	 *
	 * @param id The order.
	 * @returns The order, or null when it is not the caller's.
	 */
	@Query('purchaseOrder')
	async purchaseOrder(@Args('id') id: ID): Promise<PurchaseOrder | null> {
		try {
			return await this.purchaseOrderService.findOneDetailed(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Raises a purchase order.
	 *
	 * @param input The order to raise.
	 * @returns The payload, with the order or the reason it was refused.
	 */
	@Idempotent({ scope: 'purchase_order.create', required: false, resourceType: 'purchase_order' })
	@Mutation('createPurchaseOrder')
	async createPurchaseOrder(@Args('input') input: ICreatePurchaseOrderArgs) {
		try {
			return {
				purchaseOrder: await this.purchaseOrderService.create(input as any),
				userErrors: []
			};
		} catch (error) {
			return { purchaseOrder: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Amends a draft purchase order.
	 *
	 * @param id The order.
	 * @param input The fields to change.
	 * @returns The payload.
	 */
	@Mutation('updatePurchaseOrder')
	async updatePurchaseOrder(@Args('id') id: ID, @Args('input') input: IUpdatePurchaseOrderArgs) {
		try {
			return {
				purchaseOrder: await this.purchaseOrderService.update(id, input as any),
				userErrors: []
			};
		} catch (error) {
			return { purchaseOrder: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Deletes a draft purchase order.
	 *
	 * @param id The order.
	 * @returns The payload, carrying the identity that was removed.
	 */
	@Mutation('deletePurchaseOrder')
	async deletePurchaseOrder(@Args('id') id: ID) {
		try {
			await this.purchaseOrderService.delete(id);

			return { id, userErrors: [] };
		} catch (error) {
			return { id: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Sends an approved purchase order to the supplier.
	 *
	 * @param id The order.
	 * @param email The recipient override.
	 * @param note An operator note.
	 * @returns The payload.
	 */
	@Mutation('sendPurchaseOrder')
	async sendPurchaseOrder(@Args('id') id: ID, @Args('email') email?: string, @Args('note') note?: string) {
		try {
			return {
				purchaseOrder: await this.purchaseOrderService.send(id, { email, note }),
				userErrors: []
			};
		} catch (error) {
			return { purchaseOrder: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Closes a purchase order short of the ordered quantity.
	 *
	 * @param id The order.
	 * @param reason Why it was closed short.
	 * @returns The payload.
	 */
	@Mutation('closePurchaseOrder')
	async closePurchaseOrder(@Args('id') id: ID, @Args('reason') reason?: string) {
		try {
			return { purchaseOrder: await this.purchaseOrderService.close(id, reason), userErrors: [] };
		} catch (error) {
			return { purchaseOrder: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Cancels a purchase order before anything arrived.
	 *
	 * @param id The order.
	 * @param reason Why it was cancelled.
	 * @returns The payload.
	 */
	@Mutation('cancelPurchaseOrder')
	async cancelPurchaseOrder(@Args('id') id: ID, @Args('reason') reason?: string) {
		try {
			return { purchaseOrder: await this.purchaseOrderService.cancel(id, reason), userErrors: [] };
		} catch (error) {
			return { purchaseOrder: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Resolves an order's lines.
	 *
	 * @param purchaseOrder The order being read.
	 * @returns The lines.
	 */
	@ResolveField('lines')
	async lines(@Parent() purchaseOrder: IPurchaseOrder): Promise<IPurchaseOrderLine[]> {
		if (Array.isArray((purchaseOrder as PurchaseOrder).lines)) {
			return (purchaseOrder as PurchaseOrder).lines;
		}

		return await this.purchaseOrderLineService.findForOrder(purchaseOrder.id);
	}

	/**
	 * Resolves the deliveries recorded against an order.
	 *
	 * @param purchaseOrder The order being read.
	 * @returns The receipts.
	 */
	@ResolveField('receipts')
	async receipts(@Parent() purchaseOrder: IPurchaseOrder): Promise<IGoodsReceipt[]> {
		if (Array.isArray((purchaseOrder as PurchaseOrder).receipts)) {
			return (purchaseOrder as PurchaseOrder).receipts;
		}

		return await this.goodsReceiptService.find({ purchaseOrderId: purchaseOrder.id } as any);
	}

	/**
	 * Resolves the quantity an order is still waiting for.
	 *
	 * Derived from the order's lines rather than accumulated from its receipts, so a reversed receipt
	 * is reflected the moment its counters are put back.
	 *
	 * @param purchaseOrder The order being read.
	 * @returns The outstanding quantity as an exact decimal string.
	 */
	@ResolveField('outstandingQuantity')
	async outstandingQuantity(@Parent() purchaseOrder: IPurchaseOrder): Promise<string> {
		const lines = await this.lines(purchaseOrder);

		return sumQuantity(
			lines.map((line) => {
				const settled = sumQuantity([line.receivedQuantity, line.damagedQuantity]);

				return isGreaterThanQuantity(settled, line.quantity)
					? '0'
					: sumQuantity([line.quantity, negateQuantity(settled)]);
			})
		);
	}

	/**
	 * Resolves whether an order carries an internal approval.
	 *
	 * Read from the cause rather than stored: the approval is a recorded fact on the order, and this
	 * field is the shape a client branches on when it decides whether the send action is available.
	 *
	 * @param purchaseOrder The order being read.
	 * @returns True when the order was approved.
	 */
	@ResolveField('isApproved')
	isApproved(@Parent() purchaseOrder: IPurchaseOrder): boolean {
		return Boolean(purchaseOrder.approvedAt);
	}
}
