import { PartialType } from '@nestjs/mapped-types';
import { CollectionChannelDTO } from './collection-channel.dto';

/**
 * Update CollectionChannel request DTO validation.
 *
 * Every member is optional, because an update states what changed rather than restating the row.
 */
export class UpdateCollectionChannelDTO extends PartialType(CollectionChannelDTO) {}

