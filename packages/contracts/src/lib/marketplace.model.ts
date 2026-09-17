import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';
import { CurrencyCode, DecimalString } from './money.model';

/**
 * The participation state of a seller account.
 *
 * Two questions are kept apart on purpose: whether a seller may sell, and whether the platform has
 * verified it. `APPROVED` means every required verification passed; `ACTIVE` means an operator then
 * let it trade. Nothing reaches `ACTIVE` implicitly, so a verification callback can never put a
 * seller live on its own.
 */
export enum SellerStatus {
	/** Created, not yet submitted for review. */
	DRAFT = 'DRAFT',
	/** Submitted and waiting to be claimed by a reviewer. */
	SUBMITTED = 'SUBMITTED',
	/** Being reviewed. */
	IN_REVIEW = 'IN_REVIEW',
	/** A fixable verification failure; the applicant may resubmit. */
	ACTION_REQUIRED = 'ACTION_REQUIRED',
	/** Refused; terminal. */
	REJECTED = 'REJECTED',
	/** Every required verification passed; not yet trading. */
	APPROVED = 'APPROVED',
	/** Trading and payable. */
	ACTIVE = 'ACTIVE',
	/** Stopped from doing anything new; balances are held. */
	SUSPENDED = 'SUSPENDED',
	/** Being closed down; only the final payout may move. */
	OFFBOARDING = 'OFFBOARDING',
	/** Closed; terminal. */
	OFFBOARDED = 'OFFBOARDED'
}

/**
 * The state of one verification kind.
 *
 * Used three times per seller — business identity, tax identifier and payout account — because the
 * three are performed by different parties at different times and one verdict cannot stand for
 * another.
 */
export enum SellerVerificationStatus {
	/** Never checked. */
	UNVERIFIED = 'UNVERIFIED',
	/** Sent to a provider or a reviewer; no verdict yet. */
	PENDING = 'PENDING',
	/** A fixable failure: the applicant can correct it and resubmit. */
	ACTION_REQUIRED = 'ACTION_REQUIRED',
	/** Passed. */
	VERIFIED = 'VERIFIED',
	/** A failure that is not fixable by resubmission. */
	FAILED = 'FAILED',
	/** Was verified and the validity window has passed. */
	EXPIRED = 'EXPIRED'
}

/**
 * Which verification a recorded result belongs to.
 */
export enum SellerVerificationKind {
	BUSINESS_IDENTITY = 'BUSINESS_IDENTITY',
	TAX_IDENTIFIER = 'TAX_IDENTIFIER',
	PAYOUT_ACCOUNT = 'PAYOUT_ACCOUNT'
}

/**
 * What a commission rate multiplies.
 *
 * Six arrangements that are commercially distinct rather than variations of one another: two
 * subtotal conventions, a tax-inclusive convention, a flat fee, and two graduated schedules. The
 * basis decides the amount, and the amount decides the commission — never the other way round.
 */
export enum CommissionBasis {
	/** `quantity × unitPrice`, before any discount. */
	ITEM_SUBTOTAL = 'ITEM_SUBTOTAL',
	/** `quantity × unitPrice` after the seller's own discounts. */
	DISCOUNTED_SUBTOTAL = 'DISCOUNTED_SUBTOTAL',
	/** The tax-inclusive amount. */
	INCLUDING_TAX = 'INCLUDING_TAX',
	/** `fixedFeePerItem × quantity`; no rate is involved. */
	FIXED_PER_ITEM = 'FIXED_PER_ITEM',
	/** The tier containing the amount sets the rate for the whole amount. */
	TIERED_AMOUNT = 'TIERED_AMOUNT',
	/** The tier containing the quantity sets the rate for the whole line. */
	TIERED_QUANTITY = 'TIERED_QUANTITY'
}

/**
 * Whether the commission was computed on the line or distributed from an order-level computation.
 *
 * The distinction is recorded rather than inferred, because a distributed commission and a line
 * commission are reconciled differently: the first sums to the order figure by construction, the
 * second is defined as the sum of its parts.
 */
