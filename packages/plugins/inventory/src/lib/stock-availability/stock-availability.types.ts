/**
 * What a caller that does not own stock asks about it, and what it is told.
 *
 * A cart line is the case this answers for: the cart may not read a stock table, so it states the
 * variant it is about and, when its channel has resolved one, the location it would be served from,
 * and the answer is a number it measures its own quantity against.
 *
 * The two shapes below are the inventory side of that seam. They are declared here, in the package
 * that owns stock, because the answer is composed from this package's own ledger and level rows:
 * the caller states the question in its own vocabulary and this package decides what the numbers on
 * this side mean.
 */
import { ID } from '@gauzy/contracts';

/** One line’s stock question: which variant, at which location. */
export interface IStockAvailabilityQuery {
	/** The variant the question is about. */
	readonly variantId: ID;
	/** The location it is asked about; absent asks it of every location the caller stocks. */
	readonly warehouseId?: ID;
}

/**
 * What may be sold of one variant, and how far past the stock a caller may go.
 *
 * `sellableQuantity` is a `number` rather than the exact decimal every quantity of this package is:
 * the caller compares it with a quantity it holds as a number, and the conversion is made here, once,
 * from the exact decimal the levels are summed at.
 */
export interface IStockSellability {
	/** Units that may be sold now: on hand, less what is held, less the unsellable buffer. */
	readonly sellableQuantity: number;
	/** Whether a quantity beyond the stock is accepted at the level the answer came from. */
	readonly allowBackorder: boolean;
	/** How far beyond the stock an order may go, when the level allows backorders and sets a ceiling. */
	readonly backorderLimit?: number;
}

/**
 * The quantity reported for a level whose stock is not counted.
 *
 * A level marked unlimited takes any quantity: the ledger’s own guard lets a hold of any size land on
 * it, and the level’s stored quantity is not a ceiling. The seam states its quantities as `number`s,
 * so "no ceiling" is reported as the largest integer a `number` represents exactly — a value no
 * stated quantity can exceed, and the one that makes the caller’s own comparison agree with the
 * ledger’s rule. Reporting the stored quantity instead would refuse every sale of an uncounted
 * variant, which is the opposite of what the level says.
 */
export const UNBOUNDED_SELLABLE = Number.MAX_SAFE_INTEGER;
