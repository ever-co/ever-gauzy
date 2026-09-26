import { Field, Float, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
	CommissionBasis,
	DecimalString,
	ICommissionTier,
	OfferingCondition,
	OfferingFulfilmentMode,
	OfferingStatus,
	SellerHoldReason,
	SellerPayoutMode,
	SellerPayoutSchedule,
	SellerPayoutStatus,
	SellerSettlementStatus,
	SellerStatus,
	SellerTransactionKind,
	SellerTransactionStatus,
	SellerVerificationKind,
	SellerVerificationStatus,
	TaxCollectionMode,
	TaxRegistrationScheme
} from '@gauzy/contracts';
import { SellerOfferingBulkOperation } from '../seller-offering/seller-offering.bulk';
import type { IBulkSellerOfferingItemResult } from '../seller-offering/seller-offering.bulk';

/**
 * The GraphQL enums the marketplace exposes.
 *
 * Every one of them is registered from the platform's own contract enum rather than restated, so the
 * API and the database cannot drift into two vocabularies for one concept.
 */
registerEnumType(SellerStatus, { name: 'SellerStatus', description: 'Where a seller stands.' });
registerEnumType(SellerVerificationKind, {
	name: 'SellerVerificationKind',
	description: 'Which verification a recorded result belongs to.'
});
registerEnumType(SellerVerificationStatus, {
	name: 'SellerVerificationStatus',
	description: 'The state of one verification kind.'
});
registerEnumType(CommissionBasis, {
	name: 'CommissionBasis',
	description: 'The amount a commission rate multiplies.'
});
registerEnumType(OfferingStatus, { name: 'OfferingStatus', description: 'Whether an offering is sellable.' });
registerEnumType(OfferingCondition, { name: 'OfferingCondition', description: 'The condition of the goods offered.' });
registerEnumType(OfferingFulfilmentMode, {
	name: 'OfferingFulfilmentMode',
	description: 'Who physically fulfils a seller line.'
});
registerEnumType(TaxCollectionMode, {
	name: 'TaxCollectionMode',
	description: 'Who collects and remits the tax on a seller line.'
});
registerEnumType(TaxRegistrationScheme, {
	name: 'TaxRegistrationScheme',
	description: 'The tax registration vocabulary.'
});
registerEnumType(SellerPayoutMode, { name: 'SellerPayoutMode', description: 'How a seller is paid.' });
registerEnumType(SellerPayoutSchedule, { name: 'SellerPayoutSchedule', description: 'When a payout run may pay.' });
registerEnumType(SellerPayoutStatus, { name: 'SellerPayoutStatus', description: 'Where a payout instruction stands.' });
registerEnumType(SellerSettlementStatus, { name: 'SellerSettlementStatus', description: 'Where a settlement stands.' });
registerEnumType(SellerTransactionKind, { name: 'SellerTransactionKind', description: 'What a ledger row records.' });
registerEnumType(SellerTransactionStatus, {
	name: 'SellerTransactionStatus',
	description: 'The lifecycle of a ledger row.'
});
registerEnumType(SellerHoldReason, { name: 'SellerHoldReason', description: 'Why a ledger row is held.' });
/**
 * The offering batch's own vocabulary, registered from the enum the resource writes with rather than
 * restated, so the values a caller states are the values the service switches on.
 */
registerEnumType(SellerOfferingBulkOperation, {
	name: 'SellerOfferingBulkOperation',
	description: 'The operation one item of an offering batch performs.'
});

/**
 * A seller, as GraphQL exposes it.
 *
 * The type mirrors the REST projection field for field: the same amounts, the same enums, the same
 * permission on the fields that carry platform-only figures. Any field a caller may not read returns
 * null for that caller and never a redacted string, so a client cannot tell a hidden value from an
 * absent one.
 */
@ObjectType('Seller')
export class SellerType {
	@Field(() => ID)
	id: string;

	@Field(() => String)
	code: string;

	@Field(() => String)
	name: string;

	@Field(() => String, { nullable: true })
	legalName?: string;

