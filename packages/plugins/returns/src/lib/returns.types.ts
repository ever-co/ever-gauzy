import { CurrencyCode, DecimalString, IBasePerTenantAndOrganizationEntityModel, ID } from '@gauzy/contracts';

/**
 * Returns, claims and exchanges.
 *
 * The three flows share the vocabulary below because they are three answers to one question — "the
 * customer is unhappy about something that was delivered" — and the difference between them is what
 * the answer costs:
 *
 * - a **return** takes goods back and may send money out;
 * - a **claim** records the complaint and the resolution chosen for it, which is either a refund or
 *   a replacement;
 * - an **exchange** is a return and a replacement shipment priced against each other, so the
 *   customer pays or is owed the difference.
 *
 * All three are wired into the order through `order_change`, so none of them is a second way to
 * mutate an order: each one asks for a change and the change is what moves money and stock.
 */

/*
|--------------------------------------------------------------------------
| Enums
|--------------------------------------------------------------------------
*/

/**
 * The lifecycle of a return, from the request to the settled refund.
 *
 * `REJECTED` and `CANCELED` are terminal without goods moving; `CLOSED` is terminal and means the
 * refund is settled and the stock decision has been written.
 */
export enum OrderReturnStatus {
	/** Created and not yet submitted to the customer. */
	OPEN = 'OPEN',
	/** The customer asked to return; awaiting a decision. */
	REQUESTED = 'REQUESTED',
	/** Accepted; the customer may ship the goods back. */
	APPROVED = 'APPROVED',
	/** Everything expected arrived. */
	RECEIVED = 'RECEIVED',
	/** Some lines arrived; the rest are still expected. */
	PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED',
	/** Refused. Terminal. */
	REJECTED = 'REJECTED',
	/** Withdrawn by either side before receipt. Terminal. */
	CANCELED = 'CANCELED',
	/** Received and settled — refund issued, stock restocked or written off. Terminal. */
	CLOSED = 'CLOSED'
}

/** What kind of resolution a claim asks for. */
export enum OrderClaimType {
	/** Money back; the claim drives a refund. */
	REFUND = 'REFUND',
	/** Replacement goods; the claim drives a shipment and, where the faulty goods come back, a return. */
	REPLACE = 'REPLACE'
}

/** The lifecycle of a claim. Terminal states are `REJECTED`, `CANCELED` and `CLOSED`. */
export enum OrderClaimStatus {
	/** Recorded internally, not yet submitted. */
	OPEN = 'OPEN',
	/** Submitted; awaiting a decision. */
	REQUESTED = 'REQUESTED',
	/** Accepted; the resolution is being executed. */
	APPROVED = 'APPROVED',
	/** Refused. Terminal. */
	REJECTED = 'REJECTED',
	/** Withdrawn. Terminal. */
	CANCELED = 'CANCELED',
	/** The resolution settled — refund paid or replacement shipped. Terminal. */
	CLOSED = 'CLOSED'
}

/**
 * Why a claim line is being claimed.
 *
 * This is an enum rather than a table because each value selects a different resolution path
 * (restock, write off, replace without a return, or ask an operator for a note), so the code acts on
 * it. A reason that is only reported on lives in `order_return_reason` instead.
 */
export enum OrderClaimReason {
	/** On the order but not in the shipment; nothing to send back. */
	MISSING_ITEM = 'MISSING_ITEM',
	/** A different item arrived; resolved by a replacement plus a return of the wrong item. */
	WRONG_ITEM = 'WRONG_ITEM',
	/** Faulty as manufactured; written off rather than restocked. */
	PRODUCTION_FAILURE = 'PRODUCTION_FAILURE',
	/** Damaged in transit; the restock decision follows the received condition. */
	DAMAGED = 'DAMAGED',
	/** Anything not covered; requires a note. */
	OTHER = 'OTHER'
}

