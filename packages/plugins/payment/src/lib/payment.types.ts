import {
	CurrencyCode,
	DecimalString,
	IBasePerTenantAndOrganizationEntityModel,
	ID,
	IPagination,
	IPaymentAccountHolder,
	IPaymentMethodToken
} from '@gauzy/contracts';

/**
 * The payment domain's value sets and in-memory shapes.
 *
 * The enumerations live beside the tables they describe rather than in the shared contract package,
 * because a provider registration, a collection, a session, a capture and a refund are concepts only
 * this domain has: an order reads money through the core `payment` row that was written for it, a
 * return reaches money through the refund it caused, and neither needs these types to do it. What
 * does cross a domain boundary — an exact decimal, a currency, the adjustment ledger, the inbound
 * webhook contract — is already declared by the kernel.
 */

/**
 * Lifecycle of a collection: the money side of one order or cart.
 *
 * Derived from the amounts and the sessions of the collection, never set directly by a caller.
 */
export enum PaymentCollectionStatus {
	/** Nothing attempted. */
	NOT_PAID = 'NOT_PAID',
	/** A session exists and the customer or the provider has not answered yet. */
	AWAITING = 'AWAITING',
	/** The whole `amount` is authorised. */
	AUTHORIZED = 'AUTHORIZED',
	/** Less than `amount` is authorised: a split payment, or a provider that authorises per line. */
	PARTIALLY_AUTHORIZED = 'PARTIALLY_AUTHORIZED',
	/** Something is captured and less than the authorised amount is captured. */
	PARTIALLY_CAPTURED = 'PARTIALLY_CAPTURED',
	/** The whole amount is captured and nothing is outstanding. */
	COMPLETED = 'COMPLETED',
	/** Cancelled before completion; the authorisations were released. */
	CANCELED = 'CANCELED',
	/** The last attempt failed and no further attempt is in progress. */
	FAILED = 'FAILED'
}

/**
 * Lifecycle of one attempt with one provider.
 */
export enum PaymentSessionStatus {
	/** Created; nothing has happened yet. */
	PENDING = 'PENDING',
	/** The customer has submitted and the provider is deciding. */
	PENDING_AUTHORIZATION = 'PENDING_AUTHORIZATION',
	/** The provider needs another action from the customer; the next-action data is in `data`. */
	REQUIRES_MORE = 'REQUIRES_MORE',
	/** The provider authorised the amount. */
	AUTHORIZED = 'AUTHORIZED',
	/** Captured through this session. */
	CAPTURED = 'CAPTURED',
	/** Cancelled by us or by the customer. */
	CANCELED = 'CANCELED',
	/** The provider returned an error; the retry is a new session. */
	ERROR = 'ERROR',
	/** Past `expiresAt`. */
	EXPIRED = 'EXPIRED'
}

/**
 * Lifecycle of one refund.
 */
export enum RefundStatus {
	/** Recorded and not yet attempted, or still in flight. */
	PENDING = 'PENDING',
	/** The provider confirmed it; the order ledger carries the negative movement. */
	SUCCEEDED = 'SUCCEEDED',
	/** The provider rejected it. No ledger row was written. */
	FAILED = 'FAILED',
	/** Withdrawn before it was attempted. */
	CANCELED = 'CANCELED'
}

/**
 * Where an inbound provider callback stands.
 *
 * `IGNORED` and `FAILED` are deliberately different: `IGNORED` is a validly signed event of a type
 * this build does not handle — there is nothing to do — while `FAILED` is something to fix.
 */
export enum PaymentWebhookEventStatus {
	/** Persisted, before anything was verified or parsed. */
	RECEIVED = 'RECEIVED',
	/** Handled successfully. */
	PROCESSED = 'PROCESSED',
	/** Handling threw, or verification failed. Retried, then escalated. */
	FAILED = 'FAILED',
	/** Validly signed, but a type this build does not handle. */
	IGNORED = 'IGNORED'
}

