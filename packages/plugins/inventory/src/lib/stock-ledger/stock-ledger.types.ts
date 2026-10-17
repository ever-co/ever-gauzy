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
 *
 * **The quantity is the delta, unless the caller states that the movement is an event.** Every kind is
 * a delta kind: the signed quantity the caller states is what the level moves by. A caller recording
 * units that never entered the location’s stock at all — a return’s discarded or damaged units — states
 * `eventOnly`, and then the row is written with a zero delta and the stated quantity is kept in the
 * row’s note. Which of the two a movement is belongs to the *request* and not to the kind, because the
 * same kind is stated by callers on both sides of it: a compensating write-off that takes back what a
 * receipt added moves the level, while a write-off of goods that never reached the shelf does not.
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
	/**
	 * Whether this movement records an event about units that never entered this location’s stock.
	 *
	 * `false` (the default) means the stated quantity is the level’s delta. `true` means the units are
	 * outside the level — the row records the event, the stated quantity is kept in the row’s note, and
	 * the level keeps the quantity it had.
	 */
	readonly eventOnly?: boolean;
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

/**
 * One put-away: the walk received units take from where they were dropped into a storage bin.
 *
 * It differs from a relocation in two ways that are the reason it is its own request rather than a
 * relocation with an option. The units **arrive** — they were received into the location a moment ago and
 * this is the movement that says where they now live — and the target bin becomes the variant's **home
 * bin**, the column a pick reads to know where to send the picker. A relocation moves units between bins a
 * level already holds; a put-away is how the level comes to hold them in a bin at all.
 */
export interface IStockLedgerPutAway {
	/** The location the units are already in. */
	readonly warehouseId: ID;
	/** The variant being placed. */
	readonly variantId: ID;
	/** The bin the units are placed into, which becomes the variant's home bin. */
	readonly binId: ID;
	/** The positive quantity being placed. */
	readonly quantity: DecimalString;
	/** The stock movement the units were received by, when the caller has one. */
	readonly stockMovementId?: ID;
	/** The concept that asked for the put-away, e.g. `GOODS_RECEIPT`. */
	readonly referenceType: string;
	/** The row that asked for the put-away. */
	readonly referenceId: ID;
	/** The bin the units are walking from, when the receiving area is itself a bin. */
	readonly fromBinId?: ID;
	/**
	 * Whether this put-away is *also* the receipt of the units into the location.
	 *
	 * **The default is false, and that default is the correction.** A put-away is a walk: the units are
	 * already at the location — the receipt recorded them there — and the walk says which address they
	 * live at. So it is two legs, and the location's own quantity is the same before and after. Written
	 * as one leg it credited the location a second time: a receipt of a hundred units followed by a
	 * put-away of the same hundred left the level reading two hundred while the building held one
	 * hundred, and neither the ledger nor a reconciliation could see it, because both sides of the
	 * comparison were inflated by the same amount.
	 *
	 * A caller that really is receiving and addressing in one call — stock that arrives directly into a
	 * storage position, with no separate receipt behind it — states this, and the arrival leg is then
	 * the only one written.
	 */
	readonly receiving?: boolean;
	/** Free-text explanation kept beside both movements. */
	readonly reason?: string;
}

/** What a put-away wrote. */
export interface IStockLedgerPutAwayResult {
	/**
	 * The leg the units left: the receiving bin when the caller named one, and the location's
	 * unaddressed pool otherwise. Absent only for a put-away that states it is also the receipt.
	 */
	readonly transferOutMovementId?: ID;
	/** The leg into the target bin. */
	readonly transferInMovementId: ID;
	/** The bin the level row now names as the variant's home, which is the one that was placed into. */
	readonly binId: ID;
	/** The level after the walk, as the ledger computed it. */
	readonly quantityAfter: DecimalString;
}
