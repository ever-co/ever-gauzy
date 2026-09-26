import { PartialType } from '@nestjs/mapped-types';
import { OrderLineDTO } from './order-line.dto';

/** Update request validation. */
export class UpdateOrderLineDTO extends PartialType(OrderLineDTO) {}