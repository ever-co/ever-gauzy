import { PriceListDTO } from './price-list.dto';

/**
 * Create price list request validation.
 *
 * A list is created as a complete statement of its scope, so the create shape is the entity's
 * authorable surface with no field omitted: a list created without a scope column would silently
 * apply everywhere, which is the one outcome an operator never intends by accident.
 */
export class CreatePriceListDTO extends PriceListDTO {}
