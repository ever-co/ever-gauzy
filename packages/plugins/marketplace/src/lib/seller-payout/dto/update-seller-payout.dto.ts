import { OmitType, PartialType } from '@nestjs/mapped-types';
import { SellerPayoutDTO } from './seller-payout.dto';

/**
 * Update request validation.
 *
 * An edit states what a payout says about itself — its note, its provider references, its period and
 * schedule and its metadata — and nothing its lifecycle owns. A payout's seller and currency are fixed once
 * it exists; its status moves only through the approve, pay, cancel and retry routes, each under its own
 * grant; its fee is what the provider reported when it was paid; its lines, and so its `transactionIds`,
 * are what it was built from; and its payout mode is snapshotted from the seller at creation. The body
 * used to carry `status`, `feeAmount`, `transactionIds` and `payoutMode`, which let a caller holding only
 * `SELLER_PAYOUTS_CREATE` mark a draft payout `PAID`; the service refuses them too
 * (`SELLER_PAYOUT_LIFECYCLE_MEMBERS`), so a body that reached it some other way is answered the same.
 */
export class UpdateSellerPayoutDTO extends PartialType(
	OmitType(SellerPayoutDTO, ['sellerId', 'currency', 'status', 'payoutMode', 'transactionIds', 'feeAmount'] as const)
) {}
