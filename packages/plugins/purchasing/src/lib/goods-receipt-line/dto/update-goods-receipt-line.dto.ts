import { PartialType } from '@nestjs/mapped-types';
import { GoodsReceiptLineDTO } from './goods-receipt-line.dto';

/**
 * An update to a receipt line's annotation.
 *
 * The quantities are not reachable from here: a receipt line's quantities are what the ledger was
 * told, and the way to correct them is to reverse the receipt rather than to rewrite one line of it.
 */
export class UpdateGoodsReceiptLineDTO extends PartialType(GoodsReceiptLineDTO) {}
