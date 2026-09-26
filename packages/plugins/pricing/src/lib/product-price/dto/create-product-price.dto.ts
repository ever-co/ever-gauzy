import { ProductPriceDTO } from './product-price.dto';

/**
 * Create price request validation.
 *
 * A price with no `priceListId` is the variant's default price; a price with no quantity bounds is
 * the single price of the variant at any quantity. Both are ordinary creates rather than separate
 * endpoints, because they are the same row with a different scope.
 */
export class CreateProductPriceDTO extends ProductPriceDTO {}
