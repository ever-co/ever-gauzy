import {
	ICommerceCart,
	ICommerceCartLine,
	ICommerceCartPromotion,
	ICommerceCartShippingMethod,
	ICommerceCartTotals,
	ICommerceCheckoutSession
} from '@gauzy/contracts';

/**
 * The GraphQL type names of the cart domain, bound to the contracts.
 *
 * A type in the schema and an interface in the contracts package describe the same rows, so they are
 * one definition here rather than two that can drift: the SDL states the shape a client sees, and
 * these aliases state which contract a resolver returns. The names are the concepts' own names — the
 * `commerce_` prefix belongs to the tables, and it stops there.
 */
export type Cart = ICommerceCart;
export type CartLine = ICommerceCartLine;
export type CartShippingMethod = ICommerceCartShippingMethod;
export type CartPromotion = ICommerceCartPromotion;
export type CheckoutSession = ICommerceCheckoutSession;
export type CartTotals = ICommerceCartTotals;

/** A page of carts. */
export interface ICartConnection {
	items: Cart[];
	total: number;
}

/** A page of checkout sessions. */
export interface ICheckoutSessionConnection {
	items: CheckoutSession[];
	total: number;
}

/** What a completed checkout returns. */
export interface ICheckoutResult {
	orderId: string;
	orderNumber: string;
	cart: Cart;
}
