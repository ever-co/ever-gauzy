import { CreateOrderClaimDTO } from './order-claim.dto';

/**
 * Creation input for a claim. Same shape as the create DTO; kept as its own name so the controller's
 * create contract is readable on its own.
 */
export class CreateOrderClaimCreateDTO extends CreateOrderClaimDTO {}
