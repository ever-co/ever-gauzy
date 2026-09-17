import { CreateOrderReturnReasonDTO } from './order-return-reason.dto';

/**
 * Creation input for a governed return reason. Same shape as the create DTO; kept as its own name so
 * the controller's create contract is readable on its own.
 */
export class CreateOrderReturnReasonCreateDTO extends CreateOrderReturnReasonDTO {}
