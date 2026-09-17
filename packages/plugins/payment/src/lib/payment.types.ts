import { DecimalString, IBasePerTenantAndOrganizationEntityModel, ID, IPagination } from '@gauzy/contracts';

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

/**
 * Paginated provider registrations.
 */
export type IPaymentProviderPagination = IPagination<IPaymentProvider>;

/**
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
