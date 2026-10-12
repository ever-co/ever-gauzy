import { CommerceCartResolver } from './commerce-cart.resolver';
import { CommerceCartLineResolver } from './commerce-cart-line.resolver';
import { CommerceCartPromotionResolver } from './commerce-cart-promotion.resolver';
import { CommerceCartShippingMethodResolver } from './commerce-cart-shipping-method.resolver';
import { CommerceCheckoutSessionResolver } from './commerce-checkout-session.resolver';

export { CommerceCartResolver } from './commerce-cart.resolver';
export { CommerceCartLineResolver } from './commerce-cart-line.resolver';
export { CommerceCartPromotionResolver } from './commerce-cart-promotion.resolver';
export { CommerceCartShippingMethodResolver } from './commerce-cart-shipping-method.resolver';
export { CommerceCheckoutSessionResolver } from './commerce-checkout-session.resolver';
export * from './types';

/**
 * The domain's resolvers, in the order the schema extension expects them.
 *
 * A plugin's resolvers are registered with its SDL: disabling the package removes both, so a schema
 * never advertises a field that nothing can resolve.
 */
export const cartResolvers = [
	CommerceCartResolver,
	CommerceCartLineResolver,
	CommerceCartShippingMethodResolver,
	CommerceCartPromotionResolver,
	CommerceCheckoutSessionResolver
];
