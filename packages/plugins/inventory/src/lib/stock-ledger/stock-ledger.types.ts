/**
 * The ledger as another package’s seam sees it: bin contents, the home bin of a variant, and the
 * movements a package that does not own stock states but never writes itself.
 *
 * A package that owns a physical operation — a pick, a count, a return, a receipt — knows what
 * moved and where it moved; it does not own `stock_movement` and must not write it. So it states the
 * movement it wants in its own vocabulary and this package decides the level, exactly as the manual
 * correction, the transfer and the cycle count already do. Two shapes are declared for that: the
 * request a caller states, and the answer that says which row was written and what the level became.
 *
 * The balances are declared here as well, because they are derived from this package’s ledger rather
 * than stored: a bin holds nothing of its own, and what it holds is the sum of the movements recorded
 * against it.
 */
import { DecimalString, ID } from '@gauzy/contracts';

/** What the ledger knows about one variant in one bin, derived from the movement ledger. */
export interface IStockLedgerBinBalance {
	/** The variant the balance is for. */
	readonly variantId: ID;
	/** The bin the balance is held in; absent when the balance is the whole location’s. */
	readonly binId?: ID;
	/** On-hand quantity, derived from the movement ledger. */
	readonly quantity: DecimalString;
}

/** A question about one variant at one location, or in one bin of it. */
export interface IStockLedgerBalanceQuery {
	/** The location the question is about. */
	readonly warehouseId: ID;
	/** The variant the question is about. */
	readonly variantId: ID;
	/** The bin the question is about; absent means the whole location. */
	readonly binId?: ID;
}

/** Where a variant is normally kept at a location, and how much of it the level holds there. */
export interface IStockLedgerHomeBin {
	/** The bin the level row names as home, when it names one. */
	readonly binId?: ID;
	/** What the level holds at the location. */
	readonly quantity?: DecimalString;
}

/**
 * One movement a caller states, in the vocabulary of its own domain.
 *
 * `kind` is the calling package’s movement kind, carried as text: the packages that consume this seam
 * each declare their own small enumeration of the kinds they produce — a pick adjusts, a return
 * restocks, a receipt arrives — and none of them owns the ledger’s vocabulary. What the ledger does
 * with a kind is stated once, in the service that answers this seam, so a caller reads it in one
 * place rather than inferring it from its own enumeration.
 */
export interface IStockLedgerMovementRequest {
	/** The location the movement happened at. */
	readonly warehouseId: ID;
	/** The variant that moved. */
	readonly variantId: ID;
	/** Signed quantity; positive adds to stock, negative removes from it. */
	readonly quantity: DecimalString;
	/** What kind of movement this is. */
	readonly kind: string;
	/** The bin the movement physically happened in, when the location addresses stock by bin. */
	readonly binId?: ID;
	/** The concept that asked for the movement, e.g. `ORDER_RETURN`. */
	readonly referenceType: string;
	/** The row that asked for the movement. */
	readonly referenceId: ID;
	/** Free-text explanation kept beside the movement. */
	readonly reason?: string;
	/** Instant the movement happened; defaults to now. */
	readonly occurredAt?: Date;
}

/** What the ledger answers with once a movement is written. */
export interface IStockLedgerMovementResult {
	/** The movement row that was written. */
	readonly movementId: ID;
	/** The level after the movement, as the ledger computed it. */
	readonly quantityAfter: DecimalString;
}

/** One relocation of units between two bins of one location. */
export interface IStockLedgerRelocation {
	/** The location both bins belong to. */
	readonly warehouseId: ID;
	/** The variant being moved. */
	readonly variantId: ID;
	/** The bin the units leave. */
	readonly fromBinId: ID;
	/** The bin the units arrive in. */
	readonly toBinId: ID;
	/** The positive quantity being moved; the direction is the pair of bins. */
	readonly quantity: DecimalString;
	/** The concept that asked for the move, e.g. `WAREHOUSE_BIN_TRANSFER`. */
	readonly referenceType: string;
	/** The row that asked for the move. */
	readonly referenceId: ID;
	/** Free-text explanation kept beside both movements. */
	readonly reason?: string;
}
