import { CurrencyCode, DecimalString, IBasePerTenantAndOrganizationEntityModel, ID } from '@gauzy/contracts';

/**
 * Purchasing: what the organization buys, what arrives, and how the two are reconciled.
 *
 * A purchase order is an intention — it names a supplier, a receiving location and the lines that
 * are expected, and it contributes those quantities to the location's incoming figure for as long as
 * it is open. A goods receipt is the fact — it names what physically turned up and is what writes the
 * stock movements that make the goods sellable. Keeping the two apart is what makes a short delivery
 * visible: the order still expects the remainder, the receipt records only what came.
 *
 * The supplier is not modelled here. `organization_vendor` is the platform's supplier master and this
 * domain extends it with the six purchasing columns it was missing rather than creating a second
 * party table; `purchase_order.vendorId` points at that row.
 */

/*
|--------------------------------------------------------------------------
| Enums
|--------------------------------------------------------------------------
*/

/**
 * Where a purchase order is in its lifecycle.
 *
 * `DRAFT` is being prepared and contributes nothing to the receiving location's incoming figure.
 * `SENT` onwards does: the ordered remainder is what the location is waiting for. `CANCELED` and
 * `CLOSED` are terminal, and both are what removes the contribution — the incoming figure is
 * recomputed from the open orders rather than adjusted, so a cancellation can never leave a phantom
 * inbound quantity behind.
 *
 * `CANCELED` is reachable only from `DRAFT` and `SENT`. Once anything has been received the order is
 * finished by `CLOSED` instead, which is the state that says "the remainder is abandoned, and that is
 * a decision rather than an accident".
 */
export enum PurchaseOrderStatus {
	/** Being prepared; contributes nothing to the incoming figure. */
	DRAFT = 'DRAFT',
	/** Sent to the supplier; the ordered quantities now count as incoming. */
	SENT = 'SENT',
	/** The supplier confirmed, possibly with revised quantities or dates. */
	ACKNOWLEDGED = 'ACKNOWLEDGED',
	/** Some lines were received; the outstanding quantities remain incoming. */
	PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED',
	/** Every line was received in full. */
	RECEIVED = 'RECEIVED',
	/** Abandoned before anything arrived. Terminal. */
	CANCELED = 'CANCELED',
	/** Finished short of the ordered quantity, deliberately. Terminal. */
	CLOSED = 'CLOSED'
}

/**
 * Where a goods receipt is in its lifecycle.
 *
 * A receipt is written once and is never edited: correcting it means reversing it, which writes the
 * compensating movements the ledger needs and leaves the original document readable. That is why the
 * value set is two states rather than an editing lifecycle.
 */
export enum GoodsReceiptStatus {
	/** Posted: its lines' movements are part of the ledger. */
	POSTED = 'POSTED',
	/** Reversed: compensating movements were written and the movements are no longer the level's. */
	CANCELED = 'CANCELED'
}

/**
 * Where a negotiated vendor term is in its life.
 *
 * A term is drafted before it is agreed, which is why `DRAFT` is a state of its own rather than an
 * absence: a buyer writes the price break the vendor quoted, the vendor confirms it, and only then is
 * it a candidate for pricing an order. `INACTIVE` is where a term goes when it is withdrawn — a term a
 * placed order used is never deleted, so "why was this ordered at 4.20?" stays answerable after the
 * renegotiation that replaced it.
 */
export enum VendorTermStatus {
	/** Being prepared; never a resolution candidate. */
	DRAFT = 'DRAFT',
	/** A candidate inside its window and at or above its quantity break. */
	ACTIVE = 'ACTIVE',
	/** Withdrawn, retained. */
	INACTIVE = 'INACTIVE'
}

/**
 * What a supplier's bill is matched against, when the tenant bills a purchase line.
 *
 * The platform supports both readings and neither is a default the domain may invent: a vendor who
 * invoices on receipt is matched against what arrived, a vendor who invoices on order is matched
 * against what was ordered. The value lives on the variant the line points at; declaring the two
 * readings here is what lets the line service derive the same figure the bill side expects without
 * reaching into the catalogue.
 */