/** The lifecycle of an exchange. Both halves settle before `CLOSED`. */
export enum OrderExchangeStatus {
	/** Drafted; the inbound and outbound line sets may still change. */
	OPEN = 'OPEN',
	/** Submitted; awaiting a decision. */
	REQUESTED = 'REQUESTED',
	/** Accepted; the resolution runs — order change, re-reservation, payment adjustment. */
	APPROVED = 'APPROVED',
	/** Refused. Terminal. */
	REJECTED = 'REJECTED',
	/** Withdrawn. Terminal. */
	CANCELED = 'CANCELED',
	/** Both halves settled: the return received and the replacement shipped. Terminal. */
	CLOSED = 'CLOSED'
}

/**
 * The stock movement kinds this domain produces.
 *
 * Declared here so a return or an exchange can name what it needs without the domain owning the
 * ledger: a restockable unit is a `RETURN`, a unit that came back unsellable is a `WRITE_OFF`, and a
 * unit that arrived broken is a `DAMAGE`. Writing them is the inventory ledger's job.
 *
 * The first moves the level and the other two do not, and that difference is stated on the request
 * (`eventOnly`) rather than inferred from the kind: see {@link IStockMovementRequest}.
 */
export enum StockMovementKind {
	/** Goods came back and go into sellable stock. */
	RETURN = 'RETURN',
	/** Goods came back and are removed from the network without ever entering sellable stock. */
	WRITE_OFF = 'WRITE_OFF',
	/** Goods were damaged and are recorded without ever being sellable. */
	DAMAGE = 'DAMAGE'
}

/*
|--------------------------------------------------------------------------
| Cross-domain ports
|--------------------------------------------------------------------------
*/

/**
 * One request to record a movement in the platform stock ledger.
 *
 * The returns domain never writes an on-hand quantity. It states the movement it wants and the
 * ledger decides the level, because two writers of one level is how a level drifts.
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
	/**
	 * Whether the units this movement is about ever entered the location's stock.
	 *
	 * A return's discarded units and its damaged units never did — they left the network on a sale and
	 * came back unsellable — so the movement records the event and the level keeps the quantity it had.
	 * A restocked unit states `false` (or nothing) and its quantity lands on the level.
	 */
	readonly eventOnly?: boolean;
	/** Concept that asked for the movement, e.g. `ORDER_RETURN`. */
	readonly referenceType: string;
	/** Row that asked for the movement. */
	readonly referenceId: ID;
	/** Free-text explanation kept beside the movement. */
	readonly reason?: string;
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

/**
 * The stock ledger as this domain sees it.
 *
 * Provided by the inventory capability and injected under `RETURNS_STOCK_LEDGER`. The service refuses
 * to complete a receipt when no ledger is registered rather than adjusting a level itself.
 */
export interface IStockLedgerPort {
	recordMovement(request: IStockMovementRequest): Promise<IStockMovementResult>;
}

/** One request to send money back to the buyer of an order. */
export interface IRefundRequest {
	/** Order being refunded. */
	readonly orderId: ID;
	/** Return that produced the refund, when it came from one. */
	readonly returnId?: ID;
	/** Exchange that produced the refund, when it came from one. */
	readonly exchangeId?: ID;
	/**
	 * Claim that produced the refund, when it came from one.
	 *
	 * A claim is the third thing that can owe money back — after a return and an exchange — and it is
	 * neither of the other two: it names a damaged or short delivery rather than goods sent back. The
	 * refund it produces has to carry which of the three asked for it, because the attribution is what
	 * lets a later report answer "what did this claim cost us" without reading the claim row again.
	 */
	readonly claimId?: ID;
	/** Amount to refund, exact. */
	readonly amount: DecimalString;
	/** Currency of the amount. */
	readonly currency: CurrencyCode;
	/** Governed reason code, when the operator picked one. */
	readonly reasonId?: ID;
	/** Free-text note kept beside the refund. */
	readonly note?: string;
}

/** What the payment capability answers with once a refund is recorded. */
export interface IRefundResult {
	/** The refund row that was written. */
	readonly refundId: ID;
	/** Amount actually refunded, which may be less than the amount requested. */
	readonly amount: DecimalString;
	/** Currency of the amount. */
	readonly currency: CurrencyCode;
}