/**
 * When the money is taken relative to the authorisation.
 */
export enum PaymentCaptureMode {
	/** A separate provider call takes the money, typically when the fulfillment ships. */
	MANUAL = 'MANUAL',
	/** One provider call authorises and captures; the capture is written with the authorisation. */
	AUTOMATIC = 'AUTOMATIC'
}

/**
 * What an inbound provider callback did at intake.
 */
export interface IPaymentWebhookIntakeResult {
	/** Always true: a callback that is recorded is acknowledged. */
	readonly received: boolean;
	/** True when the `(providerId, eventId)` pair was already stored, so nothing was processed. */
	readonly duplicate?: boolean;
	/** The provider's event identifier, echoed back so the provider can correlate the acknowledgement. */
	readonly eventId: string;
	/** Where the event stands after intake. */
	readonly status: PaymentWebhookEventStatus;
}

/**
 * A provider registration.
 *
 * Credentials are never here: they live in the `integration_setting` rows of the integration this row
 * points at. What the row holds is what an operator may edit — availability, display order and the
 * non-secret configuration the adapter reads.
 */
export interface IPaymentProvider extends IBasePerTenantAndOrganizationEntityModel {
	code: string;
	name: string;
	isEnabled: boolean;
	isTestMode: boolean;
	integrationId?: ID;
	supportedCurrencies?: string[];
	supportedCountries?: string[];
	supportedPaymentMethods?: string[];
	sortOrder: number;
	configuration?: Record<string, unknown>;
	metadata?: Record<string, unknown>;
}

/**
 * The money side of one order or cart.
 *
 * `capturedAmount + canceledAmount <= authorizedAmount <= amount`, and
 * `refundedAmount <= capturedAmount`: the service checks both inside the writing transaction, and the
 * nightly ledger audit re-derives them from the captures and the refunds.
 */
export interface IPaymentCollection extends IBasePerTenantAndOrganizationEntityModel {
	orderId?: ID;
	cartId?: ID;
	amount: DecimalString;
	currency: string;
	status: PaymentCollectionStatus;
	authorizedAmount: DecimalString;
	capturedAmount: DecimalString;
	refundedAmount: DecimalString;
	canceledAmount: DecimalString;
	settlementCurrency?: string;
	settlementAmount?: DecimalString;
	fxRate?: DecimalString;
	fxRateId?: ID;
	fxCapturedAt?: Date;
	completedAt?: Date;
	metadata?: Record<string, unknown>;
	sessions?: IPaymentSession[];
}

/**
 * One attempt at collecting a collection through one provider.
 *
 * An attempt that names a saved instrument (`paymentMethodTokenId`) is **off-session**: it carries no
 * `clientSecret`, because there is no client to hand one to, and it can never enter `REQUIRES_MORE`,
 * because there is nobody to perform the next action.
 */
export interface IPaymentSession extends IBasePerTenantAndOrganizationEntityModel {
	collectionId: ID;
	providerId: ID;
	status: PaymentSessionStatus;
	amount: DecimalString;
	currency: string;
	externalId?: string;
	paymentMethodTokenId?: ID;
	clientSecret?: string;
	data?: Record<string, unknown>;
	idempotencyKey?: string;
	expiresAt?: Date;
	authorizedAt?: Date;
	metadata?: Record<string, unknown>;
	collection?: IPaymentCollection;
	provider?: IPaymentProvider;
}

/**
 * Money actually taken against an authorisation. Append-only: a partial capture is another row, and a
 * correction is a refund rather than an edit.
 */
export interface IPaymentCapture extends IBasePerTenantAndOrganizationEntityModel {
	paymentId: ID;
	amount: DecimalString;
	currency: string;
	externalId?: string;
	capturedAt: Date;
	metadata?: Record<string, unknown>;
}

/**
 * Money given back.
 *
 * `Σ SUCCEEDED refunds` of a payment may never exceed `Σ captures` of that payment, and a refund that
 * has reached a terminal status is never re-opened. A pending refund may be approved or cancelled;
 * a failed one leaves no ledger row.
 */
