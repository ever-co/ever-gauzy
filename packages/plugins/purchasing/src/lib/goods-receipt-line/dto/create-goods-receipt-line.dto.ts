import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { DecimalString, ID } from '@gauzy/contracts';
import { GoodsReceiptLineDTO } from './goods-receipt-line.dto';

/**
 * A receipt line written on its own, outside a receipt's line set.
 *
 * The ordinary path writes lines as part of the receipt; this shape exists for the line controller,
 * and it is the only place a caller names the receipt a line belongs to. It is not a way to write a
 * row directly — it goes through the receipt service, so the ceiling check and the stock movements
 * still apply.
 */
export class CreateGoodsReceiptLineDTO extends GoodsReceiptLineDTO {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly receiptId: ID;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly purchaseOrderLineId: ID;

	@ApiProperty({ type: () => String, description: 'Exact decimal good quantity, e.g. "8.000000".' })
	@IsNotEmpty()
	readonly quantity: DecimalString;
}
