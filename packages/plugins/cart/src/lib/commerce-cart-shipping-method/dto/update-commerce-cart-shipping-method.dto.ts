import { PartialType } from '@nestjs/mapped-types';
import { CommerceCartShippingMethodDTO } from './commerce-cart-shipping-method.dto';

/** Change delivery choice request validation. */
export class UpdateCommerceCartShippingMethodDTO extends PartialType(CommerceCartShippingMethodDTO) {}