export enum CommissionOn {
	LINE = 'LINE',
	ORDER = 'ORDER'
}

/**
 * One band of a graduated commission schedule.
 *
 * Bands are half open — `from <= x < to` — and `to` of `null` means open ended. Overlapping or
 * gapped bands are refused at write time, because two answers to "which rate applies" is a defect
 * rather than a policy.
 */
export interface ICommissionTier {
	/** Inclusive lower bound, in major units for an amount basis and in units for a quantity basis. */
	from: number;
	/** Exclusive upper bound; `null` is open ended. */
	to?: number | null;
	/** Rate applied to the whole amount or quantity when the value falls in this band. */
	rate: DecimalString;
}

/**
 * Where a resolved commission came from.
 *
 * Recorded so a statement can explain itself: the same rate means different things when it is the
 * offering's, the seller's default or the platform's.
 */
export enum CommissionSource {
	OFFERING = 'OFFERING',
	SELLER = 'SELLER',
	PLATFORM = 'PLATFORM'
}

/**
 * Whether an offering is sellable, and why not.
 */
export enum OfferingStatus {
	/** Being authored. */
	DRAFT = 'DRAFT',
	/** Waiting for moderation. */
	PENDING_REVIEW = 'PENDING_REVIEW',
	/** Sellable, subject to the publication rules. */
	ACTIVE = 'ACTIVE',
	/** Not sellable; resumable by the seller. */
	PAUSED = 'PAUSED',
	/** Refused by a moderator. */
	REJECTED = 'REJECTED',
	/** Withdrawn; terminal. */
	WITHDRAWN = 'WITHDRAWN'
}

/**
 * The condition of the goods a seller offers.
 */
export enum OfferingCondition {
	NEW = 'NEW',
	REFURBISHED = 'REFURBISHED',
	USED_LIKE_NEW = 'USED_LIKE_NEW',
	USED_GOOD = 'USED_GOOD',
	USED_ACCEPTABLE = 'USED_ACCEPTABLE'
}

/**
 * Who physically fulfils a seller's line.
 */
export enum OfferingFulfilmentMode {
	/** The platform ships from its own locations; the seller is not involved in fulfilment. */
	PLATFORM = 'PLATFORM',
	/** The seller ships from its own location; only that seller's stock may be allocated. */
	SELLER = 'SELLER',
	/** The seller's supplier ships; no allocation against a stock level. */
	DROPSHIP = 'DROPSHIP'
}

/**
 * The vocabulary a tax rate's applicability rule reads.
 */
export enum TaxRegistrationScheme {
	NONE = 'NONE',
	VAT = 'VAT',
	GST = 'GST',
	SALES_TAX = 'SALES_TAX',
	ABN = 'ABN',
	TAX_ID = 'TAX_ID'
}

/**
 * Who collects and remits the tax on a seller's lines.
 */
export enum TaxCollectionMode {
	/** The seller remits on its own registration; the platform records the tax as it always has. */
	SELLER_REMITS = 'SELLER_REMITS',
	/** The sale is the seller's; the marketplace collects and remits on its behalf. */
	MARKETPLACE_COLLECTS_AND_REMITS = 'MARKETPLACE_COLLECTS_AND_REMITS',
	/** The platform is the supplier of record for the jurisdiction. */
	DEEMED_SUPPLIER = 'DEEMED_SUPPLIER'
}

/**
 * How a seller's money reaches the seller.
 *
 * There are exactly two permitted modes and no third. In both, the seller's share is credited to the
 * seller's own provider account at capture, so the platform never holds a third party's money; a
 * provider model in which the money lands in the platform's balance and is transferred out later is
 * not a mode this platform supports.
 */
export enum SellerPayoutMode {
	/** The provider split the charge at capture; the platform instructs no transfer. */
	PROVIDER_SPLIT = 'PROVIDER_SPLIT',
	/** The provider holds the seller's balance; the platform instructs a transfer to the seller's bank. */
	PROVIDER_TRANSFER = 'PROVIDER_TRANSFER'
}