	@Field(() => String, { nullable: true })
	email?: string;

	@Field(() => String, { nullable: true })
	phone?: string;

	@Field(() => ID, { nullable: true })
	contactId?: string;

	@Field(() => SellerStatus)
	status: SellerStatus;

	@Field(() => SellerVerificationStatus)
	businessVerificationStatus: SellerVerificationStatus;

	@Field(() => SellerVerificationStatus)
	taxVerificationStatus: SellerVerificationStatus;

	@Field(() => SellerVerificationStatus)
	payoutAccountStatus: SellerVerificationStatus;

	@Field(() => Date, { nullable: true })
	verificationExpiresAt?: Date;

	@Field(() => String, { nullable: true })
	taxCountryCode?: string;

	@Field(() => TaxCollectionMode)
	taxCollectionMode: TaxCollectionMode;

	/**
	 * The seller's own commission rate. A seller reads its own; another seller's is a scope violation
	 * rather than a hidden field.
	 */
	@Field(() => Float, { nullable: true })
	defaultCommissionRate?: number;

	@Field(() => CommissionBasis, { nullable: true })
	commissionBasis?: CommissionBasis;

	@Field(() => SellerPayoutMode)
	payoutMode: SellerPayoutMode;

	@Field(() => SellerPayoutSchedule)
	payoutSchedule: SellerPayoutSchedule;

	@Field(() => String, { nullable: true })
	payoutCurrency?: string;

	@Field(() => Float)
	payoutThreshold: number;

	@Field(() => Float)
	reservePercent: number;

	@Field(() => Int)
	payoutHoldDays: number;

	@Field(() => Date, { nullable: true })
	activatedAt?: Date;

	@Field(() => Date, { nullable: true })
	suspendedAt?: Date;

	@Field(() => String, { nullable: true })
	suspensionReason?: string;
}

/**
 * A seller's balance in one currency.
 *
 * A negative carry-forward is reported rather than hidden: a refund after a payout makes the balance
 * negative on purpose, and a client that is not told so would render it as an error.
 */
@ObjectType('SellerBalance')
export class SellerBalanceType {
	@Field(() => String)
	currency: string;

	@Field(() => Float)
	available: number;

	@Field(() => Float)
	pending: number;

	@Field(() => Float)
	held: number;

	@Field(() => Float)
	negativeCarryForward: number;

	@Field(() => Float)
	reserveNextRun: number;

	@Field(() => Date, { nullable: true })
	nextPayoutAt?: Date;
}

/** One line of a seller statement. */
@ObjectType('SellerStatementLine')
export class SellerStatementLineType {
	@Field(() => ID)
	transactionId: string;

	@Field(() => SellerTransactionKind)
	kind: SellerTransactionKind;

	@Field(() => SellerTransactionStatus)
	status: SellerTransactionStatus;

	@Field(() => Date)
	occurredAt: Date;

	@Field(() => String, { nullable: true })
	description?: string;

	@Field(() => Float)
	grossAmount: number;

	@Field(() => Float)
	commissionAmount: number;

	@Field(() => Float)
	netAmount: number;

	@Field(() => String)
	currency: string;
}

/** A seller's statement over a period. */
@ObjectType('SellerStatement')
export class SellerStatementType {
	@Field(() => ID)
	sellerId: string;

	@Field(() => String)
	currency: string;

	@Field(() => Date, { nullable: true })
	from?: Date;

	@Field(() => Date, { nullable: true })
	to?: Date;

	@Field(() => Float)
	openingBalance: number;

	@Field(() => [SellerStatementLineType])
	lines: SellerStatementLineType[];

	@Field(() => Float)
	closingBalance: number;

	@Field(() => Float)
	negativeCarryForward: number;

	@Field(() => Float)
	reserveNextRun: number;
}

/** One seller's part of an order's money. */
@ObjectType('SellerTransaction')
export class SellerTransactionType {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	sellerId: string;

	@Field(() => ID)
	orderId: string;

	@Field(() => ID, { nullable: true })
	orderLineId?: string;

