import type { CommissionBasis, CurrencyCode, DecimalString, ICommissionTier, ID } from '@gauzy/contracts';
import type { BulkRequest } from '@gauzy/core';

/**
 * The offering batch, as the two surfaces declare it.
 *
 * A catalogue edit that moves a whole page of listings — publish what was approved, pause what is out
 * of stock, withdraw what was discontinued, re-price what the supplier re-priced — is one request
 * whose answer names every item it could not apply, and the contract that states it is the platform's
 * own (`api/bulk.ts` in the kernel): the request, the result and the partial-success semantics are the
 * same for every resource, so a domain declares only what its own items carry and nothing about how a
 * batch is run. This module is that declaration for the offering resource — the item, the body, the
 * answer and the members an item must carry — and it holds no runner of its own, because
 * `BulkExecutor` is the platform's single answer to how a batch is applied.
 *
 * **The four operations are the resource's own, and they are not the platform's four write kinds.**
 * Publish, pause and withdraw each move one existing row between statuses, and re-price rewrites the
 * price and the commission of one; no operation creates a row and none removes one — a withdrawal
 * keeps the row, because it explains a past line's price and commission. An item therefore states its
 * verb in this module's `operation` member rather than in the platform's `op`, whose vocabulary is
 * `create`/`update`/`delete`/`upsert` and whose pre-pass refuses any other value.
 *
 * The members an item may state are the members the delivered routes accept, so one batch produces the
 * same columns, the same outbox events and the same refusals as the equivalent single-item calls.
 */

/**
 * The operation one item of an offering batch performs.
 *
 * Every value is the delivered route the same act is served by today: `PUBLISH` is
 * `POST /seller-offerings/:id/publish`, `PAUSE` is `POST /seller-offerings/:id/unpause`, `WITHDRAW` is
 * `DELETE /seller-offerings/:id`, and `REPRICE` is the price-and-commission write of
 * `PUT /seller-offerings/:id`. A batch is therefore one request for what the package already performs
 * through four, and an item cannot reach a state the single-item routes do not serve.
 *
 * The values are upper case because they are this resource's vocabulary, as `OfferingStatus` is: the
 * status a value moves an offering to is the status the entity already carries, and `PAUSED` is one of
 * them — the pause operation invents no state.
 */
export enum SellerOfferingBulkOperation {
	/** Moves the offering to `ACTIVE`, checking every publication clause first. */
	PUBLISH = 'PUBLISH',
	/** Moves the offering to `PAUSED`, so it stops being sellable and stays resumable. */
	PAUSE = 'PAUSE',
	/** Moves the offering to `WITHDRAWN`; the row is kept. */
	WITHDRAW = 'WITHDRAW',
	/** Rewrites the offering's price, and the commission it is sold under when the item states one. */
	REPRICE = 'REPRICE'
}

/**
 * Every operation an item may name.
 *
 * The list is the vocabulary a refusal reports beside the value it refused, and the one the runtime check
 * below reads, so an operation added to the enum is offered and accepted in the same edit.
 */
export const SELLER_OFFERING_BULK_OPERATIONS: readonly SellerOfferingBulkOperation[] =
	Object.values(SellerOfferingBulkOperation);

/**
 * Whether a value is an operation this batch serves.
 *
 * The check is a runtime one because a REST body reaches the service as it was sent: the resource's
 * item type is a compile-time shape, and an item carrying `"REPRICE "` or `"REPRICE_OFFERING"` would
 * otherwise fall through to whichever branch the code happened to order last.
 *
 * @param value The value an item stated.
 * @returns True when it is one of the four operations.
 */
export function isSellerOfferingBulkOperation(value: unknown): value is SellerOfferingBulkOperation {
	return typeof value === 'string' && (SELLER_OFFERING_BULK_OPERATIONS as readonly string[]).includes(value);
}

/**
 * One item of an offering batch: the operation the item performs and the offering it performs it on.
 *
 * The item is the writing half of one offering with the operation stated on top, so a member that is
 * absent is a member the item says nothing about — a different request from a member stated as empty,
 * and the reason a re-price of the amount alone leaves the currency, the window and the channel set as
 * the offering holds them.
 *
 * Each member belongs to the operation that reads it: `channelIds` narrows what a `PUBLISH` publishes
 * to, the two price members and the three commission members are what a `REPRICE` writes, and a
 * `PAUSE` and a `WITHDRAW` write the status alone. The union is stated once rather than split into four
 * item types because a batch is one array a client builds, and four shapes for one array would make
 * every batch a union type at the call site.
 */
