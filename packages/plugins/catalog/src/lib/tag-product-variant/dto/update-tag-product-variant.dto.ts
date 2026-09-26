import { PartialType } from '@nestjs/mapped-types';
import { TagProductVariantDTO } from './tag-product-variant.dto';

/**
 * Update TagProductVariant request DTO validation.
 *
 * Every member is optional, because an update states what changed rather than restating the row.
 */
export class UpdateTagProductVariantDTO extends PartialType(TagProductVariantDTO) {}