export interface IRefund extends IBasePerTenantAndOrganizationEntityModel {
	orderId: ID;
	paymentId?: ID;
	returnId?: ID;
	claimId?: ID;
	amount: DecimalString;
	currency: string;
	reasonId?: ID;
	reason?: string;
	status: RefundStatus;
	externalId?: string;
	refundedAt?: Date;
	note?: string;
	metadata?: Record<string, unknown>;
	refundReason?: IRefundReason;
	/**
	 * The lines the refund paid back, resolved through the refund-line service rather than mapped as
	 * a relation, so the same read answers for a refund whose breakdown was written before the table
	 * existed.
	 */
	lines?: IRefundLine[];
}

/**
 * Which lines a refund paid back, as a row.
 *
 * The breakdown is money, and it is its own table rather than an array inside `refund.metadata`:
 * nothing enforced the sum of an array, nothing indexed it, and no lock could be taken on it. A row
 * is a positive magnitude in the order currency — the direction of the movement is the ledger row's —
 * and its `amount` is capped by the refund it belongs to.
 *
 * `legacy` marks a row that was read from the per-line array a refund written before this table
 * existed carries in its metadata. Those rows are answered for, never written: the array is a read
 * path kept for the refunds that still hold it, and no new refund writes one.
 */
export interface IRefundLine extends IBasePerTenantAndOrganizationEntityModel {
	refundId: ID;
	orderLineId: ID;
	quantity: DecimalString;
	amount: DecimalString;
	currency: string;
	metadata?: Record<string, unknown>;
	refund?: IRefund;
	readonly legacy?: boolean;
}

/**
 * A governed refund reason, so refund reporting is groupable. The tree is at most two levels deep,
 * and a reason a refund cites is deactivated rather than deleted.
 */
export interface IRefundReason extends IBasePerTenantAndOrganizationEntityModel {
	code: string;
	label: string;
	description?: string;
	parentId?: ID;
	parent?: IRefundReason;
	children?: IRefundReason[];
}

/**
 * An inbound provider callback, with replay protection.
 *
 * The payload row is written before signature verification and before any state change, so an
 * unverifiable callback is still on record; `(providerId, eventId)` is unique, so a provider retry is
 * acknowledged with no side effect.
 */
export interface IPaymentWebhookEvent extends IBasePerTenantAndOrganizationEntityModel {
	providerId: ID;
	eventId: string;
	type: string;
	payload: Record<string, unknown>;
	signature?: string;
	receivedAt: Date;
	processedAt?: Date;
	status: PaymentWebhookEventStatus;
	lastError?: string;
	attemptCount: number;
	provider?: IPaymentProvider;
}

/**
 * The writable surface of a provider registration: the code and the name are required, everything
 * else has a default.
 */
export type IPaymentProviderCreateInput = Partial<IPaymentProvider> & Pick<IPaymentProvider, 'code' | 'name'>;

/**
 * The fields of a provider registration an update may change.
 */
export type IPaymentProviderUpdateInput = Partial<IPaymentProvider>;

/**
 * The writable surface of a collection: what must be collected, and for which order or cart. The
 * status and the four amounts are derived and are never taken from the input.
 */
export type IPaymentCollectionCreateInput = Partial<IPaymentCollection> &
	Pick<IPaymentCollection, 'amount' | 'currency'>;

/**
 * The fields of a collection an update may change. The amounts move through the operations that cause
 * them, so they are not part of it.
 */
export type IPaymentCollectionUpdateInput = Omit<Partial<IPaymentCollection>, 'status'>;

/**
 * The writable surface of a session.
 */
export type IPaymentSessionCreateInput = Partial<IPaymentSession> &
	Pick<IPaymentSession, 'collectionId' | 'providerId' | 'amount' | 'currency'>;

/**
 * The fields of a session an update may change.
 */
