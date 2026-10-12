import { PartialType } from '@nestjs/mapped-types';
import { CreateCouponDTO } from './create-coupon.dto';

/**
 * Update Coupon request: every field of the create shape, all of them optional.
 */
export class UpdateCouponDTO extends PartialType(CreateCouponDTO) {}