	@Field(() => SellerTransactionKind)
	kind: SellerTransactionKind;

	@Field(() => SellerTransactionStatus)
	status: SellerTransactionStatus;

	@Field(() => String)
	currency: string;

	@Field(() => Float)
	grossAmount: number;

	@Field(() => Float)
	taxAmount: number;

	@Field(() => Float)
	sellerDiscountAmount: number;

	@Field(() => Float)
	platformDiscountAmount: number;

	@Field(() => CommissionBasis)
	commissionBasis: CommissionBasis;

	@Field(() => Float)
	commissionBasisAmount: number;

	@Field(() => Float)
	commissionRate: number;

	@Field(() => Float)
	commissionAmount: number;

	@Field(() => Float)
	netAmount: number;

	@Field(() => Date)
	occurredAt: Date;

	@Field(() => Date, { nullable: true })
	settleableAt?: Date;

	@Field(() => SellerHoldReason, { nullable: true })
	holdReason?: SellerHoldReason;

	@Field(() => ID, { nullable: true })
	reversesTransactionId?: string;
}

/** What a seller offers, and at what terms. */
@ObjectType('SellerOffering')
export class SellerOfferingType {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	sellerId: string;

	@Field(() => ID)
	variantId: string;

	@Field(() => ID, { nullable: true })
	productId?: string;

	@Field(() => String, { nullable: true })
	sellerSku?: string;

	@Field(() => String, { nullable: true })
	title?: string;

	@Field(() => OfferingCondition)
	condition: OfferingCondition;

	@Field(() => Float, { nullable: true })
	priceAmount?: number;

	@Field(() => String, { nullable: true })
	priceCurrency?: string;

	@Field(() => Float, { nullable: true })
	commissionRate?: number;

	@Field(() => OfferingStatus)
	status: OfferingStatus;

	@Field(() => [String], { nullable: true })
	channelIds?: string[];

	@Field(() => Date, { nullable: true })
	availableFrom?: Date;

	@Field(() => Date, { nullable: true })
	availableTo?: Date;

	@Field(() => OfferingFulfilmentMode)
	fulfilmentMode: OfferingFulfilmentMode;

	@Field(() => Boolean)
	isFeatured: boolean;
}

/** One instruction to move a seller's balance to the seller's bank account. */
@ObjectType('SellerPayout')
export class SellerPayoutType {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	sellerId: string;

	@Field(() => String)
	number: string;

	@Field(() => SellerPayoutStatus)
	status: SellerPayoutStatus;

	@Field(() => SellerPayoutMode)
	payoutMode: SellerPayoutMode;

	@Field(() => String)
	currency: string;

	@Field(() => Float)
	netAmount: number;

	@Field(() => Float)
	feeAmount: number;

	@Field(() => Float)
	reserveAmount: number;

	@Field(() => Float)
	paidAmount: number;

	@Field(() => Boolean)
	isFinal: boolean;

	@Field(() => Date, { nullable: true })
	paidAt?: Date;

	@Field(() => String, { nullable: true })
	providerKey?: string;

	@Field(() => String, { nullable: true })
	providerTransferId?: string;
}

/** The join between a payout and one ledger row it pays. */
@ObjectType('SellerPayoutLine')
export class SellerPayoutLineType {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	sellerPayoutId: string;

	@Field(() => ID)
	sellerTransactionId: string;

	@Field(() => Float)
	amount: number;

	@Field(() => String)
	currency: string;
}

/** What the provider reported it settled, recorded as reported. */
@ObjectType('SellerSettlement')
export class SellerSettlementType {
	@Field(() => ID)
	id: string;

	@Field(() => ID)
	sellerId: string;

	@Field(() => String)
	providerKey: string;

	@Field(() => SellerSettlementStatus)
	status: SellerSettlementStatus;

	@Field(() => String)
	currency: string;

	@Field(() => Float)
	grossAmount: number;

	@Field(() => Float)
	commissionAmount: number;

	@Field(() => Float)
	feeAmount: number;