/**
 * When a payout run may create a payout for a seller.
 */
export enum SellerPayoutSchedule {
	/** Only an explicit request creates a payout. */
	MANUAL = 'MANUAL',
	DAILY = 'DAILY',
	WEEKLY = 'WEEKLY',
	BI_WEEKLY = 'BI_WEEKLY',
	SEMI_MONTHLY = 'SEMI_MONTHLY',
	MONTHLY = 'MONTHLY',
	/** A payout is created once the settleable balance reaches the seller's threshold. */
	THRESHOLD = 'THRESHOLD'
}

/**
 * Where a payout instruction stands.
 */
export enum SellerPayoutStatus {
	/** Built and not yet submitted for approval. */
	DRAFT = 'DRAFT',
	/** Waiting for approval. */
	PENDING = 'PENDING',
	/** Approved; the transfer has not been attempted. */
	APPROVED = 'APPROVED',
	/** The provider call is in flight. */
	PROCESSING = 'PROCESSING',
	/** The provider reports the transfer executed. Terminal. */
	PAID = 'PAID',
	/** The provider refused the transfer; retryable. */
	FAILED = 'FAILED',
	/** Cancelled before payment; its transactions return to settleable. Terminal. */
	CANCELED = 'CANCELED'
}

/**
 * Where a settlement report stands.
 */
export enum SellerSettlementStatus {
	/** Accepting the platform's lines for the period. */
	OPEN = 'OPEN',
	/** Compared against the provider's report. */
	RECONCILED = 'RECONCILED',
	/** Final; no further lines are accepted. */
	CLOSED = 'CLOSED',
	/** The provider's figures and the platform's ledger disagree and the difference is unresolved. */
	DISPUTED = 'DISPUTED'
}

/**
 * What a seller ledger row records.
 */
export enum SellerTransactionKind {
	/** A seller-owned order line was sold. */
	SALE = 'SALE',
	/** Shipping revenue attributed to the seller. */
	SHIPPING = 'SHIPPING',
	/** A carrier cost the platform paid on the seller's behalf; a negative row. */
	SHIPPING_FEE = 'SHIPPING_FEE',
	/** A reversal of money returned to the buyer. */
	REFUND = 'REFUND',
	/** A reversal of a charged-back sale. */
	CHARGEBACK = 'CHARGEBACK',
	/** A fee deducted from the seller's balance. */
	FEE = 'FEE',
	/** A manual adjustment, always with a reason. */
	ADJUSTMENT = 'ADJUSTMENT'
}

/**
 * The lifecycle of a seller ledger row.
 *
 * The status is the only mutable thing about a ledger row: its amounts are append only, so a
 * correction is a new reversal row rather than an edit.
 */
export enum SellerTransactionStatus {
	/** Written at placement, before the money is captured. */
	PENDING = 'PENDING',
	/** Captured and past the hold window; eligible for a payout. */
	SETTLEABLE = 'SETTLEABLE',
	/** Deliberately kept out of payouts, with a reason. */
	HELD = 'HELD',
	/** Included in a payout. */
	SETTLED = 'SETTLED',
	/** The payout covering it was paid. */
	PAID = 'PAID',
	/** Reversed in full by a later row. */
	REVERSED = 'REVERSED'
}

/**
 * Why a ledger row is held out of payouts.
 */
export enum SellerHoldReason {
	SELLER_SUSPENDED = 'SELLER_SUSPENDED',
	CHARGEBACK = 'CHARGEBACK',
	VERIFICATION_EXPIRED = 'VERIFICATION_EXPIRED',
	DISPUTE = 'DISPUTE',
	MANUAL = 'MANUAL'
}

/**
 * A seller of record on the marketplace.
 *
 * A seller is a party plus a commercial relationship: the party is the platform's existing
 * organization contact, and this row carries the lifecycle, the commission terms, the tax
 * registration and the payout terms that make the party a marketplace participant. It is bound to
 * exactly one organization and to exactly one contact, and neither binding ever moves.
 */
