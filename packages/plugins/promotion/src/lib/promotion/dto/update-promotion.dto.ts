import { PartialType } from '@nestjs/mapped-types';
import { CreatePromotionDTO } from './create-promotion.dto';

/**
 * Update Promotion request: every field of the create shape, all of them optional.
 */
export class UpdatePromotionDTO extends PartialType(CreatePromotionDTO) {}
