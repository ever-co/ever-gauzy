import { PartialType } from '@nestjs/mapped-types';
import { CollectionDTO } from './collection.dto';

/**
 * Update Collection request DTO validation.
 *
 * Every member is optional, because an update states what changed rather than restating the row.
 */
export class UpdateCollectionDTO extends PartialType(CollectionDTO) {}

