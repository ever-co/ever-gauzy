/**
 * Enumeration vocabulary of the inventory domain.
 *
 * Every value set below is the union of the values named for that enumeration in the schema
 * specification, the enumeration catalogue and the inventory domain specification. A value that
 * any of the three names is a value an installation must be able to store, so the sets are
 * unioned rather than narrowed: a state a document transition can reach must exist in the
 * column that records it.
 */
/**
 * What caused a quantity change. The value decides which bookkeeping rule applies.
 */
export enum StockMovementType {
	/** Stock arrived: a goods receipt, an opening balance or a positive manual receipt. */
	RECEIPT = 'RECEIPT',
	/** Stock left the network for internal consumption rather than a sale. */
	ISSUE = 'ISSUE',
	/** A manual correction with a stated reason. The ledger is append-only, so a correction is an opposite row. */
	ADJUSTMENT = 'ADJUSTMENT',
	/** Stock arrived from another location. */
	TRANSFER_IN = 'TRANSFER_IN',
	/** Stock left for another location. */
	TRANSFER_OUT = 'TRANSFER_OUT',
	/** Quantity moved from available to reserved. */
	RESERVATION = 'RESERVATION',
	/** A reservation was released or expired; available goes back up. */
	RELEASE = 'RELEASE',
	/** Stock left because it was sold and fulfilled. */
	SALE = 'SALE',
	/** Stock came back from a customer and is sellable again. */
	RETURN = 'RETURN',
	/** Stock is gone and will not be sold. */
	WRITE_OFF = 'WRITE_OFF',
	/** Stock was found damaged and removed from the sellable network. */
	DAMAGE = 'DAMAGE',
	/** A stock-take correction; the quantity is the difference between counted and recorded. */
	COUNT = 'COUNT'
}

/**
 * Descriptive provenance of a movement.
 *
 * Deliberately a string rather than an enumeration: the handler has already run by the time the row
 * is written, the column records what caused it, and a new cause must not require an enumeration
 * change on the platform’s highest-volume table. An unrecognised value is valid data; it is
 * displayed as-is and never selects a handler.
 */
export type StockMovementReferenceType =
	| 'CART'
	| 'ORDER'
	| 'FULFILLMENT'
	| 'RETURN'
	| 'CLAIM'
	| 'EXCHANGE'
	| 'TRANSFER'
	| 'PURCHASE_ORDER'
	| 'GOODS_RECEIPT'
	| 'ADJUSTMENT'
	| 'COUNT'
	| 'PUTAWAY'
	| 'REPLENISHMENT'
	| 'PICK'
	| 'RECONCILIATION'
	| 'MIGRATION'
	| 'MANUAL';

/** The reference vocabulary as values, for callers that must name a document. */
export const StockMovementReferenceType = {
	CART: 'CART',
	ORDER: 'ORDER',
	FULFILLMENT: 'FULFILLMENT',
	RETURN: 'RETURN',
	CLAIM: 'CLAIM',
	EXCHANGE: 'EXCHANGE',
	TRANSFER: 'TRANSFER',
	PURCHASE_ORDER: 'PURCHASE_ORDER',
	GOODS_RECEIPT: 'GOODS_RECEIPT',
	ADJUSTMENT: 'ADJUSTMENT',
	COUNT: 'COUNT',
	PUTAWAY: 'PUTAWAY',
	REPLENISHMENT: 'REPLENISHMENT',
	PICK: 'PICK',
	RECONCILIATION: 'RECONCILIATION',
	MIGRATION: 'MIGRATION',
	MANUAL: 'MANUAL'
} as const;

/**
 * Reason codes carried by a movement, an adjustment or a count.
 */
export const StockReasonCode = {
	OPENING_BALANCE: 'OPENING_BALANCE',
	RECONCILIATION: 'RECONCILIATION',
	CYCLE_COUNT: 'CYCLE_COUNT',
	IN_TRANSIT_LOSS: 'IN_TRANSIT_LOSS',
	EXPIRED: 'EXPIRED',
	CUSTOMER_RETURN: 'CUSTOMER_RETURN',
	SUPPLIER_CLAIM: 'SUPPLIER_CLAIM',
	INTERNAL_USE: 'INTERNAL_USE',
	ORDER_CANCELED: 'ORDER_CANCELED',
	SHORT_PICK: 'SHORT_PICK',
	SUBSTITUTION: 'SUBSTITUTION',
	DAMAGE: 'DAMAGE',
	SCRAP: 'SCRAP',
	FOUND: 'FOUND'
} as const;

