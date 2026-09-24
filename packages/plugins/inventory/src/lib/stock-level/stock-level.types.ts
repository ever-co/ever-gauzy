/**
 * The contract of the single write path into stock.
 *
 * Every quantity change on the platform is expressed as one of these inputs and applied by
 * `StockLevelService.applyMovement`, inside one transaction, together with the level row update and
 * the append-only ledger row that records the resulting quantity.
 */
import { ID } from '@gauzy/contracts';
import { StockMovementType, StockMovementReferenceType } from './../inventory.enums';

/**
 * The `@Versioned({ target })` a route states when its version is the **level's**.
 *
 * A route that posts stock against a document — applying an adjustment, placing or releasing a hold,
 * closing a count, reconciling, a pick or a put-away — protects the level row the document moves, so
 * the version its caller states is the level's. The engine reads that version from the request, and
 * it honours it only when the route named this table: a request can reach the engine from a route
 * whose version belongs to a record of its own, and a return's or an order's version predicated
 * onto a level row refuses every write the level did not happen to share a number with.
 *
 * It is the level row's table name, so a package that reaches the engine through a port — the
 * warehouse package's bin and pick routes — can state it without importing this one.
 */
export const STOCK_LEVEL_VERSION_TARGET = 'warehouse_product_variant';

/** One quantity and reservation change, expressed as a signed delta. */
export interface IStockMovementInput {
	/** Location the change happened at. */
	readonly warehouseId: ID;
	/** Variant the change applies to. */
	readonly variantId: ID;
	/** Product of the variant, denormalised so a ledger read does not need the variant row. */
	readonly productId?: ID;
	/** Physical bin inside the location. Refused on a location that is not binned. */
	readonly binId?: ID;
	/** What caused the change. */
	readonly type: StockMovementType;
	/** Signed change applied to the level’s on-hand quantity. `0` is allowed for a pure hold change. */
	readonly quantityDelta: number;
	/** Signed change applied to the level’s reserved quantity. `0` is allowed for a pure quantity change. */
	readonly reservedDelta: number;
	/** Kind of document that caused the change. */
	readonly referenceType: StockMovementReferenceType;
	/** Id of the document that caused the change. */
	readonly referenceId: ID;
	/** Machine-readable reason code, required for a manual correction. */
	readonly reason?: string;
	/** Free text from the operator. */
	readonly note?: string;
	/** Business time of the change; defaults to now. */
	readonly occurredAt?: Date;
	/** How long to wait for the level row lock before refusing, in milliseconds. */
	readonly lockTimeoutMs?: number;
	/** Set when the caller already resolved the level row and wants the reservation of that row. */
	readonly levelId?: ID;
}

/** The outcome of one applied movement. */
export interface IAppliedMovement {
	readonly movementId: ID;
	readonly levelId: ID;
	/**
	 * The version the level holds after this movement.
	 *
	 * It is reported because a caller can only condition its next write on a version it has been told:
	 * the value is published as the response's `ETag` on a versioned route, and a client that replays
	 * one is answered with the same version rather than a second movement.
	 */
	readonly version: number;
	readonly quantityBefore: number;
	readonly quantityAfter: number;
	readonly reservedBefore: number;
	readonly reservedAfter: number;
	readonly binId?: ID;
}

/** The availability of one level row, derived and never stored. */
export interface IStockAvailability {
	readonly levelId: ID;
	readonly warehouseId: ID;
	readonly variantId: ID;
	/** The level's optimistic-lock counter, which is what a conditional write is stated against. */
	readonly version: number;
	readonly quantity: number;
	readonly reservedQuantity: number;
	readonly safetyStock: number;
	readonly availableQuantity: number;
	readonly incomingQuantity: number;
	readonly isUnlimited: boolean;
	readonly allowBackorder: boolean;
	readonly backorderLimit?: number;
}

/** Which level rows a reconciliation walks. */
export interface IStockReconciliationFilter {
	/** Restrict the walk to one location. */
	readonly warehouseId?: ID;
	/** Restrict the walk to one variant. */
	readonly variantId?: ID;
	/** How many level rows one run walks; the documented batch size is the default. */
	readonly take?: number;
	/** How long to wait for a level row lock before the write is refused, in milliseconds. */
	readonly lockTimeoutMs?: number;
}

/**
 * One level the reconciliation put back in agreement with its ledger.
 *
 * The numbers are carried so the report says what the run changed and by how much, rather than only
 * how many rows it touched: `quantityBefore` is what the level held, `ledgerQuantity` is what its
 * movements sum to, and `quantityAfter` is the value the correction left behind.
 */
export interface IStockLevelCorrection {
	readonly levelId: ID;
	readonly warehouseId: ID;
	readonly variantId: ID;
	readonly quantityBefore: number;
	readonly ledgerQuantity: number;
	readonly quantityAfter: number;
}

/**
 * What one reconciliation run found and corrected.
 *
 * `scanned` counts the level rows the run walked and `corrected` the rows the ledger disagreed with;
 * a run that reports zero corrected rows is the operational definition of a ledger that has
 * converged with its levels.
 */
export interface IStockReconciliation {
	readonly scanned: number;
	readonly corrected: number;
	readonly corrections: IStockLevelCorrection[];
}
