import { PartialType } from '@nestjs/mapped-types';
import { CollectionProductDTO } from './collection-product.dto';

/**
 * Update CollectionProduct request DTO validation.
 *
 * Every member is optional, because an update states what changed rather than restating the row.
 */
export class UpdateCollectionProductDTO extends PartialType(CollectionProductDTO) {}

