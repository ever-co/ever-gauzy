import { PartialType } from '@nestjs/mapped-types';
import { OrderExchangeDTO } from './order-exchange.dto';

/**
 * An update to an exchange that has not been resolved yet.
 */
export class UpdateOrderExchangeDTO extends PartialType(OrderExchangeDTO) {}
