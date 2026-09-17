import { FulfillmentResolver } from './fulfillment.resolver';
import { ShippingOptionResolver } from './shipping-option.resolver';

/**
 * Every resolver this plugin contributes to the platform schema.
 *
 * The list is what the plugin hands the composition pass, and each class is also a provider of the
 * plugin's module — a resolver injects the same services the REST controllers do, so both surfaces
 * run through one implementation of every rule.
 */
export const fulfillmentResolvers = [FulfillmentResolver, ShippingOptionResolver];

export { FulfillmentResolver, ShippingOptionResolver };