/**
 * Refunds as this domain sees them.
 *
 * Provided by the payment capability and injected under `RETURNS_REFUND_GATEWAY`. A return can be
 * received, restocked and closed without a refund — that is what a warranty replacement against no
 * charge looks like — so the port is optional, but a refund can never be written by this domain.
 */
export interface IRefundGatewayPort {
	createRefund(request: IRefundRequest): Promise<IRefundResult>;
}

/** What one order line reports about how much of it actually left the building. */
export interface IOrderLineFulfillment {
	/** The order line. */
	readonly orderLineId: ID;
	/** Variant the line is for, when the order domain reports it. */
	readonly variantId?: ID;
	/** Quantity that was shipped and not cancelled. This is the ceiling a return is measured against. */
	readonly fulfilledQuantity: DecimalString;
	/** Price one unit was sold at, when the order domain reports it; used to price a return. */
	readonly unitPrice?: DecimalString;
}

/**
 * One movement of an order line's received-return counter.
 *
 * The counter is the order's own cache of what came back — `order_line.returnReceivedQuantity`, which
 * is the goods half of a return and the input `deriveFulfillmentStatus` sums to decide between
 * `PARTIALLY_RETURNED` and `RETURNED` — so it is moved by a delta rather than set to a value. A
 * delta is what the receipt has: the return line already holds what earlier deliveries recorded, and
 * this call is about the units this delivery brought.
 *
 * **The units are every unit that arrived, sound or damaged.** A damaged unit came back exactly as a
 * sound one did — the receipt counts it against the request and the return reaches `RECEIVED` on it —
 * and `returnReceivedQuantity` is the one counter the derivation reads as "came back". The sibling
 * `returnDismissedQuantity` is not that: the derivation subtracts it from the quantity the order still
 * owes, and the fulfilment package subtracts it from what may still be shipped, so a broken unit moved
 * there would make a line with units still to ship owe fewer of them, and a return whose every unit
 * arrived broken would leave its order answering `FULFILLED`.
 */
export interface IOrderLineReceiptMove {
	/** The order line the goods belong to. */
	readonly orderLineId: ID;
	/**
	 * How much this delivery moves the counter.
	 *
	 * **Positive on a receipt and negative when one is undone.** The receipt's compensating action has
	 * to put the counter back, and a counter moved by a signed delta is moved back by the same call
	 * with the sign reversed rather than by a second method that could disagree with this one about
	 * the floor or the units.
	 */
	readonly quantityDelta: DecimalString;
}

/**
 * One movement of an order line's requested-return counter.
 *
 * The counter is `order_line.returnRequestedQuantity`, the order's cache of what its live returns ask
 * for, and doc 10 invariant I-12 bounds what came back by it: `returnReceivedQuantity +
 * returnDismissedQuantity <= returnRequestedQuantity`. It moves up when a return's lines are written,
 * by the difference when they are rewritten, and back down by the units still outstanding when the
 * return is rejected or cancelled (doc 10 §11.7: "returnRequestedQuantity reverted").
 */
export interface IOrderLineReturnRequestMove {
	/** The order line the request is against. */
	readonly orderLineId: ID;
	/** How much this write moves the counter: positive when more is asked back, negative when less is. */
	readonly quantityDelta: DecimalString;
}

/**
 * The order's fulfilled quantities as this domain sees them.
 *
 * A return may only cover what was actually shipped, and only the order domain knows that number —
 * an order line that was never fulfilled cannot be returned, and a partially fulfilled line can be
 * returned only up to the part that left. Reading it here rather than caching it means the ceiling
 * follows later fulfilment of the same order.
 *
 * **The port carries both directions of the same fact, and that is why it keeps its name.** What a
 * line has shipped is read to measure a request against it; what came back is written when the units
 * arrive, and it is the same counter the derivation reads. A separate port for the writer would be
 * two seams onto one table, which is the shape this package avoids everywhere else — and the seam
 * itself states its rule: it exists so that no other package ever reads or writes `order_line`.
 */
