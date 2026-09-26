import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { PurchasingFeatures } from '../../purchasing.features';
import { IGoodsReceipt, IGoodsReceiptLine } from '../../purchasing.types';
import { PurchasingPermissions } from '../../purchasing.permissions';
import { toUserError } from '../wire';
import { GoodsReceipt } from '../../goods-receipt/goods-receipt.entity';
import { GoodsReceiptService } from '../../goods-receipt/goods-receipt.service';
import { GoodsReceiptLine } from '../../goods-receipt-line/goods-receipt-line.entity';
import { GoodsReceiptLineService } from '../../goods-receipt-line/goods-receipt-line.service';

/**
 * The goods-receipt line's own fields.
 *
 * A receipt line is written with its receipt, so it is normally read through it. This resolver exists
 * for the one case where it is not: a caller that reached a line by order line, and needs the delivery
 * it belongs to in order to know when and where it arrived.
 *
 * **It does answer two root fields, and they are the write pair rather than a read.** `DELETE
 * /goods-receipt-lines/:id/soft` and `PUT /goods-receipt-lines/:id/recover` are routes the line's own
 * controller serves — it overrides both to state `GOODS_RECEIPTS_CREATE`, because a controller inherits
 * them from `CrudController<T>` whether or not it declares them — and §3.1 of the GraphQL specification
 * makes a delivered write route a delivered capability on both protocols. A withdrawal a REST caller can
 * perform and a GraphQL caller cannot is the asymmetry the two-protocol rule forbids, and a read the line
 * does not need is not a reason to withhold a write it does. Nothing here reads a line by id: the pair
 * takes one because the routes take one.
 *
 * **Authorisation is the controller's.** A line with no root read is still served through the one
 * GraphQL endpoint, so the class carries the guard chain, the platform's feature gate and the read
 * permission the goods-receipt-line controller class carries — `GOODS_RECEIPTS_VIEW`, which is the
 * permission that controller's own list route states, and the permission the receipt these fields are
 * selected through is read under. Each of the two write fields then states `GOODS_RECEIPTS_CREATE`, the
 * grant the line's controller overrides its own inherited routes with, which is also the grant the
 * receipt these rows are written by carries — a line is a delivery, not a document to be edited. The
 * platform gate is `FEATURE_GRAPHQL`, imported from the catalogue rather than restated: a literal that
 * drifted would name a code no catalogue row carries, which the guard resolves as disabled and which
 * would refuse this field for every caller with nothing red anywhere.
 *
 * **The plugin's own gate stands beside it.** The class also declares `PurchasingFeatures.PURCHASING`
 * (`FEATURE_PURCHASING`), the code every purchasing REST controller declares with `@FeatureFlag`, so a
 * tenant that switched purchasing off is refused here exactly as its routes refuse it — rather than finding
 * every write the routes withhold still served over GraphQL. The two codes are two questions, both of which
 * must be answered yes: the endpoint is on, and the capability is on. The platform's decorator accumulates
 * the codes stated on one target and `FeatureFlagGuard` requires every one of them.
 */
@Resolver('GoodsReceiptLine')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(PurchasingFeatures.PURCHASING)
@Permissions(PurchasingPermissions.GOODS_RECEIPTS_VIEW)
export class GoodsReceiptLineResolver {
	constructor(
		private readonly goodsReceiptService: GoodsReceiptService,
		private readonly goodsReceiptLineService: GoodsReceiptLineService
	) {}

	/**
	 * Resolves the receipt a line belongs to.
	 *
	 * @param line The line being read.
	 * @returns The receipt, or null when it cannot be read.
	 */
	@ResolveField('receipt')
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_VIEW)
	async receipt(@Parent() line: IGoodsReceiptLine): Promise<GoodsReceipt | null> {
		const attached = (line as { receipt?: IGoodsReceipt }).receipt;

		if (attached?.id) {
			return attached as GoodsReceipt;
		}

		if (!line.receiptId) {
			return null;
		}

		try {
			return await this.goodsReceiptService.findOneDetailed(line.receiptId);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Withdraws a receipt line without removing the row.
	 *
	 * The field mirrors `DELETE /goods-receipt-lines/:id/soft`, which the line's controller inherits from
	 * `CrudController<T>` and overrides only to state a permission the inherited declaration left
	 * unstated — the base declares the route with no permission metadata, so `PermissionGuard` fell
	 * through to the class-level read grant while the write routes of this resource demand
	 * `GOODS_RECEIPTS_CREATE`. The field states the grant the route states, read off that same override,
	 * because a field that left the act to its class would let whoever may read a receipt withdraw one of
	 * its lines.
	 *
	 * The answer is the line rather than a payload, which is what the routes of this resource answer and
	 * what the sibling line resource of this plugin answers too (`softDeletePurchaseOrderLine` answers
	 * `PurchaseOrderLine!`): this document carries no payload type of which a receipt line is the member,
	 * so there is no second shape to invent and none is invented. The service is called as the route
	 * calls it — the route forwards the (empty) option list its own handler parameters collected, and the
	 * field collects none, which the service reads as one thing.
	 *
	 * @param id The line to withdraw.
	 * @returns The soft-deleted line.
	 */
	@Mutation('softDeleteGoodsReceiptLine')
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_CREATE)
	async softDeleteGoodsReceiptLine(@Args('id') id: ID): Promise<GoodsReceiptLine> {
		return await this.goodsReceiptLineService.softRemove(id);
	}

	/**
	 * Deletes a receipt line outright.
	 *
	 * The route it mirrors is `DELETE /goods-receipt-lines/:id`, declared here in the controller and
	 * overridden only to state the permission the base leaves unstated, under the same `GOODS_RECEIPTS_CREATE`
	 * the withdrawal below states. The field reaches the method the route reaches — `super.delete(id)`,
	 * the CRUD base's own `delete` — and not the `softRemove` of the pair beside it, which is the
	 * distinction the two fields exist to keep.
	 *
	 * **This is a hard delete of a row the ledger explains.** A receipt line is what a `stock_movement`
	 * row was written from, so removing it leaves the movement with nothing that records what arrived;
	 * `softDeleteGoodsReceiptLine` below is the removal a caller reaches for. The field is delivered
	 * because §3.1 requires one mutation per REST write route, and the answer carries the identity rather
	 * than the line, because a removed row is not there to answer with — the same payload shape
	 * `deleteGoodsReceipt` and `deletePurchaseOrder` already answer.
	 *
	 * @param id The line to delete.
	 * @returns The payload, carrying the identity that was removed.
	 */
	@Mutation('deleteGoodsReceiptLine')
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_CREATE)
	async deleteGoodsReceiptLine(@Args('id') id: ID) {
		try {
			await this.goodsReceiptLineService.delete(id);

			return { id, userErrors: [] };
		} catch (error) {
			return { id: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Puts a withdrawn receipt line back.
	 *
	 * The other half of the same inherited pair, answered and permissioned as the withdrawal is: the
	 * route is `PUT /goods-receipt-lines/:id/recover`, and its override states `GOODS_RECEIPTS_CREATE`
	 * for the same reason.
	 *
	 * @param id The line to restore.
	 * @returns The restored line.
	 */
	@Mutation('recoverGoodsReceiptLine')
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_CREATE)
	async recoverGoodsReceiptLine(@Args('id') id: ID): Promise<GoodsReceiptLine> {
		return await this.goodsReceiptLineService.softRecover(id);
	}
}
