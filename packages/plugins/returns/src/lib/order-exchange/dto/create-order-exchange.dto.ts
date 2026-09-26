import { CreateOrderExchangeDTO } from './order-exchange.dto';

/**
 * Creation input for an exchange. Same shape as the create DTO; kept as its own name so the
 * controller's create contract is readable on its own.
 */
export class CreateOrderExchangeCreateDTO extends CreateOrderExchangeDTO {}
