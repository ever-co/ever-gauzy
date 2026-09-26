import { OrderClaimLineResolver } from './order-claim-line.resolver';
import { OrderClaimResolver } from './order-claim.resolver';
import { OrderExchangeLineResolver } from './order-exchange-line.resolver';
import { OrderExchangeResolver } from './order-exchange.resolver';
import { OrderReturnLineResolver } from './order-return-line.resolver';
import { OrderReturnReasonResolver } from './order-return-reason.resolver';
import { OrderReturnResolver } from './order-return.resolver';

/**
 * Every resolver this plugin contributes to the platform schema.
 *
 * The list is what the plugin hands the composition pass, and each class is also a provider of the
 * plugin's module — a resolver injects the same services the REST controllers do, so both surfaces
 * run through one implementation of every rule.
 */
export const resolvers = [
	OrderReturnResolver,
	OrderReturnLineResolver,
	OrderReturnReasonResolver,
	OrderClaimResolver,
	OrderClaimLineResolver,
	OrderExchangeResolver,
	OrderExchangeLineResolver
];

export {
	OrderReturnResolver,
	OrderReturnLineResolver,
	OrderReturnReasonResolver,
	OrderClaimResolver,
	OrderClaimLineResolver,
	OrderExchangeResolver,
	OrderExchangeLineResolver
};
