import { PartialType } from '@nestjs/mapped-types';
import { OrderTransactionDTO } from './order-transaction.dto';

/** Update request validation. */
export class UpdateOrderTransactionDTO extends PartialType(OrderTransactionDTO) {}