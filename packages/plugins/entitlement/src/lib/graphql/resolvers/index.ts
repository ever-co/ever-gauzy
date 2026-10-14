import { EntitlementActivationResolver } from './entitlement-activation.resolver';
import { EntitlementKeyResolver } from './entitlement-key.resolver';
import { EntitlementResolver } from './entitlement.resolver';

/**
 * Every resolver this plugin contributes to the platform schema.
 *
 * The list is what the plugin hands the composition pass, and each class is also a provider of the
 * plugin's module — a resolver injects the same services the REST controllers do, so both surfaces
 * run through one implementation of every rule.
 */
export const resolvers = [EntitlementResolver, EntitlementActivationResolver, EntitlementKeyResolver];

export { EntitlementResolver, EntitlementActivationResolver, EntitlementKeyResolver };
