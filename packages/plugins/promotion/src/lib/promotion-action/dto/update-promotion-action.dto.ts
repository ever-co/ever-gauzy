import { PartialType } from '@nestjs/mapped-types';
import { CreatePromotionActionDTO } from './create-promotion-action.dto';

/**
 * Update PromotionAction request: every field of the create shape, all of them optional.
 */
export class UpdatePromotionActionDTO extends PartialType(CreatePromotionActionDTO) {}
