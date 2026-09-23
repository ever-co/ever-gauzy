import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, Idempotent, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { toFailedGoodsReceiptPayload, toGoodsReceiptPayload, toUserError } from '../wire';
import { buildConnection, IPageSelection, resolvePageWindow } from '../pagination';
import {
	IGoodsReceipt,
	IGoodsReceiptLineInput,
	IPurchaseOrder,
	IPurchaseOrderLine,
	PurchaseOrderStatus
} from '../../purchasing.types';
import { PurchasingPermissions } from '../../purchasing.permissions';
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
 * The delivery a caller records against the order they are already looking at, as the schema declares
 * it.
 *
 * It is the body of `POST /purchase-orders/:id/receipts` and nothing else: the order rides as the
 * field's own argument because the route carries it in the path, and the location is deliberately
 * absent because the route does not read one — a delivery anchored to an order inherits that order's
 * receiving location, and a field that accepted a location the service never received would tell a
 * caller it had moved the goods somewhere it had not.
 */
interface IReceivePurchaseOrderArgs {
	receivedAt?: Date;
	overReceiptTolerance?: string;
	note?: string;
	lines: IGoodsReceiptLineInput[];
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
 *
 * **Authorisation is the controller's, restated field by field.** The class carries what the
 * purchase-order controller class carries — both protocol guards, the platform's feature gate and the
 * read permission its reads run under — and every field then states the permission its own route states:
 * the two reads carry `PURCHASE_ORDERS_VIEW`, raising an order `PURCHASE_ORDERS_CREATE`, amending,
 * deleting, acknowledging, cancelling, closing, withdrawing and recovering one `PURCHASE_ORDERS_EDIT`,
 * approving one internally `PURCHASE_ORDERS_APPROVE`, and sending it to the supplier
 * `PURCHASE_ORDERS_SEND` — the value that decides whether the supplier is told, as against
 * `PURCHASE_ORDERS_APPROVE`, which is what permits the order to exist. Receiving against the order
 * carries `GOODS_RECEIPTS_CREATE` rather than a purchase-order grant, because it writes stock movements
 * and the order's received counters: that is the receiving authority, and the route states the same
 * string, so a caller who may not book a delivery is refused on both surfaces alike. The fields that
 * resolve an order's lines, its receipts and its derived outstanding quantity answer under the
 * permission the order is read with, which is the route they are selected through.
 *
 *
 * **The gate is the catalogue's.** `FeatureFlagGuard` is appended to the two permission guards — after
 * them, so a caller with no credential is refused as a credential problem before a tenant's switches are
 * consulted — and the code it reads is `FEATURE_GRAPHQL`, the commerce catalogue's own entry for "the
 * GraphQL endpoint and its resolvers, under the same guards and permissions as REST". The code is
 * imported rather than restated because nothing checks one string against another: a literal that
 * drifted names a code no catalogue row carries, which the guard resolves as disabled, and every field
 * here would then answer `Cannot query field <name>` for every caller with nothing red anywhere.
 */
@Resolver('PurchaseOrder')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PurchasingPermissions.PURCHASE_ORDERS_VIEW)
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
	 * @param withDeleted Whether retired rows are included.
	 * @returns One page of purchase orders.
	 */
	@Query('purchaseOrders')
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_VIEW)
	async purchaseOrders(
		@Args('filter')
		filter?: {
			status?: PurchaseOrderStatus;
			vendorId?: ID;
			warehouseId?: ID;
			number?: string;
			expectedAt?: Date;
		},
		@Args('page') page?: IPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
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
			order: { createdAt: 'DESC' },
			...(withDeleted ? { withDeleted: true } : {})
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
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_VIEW)
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
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_CREATE)
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
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_EDIT)
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
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_EDIT)
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
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_SEND)
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
	 * Records the supplier's acknowledgement of a sent order.
	 *
	 * The field states `PURCHASE_ORDERS_EDIT`, which is what the route states: the supplier's
	 * confirmation is a note on a document the buyer already owns, so it is an edit rather than the
	 * release of the spend — the grant that decides whether an order may exist at all stays with
	 * `approvePurchaseOrder` below, and the grant that decides whether the supplier is told stays with
	 * `sendPurchaseOrder` above. The revised expected date rides as the field's own argument, because the
	 * route takes it in the body and a field has no body. The version the route reads from `If-Match` is
	 * not stated, for the reason none of these transitions states one.
	 *
	 * @param id The order being acknowledged.
	 * @param expectedAt The revised expected date, when the supplier stated one.
	 * @param note An operator note.
	 * @returns The payload.
	 */
	@Mutation('acknowledgePurchaseOrder')
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_EDIT)
	async acknowledgePurchaseOrder(
		@Args('id') id: ID,
		@Args('expectedAt', { type: () => Date, nullable: true }) expectedAt?: Date,
		@Args('note') note?: string
	) {
		try {
			return {
				purchaseOrder: await this.purchaseOrderService.acknowledge(id, { expectedAt, note }),
				userErrors: []
			};
		} catch (error) {
			return { purchaseOrder: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Approves a purchase order internally.
	 *
	 * The one transition whose grant is not an edit: the field states `PURCHASE_ORDERS_APPROVE`,
	 * because the approval is what permits an order to be sent to a supplier, and a surface that served
	 * it under the edit grant would let whoever may amend a draft release the spend as well. The note
	 * rides as the field's own argument, since the route takes it in the body and a field has no body.
	 *
	 * @param id The order to approve.
	 * @param note An operator note kept on the order.
	 * @returns The payload.
	 */
	@Mutation('approvePurchaseOrder')
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_APPROVE)
	async approvePurchaseOrder(@Args('id') id: ID, @Args('note') note?: string) {
		try {
			return { purchaseOrder: await this.purchaseOrderService.approve(id, note), userErrors: [] };
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
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_EDIT)
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
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_EDIT)
	async cancelPurchaseOrder(@Args('id') id: ID, @Args('reason') reason?: string) {
		try {
			return { purchaseOrder: await this.purchaseOrderService.cancel(id, reason), userErrors: [] };
		} catch (error) {
			return { purchaseOrder: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Receives goods against a purchase order.
	 *
	 * The field states `GOODS_RECEIPTS_CREATE` rather than a purchase-order grant, because that is what
	 * the route states and the reason is the operation rather than the resource: receiving writes stock
	 * movements and the order's received counters, so it is the receiving authority rather than an edit
	 * to a document. A field that stated an edit grant here would answer a booking the REST route refuses
	 * to the same caller, which is the disagreement the parity rule exists to prevent.
	 *
	 * It carries no retry declaration, because the route carries none: the delivery-recording mutation
	 * beside it (`createGoodsReceipt`) demands a key, and this path deliberately does not, so a field
	 * that demanded one would refuse callers the route serves. The delivery is handed to the same service
	 * method the route calls, with the order stated as the route states it — in the path there, as the
	 * field's argument here — and the answer is the receipt, which is what the route returns.
	 *
	 * @param id The order being received against.
	 * @param input The quantities that arrived.
	 * @returns The payload, carrying the receipt, the movements it wrote and the order's new state.
	 */
	@Mutation('receivePurchaseOrder')
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_CREATE)
	async receivePurchaseOrder(@Args('id') id: ID, @Args('input') input: IReceivePurchaseOrderArgs) {
		try {
			return toGoodsReceiptPayload(
				await this.goodsReceiptService.receive({
					purchaseOrderId: id,
					receivedAt: input.receivedAt,
					overReceiptTolerance: input.overReceiptTolerance,
					note: input.note,
					lines: input.lines
				} as any)
			);
		} catch (error) {
			return toFailedGoodsReceiptPayload(error);
		}
	}

	/**
	 * Withdraws a purchase order without removing the row.
	 *
	 * The field mirrors `DELETE /:id/soft`, and it states `PURCHASE_ORDERS_EDIT` because the route does:
	 * the route is `CrudController`'s, and this controller overrides it only to state a grant the
	 * inherited declaration lacked — the base declares it with no permission metadata, so
	 * `PermissionGuard` fell through to the class-level read grant while the destructive mutation beside
	 * it demanded `PURCHASE_ORDERS_EDIT`. The answer is the withdrawn row, which is what the route
	 * returns and what every other inherited soft removal in the composed schema answers with, so a
	 * client generated from the schema sees one shape for the operation rather than two.
	 *
	 * No version is stated: the withdrawn order is the document the caller read, and the field has no
	 * header to carry one. The service is called exactly as the route calls it — the route declares no
	 * body of its own and forwards the empty option list that leaves, so the field forwards none.
	 *
	 * @param id The order to withdraw.
	 * @returns The soft-deleted order.
	 */
	@Mutation('softDeletePurchaseOrder')
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_EDIT)
	async softDeletePurchaseOrder(@Args('id') id: ID): Promise<PurchaseOrder> {
		return await this.purchaseOrderService.softRemove(id);
	}

	/**
	 * Puts a withdrawn purchase order back.
	 *
	 * The other half of the same inherited pair, and permissioned as the withdrawal is, for the same
	 * reason: recovery is a write on the document and the route states the edit grant rather than the
	 * read one it would otherwise inherit. Answering the restored row keeps the field a capability of the
	 * route rather than a second implementation of it.
	 *
	 * @param id The order to restore.
	 * @returns The restored order.
	 */
	@Mutation('recoverPurchaseOrder')
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_EDIT)
	async recoverPurchaseOrder(@Args('id') id: ID): Promise<PurchaseOrder> {
		return await this.purchaseOrderService.softRecover(id);
	}

	/**
	 * Resolves an order's lines.
	 *
	 * @param purchaseOrder The order being read.
	 * @returns The lines.
	 */
	@ResolveField('lines')
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_VIEW)
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
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_VIEW)
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
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_VIEW)
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
	@Permissions(PurchasingPermissions.PURCHASE_ORDERS_VIEW)
	isApproved(@Parent() purchaseOrder: IPurchaseOrder): boolean {
		return Boolean(purchaseOrder.approvedAt);
	}
}
