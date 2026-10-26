import { PartialType } from '@nestjs/mapped-types';
import { OrderCreditLineDTO } from './order-credit-line.dto';

/** Update request validation. */
export class UpdateOrderCreditLineDTO extends PartialType(OrderCreditLineDTO) {}