	@Field(() => Float)
	netAmount: number;

	/** The platform's lines less the reported net; zero when the two agree. */
	@Field(() => Float)
	discrepancyAmount: number;

	@Field(() => Date, { nullable: true })
	closedAt?: Date;
}

/** The per-order split reconciliation, whose delta must be zero. */
@ObjectType('SellerSplitReconciliation')
export class SellerSplitReconciliationType {
	@Field(() => ID)
	orderId: string;

	@Field(() => String)
	currency: string;

	@Field(() => Float)
	capturedAmount: number;

	@Field(() => Float)
	sumNet: number;

	@Field(() => Float)
	sumCommission: number;

	@Field(() => Float)
	platformDiscount: number;

	/** A non-zero delta is a defect, not a rounding curiosity. */
	@Field(() => Float)
	splitDelta: number;

	/** What the platform kept on the seller-owned part; legitimately negative. */
	@Field(() => Float)
	platformRetained: number;
}

/**
 * One item's outcome in an offering batch.
 *
 * The item result is the batch's unit of answer rather than a row: it carries the position the item held
 * in the request and either the offering that moved or the failure with the item's own code, so a client
 * that sent a page of listings reads which of them applied without matching rows back to a request by
 * hand.
 */
@ObjectType('SellerOfferingBulkItemResult')
export class SellerOfferingBulkItemResultType {
	/** The item's position in the request. */
	@Field(() => Int)
	index: number;

	/** True when the item applied. */
	@Field(() => Boolean)
	ok: boolean;

	/** The offering that moved, when the item applied. */
	@Field(() => ID, { nullable: true })
	id?: string;

	/** The resource that moved, so a mixed batch reads unambiguously. */
	@Field(() => String, { nullable: true })
	resource?: string;

	/**
	 * Why the item did not apply, with the code the same item would have produced alone.
	 *
	 * The member's type is the kernel's `UserError`, named here as the schema names it: the platform
	 * declares that type once for every payload that reports an expected outcome, and a second class for it
	 * in this package would be a second declaration of a kernel type — one that composes only while the two
	 * copies agree.
	 */
	@Field(() => 'UserError', { nullable: true })
	error?: IBulkSellerOfferingItemResult['error'];
}

/**
 * What a batch of offerings adds up to.
 *
 * The counts are read from the platform's own batch result rather than accumulated beside it, so a client
 * can assert `succeeded + failed == total` against the same answer rather than against a second number
 * that could disagree with it.
 */
@ObjectType('BulkSellerOfferingsPayload')
export class BulkSellerOfferingsPayloadType {
	/** One entry per request item, in request order. */
	@Field(() => [SellerOfferingBulkItemResultType])
	results: IBulkSellerOfferingItemResult[];

	/** How many items applied. */
	@Field(() => Int)
	succeeded: number;

	/** How many items did not. */
	@Field(() => Int)
	failed: number;

	/** How many items the request carried. */
	@Field(() => Int)
	total: number;
}

/**
 * What a hard deletion reports.
 *
 * The REST route answers with the ORM's own `DeleteResult`, and this is that result's one actionable
 * member rather than the whole of it. `raw` is deliberately not projected: it is the driver's payload
 * rather than the platform's answer, and §3.1 of the GraphQL specification is explicit that parity is
 * capability parity and not shape parity — a client that needs the count is served, and a client that
 * would read a Postgres-specific envelope is not taught to.
 */
@ObjectType('SellerDeleteResult')
export class SellerDeleteResultType {
	/** How many rows the deletion removed: one, or none when the id matched nothing. */
	@Field(() => Int)
	affected: number;
}

/**
 * What one payout run decided for one seller.
 *
 * A run answers a decision per seller rather than a row: a seller the schedule did not find due, one
 * whose balance was under its threshold and one that was paid are all answers, and `payoutId` and
 * `skippedReason` are the two members that tell them apart. The amounts are the run's own arithmetic —
 * the settleable balance it saw, what the reserve withheld and what was payable after it — so a client
 * reads why a seller was or was not paid without reconstructing the run's policy.
 */
