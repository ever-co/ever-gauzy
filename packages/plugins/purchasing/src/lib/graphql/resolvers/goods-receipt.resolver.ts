import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import { FeatureFlagGuard, Idempotent, PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { toFailedGoodsReceiptPayload, toGoodsReceiptPayload, toUserError } from '../wire';
import { buildConnection, IPageSelection, resolvePageWindow } from '../pagination';
import { GoodsReceiptStatus, IGoodsReceipt, IGoodsReceiptLine, IGoodsReceiptLineInput } from '../../purchasing.types';
import { PurchasingPermissions } from '../../purchasing.permissions';
import { GoodsReceiptLineService } from '../../goods-receipt-line/goods-receipt-line.service';
import { GoodsReceipt } from '../../goods-receipt/goods-receipt.entity';
import { GoodsReceiptPosting, GoodsReceiptService } from '../../goods-receipt/goods-receipt.service';

/** The delivery a caller asks for, as the schema declares it. */
interface ICreateGoodsReceiptArgs {
	purchaseOrderId: ID;
	warehouseId?: ID;
	receivedAt?: Date;
	overReceiptTolerance?: string;
	note?: string;
	lines: IGoodsReceiptLineInput[];
	/** The client's retry key, which this mutation requires. */
	idempotencyKey?: string;
}

/**
 * The purchasing domain's goods-receipt root fields.
 *
 * A receipt is recorded and read back; ending it is the reversal, which writes the compensating
 * movements and puts the received counters back on the order. That is why there is one terminal field
 * rather than a cancel and a close: a receipt has exactly one way out, and it is the same operation
 * whichever name a caller reached for.
 *
 * The resolvers call the same services the REST controllers call, so a receipt recorded here and one
 * recorded over REST pass through the same over-receipt check and the same movement seam — and, for the
 * recording itself, the same retry declaration under the same scope: a delivery that is booked twice
 * books the stock twice, so the mutation demands a key exactly as the route does, and the key rides as
 * the `idempotencyKey` member of the mutation's own input because one GraphQL request may select
 * several mutations.
 *
 * **Authorisation is the controller's, restated field by field.** The class carries what the
 * goods-receipt controller class carries — both protocol guards, the platform's feature gate and the read
 * permission its reads run under — and every field then states the permission its own route states: the
 * two reads carry `GOODS_RECEIPTS_VIEW`, while recording a delivery, recording one further line against a
 * posted receipt and ending (reversing) one all carry `GOODS_RECEIPTS_CREATE`, because each writes stock
 * movements and puts counters back on the order's lines, which is the receiving authority rather than an
 * edit to a document. The fields that resolve a receipt's lines and the movements those lines wrote answer
 * under the permission the receipt is read with, which is the route they are selected through.
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
@Resolver('GoodsReceipt')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PurchasingPermissions.GOODS_RECEIPTS_VIEW)
export class GoodsReceiptResolver {
	constructor(
		private readonly goodsReceiptService: GoodsReceiptService,
		private readonly goodsReceiptLineService: GoodsReceiptLineService
	) {}

	/**
	 * Lists goods receipts.
	 *
	 * @param filter The receipt filter.
	 * @param page The page.
	 * @returns One page of receipts.
	 */
	@Query('goodsReceipts')
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_VIEW)
	async goodsReceipts(
		@Args('filter')
		filter?: { purchaseOrderId?: ID; warehouseId?: ID; status?: GoodsReceiptStatus; number?: string },
		@Args('page') page?: IPageSelection
	) {
		const { skip, take } = resolvePageWindow(page);
		const result = await this.goodsReceiptService.findAll({
			where: {
				...(filter?.purchaseOrderId ? { purchaseOrderId: filter.purchaseOrderId } : {}),
				...(filter?.warehouseId ? { warehouseId: filter.warehouseId } : {}),
				...(filter?.status ? { status: filter.status } : {}),
				...(filter?.number ? { number: filter.number } : {})
			},
			skip,
			take,
			order: { createdAt: 'DESC' }
		} as any);

		return buildConnection(result, skip);
	}

	/**
	 * Reads one goods receipt.
	 *
	 * @param id The receipt.
	 * @returns The receipt, or null when it is not the caller's.
	 */
	@Query('goodsReceipt')
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_VIEW)
	async goodsReceipt(@Args('id') id: ID): Promise<GoodsReceipt | null> {
		try {
			return await this.goodsReceiptService.findOneDetailed(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Records a delivery against a purchase order.
	 *
	 * @param input The delivery.
	 * @returns The payload, with the receipt or the reason it was refused.
	 */
	@Idempotent({ scope: 'purchase_order.receive', required: true, resourceType: 'goods_receipt' })
	@Mutation('createGoodsReceipt')
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_CREATE)
	async createGoodsReceipt(@Args('input') input: ICreateGoodsReceiptArgs) {
		try {
			return toGoodsReceiptPayload(await this.goodsReceiptService.receive(input as any));
		} catch (error) {
			return toFailedGoodsReceiptPayload(error);
		}
	}

	/**
	 * Records one further line against a receipt that was already posted.
	 *
	 * @param receiptId The receipt to add the line to.
	 * @param input The line that arrived.
	 * @returns The payload.
	 */
	@Mutation('recordGoodsReceiptLine')
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_CREATE)
	async recordGoodsReceiptLine(@Args('receiptId') receiptId: ID, @Args('input') input: IGoodsReceiptLineInput) {
		try {
			const posting: GoodsReceiptPosting = await this.goodsReceiptService.recordLine(receiptId, input);

			return toGoodsReceiptPayload(posting);
		} catch (error) {
			return toFailedGoodsReceiptPayload(error);
		}
	}

	/**
	 * Ends a receipt, taking its quantities back out of stock and off the order's lines.
	 *
	 * @param id The receipt to end.
	 * @param reason Why it was ended.
	 * @returns The payload.
	 */
	@Mutation('closeGoodsReceipt')
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_CREATE)
	async closeGoodsReceipt(@Args('id') id: ID, @Args('reason') reason?: string) {
		try {
			return toGoodsReceiptPayload(await this.goodsReceiptService.reverse(id, reason));
		} catch (error) {
			return toFailedGoodsReceiptPayload(error);
		}
	}

	/**
	 * Resolves a receipt's lines.
	 *
	 * @param goodsReceipt The receipt being read.
	 * @returns The lines.
	 */
	@ResolveField('lines')
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_VIEW)
	async lines(@Parent() goodsReceipt: IGoodsReceipt): Promise<IGoodsReceiptLine[]> {
		if (Array.isArray((goodsReceipt as GoodsReceipt).lines)) {
			return (goodsReceipt as GoodsReceipt).lines;
		}

		return await this.goodsReceiptLineService.findForReceipt(goodsReceipt.id);
	}

	/**
	 * Resolves the movements a receipt wrote.
	 *
	 * Read from the lines rather than stored on the header: the link is per line, and a receipt whose
	 * lines were written by two different operations still answers with all of them.
	 *
	 * @param goodsReceipt The receipt being read.
	 * @returns The movement ids, in line order.
	 */
	@ResolveField('stockMovementIds')
	@Permissions(PurchasingPermissions.GOODS_RECEIPTS_VIEW)
	async stockMovementIds(@Parent() goodsReceipt: IGoodsReceipt): Promise<ID[]> {
		const lines = await this.lines(goodsReceipt);

		return lines.map((line) => line.stockMovementId).filter((id): id is ID => Boolean(id));
	}
}