export interface ISeller extends IBasePerTenantAndOrganizationEntityModel {
	/** Stable human-usable key, unique per organization and immutable after creation. */
	code: string;
	/** Trading name. */
	name: string;
	/** Registered name, retained through offboarding. */
	legalName?: string;
	/** Snapshot of the party's reachability, so a notification path survives a contact edit. */
	email?: string;
	/** Snapshot of the party's phone number. */
	phone?: string;
	/** The seller's party row. */
	contactId: ID;
	/** The payee master, when the same business is also paid outside the marketplace. */
	merchantId?: ID;
	/** The staff user who administers this seller from inside the platform. */
	userId?: ID;
	/** Channels the seller may sell in; null means every channel of the organization. */
	channelIds?: string[];
	/** Regions the seller serves; null means the channel's own set. */
	regionIds?: string[];
	status: SellerStatus;
	submittedAt?: Date;
	activatedAt?: Date;
	suspendedAt?: Date;
	suspensionReason?: string;
	rejectedAt?: Date;
	rejectionReason?: string;
	offboardedAt?: Date;
	businessVerificationStatus: SellerVerificationStatus;
	taxVerificationStatus: SellerVerificationStatus;
	payoutAccountStatus: SellerVerificationStatus;
	verificationProvider?: string;
	verificationReference?: string;
	verifiedAt?: Date;
	verificationExpiresAt?: Date;
	/** Opaque, masked reference to the destination account; never an account number. */
	payoutAccountReference?: string;
	/** The verified account holder the money is sent to. */
	payoutAccountHolderId?: ID;
	taxId?: string;
	vatNumber?: string;
	/** ISO 3166-1 alpha-2 jurisdiction of registration. */
	taxCountryCode?: string;
	taxRegistrationScheme?: TaxRegistrationScheme;
	taxCollectionMode: TaxCollectionMode;
	/** Fraction, not a percentage: `0.150000` is fifteen per cent. Null inherits the platform default. */
	defaultCommissionRate?: DecimalString;
	commissionBasis?: CommissionBasis;
	commissionTiers?: ICommissionTier[];
	fixedFeePerItem?: DecimalString;
	fixedFeeCurrency?: CurrencyCode;
	commissionOnShipping: boolean;
	chargeShippingCost: boolean;
	allowNegativeNet: boolean;
	payoutMode: SellerPayoutMode;
	payoutSchedule: SellerPayoutSchedule;
	payoutCurrency?: CurrencyCode;
	payoutThreshold: DecimalString;
	reservePercent: DecimalString;
	reserveHoldDays: number;
	payoutHoldDays: number;
	externalId?: string;
	metadata?: JsonData;
}

/**
 * A seller's right to sell one product variant.
 *
 * The catalogue is unchanged by the marketplace: a product and its variants exist once, and this row
 * is the relationship between an existing variant and a seller — at the seller's price, under the
 * seller's SKU, for a period, in a set of channels. A variant may be offered by many sellers at once.
 */
export interface ISellerOffering extends IBasePerTenantAndOrganizationEntityModel {
	sellerId: ID;
	variantId: ID;
	/** Derived from the variant and stored so offering reports need no join. */
	productId?: ID;
	/** The seller's own SKU for the listing. */
	sellerSku?: string;
	/** The seller's listing title; null uses the catalogue title. */
	title?: string;
	condition: OfferingCondition;
	/** Authoring convenience; materialised into a price row when the offering is published. */
	priceAmount?: DecimalString;
	priceCurrency?: CurrencyCode;
	/** The authoritative price row for this offering. */
	productPriceId?: ID;
	commissionRate?: DecimalString;
	commissionBasis?: CommissionBasis;
	commissionTiers?: ICommissionTier[];
	status: OfferingStatus;
	channelIds?: string[];
	regionIds?: string[];
	availableFrom?: Date;
	availableTo?: Date;
	maxQuantityPerOrder?: number;
	fulfilmentMode: OfferingFulfilmentMode;
	fulfilmentWarehouseId?: ID;
	handlingDays?: number;
	isFeatured: boolean;
	allowNegativeNet?: boolean;
	approvedAt?: Date;
	approvedByUserId?: ID;
	rejectionReason?: string;
	externalId?: string;
	metadata?: JsonData;
}

