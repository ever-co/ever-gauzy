import { PartialType } from '@nestjs/mapped-types';
import { WithoutInitializers } from '@gauzy/common';
import { CreateCouponDTO } from './create-coupon.dto';

/**
 * Update Coupon request: every field of the create shape, all of them optional.
 *
 * Built through `WithoutInitializers`, so a partial update does not carry the create DTO's defaults back over the
 * stored values (review R3-04/R3-05).
 */
export class UpdateCouponDTO extends WithoutInitializers(PartialType(CreateCouponDTO)) {}
