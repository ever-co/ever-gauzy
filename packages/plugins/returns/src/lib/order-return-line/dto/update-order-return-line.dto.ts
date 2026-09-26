import { PartialType } from '@nestjs/mapped-types';
import { OrderReturnLineDTO } from './order-return-line.dto';

/**
 * An update to a return line. A line that has already received units may only have its note changed;
 * the service enforces that, because the quantities a receipt was written against must not move.
 */
export class UpdateOrderReturnLineDTO extends PartialType(OrderReturnLineDTO) {}