/**
 * The split of one order line's money for one seller.
 *
 * This row is the ledger and the truth: what the buyer paid for the line, what the seller funded,
 * what the platform funded, what the commission was and what the seller is owed. Every amount is an
 * exact decimal in the row's own currency and the row is append only — a correction is a new
 * reversal row naming the row it reverses.
 *
 * The five amounts satisfy, exactly, at the row's currency precision:
 * `netAmount = grossAmount + taxAmount + sellerDiscountAmount − commissionAmount`.
 */
export interface ISellerTransaction extends IBasePerTenantAndOrganizationEntityModel {
	sellerId: ID;
	orderId: ID;
	/** Null for shipping, fee and order-level adjustment rows. */
	orderLineId?: ID;
	/** The payment-ledger row this split corresponds to. */
	orderTransactionId?: ID;
	kind: SellerTransactionKind;
	status: SellerTransactionStatus;
	currency: CurrencyCode;
	/** Snapshot of the currency's decimal places, so a later precision change cannot rewrite history. */
	currencyDecimals: number;
	/** Signed: positive for a sale or a shipping charge, negative on a reversal row. */
	grossAmount: DecimalString;
	/** Signed; the line's tax. */
	taxAmount: DecimalString;
	/** Signed, non-positive on a sale: the seller's own discount, which reduces the commission basis. */
	sellerDiscountAmount: DecimalString;
	/** Signed, non-positive on a sale: the platform's discount, which never reduces the basis. */
	platformDiscountAmount: DecimalString;
	/** The basis convention snapshotted at placement. */
	commissionBasis: CommissionBasis;
	/** The amount the rate applied to, signed like the row. */
	commissionBasisAmount: DecimalString;
	/** The resolved rate, snapshotted; a later change to the offering never moves a past row. */
	commissionRate: DecimalString;
	/** `round(commissionBasisAmount × commissionRate)` at `currencyDecimals`, or the fixed fee. */
	commissionAmount: DecimalString;
	/** `grossAmount + taxAmount + sellerDiscountAmount − commissionAmount`, exactly. */
	netAmount: DecimalString;
	commissionOn: CommissionOn;
	/** The business moment the row describes: placement for a sale, the refund date for a reversal. */
	occurredAt: Date;
	/** When the row became eligible for a payout. */
	settleableAt?: Date;
	settledAt?: Date;
	paidAt?: Date;
	holdReason?: SellerHoldReason;
	/** The row this one reverses. */
	reversesTransactionId?: ID;
	/** The money movement that caused a reversal. */
	refundId?: ID;
	description?: string;
	externalId?: string;
	metadata?: JsonData;
}

/**
 * One instruction to move a seller's settleable balance to the seller's bank account.
 *
 * A payout is derived from the ledger and never edited to disagree with it: it is built from
 * settleable transactions of one seller in one currency, and `netAmount` is the sum of its lines.
 * The platform holds no funds, so this row records an instruction given to a regulated provider
 * rather than a movement of the platform's own money.
 */
