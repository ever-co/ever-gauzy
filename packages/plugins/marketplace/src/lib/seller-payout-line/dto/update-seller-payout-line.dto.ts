import { OmitType, PartialType } from '@nestjs/mapped-types';
import { SellerPayoutLineDTO } from './seller-payout-line.dto';

/**
 * Update request validation.
 *
 * A line's note is the only thing an update may change: the pair and the amount are what the payout and the ledger already agree on.
 */
export class UpdateSellerPayoutLineDTO extends PartialType(OmitType(SellerPayoutLineDTO, ['sellerPayoutId', 'sellerTransactionId'] as const)) {}