export interface IOrderFulfillmentPort {
	/**
	 * Reads what each line of an order has fulfilled.
	 *
	 * @param orderId The order to read.
	 * @returns One entry per line with something fulfilled; a line that never shipped is absent.
	 */
	getFulfilledLines(orderId: ID): Promise<IOrderLineFulfillment[]>;

	/**
	 * Moves the received-return counter of the named order lines.
	 *
	 * **All or nothing.** A call that fails has moved nothing — a move refused part-way reverses the moves
	 * of the same call that landed before it — so the caller's compensation undoes a call only when the
	 * call resolved.
	 *
	 * @param orderId The order whose lines are moved, which is also the scope the write is checked in.
	 * @param moves One entry per order line this delivery touched.
	 * @returns Nothing: the caller's own rows say what arrived, and this counter is the order's cache of it.
	 */
	recordReturnReceipt(orderId: ID, moves: readonly IOrderLineReceiptMove[]): Promise<void>;

	/**
	 * Moves the requested-return counter of the named order lines, all or nothing, by the same atomic
	 * statement as the receipt and with the same floor at zero.
	 *
	 * @param orderId The order whose lines are moved, which is also the scope the write is checked in.
	 * @param moves One entry per order line whose requested quantity changed.
	 * @returns Nothing: the return's own lines say what is asked back, and this counter is the order's
	 * cache of it.
	 */
	recordReturnRequest(orderId: ID, moves: readonly IOrderLineReturnRequestMove[]): Promise<void>;
}

/**
 * Why a returns move says the order's totals moved, when the move is the goods arriving.
 *
 * `RETURN_RECEIVE` writes the order line's received-return counter (doc 10 §11.6 step 2), and that
 * counter is one of the five sums `deriveFulfillmentStatus` reads — so a receipt moves the order's
 * `fulfillmentStatus`, and ADR-26 owes a recompute for it with a reason that names the move. It is
 * deliberately **not** `PAYMENT_RECONCILED`, which the refund's own recompute states: a receipt that
 * refunds nothing has moved no money at all, and a summary row claiming a payment was reconciled
 * would name a move that did not happen.
 */
export const RETURNS_RECEIPT_REASON = 'RETURN_RECEIVED';

/**
 * Why a returns move says the order's totals moved.
 *
 * `OrderTotalsService.recompute` records the reason on the `order_summary` row it writes and documents
 * six: `PLACED`, `CHANGE_CONFIRMED`, `PAYMENT_RECONCILED`, `FULFILLMENT_COMMITTED`, `RETURN_RECEIVED`
 * and `CASH_ROUNDED`. A returns move that appends a ledger row is a **money** move — the only ledger
 * row this package appends is the refund's `order_transaction`, and the service that appends it moves
 * the payment's refunded total with it — so this reason is `PAYMENT_RECONCILED`.
 *
 * It is deliberately **not** `FULFILLMENT_COMMITTED`, which the same service documents for the
 * fulfilment write. `deriveFulfillmentStatus` reads the order's status and five sums over its lines —
 * `quantity`, `writtenOffQuantity`, `returnDismissedQuantity`, `fulfilledQuantity` and
 * `returnReceivedQuantity` — and while this package **does** now write the last of them, it writes it
 * on the receipt and says so with `RETURN_RECEIVED`; a summary row claiming a fulfilment was committed
 * would name a shipment that did not happen. The string is stated once, here, because it is read by
 * the order domain as a fact rather than as a log line: a typo would record a reason no reader of
 * `order_summary` recognises.
 */
export const RETURNS_TOTALS_REASON = 'PAYMENT_RECONCILED';

/**
 * The order's derived columns, as this domain sees them.
 *
 * Provided by the order capability and injected under `RETURNS_ORDER_TOTALS`. A return that gives money
 * back appends an `order_transaction` row, and the order's totals, `paymentStatus`, `fulfillmentStatus`
 * and version are all derived from that ledger — plus the order's lines and credit lines — by one
 * function the order package owns. ADR-26 requires the move that changed the ledger to recompute them
 * from it, and the recompute is the order package's to perform: an order row is not this domain's to
 * write, so the call travels through this port rather than through a repository.
 *
 * The answer is deliberately untyped. It is the order's row, which this domain has no business naming,
 * and a caller here reads nothing from it — the write either landed or it did not.
 */