export interface IBulkSellerOfferingItem {
	/** The offering the item acts on. Required: no operation of this batch creates or guesses a row. */
	id: ID;
	/** The operation this item performs. Required: an item that states none is refused. */
	operation: SellerOfferingBulkOperation;
	/** The price the offering is to carry; read by a re-price. */
	priceAmount?: DecimalString;
	/** The currency of that price; read by a re-price. */
	priceCurrency?: CurrencyCode;
	/** The commission rate the offering overrides the seller's default with; read by a re-price. */
	commissionRate?: DecimalString;
	/** What that rate multiplies; read by a re-price. */
	commissionBasis?: CommissionBasis;
	/** The graduated schedule that replaces the flat rate; read by a re-price. */
	commissionTiers?: ICommissionTier[];
	/** The channel subset to publish to; null inherits the seller's set. Read by a publish. */
	channelIds?: string[];
}

/**
 * The body `POST /seller-offerings/bulk` accepts.
 *
 * The three members the endpoint table declares, and no others: the items, each naming its operation
 * and the offering it applies to; the platform's write mode; and the flag that says whether the batch
 * is one write or a sequence of them.
 *
 * The mode is the platform's own — `upsert` merges into the addressed row and `replace` overwrites it —
 * and the executor validates it and hands it to every item before the first write. This route creates
 * no row, so an item is applied to the offering it names whichever mode the batch states; the member is
 * declared because the contract the route adopts carries it, and a batch that states none gets the
 * platform's default.
 *
 * A dry run is deliberately not declared: this resource holds no priced-but-unwritten pass, and the
 * executor would honour the member by applying every item with no transaction — a request answered with
 * the writes it asked not to make. The route refuses the member instead.
 */
export interface IBulkSellerOfferingsRequest extends Pick<
	BulkRequest<IBulkSellerOfferingItem>,
	'items' | 'mode' | 'atomic'
> {}

/**
 * What a caller states to `bulkSellerOfferings`.
 *
 * The route's own body plus the retry key. GraphQL has no header that can say which of the mutations in
 * a document a key belongs to, so the key rides beside the input it qualifies — and the platform's
 * idempotency kernel reads it from exactly there, which is why a key it cannot use is refused with the
 * same answer on both surfaces.
 */
export interface IBulkSellerOfferingsInput extends IBulkSellerOfferingsRequest {
	/** The client's retry key for this batch. Optional: the operation honours one and does not demand it. */
	idempotencyKey?: string;
}

/**
 * One item's outcome, as `SellerOfferingBulkItemResult` declares it.
 *
 * A batch is answered in one piece, so each entry carries the position the item held in the request and
 * either the offering that moved or the failure with the item's own code.
 */
export interface IBulkSellerOfferingItemResult {
	/** The item's position in the request. */
	index: number;
	/** True when the item applied. */
	ok: boolean;
	/** The offering that moved, when the item applied. */
	id?: ID;
	/** The resource that moved, so a mixed batch reads unambiguously. */
	resource?: string;
	/** Why the item did not apply, with the item's own code. */
	error?: {
		code: string;
		message: string;
		path: string[];
		details?: Record<string, unknown>;
	};
}

/**
 * What `bulkSellerOfferings` answers.
 *
 * The counts are read from the platform's own batch result rather than accumulated here, so a client can
 * assert `succeeded + failed === total` on either surface.
 */
export interface IBulkSellerOfferingsPayload {
	/** One entry per request item, in request order. */
	results: IBulkSellerOfferingItemResult[];
	/** How many items applied. */
	succeeded: number;
	/** How many items did not. */
	failed: number;
	/** How many items the request carried. */
	total: number;
}

/**
 * The members an item of any operation must carry.
 *
 * This is the platform's default widened, not narrowed: an operation that changes a row has always had
 * to name it, and every item of this batch has to name the operation as well, whichever kind it
 * declares. The platform's pre-pass treats an item that states no operation as an upsert, and an item
 * that defaulted here would silently re-price a listing the caller meant to pause — which is the
 * failure the pre-pass exists to report before anything is written.
 *
 * Both members are required of every operation rather than of some, because the four operations of this
 * batch all address an existing offering and all state which of the four they perform.
 *
 * @returns The members the item must carry.
 */
export const SELLER_OFFERING_BULK_REQUIRED_KEYS = (): readonly string[] => ['id', 'operation'];
