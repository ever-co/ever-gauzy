import { OmitType, PartialType } from '@nestjs/mapped-types';
import { SellerOfferingDTO } from './seller-offering.dto';

/**
 * Update request validation.
 *
 * The subject of an offering is immutable: an offering that changed variant would silently rewrite what past orders were priced against. Withdraw it and create another.
 */
export class UpdateSellerOfferingDTO extends PartialType(OmitType(SellerOfferingDTO, ['sellerId', 'variantId'] as const)) {}