export enum PurchaseBillingPolicy {
	/** Bill against the ordered quantity. */
	ON_ORDERED = 'ON_ORDERED',
	/** Bill against what has been received. */
	ON_RECEIVED = 'ON_RECEIVED'
}

/**
 * The movement kinds a receipt produces.
 *
 * Declared here so this domain can name what it needs without owning the ledger. A good unit received
 * into the destination is a `RECEIPT`; a unit that arrived broken is a `DAMAGE`, which is recorded
 * without ever becoming sellable; a reversal writes a `WRITE_OFF` of the quantity the receipt added,
 * because the ledger is append-only and an opposite row is how a correction is expressed.
 */
export enum StockMovementKind {
	/** Units physically arrived at a location. */
	RECEIPT = 'RECEIPT',
	/** Units arrived damaged and are removed from the sellable network. */
	DAMAGE = 'DAMAGE',
	/** Units are gone and will not be sold; the reversal of an earlier receipt. */
	WRITE_OFF = 'WRITE_OFF'
}

/*
|--------------------------------------------------------------------------
| Cross-domain ports
|--------------------------------------------------------------------------
*/

/**
 * One request to record a movement in the platform stock ledger.
 *
 * This domain never writes an on-hand quantity. It states the movement and the ledger decides the
 * level: two writers of one level is how a level drifts.
 */
export interface IStockMovementRequest {
	/** Location the goods moved at. */
	readonly warehouseId: ID;
	/** Variant that moved. */
	readonly variantId: ID;
	/** Signed quantity; positive adds to stock, negative removes from it. */
	readonly quantity: DecimalString;
	/** What kind of movement this is. */
	readonly kind: StockMovementKind;
	/** Concept that asked for the movement, e.g. `GOODS_RECEIPT`. */
	readonly referenceType: string;
	/** Row that asked for the movement. */
	readonly referenceId: ID;
	/** Free-text explanation kept beside the movement. */
	readonly reason?: string;
	/** Batch or lot the units carry, so the ledger stays batch-accurate. */
	readonly batchNumber?: string;
	/** Shelf life the units carry, when the goods are perishable. */
	readonly expiresAt?: Date;
	/** Instant the movement happened; defaults to now. */
	readonly occurredAt?: Date;
}

/** What the ledger answers with once a movement is written. */
export interface IStockMovementResult {
	/** The movement row that was written. */
	readonly movementId: ID;
	/** Level after the movement, as the ledger computed it. */
	readonly quantityAfter: DecimalString;
}

/** One request to walk received units from the receiving area into a storage bin. */
export interface IPutAwayRequest {
	/** Location the units are already in. */
	readonly warehouseId: ID;
	/** Bin the units are being placed into. */
	readonly binId: ID;
	/** Variant being placed. */
	readonly variantId: ID;
	/** Quantity being placed. */
	readonly quantity: DecimalString;
	/** The receipt line's movement, which is what the walk is recorded against. */
	readonly stockMovementId?: ID;
	/** Row that asked for the put-away. */
	readonly referenceId: ID;
	/** Free-text explanation kept beside the walk. */
	readonly reason?: string;
}

/** What the ledger answers with once a put-away is written. */
export interface IPutAwayResult {
	/** The outbound leg of the walk, out of the receiving area. */
	readonly transferOutMovementId: ID;
	/** The inbound leg of the walk, into the target bin. */
	readonly transferInMovementId: ID;
}

/**
 * The inventory capability as this domain sees it.
 *
 * Provided by the inventory and warehouse capability and injected under `PURCHASING_INVENTORY`. A
 * receipt that has units to move fails loudly when no ledger is registered rather than adjusting a
 * level itself, because this plugin must never write an inventory table.
 */
export interface IInventoryPort {
	recordMovement(request: IStockMovementRequest): Promise<IStockMovementResult>;
	putAway(request: IPutAwayRequest): Promise<IPutAwayResult>;
}

/** One request to raise the platform's approval request for a purchase order. */
export interface IPurchaseApprovalRequest {
	/** The purchase order being approved. */
	readonly purchaseOrderId: ID;
	/** What the approval is about, for the approver's list. */
	readonly name: string;
	/** The value being committed, so a threshold policy can be applied. */
	readonly amount: DecimalString;
	/** Currency of the amount. */
	readonly currency: CurrencyCode;
	/** Free-text note kept beside the request. */
	readonly note?: string;
}

