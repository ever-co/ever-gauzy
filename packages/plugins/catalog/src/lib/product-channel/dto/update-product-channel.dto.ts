import { PartialType } from '@nestjs/mapped-types';
import { ProductChannelDTO } from './product-channel.dto';

/**
 * Update ProductChannel request DTO validation.
 *
 * Every member is optional, because an update states what changed rather than restating the row.
 */
export class UpdateProductChannelDTO extends PartialType(ProductChannelDTO) {}

