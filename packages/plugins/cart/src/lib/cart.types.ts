import { ID } from '@gauzy/contracts';

/**
 * One line's stock question: which variant, at which location.
 *
 * The location is optional because a cart line only carries one when the channel resolved it; the
 * capability answers for the location it is given, and for its default location when it is given none.
 */
export interface ICartStockQuery {
	/** The variant the line is for. */
	readonly variantId: ID;
	/** The location the line was priced for, when the channel resolved one. */
	readonly warehouseId?: ID;
}

/** What the stock capability reports about one variant at one location. */
export interface ICartStockAvailability {
	/**
	 * Units that may be sold right now: what is on hand, less what is already reserved, less the
	 * location's safety stock. Reported rather than derived here, because how it is derived is the
	 * inventory domain's own rule and a second derivation would be a second answer.
	 */
	readonly sellableQuantity: number;
	/** Whether the location accepts orders beyond what is on hand. */
	readonly allowBackorder: boolean;
	/** How far beyond what is on hand an order may go, when the location allows backorders. */
	readonly backorderLimit?: number;
}

/**
 * The stock capability as this package sees it.
 *
 * Provided by the inventory package and injected under `CART_STOCK_AVAILABILITY`. The cart asks this
 * one question and nothing else: stock is the inventory domain's, this package never reads a stock
 * table, and it never reserves — the reservation is the checkout operation's own `reserve-stock` step.
 */
export interface ICartStockPort {
	/**
	 * @param query The variant and, when it is known, the location.
	 * @returns What may be sold, or the quantity the location allows past what is on hand.
	 */
	availabilityOf(query: ICartStockQuery): Promise<ICartStockAvailability | null>;
}

/*
|--------------------------------------------------------------------------
| Injection tokens
|--------------------------------------------------------------------------
*/

/**
 * Token the stock capability is injected under.
 *
 * Optional on purpose: the cart is a complete package on its own, and an installation that runs it
 * without the inventory package must still create, validate and complete a cart. With no provider
 * registered the ladder reports the `STOCK` step as `SKIPPED` and the cart validates exactly as it did
 * before the step existed, so the availability is simply not known here; an installation that does
 * have the capability gets the step, and a cart that cannot be reserved is refused while the buyer can
 * still change it rather than when the checkout operation reserves it.
 */
export const CART_STOCK_AVAILABILITY = Symbol('CART_STOCK_AVAILABILITY');