@ObjectType('SellerPayoutRunResult')
export class SellerPayoutRunResultType {
	@Field(() => ID)
	sellerId: string;

	@Field(() => String)
	currency: string;

	/** The settleable balance the run saw. */
	@Field(() => Float)
	balance: number;

	/** The amount the reserve policy withheld at this run. */
	@Field(() => Float)
	reserveAmount: number;

	/** What was payable after the reserve and the hold window. */
	@Field(() => Float)
	payable: number;

	/** The payout the run created, absent when it created none. */
	@Field(() => ID, { nullable: true })
	payoutId?: string;

	/** Why no payout was created, when none was. */
	@Field(() => String, { nullable: true })
	skippedReason?: string;
}

/**
 * One platform line of a settlement's period, with the net the ledger carries for it.
 *
 * The reconciliation answers the lines the comparison was made over rather than only its verdict: a
 * discrepancy a client cannot attribute to a line is one it cannot take to the provider, and the
 * settlement's own `discrepancyAmount` is the difference of the sums, not of any one row.
 */
@ObjectType('SellerSettlementDifference')
export class SellerSettlementDifferenceType {
	/** The ledger row the platform holds for the period. */
	@Field(() => ID)
	transactionId: string;

	/** The net that row carries: the platform's side of the comparison. */
	@Field(() => Float)
	platformNet: number;
}

/**
 * What a reconciliation found: the settlement it moved and the platform's lines it compared.
 *
 * Both halves are answered because both are what the route answers. The settlement is re-read from the
 * service's own return, so the status a client reads is the one the comparison decided — `RECONCILED`
 * when the figures agree and `DISPUTED` when they do not.
 */
@ObjectType('SellerSettlementReconciliation')
export class SellerSettlementReconciliationType {
	/** The settlement after the comparison. */
	@Field(() => SellerSettlementType)
	settlement: SellerSettlementType;

	/** The platform's lines for the settlement's period, each with the net the ledger carries. */
	@Field(() => [SellerSettlementDifferenceType])
	differences: SellerSettlementDifferenceType[];
}

/* ------------------------------------------------------------------------------------------------
 * The write inputs
 * ---------------------------------------------------------------------------------------------- */

/**
 * What a caller supplies to open a seller account.
 *
 * The members are the writable half of `SellerDTO` and nothing else. `organizationId`, `tenantId` and
 * the organization object are absent for the reason that body's own documentation gives: they are the
 * request's rather than the body's, and the service overwrites them from the context. A member a
 * document advertises and the platform then discards is worse than one it never declared, because a
 * caller that stated it would believe it had moved the seller between organizations.
 */
export interface ICreateSellerInput {
	/** Required: a seller without a code cannot be referred to by a ledger row or a statement. */
	code: string;
	/** Required: a seller without a party cannot be verified, contracted with or taxed. */
	contactId: string;
	name?: string;
	legalName?: string;
	email?: string;
	phone?: string;
	merchantId?: string;
	userId?: string;
	channelIds?: string[];
	regionIds?: string[];
	payoutAccountReference?: string;
	payoutAccountHolderId?: string;
	taxId?: string;
	vatNumber?: string;
	taxCountryCode?: string;
	taxRegistrationScheme?: TaxRegistrationScheme;
	taxCollectionMode?: TaxCollectionMode;
	/** A fraction, not a percentage: `0.15` is fifteen per cent. */
	defaultCommissionRate?: DecimalString;
	commissionBasis?: CommissionBasis;
	commissionTiers?: ICommissionTier[];
	fixedFeePerItem?: DecimalString;
	fixedFeeCurrency?: string;
	commissionOnShipping?: boolean;
	chargeShippingCost?: boolean;
	allowNegativeNet?: boolean;
	payoutMode?: SellerPayoutMode;
	payoutSchedule?: SellerPayoutSchedule;
	payoutCurrency?: string;
	payoutThreshold?: DecimalString;
	reservePercent?: DecimalString;
	reserveHoldDays?: number;
	payoutHoldDays?: number;
	externalId?: string;
	metadata?: Record<string, any>;
}