export interface ISellerPayout extends IBasePerTenantAndOrganizationEntityModel {
	sellerId: ID;
	/** From the platform sequence, unique per organization. */
	number: string;
	status: SellerPayoutStatus;
	/** Snapshotted from the seller at creation. */
	payoutMode: SellerPayoutMode;
	currency: CurrencyCode;
	currencyDecimals: number;
	/** The sum of the payout's lines. */
	netAmount: DecimalString;
	/** The provider's transfer fee. */
	feeAmount: DecimalString;
	/** Withheld by the reserve policy at this run. */
	reserveAmount: DecimalString;
	/** `netAmount − feeAmount − reserveAmount`; the amount instructed. */
	paidAmount: DecimalString;
	settlementCurrency?: CurrencyCode;
	fxRate?: DecimalString;
	settlementAmount?: DecimalString;
	fxCapturedAt?: Date;
	periodStart?: Date;
	periodEnd?: Date;
	scheduledAt?: Date;
	/** The offboarding payout, exempt from the threshold and from the reserve. */
	isFinal: boolean;
	approvedAt?: Date;
	approvedByUserId?: ID;
	paidAt?: Date;
	failedAt?: Date;
	canceledAt?: Date;
	providerKey?: string;
	providerReference?: string;
	providerTransferId?: string;
	/** Masked snapshot of the destination at the time of payment. */
	payoutAccountReference?: string;
	failureCode?: string;
	failureReason?: string;
	reconcilesSettlementId?: ID;
	/** Mandatory when an operator creates a below-threshold payout. */
	note?: string;
	externalId?: string;
	metadata?: JsonData;
}

/**
 * The join between a payout and one transaction it pays.
 *
 * Deliberately thin: everything else about the money is already on the transaction, and duplicating
 * it would create two versions of the same figure. It exists to make three things provable — the
 * lines sum to the payout, a transaction is in at most one live payout, and cancelling a payout
 * releases its lines.
 */
export interface ISellerPayoutLine extends IBasePerTenantAndOrganizationEntityModel {
	sellerPayoutId: ID;
	sellerTransactionId: ID;
	/** The portion of the transaction's net paid by this payout. */
	amount: DecimalString;
	currency: CurrencyCode;
	note?: string;
	metadata?: JsonData;
}

/**
 * What the provider reported it did, recorded as reported.
 *
 * A settlement is the provider's statement for a period, not the platform's expectation: the
 * platform never edits its own ledger to agree with one, and a difference is recorded as a
 * discrepancy and reported.
 */
export interface ISellerSettlement extends IBasePerTenantAndOrganizationEntityModel {
	sellerId: ID;
	/** The account the settlement was paid into. */
	payoutAccountHolderId?: ID;
	/** The payout this settlement reports, in the transfer mode. */
	payoutId?: ID;
	providerKey: string;
	status: SellerSettlementStatus;
	currency: CurrencyCode;
	currencyDecimals: number;
	/** What the provider reports as the seller's gross. */
	grossAmount: DecimalString;
	/** The commission withheld at source. */
	commissionAmount: DecimalString;
	/** The provider's own fee; never the platform's commission. */
	feeAmount: DecimalString;
	/** `grossAmount − commissionAmount − feeAmount`. */
	netAmount: DecimalString;
	settlementCurrency?: CurrencyCode;
	fxRate?: DecimalString;
	settlementAmount?: DecimalString;
	fxCapturedAt?: Date;
	periodStart?: Date;
	periodEnd?: Date;
	/** The provider's own report identifier; unique per provider, so a replay cannot double-count. */
	providerReportId?: string;
	externalReference?: string;
	/** The platform's lines for the period less the reported net; zero when the two agree. */
	discrepancyAmount: DecimalString;
	reconciledAt?: Date;
	reconciledByUserId?: ID;
	closedAt?: Date;
	/** Mandatory when the settlement is disputed or carries a discrepancy. */
	note?: string;
	metadata?: JsonData;
}

/**
 * The commission that applies to one seller-owned line, after resolution.
 *
 * Snapshotted onto the ledger row, so a statement is reproducible from its own columns and a later
 * change to the offering, the seller or the platform default never moves a past transaction.
 */
export interface IResolvedCommission {
	rate: DecimalString;
	basis: CommissionBasis;
	tiers?: ICommissionTier[];
	fixedFeePerItem?: DecimalString;
	fixedFeeCurrency?: CurrencyCode;
	source: CommissionSource;
	commissionOnShipping: boolean;
}

