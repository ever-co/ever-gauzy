/**
 * The contract of the single write path into stock.
 *
 * Every quantity change on the platform is expressed as one of these inputs and applied by
 * `StockLevelService.applyMovement`, inside one transaction, together with the level row update and
 * the append-only ledger row that records the resulting quantity.
 */
import { ID } from '@gauzy/contracts';
import { StockMovementType, StockMovementReferenceType } from './../inventory.enums';

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
	readonly quantity: number;
	readonly reservedQuantity: number;
	readonly safetyStock: number;
	readonly availableQuantity: number;
	readonly incomingQuantity: number;
	readonly isUnlimited: boolean;
	readonly allowBackorder: boolean;
	readonly backorderLimit?: number;
}