/** What the approval capability answers with once a request exists. */
export interface IPurchaseApprovalResult {
	/** The approval request row that was written. */
	readonly approvalId: ID;
}

/**
 * The approval capability as this domain sees it.
 *
 * Provided by the platform's approval machinery and injected under `PURCHASING_APPROVAL`. The port is
 * optional: a tenant that approves purchase orders by role alone records the approval on the order
 * without a separate request row.
 */
export interface IPurchaseApprovalPort {
	requestApproval(request: IPurchaseApprovalRequest): Promise<IPurchaseApprovalResult>;
}

/*
|--------------------------------------------------------------------------
| Injection tokens
|--------------------------------------------------------------------------
*/

/**
 * Token the inventory capability is injected under.
 *
 * Optional on purpose: a tenant that records no stock movements can still raise and approve a
 * purchase order, while a tenant that does gets the movement written by the ledger rather than by
 * this domain.
 */
export const PURCHASING_INVENTORY = Symbol('PURCHASING_INVENTORY');

/** Token the approval capability is injected under. */
export const PURCHASING_APPROVAL = Symbol('PURCHASING_APPROVAL');

/*
|--------------------------------------------------------------------------
| Outcome codes
|--------------------------------------------------------------------------
*/

/**
 * The stable codes this domain answers with.
 *
 * They are written into the message of the exception a caller receives, so a client can branch on the
 * outcome without parsing prose, and they are declared once here rather than spelled out at each use
 * site. A warning is an outcome the operation completed with; a refusal is one that left the row
 * exactly as it was.
 */
export const PurchasingCodes = {
	/** Warning: no term matched, so the line was priced from the fallback or entered by hand. */
	VENDOR_TERM_NOT_FOUND: 'VENDOR_TERM_NOT_FOUND',
	/** Refusal: two live terms of one vendor, variant and currency claim the same quantity band. */
	VENDOR_TERM_OVERLAP: 'VENDOR_TERM_OVERLAP',
	/** Refusal: the term is in another currency and this domain holds no rate to convert it with. */
	PRICE_EXCHANGE_RATE_MISSING: 'PRICE_EXCHANGE_RATE_MISSING',
	/** Refusal: nothing prices a line and the caller stated no cost of its own. */
	PURCHASE_ORDER_LINE_COST_REQUIRED: 'PURCHASE_ORDER_LINE_COST_REQUIRED',
	/** Refusal: the delivery would pass the over-receipt tolerance the line is received under. */
	RECEIPT_OVER_TOLERANCE: 'RECEIPT_OVER_TOLERANCE',
	/** Refusal: a bill would take the line past what its billing policy allows. */
	PURCHASE_LINE_OVERBILLED: 'PURCHASE_LINE_OVERBILLED',
	/** Refusal: a bill line names a purchase line of a different supplier. */
	PURCHASE_BILL_VENDOR_MISMATCH: 'PURCHASE_BILL_VENDOR_MISMATCH'
} as const;

/** One of the outcome codes above. */
export type PurchasingCode = (typeof PurchasingCodes)[keyof typeof PurchasingCodes];

/*
|--------------------------------------------------------------------------
| Contracts
|--------------------------------------------------------------------------
*/

/**
 * One negotiated term between the organization and one of its suppliers, for one sellable unit.
 *
 * This is the row that carries the agreement: the supplier master can say "this vendor has a 21-day
 * lead time" and nothing else, while a term says that this vendor quotes 4.20 for the 500-unit break
 * of this variant until March and 5.10 for the 100-unit break of another. Many terms belong to one
 * vendor and variant pair — that is what the validity window, the quantity break, the currency and
 * the priority are for — so the agreement cannot be a column on either parent.
 */