/**
 * The inputs a commission computation reads for one line.
 *
 * Every amount is a decimal string in the line's currency: the computation is exact and the caller
 * owns the rounding boundary, so nothing here is a `number` that could carry binary fraction error.
 */
export interface ICommissionComputationInput {
	sellerId: ID;
	offeringId?: ID;
	/** `quantity × unitPrice`, before discounts. */
	grossAmount: DecimalString;
	/** The seller's own discount, non-positive; it reduces the basis where the basis says so. */
	sellerDiscountAmount: DecimalString;
	/** The platform's discount, non-positive; it never reduces the basis. */
	platformDiscountAmount: DecimalString;
	/** The line's tax, which the tax-inclusive basis includes. */
	taxAmount: DecimalString;
	quantity: string;
	currency: CurrencyCode;
	currencyDecimals: number;
	/** True for a shipping row, which has no quantity. */
	isShipping?: boolean;
}

/**
 * A seller's balance in one currency, as the statement reports it.
 *
 * A negative figure is a reported fact rather than an error: a refund after a payout makes the
 * balance negative on purpose, and the next payout offsets it.
 */
export interface ISellerBalance {
	currency: CurrencyCode;
	/** Rows that are captured and past the hold window. */
	available: DecimalString;
	/** Rows written but not yet captured. */
	pending: DecimalString;
	/** Rows deliberately held out of payouts. */
	held: DecimalString;
	/** The negative part of the balance, reported explicitly. */
	negativeCarryForward: DecimalString;
	/** What the next run would withhold under the reserve policy. */
	reserveNextRun: DecimalString;
	nextPayoutAt?: Date;
}

/**
 * One line of a seller statement.
 */
export interface ISellerStatementLine {
	transactionId: ID;
	kind: SellerTransactionKind;
	status: SellerTransactionStatus;
	occurredAt: Date;
	description?: string;
	grossAmount: DecimalString;
	commissionAmount: DecimalString;
	netAmount: DecimalString;
	currency: CurrencyCode;
}

/**
 * A seller's statement for a period: what it earned, what it was charged and what it was paid.
 */
export interface ISellerStatement {
	sellerId: ID;
	currency: CurrencyCode;
	from?: Date;
	to?: Date;
	openingBalance: DecimalString;
	lines: ISellerStatementLine[];
	payouts: ISellerPayout[];
	settlements: ISellerSettlement[];
	closingBalance: DecimalString;
	negativeCarryForward: DecimalString;
	reserveNextRun: DecimalString;
	nextPayoutAt?: Date;
}

/**
 * The reconciliation of one order's split against the money actually captured.
 *
 * `splitDelta` is the whole point of the report: it is zero when the seller rows plus the platform's
 * commission account for exactly the captured amount attributable to the sellers, and any non-zero
 * value is a defect rather than a rounding curiosity.
 */
export interface ISellerSplitReconciliation {
	orderId: ID;
	orderNumber?: string;
	currency: CurrencyCode;
	/** The captured amount of the order. */
	capturedAmount: DecimalString;
	/** The part attributable to content no seller owns. */
	platformOwnCaptured: DecimalString;
	sumNet: DecimalString;
	sumCommission: DecimalString;
	/** The platform's own contribution to seller-owned lines, as a positive figure. */
	platformDiscount: DecimalString;
	splitDelta: DecimalString;
	/** What the platform kept on the seller-owned part; legitimately negative. */
	platformRetained: DecimalString;
}

/**
 * What a payout run decided for one seller.
 */
export interface ISellerPayoutRunResult {
	sellerId: ID;
	currency: CurrencyCode;
	/** The settleable balance the run saw. */
	balance: DecimalString;
	/** The amount withheld by the reserve policy. */
	reserveAmount: DecimalString;
	/** What was payable after the reserve and the hold window. */
	payable: DecimalString;
	/** The payout the run created, absent when it created none. */
	payoutId?: ID;
	/** Why no payout was created, when none was. */
	skippedReason?: string;
}
