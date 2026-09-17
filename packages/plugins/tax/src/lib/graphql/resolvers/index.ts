import { TaxCategoryResolver } from './tax-category.resolver';
import { TaxRateResolver } from './tax-rate.resolver';

/**
 * The resolvers this plugin contributes to the platform's schema.
 *
 * The array is what the plugin metadata declares, and it is the whole contribution: a plugin's resolvers
 * are registered only when the plugin is loaded, so disabling the package removes its schema and its
 * resolvers together.
 */
export const resolvers = [TaxCategoryResolver, TaxRateResolver];
