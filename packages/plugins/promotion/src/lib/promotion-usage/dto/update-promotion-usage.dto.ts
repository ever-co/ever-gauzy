import { PartialType } from '@nestjs/mapped-types';
import { WithoutInitializers } from '@gauzy/common';
import { CreatePromotionUsageDTO } from './create-promotion-usage.dto';

/**
 * Update PromotionUsage request: every field of the create shape, all of them optional.
 *
 * Built through `WithoutInitializers`, so a partial update does not carry the create DTO's defaults back over the
 * stored values (review R3-04/R3-05).
 */
export class UpdatePromotionUsageDTO extends WithoutInitializers(PartialType(CreatePromotionUsageDTO)) {}
