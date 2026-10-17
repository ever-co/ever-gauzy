import { PartialType } from '@nestjs/mapped-types';
import { OrderChangeActionDTO } from './order-change-action.dto';

/** Update request validation. */
export class UpdateOrderChangeActionDTO extends PartialType(OrderChangeActionDTO) {}