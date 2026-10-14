import { PartialType } from '@nestjs/mapped-types';
import { ProductVariantMediaDTO } from './product-variant-media.dto';

/**
 * Update ProductVariantMedia request DTO validation.
 *
 * Every member is optional, because an update states what changed rather than restating the row.
 */
export class UpdateProductVariantMediaDTO extends PartialType(ProductVariantMediaDTO) {}