export interface IOrderTotalsPort {
	/**
	 * Recomputes an order's totals, statuses and version from the ledgers that decide them.
	 *
	 * @param orderId The order the returns move changed.
	 * @param reason Why the totals moved, recorded on the summary row the recompute writes.
	 * @returns The order as written, which this domain does not read.
	 */
	recompute(orderId: ID, reason: string): Promise<unknown>;
}

/** One request to send the goods back: the return leg of a return or an exchange. */
export interface IReturnShipmentRequest {
	/** Return the goods belong to. */
	readonly returnId: ID;
	/** Order the goods came from. */
	readonly orderId: ID;
	/** Chosen return shipping option, when the tenant configured one. */
	readonly shippingOptionId?: ID;
	/** Location the goods are collected from. */
	readonly warehouseId?: ID;
	/** Carrier tracking number, when it is already known. */
	readonly trackingNumber?: string;
}

/** What the shipping capability answers with once the return leg exists. */
export interface IReturnShipmentResult {
	/** The fulfilment that carries the return leg. */
	readonly fulfillmentId: ID;
	/** Carrier tracking number, when the carrier issued one. */
	readonly trackingNumber?: string;
	/** Label the customer prints, when the carrier issued one. */
	readonly labelUrl?: string;
}

/**
 * The return leg as this domain sees it.
 *
 * Shipping a parcel needs a carrier, a label and a route, none of which this domain owns; it owns
 * the fact that a return was authorised to move. The port is optional, and a tenant without a
 * shipping capability can still authorise a return and receive it.
 */
export interface IReturnShipmentPort {
	createReturnShipment(request: IReturnShipmentRequest): Promise<IReturnShipmentResult>;
}

/*
|--------------------------------------------------------------------------
| Injection tokens
|--------------------------------------------------------------------------
*/

/**
 * Token the stock ledger is injected under.
 *
 * Optional on purpose: a tenant that records no stock movements can still take a return and refund
 * it, while a tenant that does gets the movement written by the ledger rather than by this domain.
 */
export const RETURNS_STOCK_LEDGER = Symbol('RETURNS_STOCK_LEDGER');

/** Token the refund gateway is injected under. */
export const RETURNS_REFUND_GATEWAY = Symbol('RETURNS_REFUND_GATEWAY');

/** Token the order's fulfilled quantities are read through. */
export const RETURNS_ORDER_FULFILLMENT = Symbol('RETURNS_ORDER_FULFILLMENT');

/** Token the return-leg shipping capability is injected under. */
export const RETURNS_SHIPMENT_GATEWAY = Symbol('RETURNS_SHIPMENT_GATEWAY');

/**
 * Token the order's derived columns are refreshed through.
 *
 * Optional on purpose, like the four above: a tenant without the order capability still takes a return
 * and refunds it, and the order's own columns are then the order package's to bring up to date — which
 * its reconciliation job does rather than this domain guessing at them.
 */
export const RETURNS_ORDER_TOTALS = Symbol('RETURNS_ORDER_TOTALS');


/*
|--------------------------------------------------------------------------
| Contracts
|--------------------------------------------------------------------------
*/

/** One line of a return. */
export interface IOrderReturnLine extends IBasePerTenantAndOrganizationEntityModel {
	returnId?: ID;
	orderLineId?: ID;
	quantity: DecimalString;
	receivedQuantity: DecimalString;
	damagedQuantity: DecimalString;
	reasonId?: ID;
	restock: boolean;
	warehouseId?: ID;
	note?: string;
	metadata?: Record<string, unknown>;
}

