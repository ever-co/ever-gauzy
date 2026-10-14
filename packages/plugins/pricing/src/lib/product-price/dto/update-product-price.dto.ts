import { OmitType, PartialType } from '@nestjs/mapped-types';
import { ProductPriceDTO } from './product-price.dto';

/**
 * Update price request validation.
 *
 * `variantId` is omitted on purpose: moving a price to another variant is not an edit of this row
 * but a different price, and allowing it would let a bulk edit silently re-point a tier at a
 * variant whose other tiers know nothing about it. Delete and re-create instead, which is also what
 * keeps the tier-overlap check meaningful.
 */
export class UpdateProductPriceDTO extends PartialType(OmitType(ProductPriceDTO, ['variantId'] as const)) {}
