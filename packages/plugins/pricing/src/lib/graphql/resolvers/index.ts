import { ExchangeRateResolver } from './exchange-rate.resolver';
import { PriceListResolver } from './price-list.resolver';
import { PricePreferenceResolver } from './price-preference.resolver';
import { ProductPriceResolver } from './product-price.resolver';

/**
 * The resolver classes this plugin contributes.
 *
 * The platform registers them only when the plugin is configured, so disabling the plugin removes its
 * schema contribution and its resolvers together — which is why a resolver of this domain may inject
 * anything its own module provides and nothing else.
 */
export const resolvers = [PriceListResolver, ProductPriceResolver, PricePreferenceResolver, ExchangeRateResolver];

export { ExchangeRateResolver, PriceListResolver, PricePreferenceResolver, ProductPriceResolver };
