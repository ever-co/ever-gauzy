import { PartialType } from '@nestjs/mapped-types';
import { OrderChangeDTO } from './order-change.dto';

/** Update request validation. */
export class UpdateOrderChangeDTO extends PartialType(OrderChangeDTO) {}