export interface IVendorProductTerm extends IBasePerTenantAndOrganizationEntityModel {
	vendorId?: ID;
	variantId?: ID;
	/** ISO 4217 code the price is stated in. */
	currency: CurrencyCode;
	/** Price for one base unit excluding tax, at or above `minQuantity`. */
	unitCost: DecimalString;
	/** Negotiated fraction off `unitCost`; null = none. A rate, not an amount. */
	discountPercent?: DecimalString;
	/** The quantity from which this row's price applies. */
	minQuantity: DecimalString;
	/** The supplier's selling container, e.g. a case of twelve. */
	packSize?: DecimalString;
	/** What the supplier calls that container. */
	packLabel?: string;
	/** Days from order confirmation to receipt **for this product**; null = inherit the vendor's. */
	leadTimeDays?: number;
	/** The supplier's own code for our variant. */
	vendorProductCode?: string;
	/** The supplier's own name for it; null = our name. */
	vendorProductName?: string;
	/** Negotiated over-shipment allowance; null = the organization's setting, else none. */
	overReceiptTolerancePercent?: DecimalString;
	/** Lower wins between two rows that both match. */
	priority: number;
	/** Validity window; null = open-ended on that side. */
	startsAt?: Date;
	endsAt?: Date;
	status: VendorTermStatus;
	metadata?: Record<string, unknown>;
}

/** One line of a purchase order. */
export interface IPurchaseOrderLine extends IBasePerTenantAndOrganizationEntityModel {
	purchaseOrderId?: ID;
	variantId?: ID;
	quantity: DecimalString;
	/** The unit the buyer ordered in; a plain column here, because the measurement set owns `unit`. */
	unitId?: ID;
	/** Snapshot of `unit.factor` at entry, never re-read. */
	conversionFactor: DecimalString;
	receivedQuantity: DecimalString;
	damagedQuantity: DecimalString;
	/** Cache re-derived from the bill lines, never incremented. */
	billedQuantity: DecimalString;
	unitCost: DecimalString;
	/** Snapshot of the winning term's pack size at order time, when it had one. */
	orderedPackSize?: DecimalString;
	/** Which term row priced this line. Provenance only: the line never re-reads it. */
	vendorTermId?: ID;
	taxRate?: DecimalString;
	discountTotal: DecimalString;
	total: DecimalString;
	expectedAt?: Date;
	note?: string;
	metadata?: Record<string, unknown>;
}

/** A document ordering goods from a supplier. */
export interface IPurchaseOrder extends IBasePerTenantAndOrganizationEntityModel {
	number: string;
	vendorId?: ID;
	warehouseId?: ID;
	/** The supplier's own order number, which their acknowledgement and their bill quote. */
	vendorReference?: string;
	/** Who owns this order — the routing key for every approval and follow-up. */
	buyerUserId?: ID;
	status: PurchaseOrderStatus;
	currency: CurrencyCode;
	subtotal: DecimalString;
	discountTotal: DecimalString;
	taxTotal: DecimalString;
	shippingTotal: DecimalString;
	grandTotal: DecimalString;
	/** The settlement schedule the order runs on; a plain column here, the kernel's set owns `payment_term`. */
	paymentTermId?: ID;
	/** The simple form as it stood at order time, snapshotted. */
	paymentTermsDaysSnapshot?: number;
	/** Computed once, at order time, from the resolved term. A dunning report reads this column. */
	dueDate?: Date;
	expectedAt?: Date;
	orderedAt?: Date;
	receivedAt?: Date;
	sentAt?: Date;
	acknowledgedAt?: Date;
	approvedAt?: Date;
	approvedByUserId?: ID;
	approvalId?: ID;
	canceledAt?: Date;
	closedAt?: Date;
	version: number;
	note?: string;
	metadata?: Record<string, unknown>;
	lines?: IPurchaseOrderLine[];
	receipts?: IGoodsReceipt[];
}

/** One line of a goods receipt. */
export interface IGoodsReceiptLine extends IBasePerTenantAndOrganizationEntityModel {
	receiptId?: ID;
	purchaseOrderLineId?: ID;
	variantId?: ID;
	quantity: DecimalString;
	damagedQuantity: DecimalString;
	unitCost: DecimalString;
	batchNumber?: string;
	expiresAt?: Date;
	warehouseBinId?: ID;
	stockMovementId?: ID;
	note?: string;
	metadata?: Record<string, unknown>;
}

