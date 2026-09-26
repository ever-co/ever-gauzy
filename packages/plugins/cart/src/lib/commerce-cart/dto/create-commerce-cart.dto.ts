import { CommerceCartDTO } from './commerce-cart.dto';

/**
 * Create cart request validation.
 *
 * A cart is created empty or seeded with lines; either way its totals are computed by the totals
 * writer on creation, so a caller never states an amount.
 */
export class CreateCommerceCartDTO extends CommerceCartDTO {}