export type IPaymentSessionUpdateInput = Partial<IPaymentSession>;

/**
 * The writable surface of a capture.
 */
export type IPaymentCaptureCreateInput = Partial<IPaymentCapture> &
	Pick<IPaymentCapture, 'paymentId' | 'amount' | 'currency'>;

/**
 * The fields of a capture an update may change: an append-only ledger row has none of its own, so
 * this exists only for the generic CRUD surface, which refuses the write.
 */
export type IPaymentCaptureUpdateInput = Partial<IPaymentCapture>;

/**
 * The writable surface of a refund.
 */
export type IRefundCreateInput = Partial<IRefund> & Pick<IRefund, 'orderId' | 'amount' | 'currency'>;

/**
 * The fields of a refund an update may change.
 */
export type IRefundUpdateInput = Partial<IRefund>;

/**
 * One request to record the money a return or a claim pays back.
 *
 * This is the refund as the domain that asks for it states it: the order the money goes back for, the
 * flow that caused it when there is one, the exact amount and its currency, and the governed reason
 * an operator picked. It is deliberately narrower than the refund this package writes — no payment,
 * no line breakdown and no status — because the caller knows none of those, and the entry point that
 * answers it decides what the refund is attributed to before it is written.
 */
export interface IReturnRefundRequest {
	/** The order the money goes back for. */
	readonly orderId: ID;
	/** The return that caused it, when it came from one. */
	readonly returnId?: ID;
	/** The exchange that caused it, when it came from one. */
	readonly exchangeId?: ID;
	/**
	 * The claim that caused it, when it came from one.
	 *
	 * A claim is the third flow that can owe money back — after a return and an exchange — and it
	 * names a damaged or short delivery rather than goods sent back. It is **attribution on its own**:
	 * a claim refund is recorded even when no captured payment can carry it, because the money it
	 * gives back may have arrived by means no payment row records, and refusing it would leave the
	 * claim unsettled with nothing to point at.
	 */
	readonly claimId?: ID;
	/** Amount to pay back, exact. */
	readonly amount: DecimalString;
	/** Currency of the amount. */
	readonly currency: CurrencyCode;
	/** The governed reason the refund cites, when the operator picked one. */
	readonly reasonId?: ID;
	/** Free-text note kept beside the refund. */
	readonly note?: string;
}

/**
 * What the refund entry point answers with.
 *
 * The row it wrote is named by the identifier the caller knows it by, and the amount and the currency
 * are read back from the stored refund rather than echoed from the request: an amount the platform
 * rounded, or refused to pay in full, must be answered as it was recorded.
 */
export interface IReturnRefundResult {
	/** The refund that was written. */
	readonly refundId: ID;
	/** Amount actually paid back. */
	readonly amount: DecimalString;
	/** Currency of the amount. */
	readonly currency: CurrencyCode;
}

/**
 * The writable surface of a refund line: what came back, and for how much. The currency is the
 * refund's, and the refund a line belongs to is named by the row it is written with.
 */
export type IRefundLineCreateInput = Partial<IRefundLine> &
	Pick<IRefundLine, 'orderLineId' | 'quantity' | 'amount'>;

/**
 * The fields of a refund line an update may change. What the line explains — its refund and its order
 * line — is not among them: a different order line is a different line.
 */
export type IRefundLineUpdateInput = Partial<IRefundLine>;

/**
 * The writable surface of a refund reason.
 */
export type IRefundReasonCreateInput = Partial<IRefundReason> & Pick<IRefundReason, 'code' | 'label'>;

/**
 * The fields of a refund reason an update may change.
 */
export type IRefundReasonUpdateInput = Partial<IRefundReason>;

/**
 * The writable surface of an inbound callback record. Only the intake writes one, which is what keeps
 * the payload exactly as the provider sent it.
 */
export type IPaymentWebhookEventCreateInput = Partial<IPaymentWebhookEvent> &
	Pick<IPaymentWebhookEvent, 'providerId' | 'eventId' | 'type' | 'payload'>;

