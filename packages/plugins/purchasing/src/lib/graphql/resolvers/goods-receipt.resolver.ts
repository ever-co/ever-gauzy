import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { ID } from '@gauzy/contracts';
import { Idempotent } from '@gauzy/core';
import { toFailedGoodsReceiptPayload, toGoodsReceiptPayload, toUserError } from '../wire';
import { buildConnection, IPageSelection, resolvePageWindow } from '../pagination';
import { GoodsReceiptStatus, IGoodsReceipt, IGoodsReceiptLine, IGoodsReceiptLineInput } from '../../purchasing.types';
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
 */
@Resolver('GoodsReceipt')
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
	async stockMovementIds(@Parent() goodsReceipt: IGoodsReceipt): Promise<ID[]> {
		const lines = await this.lines(goodsReceipt);

		return lines.map((line) => line.stockMovementId).filter((id): id is ID => Boolean(id));
	}
}
