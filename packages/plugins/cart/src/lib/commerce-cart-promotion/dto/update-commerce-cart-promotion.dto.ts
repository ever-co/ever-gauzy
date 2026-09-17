import { PartialType } from '@nestjs/mapped-types';
import { CommerceCartPromotionDTO } from './commerce-cart-promotion.dto';

/** Change an applied promotion's recorded amount. */
export class UpdateCommerceCartPromotionDTO extends PartialType(CommerceCartPromotionDTO) {}
