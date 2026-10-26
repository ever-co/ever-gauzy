import { PartialType } from '@nestjs/mapped-types';
import { ShippingProfileVariantDTO } from './shipping-profile-variant.dto';

/** Update request validation. */
export class UpdateShippingProfileVariantDTO extends PartialType(ShippingProfileVariantDTO) {}