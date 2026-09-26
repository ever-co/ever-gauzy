import { IntersectionType, PickType } from '@nestjs/mapped-types';
import { SellerPayoutLineDTO } from './seller-payout-line.dto';

/**
 * Create request validation.
 *
 * A line is created by the payout run, one per included transaction; the pair is what makes a transaction payable at most once.
 */
export class CreateSellerPayoutLineDTO extends IntersectionType(
	SellerPayoutLineDTO,
	PickType(SellerPayoutLineDTO, ['sellerPayoutId', 'sellerTransactionId'] as const)
) {}