import { IntersectionType, PickType } from '@nestjs/mapped-types';
import { SellerPayoutDTO } from './seller-payout.dto';

/**
 * Create request validation.
 *
 * A payout is built from settleable transactions of one seller in one currency, so the seller and the currency are what a caller states and the amount is what the ledger says.
 */
export class CreateSellerPayoutDTO extends IntersectionType(
	SellerPayoutDTO,
	PickType(SellerPayoutDTO, ['sellerId', 'currency'] as const)
) {}