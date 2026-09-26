import { PartialType } from '@nestjs/mapped-types';
import { OrderSummaryDTO } from './order-summary.dto';

/** Update request validation. */
export class UpdateOrderSummaryDTO extends PartialType(OrderSummaryDTO) {}