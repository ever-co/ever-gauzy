import { ICommerceCart } from '@gauzy/contracts';

/**
 * What a checkout handler is given when a cart is completed.
 */
export interface ICartCheckoutContext {
	/** The cart being converted, with its totals already recomputed and validated. */
	readonly cart: ICommerceCart;
	/** The idempotency key of the completing request, when the caller supplied one. */
	readonly idempotencyKey?: string;
	/** The payment session the buyer settled with, when the checkout used one. */
	readonly paymentSessionId?: string;
}

/**
 * What a checkout handler returns.
 */
export interface ICartCheckoutResult {
	/** The order the cart became. */
	readonly orderId: string;
	/** The order's human-facing number. */
	readonly orderNumber: string;
}

/**
 * The one thing the cart cannot do itself.
 *
 * Completing a cart produces an order, and the order is a different aggregate owned by a different
 * package. The dependency may only run one way — the order package depends on the cart, never the
 * reverse — so the cart does not import the order package. It publishes the place where a checkout is
 * performed and the order package registers the handler that performs it, which keeps the dependency
 * graph acyclic and keeps the cart usable on an installation that has no orders at all.
 */
export interface ICartCheckoutHandler {
	/** Stable key of the handler, used in diagnostics. */
	readonly key: string;
	/**
	 * Places the order for a validated cart.
	 *
	 * @param context The cart and the checkout request.
	 * @returns The created order's identity.
	 */
	complete(context: ICartCheckoutContext): Promise<ICartCheckoutResult>;
}

/**
 * The registry a checkout handler registers itself with.
 *
 * Deliberately a module-level singleton rather than a Nest provider: the plugin that registers a
 * handler does so from its own bootstrap hook, before any request exists, and a provider would make
 * registration depend on the module import order of two independent packages.
 */
export class CartCheckoutRegistry {
	private handlers = new Map<string, ICartCheckoutHandler>();

	/**
	 * Registers a handler. Registering a key twice replaces it, so a hot reload cannot leave two
	 * handlers racing for the same cart.
	 *
	 * @param handler The handler.
	 */
	register(handler: ICartCheckoutHandler): void {
		if (!handler?.key) {
			throw new Error('CART_CHECKOUT_HANDLER_INVALID: a checkout handler must declare a key.');
		}

		this.handlers.set(handler.key, handler);
	}

	/**
	 * @param key The handler's key; the only registered handler when omitted.
	 * @returns The handler, or null when none is registered.
	 */
	resolve(key?: string): ICartCheckoutHandler | null {
		if (key) {
			return this.handlers.get(key) ?? null;
		}

		const registered = [...this.handlers.values()];

		return registered.length === 1 ? registered[0] : registered[0] ?? null;
	}

	/** @returns The registered keys. */
	get keys(): string[] {
		return [...this.handlers.keys()];
	}
}

/** The registry a checkout handler registers itself with. */
export const cartCheckoutRegistry = new CartCheckoutRegistry();
