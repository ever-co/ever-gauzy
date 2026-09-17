import { OrderResolver } from './order.resolver';
import { OrderChangeResolver } from './order-change.resolver';

export { OrderResolver } from './order.resolver';
export { OrderChangeResolver } from './order-change.resolver';
export * from './types';

/**
 * The domain's resolvers, in the order the schema extension expects them.
 *
 * A plugin's resolvers are registered with its SDL, so disabling the package removes both: the schema
 * never advertises a field nothing can resolve.
 */
export const orderResolvers = [OrderResolver, OrderChangeResolver];
