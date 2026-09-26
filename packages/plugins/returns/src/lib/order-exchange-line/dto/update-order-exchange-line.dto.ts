import { PartialType } from '@nestjs/mapped-types';
import { OrderExchangeLineDTO } from './order-exchange-line.dto';

/**
 * An update to an exchange line. The service refuses one once the exchange is approved, because the
 * price snapshot is what `differenceDue` was computed from.
 */
export class UpdateOrderExchangeLineDTO extends PartialType(OrderExchangeLineDTO) {}
