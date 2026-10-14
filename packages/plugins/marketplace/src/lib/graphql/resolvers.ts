import { SellerEntityResolver } from './marketplace.resolver';

/**
 * The resolver classes this plugin contributes.
 *
 * There is one resolver for the six aggregates the marketplace owns, because they are one surface
 * with one guard pair and one permission per operation: an offering, a ledger row, a payout, its
 * lines and a settlement are all read and written in the same tenant and organization scope, so
 * splitting them across classes would state that scoping six times and let the copies drift.
 *
 * The list is the single source for both registrations the platform needs — the plugin's
 * `extensions.resolvers`, which is how the contribution is declared, and the plugin module's
 * providers, which is what lets the resolver inject the same services the REST controllers call —
 * so a resolver added here is wired on both sides rather than on whichever one was remembered.
 */
export const resolvers = [SellerEntityResolver];

export { SellerEntityResolver };
