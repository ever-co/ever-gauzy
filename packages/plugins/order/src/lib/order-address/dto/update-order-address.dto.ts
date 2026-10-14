import { PartialType } from '@nestjs/mapped-types';
import { OrderAddressDTO } from './order-address.dto';

/** Update request validation. */
export class UpdateOrderAddressDTO extends PartialType(OrderAddressDTO) {}