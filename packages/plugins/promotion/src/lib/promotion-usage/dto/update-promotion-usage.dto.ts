import { PartialType } from '@nestjs/mapped-types';
import { CreatePromotionUsageDTO } from './create-promotion-usage.dto';

/**
 * Update PromotionUsage request: every field of the create shape, all of them optional.
 */
export class UpdatePromotionUsageDTO extends PartialType(CreatePromotionUsageDTO) {}
