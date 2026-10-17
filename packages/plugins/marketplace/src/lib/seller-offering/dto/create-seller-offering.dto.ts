import { IntersectionType, PickType } from '@nestjs/mapped-types';
import { SellerOfferingDTO } from './seller-offering.dto';

/**
 * Create request validation.
 *
 * An offering names the seller and the variant it grants the right to sell; everything else — the price
 * reference, the commission override, the window and the publication set — is authored afterwards.
 *
 * An offering is created `DRAFT`: `status` is accepted only when it restates `DRAFT`, because submit, publish,
 * pause, unpause and withdraw are what move it (`SELLER_OFFERING_FIELD_NOT_WRITABLE` otherwise; review R2-G45).
 */
export class CreateSellerOfferingDTO extends IntersectionType(
	SellerOfferingDTO,
	PickType(SellerOfferingDTO, ['sellerId', 'variantId'] as const)
) {}
