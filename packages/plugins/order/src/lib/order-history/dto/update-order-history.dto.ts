import { PartialType } from '@nestjs/mapped-types';
import { OrderHistoryDTO } from './order-history.dto';

/** Update request validation. */
export class UpdateOrderHistoryDTO extends PartialType(OrderHistoryDTO) {}