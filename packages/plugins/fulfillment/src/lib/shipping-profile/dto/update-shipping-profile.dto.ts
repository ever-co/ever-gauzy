import { PartialType } from '@nestjs/mapped-types';
import { ShippingProfileDTO } from './shipping-profile.dto';

/** Update request validation. */
export class UpdateShippingProfileDTO extends PartialType(ShippingProfileDTO) {}