import { OmitType, PartialType } from '@nestjs/mapped-types';
import { SellerPayoutDTO } from './seller-payout.dto';

/**
 * Update request validation.
 *
 * A payout's seller and currency are fixed once it exists; what changes is its status, and only along the payout lifecycle.
 */
export class UpdateSellerPayoutDTO extends PartialType(OmitType(SellerPayoutDTO, ['sellerId', 'currency'] as const)) {}