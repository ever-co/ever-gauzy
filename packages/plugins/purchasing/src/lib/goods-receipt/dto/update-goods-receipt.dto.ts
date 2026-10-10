import { PartialType } from '@nestjs/mapped-types';
import { GoodsReceiptDTO } from './goods-receipt.dto';

/**
 * An update to a goods receipt's annotation.
 *
 * A posted receipt is never edited: its lines are the ledger's explanation for the movements it
 * wrote. What a caller may still change is the note and the tenant extras, and the service refuses
 * the update outright once the receipt has been reversed.
 */
export class UpdateGoodsReceiptDTO extends PartialType(GoodsReceiptDTO) {}
