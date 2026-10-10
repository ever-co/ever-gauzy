import { CommerceCart } from '../commerce-cart/commerce-cart.entity';
import { CommerceCartLine } from '../commerce-cart-line/commerce-cart-line.entity';
import { CommerceCartPromotion } from '../commerce-cart-promotion/commerce-cart-promotion.entity';
import { CommerceCartShippingMethod } from '../commerce-cart-shipping-method/commerce-cart-shipping-method.entity';
import { CommerceCheckoutSession } from '../commerce-checkout-session/commerce-checkout-session.entity';

export { CommerceCart } from '../commerce-cart/commerce-cart.entity';
export { CommerceCartLine } from '../commerce-cart-line/commerce-cart-line.entity';
export { CommerceCartPromotion } from '../commerce-cart-promotion/commerce-cart-promotion.entity';
export { CommerceCartShippingMethod } from '../commerce-cart-shipping-method/commerce-cart-shipping-method.entity';
export { CommerceCheckoutSession } from '../commerce-checkout-session/commerce-checkout-session.entity';

/**
 * Every entity this plugin owns.
 *
 * The array is the single source for the plugin's `entities` metadata and for the per-ORM feature
 * registration of its module, so an entity that exists in one place and not the other cannot be
 * declared twice or forgotten once.
 */
export const ALL_CART_ENTITIES = [
	CommerceCart,
	CommerceCartLine,
	CommerceCartShippingMethod,
	CommerceCartPromotion,
	CommerceCheckoutSession
];
