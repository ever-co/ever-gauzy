import { OrderResolver } from './order.resolver';
import { OrderChangeResolver } from './order-change.resolver';

export { OrderResolver } from './order.resolver';
export { OrderChangeResolver } from './order-change.resolver';

/**
 * The GraphQL-only shapes: the connection payloads and the totals a root field answers with.
 *
 * The remaining aliases in `./types` name the schema's types after the entities themselves. The
 * entities are what this package exports from `./entities`, so re-exporting the aliases too would
 * leave those names ambiguous at the package root; they stay where the resolvers import them.
 */
export type {
	IOrderChangeConnection,
	IOrderConnection,
	IOrderSummaryConnection,
	IOrderTransactionConnection,
	OrderTotals
} from './types';

/**
 * The domain's resolvers, in the order the schema extension expects them.
 *
 * A plugin's resolvers are registered with its SDL, so disabling the package removes both: the schema
 * never advertises a field nothing can resolve.
 */
export const orderResolvers = [OrderResolver, OrderChangeResolver];
