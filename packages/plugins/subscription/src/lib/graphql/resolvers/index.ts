import { SubscriptionBillingResolver } from './subscription-billing.resolver';
import { SubscriptionItemResolver } from './subscription-item.resolver';
import { SubscriptionPlanResolver } from './subscription-plan.resolver';
import { SubscriptionResolver } from './subscription.resolver';

/**
 * Every resolver this plugin contributes to the platform schema.
 *
 * The list is what the plugin hands the composition pass, and each class is also a provider of the
 * plugin's module — a resolver injects the same services the REST controllers do, so both surfaces
 * run through one implementation of every rule.
 */
export const resolvers = [
	SubscriptionPlanResolver,
	SubscriptionResolver,
	SubscriptionItemResolver,
	SubscriptionBillingResolver
];

export { SubscriptionPlanResolver, SubscriptionResolver, SubscriptionItemResolver, SubscriptionBillingResolver };