/** A request to take goods back against an order. */
export interface IOrderReturn extends IBasePerTenantAndOrganizationEntityModel {
	orderId?: ID;
	number: string;
	status: OrderReturnStatus;
	warehouseId?: ID;
	reasonId?: ID;
	reason?: string;
	refundAmount?: DecimalString;
	currency: CurrencyCode;
	requestedAt?: Date;
	approvedAt?: Date;
	receivedAt?: Date;
	canceledAt?: Date;
	closedAt?: Date;
	claimId?: ID;
	exchangeId?: ID;
	shippingOptionId?: ID;
	noNotification: boolean;
	note?: string;
	/** The optimistic-concurrency counter, which every write of the return moves on. */
	version?: number;
	metadata?: Record<string, unknown>;
	lines?: IOrderReturnLine[];
}

/** A governed reason code for returns. */
export interface IOrderReturnReason extends IBasePerTenantAndOrganizationEntityModel {
	code: string;
	label: string;
	description?: string;
	parentId?: ID;
	children?: IOrderReturnReason[];
}

/** One line of a claim. */
export interface IOrderClaimLine extends IBasePerTenantAndOrganizationEntityModel {
	claimId?: ID;
	orderLineId?: ID;
	variantId?: ID;
	quantity: DecimalString;
	reason: OrderClaimReason;
	isAdditionalItem: boolean;
	note?: string;
	metadata?: Record<string, unknown>;
}

/** A customer assertion that something about a delivered order was wrong. */
export interface IOrderClaim extends IBasePerTenantAndOrganizationEntityModel {
	orderId?: ID;
	number: string;
	type: OrderClaimType;
	status: OrderClaimStatus;
	refundAmount?: DecimalString;
	currency: CurrencyCode;
	returnId?: ID;
	reason?: string;
	note?: string;
	canceledAt?: Date;
	metadata?: Record<string, unknown>;
	lines?: IOrderClaimLine[];
}

/** One outbound line of an exchange. */
export interface IOrderExchangeLine extends IBasePerTenantAndOrganizationEntityModel {
	exchangeId?: ID;
	orderLineId?: ID;
	variantId?: ID;
	quantity: DecimalString;
	unitPrice: DecimalString;
	note?: string;
	metadata?: Record<string, unknown>;
}

/** A return that immediately becomes a new shipment. */
export interface IOrderExchange extends IBasePerTenantAndOrganizationEntityModel {
	orderId?: ID;
	number: string;
	status: OrderExchangeStatus;
	differenceDue?: DecimalString;
	currency: CurrencyCode;
	returnId?: ID;
	allowBackorder: boolean;
	note?: string;
	canceledAt?: Date;
	metadata?: Record<string, unknown>;
	lines?: IOrderExchangeLine[];
}

/*
|--------------------------------------------------------------------------
| Service inputs
|--------------------------------------------------------------------------
*/

/** One line as a caller supplies it when a return is requested. */
export interface IOrderReturnLineInput {
	orderLineId: ID;
	quantity: DecimalString | number;
	reasonId?: ID;
	restock?: boolean;
	warehouseId?: ID;
	note?: string;
}

/** One line as a caller supplies it when goods are received back. */
export interface IOrderReturnReceiptInput {
	lineId: ID;
	receivedQuantity: DecimalString | number;
	damagedQuantity?: DecimalString | number;
	restock?: boolean;
}

/** One line as a caller supplies it when a claim is raised. */
export interface IOrderClaimLineInput {
	orderLineId?: ID;
	variantId?: ID;
	quantity: DecimalString | number;
	reason?: OrderClaimReason;
	isAdditionalItem?: boolean;
	note?: string;
}

/** One line as a caller supplies it when an exchange is requested. */
export interface IOrderExchangeLineInput {
	orderLineId?: ID;
	variantId: ID;
	quantity: DecimalString | number;
	unitPrice?: DecimalString | number;
	note?: string;
}

/** What receiving a return did, line by line. */
export interface IOrderReturnReceiptOutcome {
	returnId: ID;
	status: OrderReturnStatus;
	/**
	 * The version the return holds once the receipt — and the refund, when one was issued — is
	 * written. A receipt is answered with the return's own state rather than with the return, so the
	 * version travels beside the status it belongs to and a caller can condition its next write on it.
	 */
	version: number;
	movementIds: ID[];
	refund?: IRefundResult;
	receivedQuantity: DecimalString;
	outstandingQuantity: DecimalString;
}
