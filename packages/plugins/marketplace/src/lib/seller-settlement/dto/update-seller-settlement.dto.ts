import { OmitType, PartialType } from '@nestjs/mapped-types';
import { SellerSettlementDTO } from './seller-settlement.dto';

/**
 * Update request validation.
 *
 * The provider, the seller, the currency and the payout of a settlement never change; its status moves only
 * through the reconcile, close and dispute routes; and its figures are the provider's report as recorded,
 * with the net derived from them rather than stated beside them. An edit therefore states what the
 * settlement says about itself — its period, its report and external references, the holder it pays, its
 * note and its metadata. The body used to carry `status` and the four figures, which let an edit close a
 * settlement without the close or give it a net its own figures do not produce; the service refuses them too
 * (`SELLER_SETTLEMENT_LIFECYCLE_MEMBERS`), so a body that reached it some other way is answered the same.
 */
export class UpdateSellerSettlementDTO extends PartialType(
	OmitType(SellerSettlementDTO, [
		'sellerId',
		'providerKey',
		'currency',
		'payoutId',
		'status',
		'grossAmount',
		'commissionAmount',
		'feeAmount',
		'netAmount'
	] as const)
) {}