/**
 * What a caller supplies to amend a seller account.
 *
 * The party binding and the code are absent because they are immutable on the REST body too:
 * `UpdateSellerDTO` omits them, and the service deletes them from any body that carries them anyway.
 * A caller is therefore refused the same two members by the document as by the write, rather than
 * being shown a member the platform would silently drop.
 */
export interface IUpdateSellerInput {
	name?: string;
	legalName?: string;
	email?: string;
	phone?: string;
	merchantId?: string;
	userId?: string;
	channelIds?: string[];
	regionIds?: string[];
	payoutAccountReference?: string;
	payoutAccountHolderId?: string;
	taxId?: string;
	vatNumber?: string;
	taxCountryCode?: string;
	taxRegistrationScheme?: TaxRegistrationScheme;
	taxCollectionMode?: TaxCollectionMode;
	defaultCommissionRate?: DecimalString;
	commissionBasis?: CommissionBasis;
	commissionTiers?: ICommissionTier[];
	fixedFeePerItem?: DecimalString;
	fixedFeeCurrency?: string;
	commissionOnShipping?: boolean;
	chargeShippingCost?: boolean;
	allowNegativeNet?: boolean;
	payoutMode?: SellerPayoutMode;
	payoutSchedule?: SellerPayoutSchedule;
	payoutCurrency?: string;
	payoutThreshold?: DecimalString;
	reservePercent?: DecimalString;
	reserveHoldDays?: number;
	payoutHoldDays?: number;
	externalId?: string;
	metadata?: Record<string, any>;
}

/**
 * What a caller supplies to record one verification kind's result.
 *
 * `kind` and `status` are required on both surfaces: the REST body states them as required members of an
 * inline type, and the service refuses a result that carries neither with `BAD_REQUEST`. The relation
 * `reference` and `provider` are the evidence the verdict rests on, and `expiresAt` is the window the
 * verdict is good for — a verdict with no window is one a statement cannot age.
 */
export interface IVerifySellerInput {
	kind: SellerVerificationKind;
	status: SellerVerificationStatus;
	reference?: string;
	provider?: string;
	expiresAt?: Date;
	note?: string;
}

/**
 * What a caller supplies to offer a variant.
 *
 * `sellerId` and `variantId` are required on both surfaces: `CreateSellerOfferingDTO` intersects the
 * offering's own shape with a pick of those two, and the service refuses a body that names neither,
 * because an offering that does not say what is offered by whom is not an offering. `productId` is
 * deliberately absent, as it is from the REST body: it is derived from the variant, so a caller cannot
 * make an unpublished variant visible by asserting one.
 *
 * `organizationId` and `tenantId` are absent for the reason the seller inputs give: they are the
 * request's rather than the body's, and the service copies the organization from the seller it read.
 */
export interface ICreateSellerOfferingInput {
	/** Required: an offering names the seller whose right to sell it records. */
	sellerId: string;
	/** Required: an offering names the catalogue variant it offers. */
	variantId: string;
	sellerSku?: string;
	title?: string;
	condition?: OfferingCondition;
	priceAmount?: DecimalString;
	priceCurrency?: string;
	productPriceId?: string;
	/** Overrides the seller's default rate for this offering alone. */
	commissionRate?: DecimalString;
	commissionBasis?: CommissionBasis;
	commissionTiers?: ICommissionTier[];
	status?: OfferingStatus;
	channelIds?: string[];
	regionIds?: string[];
	availableFrom?: Date;
	availableTo?: Date;
	maxQuantityPerOrder?: number;
	fulfilmentMode?: OfferingFulfilmentMode;
	fulfilmentWarehouseId?: string;
	handlingDays?: number;
	isFeatured?: boolean;
	allowNegativeNet?: boolean;
	externalId?: string;
	metadata?: Record<string, any>;
}