/**
 * The fields of a callback record an update may change: the processing outcome, never the payload.
 */
export type IPaymentWebhookEventUpdateInput = Partial<IPaymentWebhookEvent>;

/**
 * A callback as a provider delivers it: the body, the signature header, and whichever identifier of
 * the provider registration the route could resolve — the path segment carries the code, a stored
 * replay carries the id.
 */
export interface IPaymentWebhookIntakeInput {
	/** The provider registration, when the caller knows it. */
	providerId?: ID;
	/** The provider code, which is what the callback path carries. */
	providerCode?: string;
	/** The provider's own event identifier. It is the replay key. */
	eventId: string;
	/** The provider's event type, exactly as the provider words it. */
	type: string;
	/** The raw body. */
	payload: Record<string, unknown>;
	/** The signature header, retained as dispute evidence. */
	signature?: string;
	/** When the callback arrived, defaulting to now. */
	receivedAt?: Date;
}

/**
 * The outcome of an intake: the row that was written, and whether the callback had already been seen.
 */
export interface IPaymentWebhookIntake {
	/** The stored event, whether it was just written or already on record. */
	readonly event: IPaymentWebhookEvent;
	/** True when `(providerId, eventId)` was already stored, so nothing was processed. */
	readonly duplicate: boolean;
}

/*
|--------------------------------------------------------------------------
| The order line's refund register, as this domain sees it
|--------------------------------------------------------------------------
*/

/**
 * One refund this domain reports against one order line.
 *
 * The shape is deliberately the one the order domain's `IRecordLineRefundInput` already has, field for
 * field. It is **declared here rather than imported** because a port is a description of what this
 * domain needs, not a reference to the package that happens to satisfy it today: importing the order
 * package — even for a type — is what would make this package unable to boot without it.
 */
export interface IPaymentOrderLineRefund {
	/** The order line the money was paid back on. */
	readonly orderLineId: ID;
	/** The quantity paid back, as an exact decimal. */
	readonly quantity: DecimalString;
	/** The money paid back, in the order's currency, as a positive magnitude. */
	readonly amount: DecimalString;
	/** The order's currency, which the receiving side checks against its own order. */
	readonly currency: string;
}

/** What the register holds once the report has been applied. */
export interface IPaymentOrderLineRefundResult {
	/** The order line whose register moved. */
	readonly id: ID;
	/** The quantity refunded against the line so far, as an exact decimal. */
	readonly refundedQuantity: DecimalString;
	/** The money refunded against the line so far, as an exact decimal. */
	readonly refundedAmount: DecimalString;
}

/**
 * The order line's refund register as this domain sees it.
 *
 * Provided by the order capability and injected under `PAYMENT_ORDER_LINE_REFUND`.
 *
 * **Why this seam.** `refund_line` is this package's table and `order_line.refundedQuantity` /
 * `refundedAmount` are the order package's columns — a register whose evidence lives in another
 * capability. The order domain owns the rule that moves it (one guarded write, conditional on the
 * counters the transaction read, so two concurrent refunds cannot both claim to be the second), and
 * this domain owns the fact that money went back. The programme reaches a capability of another
 * package through an optional injection token rather than an imported module — the stock ledger, the
 * refund gateway and the order's fulfilled quantities are all reached that way — and this is the same
 * arrangement, which is why neither package has to be installed for the other to boot.
 *
 * **Why not the event bus.** The refund flow already publishes `RefundCreatedEvent` when a refund is
 * recorded and `PaymentRefundedEvent` when it succeeds, and a consumer could in principle hear one of
 * them. It cannot act on it: `EventBus.ofType` matches on the event's constructor, so a listener in
 * another package would have to import the event class — the very dependency this seam exists to avoid
 * — and neither event carries the line breakdown, so the listener would then have to read this
 * package's `refund_line` rows to discover which order lines moved. A port states the fact once, to
 * the domain that owns the register, with no import in either direction.
 *
 * **What a caller may rely on.** The port moves the register for the lines a **succeeded** refund paid
 * back, and it is called after the refund's status has moved, so a register never counts money that
 * has not gone back. It is not part of the money movement's own transaction: the money moved at the
 * provider, and a register that lagged one call is recoverable by re-reporting the lines, whereas a
 * refund that failed because a register refused would be a refund the customer was told about and did
 * not get. `RefundService` therefore reports and continues rather than rolling back, and the order
 * package's `recomputeRefundCounters` is the reconciliation half — it re-derives the register from the
 * totals this domain reports, so a report that was lost converges on the next run rather than needing
 * a manual correction.
 */
