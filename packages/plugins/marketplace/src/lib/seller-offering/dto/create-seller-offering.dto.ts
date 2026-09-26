import { IntersectionType, PickType } from '@nestjs/mapped-types';
import { SellerOfferingDTO } from './seller-offering.dto';

/**
 * Create request validation.
 *
 * An offering names the seller and the variant it grants the right to sell; everything else — the price
 * reference, the commission override, the window and the publication set — is authored afterwards.
 */
export class CreateSellerOfferingDTO extends IntersectionType(
	SellerOfferingDTO,
	PickType(SellerOfferingDTO, ['sellerId', 'variantId'] as const)
) {}