/**
 * What a caller supplies to amend an offering.
 *
 * The subject is absent because it is immutable on the REST body too: `UpdateSellerOfferingDTO` omits
 * `sellerId` and `variantId`, and the service deletes both from any body that carries them — an
 * offering that changed variant would silently rewrite what past orders were priced against.
 */
export interface IUpdateSellerOfferingInput {
	sellerSku?: string;
	title?: string;
	condition?: OfferingCondition;
	priceAmount?: DecimalString;
	priceCurrency?: string;
	productPriceId?: string;
	commissionRate?: DecimalString;
	commissionBasis?: CommissionBasis;
	commissionTiers?: ICommissionTier[];
	status?: OfferingStatus;
	channelIds?: string[];
	regionIds?: string[];
	availableFrom?: Date;
	availableTo?: Date;
	maxQuantityPerOrder?: number;
	fulfilmentMode?: OfferingFulfilmentMode;
	fulfilmentWarehouseId?: string;
	handlingDays?: number;
	isFeatured?: boolean;
	allowNegativeNet?: boolean;
	externalId?: string;
	metadata?: Record<string, any>;
}

/**
 * What a caller supplies to amend a payout: what the payout states about itself, and nothing its
 * lifecycle owns.
 *
 * The amounts are absent, and that is the point: a payout's amount is the sum of the transactions it
 * covers, so a caller chooses which rows are paid and never how much. `status` is absent because the
 * lifecycle moves through the approve, pay, cancel and retry fields, each under its own grant; `feeAmount`
 * because it is what the provider reported at payment; `transactionIds` because the lines are what the
 * payout was built from; and `payoutMode`, `sellerId` and `currency` because each is fixed once the payout
 * exists. `UpdateSellerPayoutDTO` omits the same members, and `SellerPayoutService.update` refuses them.
 */
export interface IUpdateSellerPayoutInput {
	periodStart?: Date;
	periodEnd?: Date;
	scheduledAt?: Date;
	providerKey?: string;
	providerReference?: string;
	note?: string;
	metadata?: Record<string, any>;
}

/**
 * What a caller supplies to run the payout pass.
 *
 * Every member is optional, as it is on the route's own body: a run with no period reads the schedule
 * and the ledger as they stand. `dryRun` is the member that decides whether the pass reports or pays,
 * and the run reaches the service coerced to a boolean rather than as it arrived, exactly as the route
 * coerces it.
 */
export interface IRunSellerPayoutInput {
	/** The first day of the period; absent reads from the beginning of the ledger. */
	periodStart?: Date;
	/** The last day of the period; absent reads to now. */
	periodEnd?: Date;
	/** The sellers to consider; absent considers every seller whose schedule is due. */
	sellerIds?: string[];
	currency?: string;
	/** Report what the run would do without creating a payout. */
	dryRun?: boolean;
}

/**
 * What a caller supplies to amend a settlement.
 *
 * The provider, the seller and the currency are absent because `UpdateSellerSettlementDTO` omits them:
 * a settlement is a transcription of what one provider reported about one seller in one currency, and
 * none of the three can change after the fact. `status` is absent because a settlement is reconciled,
 * closed and disputed through its own fields, and the figures because they are the provider's report as
 * recorded, with the net derived from them. `discrepancyAmount` is absent for the reason its own DTO gives
 * — it is what the reconciliation computes, and a caller that could set it could silence the one number
 * the report exists to surface. `SellerSettlementService.update` refuses the same members.
 */
export interface IUpdateSellerSettlementInput {
	payoutAccountHolderId?: string;
	periodStart?: Date;
	periodEnd?: Date;
	providerReportId?: string;
	externalReference?: string;
	note?: string;
	metadata?: Record<string, any>;
}

/**
 * What a caller supplies to reconcile a settlement.
 *
 * Two members and nothing else, because they are what the route's body carries: the provider's own
 * report identifier, recorded beside the comparison so a later reader can find the document the figures
 * came from, and a note, which the comparison records when it finds a discrepancy.
 */
export interface IReconcileSellerSettlementInput {
	providerReportId?: string;
	note?: string;
}
