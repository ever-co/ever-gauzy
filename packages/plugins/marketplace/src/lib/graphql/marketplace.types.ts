import { Field, Float, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
	CommissionBasis,
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
	SellerVerificationStatus,
	TaxCollectionMode,
	TaxRegistrationScheme
} from '@gauzy/contracts';

/**
 * The GraphQL enums the marketplace exposes.
 *
 * Every one of them is registered from the platform's own contract enum rather than restated, so the
 * API and the database cannot drift into two vocabularies for one concept.
 */
registerEnumType(SellerStatus, { name: 'SellerStatus', description: 'Where a seller stands.' });
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