/** What physically arrived against a purchase order. */
export interface IGoodsReceipt extends IBasePerTenantAndOrganizationEntityModel {
	purchaseOrderId?: ID;
	warehouseId?: ID;
	number: string;
	status: GoodsReceiptStatus;
	receivedAt: Date;
	receivedByUserId?: ID;
	canceledAt?: Date;
	version: number;
	note?: string;
	metadata?: Record<string, unknown>;
	lines?: IGoodsReceiptLine[];
}

/*
|--------------------------------------------------------------------------
| Service inputs
|--------------------------------------------------------------------------
*/

/** One line as a caller supplies it when a purchase order is raised. */
export interface IPurchaseOrderLineInput {
	variantId: ID;
	quantity: DecimalString | number;
	/** The unit the quantity is stated in; the reference unit when omitted. */
	unitId?: ID;
	/** Snapshot of the unit's factor, when the caller states one. */
	conversionFactor?: DecimalString | number;
	/**
	 * Purchase cost of one base unit. Omitted means "price this line from the standing agreement": the
	 * winning term, then the variant's own cost price, and a clear refusal when neither exists.
	 */
	unitCost?: DecimalString | number;
	/**
	 * The term the caller states as the price's provenance. Kept when the caller states the price too,
	 * which is how a line set rewritten as a unit keeps the term its price came from; when the agreement
	 * prices the line, the resolution's own winner is recorded instead.
	 */
	vendorTermId?: ID;
	taxRate?: DecimalString | number;
	discountTotal?: DecimalString | number;
	expectedAt?: Date;
	note?: string;
	/** Extras kept beside the line, carried through when a line set is rewritten. */
	metadata?: Record<string, unknown>;
}

/** What a caller may state about a purchase order beyond its lines. */
export interface IPurchaseOrderInput {
	vendorId: ID;
	warehouseId: ID;
	currency: CurrencyCode;
	/** The supplier's own order number, which their acknowledgement and their bill quote. */
	vendorReference?: string;
	/** Who owns the order. Defaults to the caller. */
	buyerUserId?: ID;
	/** The settlement schedule to snapshot; the supplier's own applies when neither this nor it is set. */
	paymentTermId?: ID;
	/** The simple settlement form to snapshot, in days. */
	paymentTermsDaysSnapshot?: number;
	expectedAt?: Date;
	shippingTotal?: DecimalString | number;
	note?: string;
	metadata?: Record<string, unknown>;
	lines: IPurchaseOrderLineInput[];
}

/** One line as a caller supplies it when goods are received. */
export interface IGoodsReceiptLineInput {
	purchaseOrderLineId: ID;
	quantity: DecimalString | number;
	damagedQuantity?: DecimalString | number;
	unitCost?: DecimalString | number;
	batchNumber?: string;
	expiresAt?: Date;
	/** Bin the units are placed into, when the location requires put-away. */
	warehouseBinId?: ID;
	note?: string;
}

/** What a caller may state about a receipt beyond its lines. */
export interface IGoodsReceiptInput {
	/**
	 * The order the delivery is anchored to, when it is anchored to one. A consolidated delivery
	 * covering several orders states none, and so does goods that arrived with no order at all: the
	 * authoritative relation is the receipt line's own order line.
	 */
	purchaseOrderId?: ID;
	warehouseId?: ID;
	receivedAt?: Date;
	/**
	 * The order's version the caller read, when it stated one. A receipt moves the order's received
	 * counters, so a receipt raised against a version that has since moved is refused rather than
	 * applied to an order somebody else has changed.
	 */
	expectedVersion?: number;
	/**
	 * Fraction of the ordered quantity a line may be exceeded by before the receipt is refused. Stated
	 * for one delivery, it outranks every standing allowance; otherwise the line's winning term, the
	 * organization's setting and the order's own configured allowance apply in that order, and none of
	 * them means no tolerance at all.
	 */
	overReceiptTolerance?: DecimalString | number;
	note?: string;
	metadata?: Record<string, unknown>;
	lines: IGoodsReceiptLineInput[];
}

/*
|--------------------------------------------------------------------------
| Vendor term resolution
|--------------------------------------------------------------------------
*/

/**
 * What a caller asks a term to price.
 *
 * The quantity is the quantity **in the reference unit** — the ordered quantity multiplied by the
 * conversion factor of the unit it was entered in — because a price break is a statement about base
 * units and a vendor who sells by the case is the ordinary case.
 */
