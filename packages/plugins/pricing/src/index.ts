/**
 * Public API Surface of @gauzy/plugin-pricing
 *
 * The package exports its plugin class — what the host application registers — together with the four
 * entities and services that own the pricing tables. A capability further up the stack (a cart, a
 * promotion, an order) prices through these services rather than reading the tables itself, which is
 * what keeps one resolved price the same wherever it is asked for.
 */
export * from './lib/pricing.plugin';
export * from './lib/pricing.module';
export * from './lib/pricing.types';
export * from './lib/pricing.permissions';
export * from './lib/pricing.features';
export * from './lib/price-list/price-list.entity';
export * from './lib/price-list/price-list.service';
export * from './lib/product-price/product-price.entity';
export * from './lib/product-price/product-price.service';
export * from './lib/price-preference/price-preference.entity';
export * from './lib/price-preference/price-preference.service';
export * from './lib/exchange-rate/exchange-rate.entity';
export * from './lib/exchange-rate/exchange-rate.service';
export * from './lib/database/migrations';
export * from './lib/graphql';
