import { PartialType } from '@nestjs/mapped-types';
import { ProductVariantChannelDTO } from './product-variant-channel.dto';

/**
 * Update ProductVariantChannel request DTO validation.
 *
 * Every member is optional, because an update states what changed rather than restating the row.
 */
export class UpdateProductVariantChannelDTO extends PartialType(ProductVariantChannelDTO) {}