export interface IVendorTermContext {
	/** The supplier the agreement is with. */
	vendorId: ID;
	/** The sellable unit the term is scoped to. */
	variantId: ID;
	/** The quantity, in the reference unit. */
	quantity: DecimalString | number;
	/** The currency the answer is wanted in. */
	currency: CurrencyCode;
	/** The instant the term's window must contain; defaults to now. */
	date?: Date;
}

/**
 * What the resolution answered with.
 *
 * A winner is not the only outcome: an order may be raised against a supplier the organization has no
 * standing agreement with, and that is a warning rather than a refusal. `term` is therefore optional
 * and `warnings` says what was missing.
 */
export interface IVendorTermResolution {
	/** The row that priced the line, when one matched. */
	term?: IVendorProductTerm;
	/** The price to apply, in the requested currency, at the storage scale. */
	unitCost: DecimalString;
	/** The negotiated fraction off the price, when the winning row carried one. */
	discountPercent?: DecimalString;
	/** The currency `unitCost` is stated in. */
	currency: CurrencyCode;
	/** Days from order confirmation to receipt, after the term-then-vendor precedence. */
	leadTimeDays: number;
	/** The supplier's container, when the winning row carried one. */
	packSize?: DecimalString;
	/** What the supplier calls that container. */
	packLabel?: string;
	/** The supplier's own code for our variant, when the winning row carried one. */
	vendorProductCode?: string;
	/** The supplier's own name for it, when the winning row carried one. */
	vendorProductName?: string;
	/** The over-shipment allowance the winning row negotiated, when it carried one. */
	overReceiptTolerancePercent?: DecimalString;
	/** The vendor-level floor on one order, reported as it stands; never inferred. */
	minimumOrderAmount?: DecimalString;
	/** Where the winning price came from: a term, the variant's own cost price, or nobody. */
	source: 'TERM' | 'VARIANT_COST_PRICE' | 'NONE';
	/** What the caller should be told about the outcome. Empty when a term matched cleanly. */
	warnings: PurchasingCode[];
}

/**
 * The pricing a term resolution leaves on a purchase-order line.
 *
 * Everything here is snapshotted onto the line at entry: the line never re-reads the term, so editing
 * a term changes future orders only.
 */
export interface IVendorTermLinePricing {
	/** Which term row priced the line; null when it was priced by hand or from the cost price. */
	vendorTermId?: ID;
	/** The cost per base unit, in the order's currency. */
	unitCost: DecimalString;
	/** The line discount the negotiated fraction produces, as an amount. */
	discountTotal: DecimalString;
	/** Snapshot of the winning term's container. */
	orderedPackSize?: DecimalString;
	/** The lead time the term resolved, snapshotted so the order can be dated without a re-read. */
	leadTimeDays: number;
	/** Where the price came from: a term, the variant's cost price, or the caller's own figure. */
	source: 'TERM' | 'VARIANT_COST_PRICE' | 'MANUAL';
	/** What the caller should be told about the outcome. */
	warnings: PurchasingCode[];
}

/** One term as a caller writes it, for the single and the bulk surface alike. */
export interface IVendorProductTermInput {
	vendorId: ID;
	variantId: ID;
	currency?: CurrencyCode;
	/** The price of one base unit. State this or a pack price; the other form is derived. */
	unitCost?: DecimalString | number;
	/**
	 * The price of the supplier's container, as the supplier quotes it. Written with `packSize`, from
	 * which the price of one base unit is derived — the container price itself is not a column, because
	 * a quote stated per container and one stated per unit must not become two facts about one price.
	 */
	packPrice?: DecimalString | number;
	discountPercent?: DecimalString | number;
	minQuantity?: DecimalString | number;
	packSize?: DecimalString | number;
	packLabel?: string;
	leadTimeDays?: number;
	vendorProductCode?: string;
	vendorProductName?: string;
	overReceiptTolerancePercent?: DecimalString | number;
	priority?: number;
	startsAt?: Date;
	endsAt?: Date;
	status?: VendorTermStatus;
	metadata?: Record<string, unknown>;
}
