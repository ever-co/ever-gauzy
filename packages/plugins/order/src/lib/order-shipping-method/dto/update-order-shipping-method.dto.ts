import { PartialType } from '@nestjs/mapped-types';
import { OrderShippingMethodDTO } from './order-shipping-method.dto';

/** Update request validation. */
export class UpdateOrderShippingMethodDTO extends PartialType(OrderShippingMethodDTO) {}