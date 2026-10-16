import { SellerEntityResolver } from './marketplace.resolver';
import { MarketplaceSubscriptionResolver } from './marketplace-subscription.resolver';

/**
 * The resolver classes this plugin contributes.
 *
 * There is one resolver for the queries and mutations of the six aggregates the marketplace owns, because they
 * are one surface with one guard pair and one permission per operation: an offering, a ledger row, a payout, its
 * lines and a settlement are all read and written in the same tenant and organization scope, so splitting them
 * across classes would state that scoping six times and let the copies drift. The streams are the second class,
 * because they read a different source — the outbox facts on the tenant topics — and they mount the same guards
 * and read through the same scoped service methods, so the scoping is still stated once, in the services.
 *
 * The list is the single source for both registrations the platform needs — the plugin's
 * `extensions.resolvers`, which is how the contribution is declared, and the plugin module's
 * providers, which is what lets the resolver inject the same services the REST controllers call —
 * so a resolver added here is wired on both sides rather than on whichever one was remembered.
 */
export const resolvers = [SellerEntityResolver, MarketplaceSubscriptionResolver];

export { SellerEntityResolver, MarketplaceSubscriptionResolver };
