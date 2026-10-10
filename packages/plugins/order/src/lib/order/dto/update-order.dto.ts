import { PartialType } from '@nestjs/mapped-types';
import { OrderDTO } from './order.dto';

/** Update request validation. */
export class UpdateOrderDTO extends PartialType(OrderDTO) {}