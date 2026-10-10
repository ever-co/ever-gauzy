import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * The body of `POST /goods-receipts/:id/cancel`.
 *
 * Reversing a receipt writes the compensating movements the ledger needs and puts the received
 * quantities back on the order's lines, so the reason is recorded on the receipt rather than kept in
 * a caller's log.
 */
export class CancelGoodsReceiptDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly reason?: string;
}