/**
 * Lifecycle of a hold on stock. `ACTIVE` is the only non-terminal value.
 */
export enum StockReservationStatus {
	/** Holding stock; counted in the level row’s reserved quantity. */
	ACTIVE = 'ACTIVE',
	/** Given back without the stock leaving. */
	RELEASED = 'RELEASED',
	/** The stock actually left; a matching movement was written in the same transaction. */
	CONSUMED = 'CONSUMED',
	/** Lapsed because the expiry passed. Separated from `RELEASED` so the expiry sweep is auditable. */
	EXPIRED = 'EXPIRED'
}

/**
 * The kind of document a hold belongs to. The set is closed and the code branches on it.
 */
export enum StockReservationReferenceType {
	CART = 'CART',
	ORDER = 'ORDER',
	RETURN = 'RETURN',
	CLAIM = 'CLAIM',
	EXCHANGE = 'EXCHANGE',
	TRANSFER = 'TRANSFER',
	SUBSCRIPTION = 'SUBSCRIPTION'
}

/**
 * Lifecycle of a transfer between two locations.
 */
export enum StockTransferStatus {
	/** Being prepared; no stock has moved. */
	DRAFT = 'DRAFT',
	/** Submitted for approval; still no stock movement. */
	REQUESTED = 'REQUESTED',
	/** Approved and awaiting dispatch. */
	APPROVED = 'APPROVED',
	/** Dispatched: outbound at the source, inbound expectation at the destination. */
	IN_TRANSIT = 'IN_TRANSIT',
	/** Some lines received. */
	PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED',
	/** Every line fully received. Terminal. */
	RECEIVED = 'RECEIVED',
	/** Abandoned; dispatched stock returns through a compensating transfer, never by editing the row. */
	CANCELED = 'CANCELED'
}

/**
 * How a manual correction states its quantity.
 */
export enum StockAdjustmentType {
	/** Add the stated quantity. */
	INCREASE = 'INCREASE',
	/** Remove the stated quantity. */
	DECREASE = 'DECREASE',
	/** The stated quantity is the observed target; the service derives the delta. */
	SET = 'SET',
	/** Withdraw unsellable stock. */
	SCRAP = 'SCRAP',
	/** Record damage found on hand. */
	DAMAGE = 'DAMAGE',
	/** Record stock discovered that the ledger did not know about. */
	FOUND = 'FOUND'
}

/**
 * Lifecycle of a manual correction instruction.
 */
export enum StockAdjustmentStatus {
	/** Drafted, not yet applied. */
	DRAFT = 'DRAFT',
	/** Applied. Immutable from here, and it has exactly one movement. */
	APPLIED = 'APPLIED',
	/** Abandoned without touching stock. */
	CANCELED = 'CANCELED'
}

/**
 * Lifecycle of a physical count session.
 */
export enum StockCountStatus {
	/** Created with a scope and no lines yet. */
	DRAFT = 'DRAFT',
	/** Lines snapshotted; the scope may be frozen. */
	OPEN = 'OPEN',
	/** At least one line counted. */
	COUNTING = 'COUNTING',
	/** Every line counted, awaiting a variance decision. */
	REVIEW = 'REVIEW',
	/** Closed; the ledger corrections have been written. Immutable. */
	CLOSED = 'CLOSED',
	/** Abandoned without writing the ledger. */
	CANCELED = 'CANCELED'
}

/**
 * Why a count was opened. The mode decides how the scope is generated.
 */
export enum StockCountMode {
	FULL = 'FULL',
	CYCLE = 'CYCLE',
	SPOT = 'SPOT',
	RECOUNT = 'RECOUNT'
}

/**
 * The outcome recorded against one counted line.
 */
export enum StockCountLineStatus {
	/** Not counted yet. */
	PENDING = 'PENDING',
	/** Counted once. */
	COUNTED = 'COUNTED',
	/** Counted a second time; the recount is the value that closes the line. */
	RECOUNTED = 'RECOUNTED',
	/** Deliberately not counted; the line writes nothing and is reported. */
	SKIPPED = 'SKIPPED'
}

/**
 * Lifecycle of a low-stock alert rule.
 */
export enum StockAlertStatus {
	/** The rule is enabled and the scan may fire it. */
	ACTIVE = 'ACTIVE',
	/** The rule is disabled; the row is kept so its history survives. */
	DISABLED = 'DISABLED'
}
