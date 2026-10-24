import { IntersectionType, PickType } from '@nestjs/mapped-types';
import { SellerSettlementDTO } from './seller-settlement.dto';

/**
 * Create request validation.
 *
 * A settlement is recorded from a provider report for one seller, one provider and one currency; the figures are the provider's and are stored as reported.
 *
 * A settlement is recorded `OPEN`: `status` is accepted only when it restates `OPEN`, because reconcile, close and
 * dispute are what move it (`SELLER_SETTLEMENT_FIELD_NOT_EDITABLE` otherwise; review R2-G45).
 */
export class CreateSellerSettlementDTO extends IntersectionType(
	SellerSettlementDTO,
	PickType(SellerSettlementDTO, ['sellerId', 'providerKey', 'currency'] as const)
) {}