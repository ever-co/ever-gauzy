import { PartialType } from '@nestjs/mapped-types';
import { CollectionVariantDTO } from './collection-variant.dto';

/**
 * Update CollectionVariant request DTO validation.
 *
 * Every member is optional, because an update states what changed rather than restating the row.
 */
export class UpdateCollectionVariantDTO extends PartialType(CollectionVariantDTO) {}

