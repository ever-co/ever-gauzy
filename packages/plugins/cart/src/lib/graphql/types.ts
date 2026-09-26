import { GraphqlConnection } from '@gauzy/core';
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

/**
 * A page of carts, and a page of checkout sessions.
 *
 * Both were a two-member shape of their own — `{ items, total }`, with no boundary a client could walk
 * from — which is the shape the schema no longer declares. The kernel's connection is the one shape
 * every list field of the platform answers with, so a client that can page one domain can page them all.
 */
export type ICartConnection = GraphqlConnection<Cart>;
export type ICheckoutSessionConnection = GraphqlConnection<CheckoutSession>;

/** What a completed checkout returns. */
export interface ICheckoutResult {
	orderId: string;
	orderNumber: string;
	cart: Cart;
}
