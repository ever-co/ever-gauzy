import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { IGoodsReceipt, IGoodsReceiptLine } from '../../purchasing.types';
import { GoodsReceipt } from '../../goods-receipt/goods-receipt.entity';
import { GoodsReceiptService } from '../../goods-receipt/goods-receipt.service';

/**
 * The goods-receipt line's own field.
 *
 * A receipt line is written with its receipt, so it is normally read through it. This resolver exists
 * for the one case where it is not: a caller that reached a line by order line, and needs the delivery
 * it belongs to in order to know when and where it arrived.
 */
@Resolver('GoodsReceiptLine')
export class GoodsReceiptLineResolver {
	constructor(private readonly goodsReceiptService: GoodsReceiptService) {}

	/**
	 * Resolves the receipt a line belongs to.
	 *
	 * @param line The line being read.
	 * @returns The receipt, or null when it cannot be read.
	 */
	@ResolveField('receipt')
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
}
