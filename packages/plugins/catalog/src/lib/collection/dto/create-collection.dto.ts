import { PartialType } from '@nestjs/mapped-types';
import { CollectionDTO } from './collection.dto';

/**
 * Create Collection request DTO validation.
 *
 * The tenant and organization columns are optional on the request: the service fills them from the
 * request context, and accepting them here is what lets a tenant administrator backfill a row on
 * behalf of a narrower scope without an endpoint of its own.
 */
export class CreateCollectionDTO extends PartialType(CollectionDTO) {}