export interface IPaymentOrderLineRefundPort {
	/** Records one refund against one order line, moving that line's refund register. */
	recordRefund(refund: IPaymentOrderLineRefund): Promise<IPaymentOrderLineRefundResult>;
}

/*
|--------------------------------------------------------------------------
| Injection tokens
|--------------------------------------------------------------------------
*/

/**
 * Token the order line's refund register is injected under.
 *
 * Optional on purpose: a payment settles an invoice, a subscription renewal or a marketplace payout as
 * readily as it settles an order, and a deployment that installs this package without the order package
 * — or refunds a document that has no order line at all — still records the refund. What it does not
 * do is pretend the register moved: the absence is reported under
 * `PAYMENT_ORDER_LINE_REFUND_UNAVAILABLE` so an operator can see which refunds were not mirrored.
 *
 * Nothing in this package provides the token, and nothing in this package imports the order package to
 * find out whether it exists. Registering a provider under it is what enables the mirror, and
 * `useExisting: OrderLineService` is all that provider needs to be, because `recordRefund` already has
 * the port's shape.
 *
 * **Where that registration has to live, and why it is not a one-line module import.** A provider is
 * resolved in the scope of the module that declares the injecting handler, and Nest imports are not
 * inherited downwards — so `RefundService`, a provider of this package's own module, sees a token only
 * if that module provides it or imports a module that exports it. Making this package import the order
 * package to reach `OrderLineService` is exactly the dependency the seam exists to avoid. The
 * registration therefore belongs to a **composition module that is global**: a module that imports the
 * order package's module, provides `{ provide: PAYMENT_ORDER_LINE_REFUND, useExisting: OrderLineService }`
 * and is marked global reaches every module's scope without either package importing the other. A
 * deployment that does not install the order package simply never registers that module, the token stays
 * unbound, and the refund path reports rather than fails.
 */
export const PAYMENT_ORDER_LINE_REFUND = Symbol('PAYMENT_ORDER_LINE_REFUND');

/**
 * Paginated provider registrations.
 */
export type IPaymentProviderPagination = IPagination<IPaymentProvider>;/**
 * Paginated collections.
 */
export type IPaymentCollectionPagination = IPagination<IPaymentCollection>;

/**
 * Paginated sessions.
 */
export type IPaymentSessionPagination = IPagination<IPaymentSession>;

/**
 * Paginated captures.
 */
export type IPaymentCapturePagination = IPagination<IPaymentCapture>;

/**
 * Paginated refunds.
 */
export type IRefundPagination = IPagination<IRefund>;

/**
 * Paginated refund lines.
 */
export type IRefundLinePagination = IPagination<IRefundLine>;

/**
 * Paginated refund reasons.
 */
export type IRefundReasonPagination = IPagination<IRefundReason>;

/**
 * Paginated inbound callbacks.
 */
export type IPaymentWebhookEventPagination = IPagination<IPaymentWebhookEvent>;

/**
 * The paging shapes of the remembered payer, in the vocabulary of every other resource here.
 */
export type IPaymentAccountHolderPagination = IPagination<IPaymentAccountHolder>;

export type IPaymentMethodTokenPagination = IPagination<IPaymentMethodToken>;
