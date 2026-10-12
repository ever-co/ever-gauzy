import { PartialType } from '@nestjs/mapped-types';
import { ShippingOptionDTO } from './shipping-option.dto';

/** Update request validation. */
export class UpdateShippingOptionDTO extends PartialType(ShippingOptionDTO) {}