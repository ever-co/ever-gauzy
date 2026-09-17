import { gql } from 'graphql-tag';

/**
 * The marketplace plugin's contribution to the platform schema.
 *
 * The type names are the concepts' own names and a field name matches the entity property it is read
 * from, so a REST caller and a GraphQL caller read the same vocabulary: a `seller` is one seller
 * account, `sellerOfferings` is what sellers offer, `sellerTransactions` is the ledger that says what
 * each seller earned. Nothing is renamed, because inside one schema a seller is unambiguous.
 *
 * Money and rates are `Decimal`, never `Float`: the value is the exact decimal string a
 * `numeric(20,6)` column carries, and the statement, the balance and the reconciliation are summed
 * from those strings, so a figure read over GraphQL and the same figure read over REST are
 * string-identical. Dates are `DateTime`, the same RFC 3339 form REST emits.
 *
 * Three of the types are not the rows of one table. `SellerBalance`, `SellerStatement` and
 * `SellerSplitReconciliation` are assembled by the seller service and the split service out of the
 * ledger, and they declare exactly the fields those services return — a field the service does not
 * compute is deliberately not declared here, because a schema field nothing populates is a null a
 * client cannot tell from an absent value.
 *
 * The document is one half of the package's GraphQL contribution and the resolvers are the other: a
 * root field declared here with no resolver resolves to null with no error anywhere, and a field a
 * resolver declares without being declared here is never served at all. The two are written and
 * reviewed together, and the plugin hands both to the platform in one `extensions` block.
 */
export const schemaExtensions = gql`
	"Where a seller account stands. \`APPROVED\` means every required verification passed; \`ACTIVE\` means an operator then let it trade."
	enum SellerStatus {
		"Created, not yet submitted for review."
		DRAFT
		"Submitted and waiting to be claimed by a reviewer."
		SUBMITTED
		"Being reviewed."
		IN_REVIEW
		"A fixable verification failure; the applicant may resubmit."
		ACTION_REQUIRED
		"Refused; terminal."
		REJECTED
		"Every required verification passed; not yet trading."
		APPROVED
		"Trading and payable."
		ACTIVE
		"Stopped from doing anything new; balances are held."
		SUSPENDED
		"Being closed down; only the final payout may move."
		OFFBOARDING
		"Closed; terminal."
		OFFBOARDED
	}

	"The state of one verification kind. A seller carries three independent verdicts, performed by different parties at different times."
	enum SellerVerificationStatus {
		"Never checked."
		UNVERIFIED
		"Sent to a provider or a reviewer; no verdict yet."
		PENDING
		"A fixable failure: the applicant can correct it and resubmit."
		ACTION_REQUIRED
		"Passed."
		VERIFIED
		"A failure that is not fixable by resubmission."
		FAILED
		"Was verified and the validity window has passed."
		EXPIRED
	}

	"What a commission rate multiplies. The basis decides the amount, and the amount decides the commission."
	enum CommissionBasis {
		"Quantity multiplied by unit price, before any discount."
		ITEM_SUBTOTAL
		"The same, after the seller's own discounts."
		DISCOUNTED_SUBTOTAL
		"The tax-inclusive amount."
		INCLUDING_TAX
		"A flat fee per item; no rate is involved."
		FIXED_PER_ITEM
		"The tier containing the amount sets the rate for the whole amount."
		TIERED_AMOUNT
		"The tier containing the quantity sets the rate for the whole line."
		TIERED_QUANTITY
	}

	"Whether an offering is sellable, and why not."
	enum OfferingStatus {
		"Being authored."
		DRAFT
		"Waiting for moderation."
		PENDING_REVIEW
		"Sellable, subject to the publication rules."
		ACTIVE
		"Not sellable; resumable by the seller."
		PAUSED
		"Refused by a moderator."
		REJECTED
		"Withdrawn; terminal."
		WITHDRAWN
	}

	"The condition of the goods offered: the same variant may be offered new by one seller and refurbished by another."
	enum OfferingCondition {
		NEW
		REFURBISHED
		USED_LIKE_NEW
		USED_GOOD
		USED_ACCEPTABLE
	}

	"Who physically fulfils a seller's line, which is also what decides whose stock may be allocated."
	enum OfferingFulfilmentMode {
		"The platform ships from its own locations."
		PLATFORM
		"The seller ships from its own location."
		SELLER
		"The seller's supplier ships; no allocation against a stock level."
		DROPSHIP
	}

	"Who collects and remits the tax on a seller's lines."
	enum TaxCollectionMode {
		"The seller remits on its own registration."
		SELLER_REMITS
		"The sale is the seller's; the marketplace collects and remits on its behalf."
		MARKETPLACE_COLLECTS_AND_REMITS
		"The platform is the supplier of record for the jurisdiction."
		DEEMED_SUPPLIER
	}

	"The tax registration vocabulary."
	enum TaxRegistrationScheme {
		NONE
		VAT
		GST
		SALES_TAX
		ABN
		TAX_ID
	}

	"How a seller's money reaches the seller. In both modes the seller's share is credited to the seller's own provider account at capture."
	enum SellerPayoutMode {
		"The provider split the charge at capture; the platform instructs no transfer."
		PROVIDER_SPLIT
		"The provider holds the seller's balance; the platform instructs a transfer to the seller's bank."
		PROVIDER_TRANSFER
	}

	"When a payout run may create a payout for a seller."
	enum SellerPayoutSchedule {
		"Only an explicit request creates a payout."
		MANUAL
		DAILY
		WEEKLY
		BI_WEEKLY
		SEMI_MONTHLY
		MONTHLY
		"A payout is created once the settleable balance reaches the seller's threshold."
		THRESHOLD
	}

	"Where a payout instruction stands."
	enum SellerPayoutStatus {
		"Built and not yet submitted for approval."
		DRAFT
		"Waiting for approval."
		PENDING
		"Approved; the transfer has not been attempted."
		APPROVED
		"The provider call is in flight."
		PROCESSING
		"The provider reports the transfer executed; terminal."
		PAID
		"The provider refused the transfer; retryable."
		FAILED
		"Cancelled before payment; its transactions return to settleable. Terminal."
		CANCELED
	}

	"Where a settlement report stands."
	enum SellerSettlementStatus {
		"Accepting the platform's lines for the period."
		OPEN
		"Compared against the provider's report."
		RECONCILED
		"Final; no further lines are accepted."
		CLOSED
		"The provider's figures and the platform's ledger disagree and the difference is unresolved."
		DISPUTED
	}

	"What a seller ledger row records."
	enum SellerTransactionKind {
		"A seller-owned order line was sold."
		SALE
		"Shipping revenue attributed to the seller."
		SHIPPING
		"A carrier cost the platform paid on the seller's behalf; a negative row."
		SHIPPING_FEE
		"A reversal of money returned to the buyer."
		REFUND
		"A reversal of a charged-back sale."
		CHARGEBACK
		"A fee deducted from the seller's balance."
		FEE
		"A manual adjustment, always with a reason."
		ADJUSTMENT
	}

	"The lifecycle of a seller ledger row. The status is the only mutable thing about the row; its amounts are append only."
	enum SellerTransactionStatus {
		"Written at placement, before the money is captured."
		PENDING
		"Captured and past the hold window; eligible for a payout."
		SETTLEABLE
		"Deliberately kept out of payouts, with a reason."
		HELD
		"Included in a payout."
		SETTLED
		"The payout covering it was paid."
		PAID
		"Reversed in full by a later row."
		REVERSED
	}

	"Why a ledger row is held out of payouts."
	enum SellerHoldReason {
		SELLER_SUSPENDED
		CHARGEBACK
		VERIFICATION_EXPIRED
		DISPUTE
		MANUAL
	}

	"A seller: a party plus the commercial relationship that makes it a marketplace participant."
	type Seller {
		id: ID!
		"Stable, human-usable key, unique per organization and immutable after creation."
		code: String!
		"Trading name."
		name: String!
		"Registered name, retained through offboarding, because a ledger row resolves to a named legal entity."
		legalName: String
		"Snapshot of the party's reachability, so a notification path survives an edit to the contact row."
		email: String
		phone: String
		"The seller's party row: the platform organization contact the seller trades as."
		contactId: ID
		status: SellerStatus!
		"Business-identity verification."
		businessVerificationStatus: SellerVerificationStatus!
		"Tax-identifier verification."
		taxVerificationStatus: SellerVerificationStatus!
		"Payout-account verification; a payout requires this to be \`VERIFIED\`."
		payoutAccountStatus: SellerVerificationStatus!
		"Verification expires: an expired payout account holds payouts, an expired identity suspends the seller."
		verificationExpiresAt: DateTime
		"Jurisdiction of registration, ISO 3166-1 alpha-2."
		taxCountryCode: String
		"Who collects and remits the tax on this seller's lines."
		taxCollectionMode: TaxCollectionMode!
		"The seller's own commission rate, as a fraction: \`0.15\` is fifteen per cent. Null inherits the platform default."
		defaultCommissionRate: Decimal
		commissionBasis: CommissionBasis
		payoutMode: SellerPayoutMode!
		payoutSchedule: SellerPayoutSchedule!
		"Null means the seller is paid per order currency."
		payoutCurrency: String
		"The minimum balance a payout run will pay out; a balance below it carries forward."
		payoutThreshold: Decimal!
		"Fraction of the settleable balance withheld at each run. A policy applied at run time, never a stored balance."
		reservePercent: Decimal!
		"Delays a ledger row's inclusion in any payout, so a chargeback window passes before money moves."
		payoutHoldDays: Int!
		"Set on every entry to \`ACTIVE\`, including a reinstatement after suspension."
		activatedAt: DateTime
		suspendedAt: DateTime
		"Present when the status is \`SUSPENDED\`: a suspension a seller cannot read the reason for is one it cannot remedy."
		suspensionReason: String
	}

	"A seller's right to sell one product variant, at the seller's price and under the seller's own SKU."
	type SellerOffering {
		id: ID!
		sellerId: ID!
		"The catalogue variant: the saleable unit, defined once for the whole platform."
		variantId: ID!
		"Derived from the variant and carried so an offering report needs no join."
		productId: ID
		"The seller's own SKU for this listing, unique per seller when set."
		sellerSku: String
		"The seller's own listing title; null uses the catalogue title."
		title: String
		condition: OfferingCondition!
		"The seller's authored price, materialised into a price row when the offering is published."
		priceAmount: Decimal
		priceCurrency: String
		"Commission override for this offering; null inherits the seller's default, which inherits the platform's."
		commissionRate: Decimal
		status: OfferingStatus!
		"Channels this offering is published to; null inherits the seller's set."
		channelIds: [String!]
		"Availability window start; null is open. The window is half open."
		availableFrom: DateTime
		availableTo: DateTime
		fulfilmentMode: OfferingFulfilmentMode!
		"Orders competing offers of the same variant in a listing. Merchandising only."
		isFeatured: Boolean!
	}

	"The split of one order line's money for one seller: the ledger, and the truth about what a seller earned or owes."
	type SellerTransaction {
		id: ID!
		sellerId: ID!
		"The order the row splits."
		orderId: ID!
		"The order line the row splits; null for shipping, fee and order-level adjustment rows."
		orderLineId: ID
		kind: SellerTransactionKind!
		status: SellerTransactionStatus!
		currency: String!
		"Signed: positive for a sale or a shipping charge, negative on a reversal row."
		grossAmount: Decimal!
		"The line's tax, from the line's own tax rows."
		taxAmount: Decimal!
		"The seller-funded discount only, non-positive on a sale. It reduces the commission basis."
		sellerDiscountAmount: Decimal!
		"The platform-funded discount attributed to this row. It reduces neither the seller's net nor the commission basis."
		platformDiscountAmount: Decimal!
		"The basis convention snapshotted at placement."
		commissionBasis: CommissionBasis!
		"The amount the rate applied to, signed like the row."
		commissionBasisAmount: Decimal!
		"The resolved rate, snapshotted: the rate this seller was actually charged."
		commissionRate: Decimal!
		commissionAmount: Decimal!
		"The seller's entitlement for this row: gross plus tax plus the seller discount, less the commission."
		netAmount: Decimal!
		"The business moment the row describes: placement for a sale, the refund's own date for a reversal."
		occurredAt: DateTime!
		"When the row became eligible for a payout; null until the money was captured and the hold elapsed."
		settleableAt: DateTime
		"Present when the status is \`HELD\`: a held row a seller cannot read the reason for is one it cannot act on."
		holdReason: SellerHoldReason
		"The row this one reverses. A reversal is always a new row, never an edit of the row it reverses."
		reversesTransactionId: ID
	}

	"One instruction to move one seller's settleable balance, in one currency, to the seller's bank account."
	type SellerPayout {
		id: ID!
		sellerId: ID!
		"Human-facing number, drawn from the platform's sequence for payouts and unique per organization."
		number: String!
		status: SellerPayoutStatus!
		"Snapshotted from the seller at creation: a seller that changes how it is paid does not change how a built payout is executed."
		payoutMode: SellerPayoutMode!
		currency: String!
		"The sum of the payout's lines, and nothing else: the lines are what make the amount derivable rather than asserted."
		netAmount: Decimal!
		"The provider's transfer fee, which the seller bears and the platform does not earn."
		feeAmount: Decimal!
		"Withheld at this run under the reserve policy; a per-run computation rather than a balance."
		reserveAmount: Decimal!
		"The amount actually instructed to the provider."
		paidAmount: Decimal!
		"The offboarding payout: exempt from the minimum threshold and from the reserve."
		isFinal: Boolean!
		paidAt: DateTime
		"The provider that was instructed."
		providerKey: String
		"The provider's transfer id, unique per provider: what makes a retried execution replay the stored response instead of moving money twice."
		providerTransferId: String
		"The ledger rows this payout covers. Loaded by the single-payout read; absent from a list row."
		lines: [SellerPayoutLine!]
	}

	"The join between a payout and one ledger row it pays. Deliberately thin: the money is already on the transaction."
	type SellerPayoutLine {
		id: ID!
		sellerPayoutId: ID!
		"The ledger row being paid."
		sellerTransactionId: ID!
		"The portion of the transaction's net paid by this payout."
		amount: Decimal!
		"Always the payout's own currency: a payout is built for one seller in one currency."
		currency: String!
	}

	"What the payment provider reported it did, recorded as reported."
	type SellerSettlement {
		id: ID!
		sellerId: ID!
		"The provider that reported the settlement."
		providerKey: String!
		status: SellerSettlementStatus!
		currency: String!
		"The provider's own gross for the period."
		grossAmount: Decimal!
		"The commission withheld at source, snapshotted from the provider's report."
		commissionAmount: Decimal!
		"The provider's fee, which is not the platform's commission and is never netted into it."
		feeAmount: Decimal!
		"Gross less the commission and the provider's fee."
		netAmount: Decimal!
		"The platform's lines for the period less the reported net: zero when the two agree. The ledger is never edited to agree with an external report."
		discrepancyAmount: Decimal!
		closedAt: DateTime
	}

	"A seller's balance in one currency. The balance is the ledger: summed from the rows every time it is asked for, never cached."
	type SellerBalance {
		currency: String!
		"Rows that are captured and past the hold window."
		available: Decimal!
		"Rows written but not yet captured."
		pending: Decimal!
		"Rows deliberately held out of payouts."
		held: Decimal!
		"The negative part of the balance, reported explicitly: a refund after a payout makes the balance negative on purpose."
		negativeCarryForward: Decimal!
		"What the next run would withhold under the reserve policy."
		reserveNextRun: Decimal!
		"The next date the seller's schedule would create a payout; null for a manual or threshold schedule."
		nextPayoutAt: DateTime
	}

	"One line of a seller statement."
	type SellerStatementLine {
		"The ledger row the line reports."
		transactionId: ID!
		kind: SellerTransactionKind!
		status: SellerTransactionStatus!
		occurredAt: DateTime!
		description: String
		"The ledger's own exact decimals, never a rounded rendering of them."
		grossAmount: Decimal!
		commissionAmount: Decimal!
		netAmount: Decimal!
		currency: String!
	}

	"A seller's statement for a period: what it earned, what it was charged and what it was paid."
	type SellerStatement {
		sellerId: ID!
		currency: String!
		"The first day of the period; null is open at the start."
		from: DateTime
		"The last day of the period; null is open at the end."
		to: DateTime
		"What the seller was owed before the period began."
		openingBalance: Decimal!
		"The ledger rows of the period, oldest first."
		lines: [SellerStatementLine!]!
		"The payouts of the period, oldest first."
		payouts: [SellerPayout!]!
		"The provider settlements of the period, oldest first."
		settlements: [SellerSettlement!]!
		"What the seller is owed at the end of the period."
		closingBalance: Decimal!
		negativeCarryForward: Decimal!
		reserveNextRun: Decimal!
		nextPayoutAt: DateTime
	}

	"The reconciliation of one order's split against the money actually captured."
	type SellerSplitReconciliation {
		orderId: ID!
		currency: String!
		"The captured amount of the order."
		capturedAmount: Decimal!
		"The part attributable to content no seller owns, which this ledger does not carry."
		platformOwnCaptured: Decimal!
		"The sum of the sellers' nets."
		sumNet: Decimal!
		"The sum of the platform's commissions."
		sumCommission: Decimal!
		"The platform's own contribution to seller-owned lines, as a positive figure."
		platformDiscount: Decimal!
		"Zero when the seller rows and the platform's commission account for exactly what was captured. A non-zero delta is a defect, not a rounding curiosity."
		splitDelta: Decimal!
		"What the platform kept on the seller-owned part; legitimately negative."
		platformRetained: Decimal!
	}

	extend type Query {
		"Lists the seller accounts of the caller's organization."
		sellers: [Seller!]!
		"Reads one seller by id or by its human-usable code."
		seller(idOrCode: String!): Seller
		"Reads a seller's statement over a period, in one currency."
		sellerStatement(sellerId: ID!, currency: String): SellerStatement
		"Reads what a seller is owed in one currency. A negative figure is a reported fact rather than an error."
		sellerBalance(sellerId: ID!, currency: String): SellerBalance
		"Lists what sellers offer."
		sellerOfferings: [SellerOffering!]!
		"Lists the per-seller split of orders: the ledger that says what each seller earned."
		sellerTransactions: [SellerTransaction!]!
		"Reconciles the split of the orders in a window against the money they captured."
		sellerSplitReconciliation(orderId: ID, sellerId: ID): [SellerSplitReconciliation!]!
		"Lists payout instructions."
		sellerPayouts: [SellerPayout!]!
		"Reads one payout with its lines."
		sellerPayout(id: ID!): SellerPayout
		"Lists the ledger rows one payout covers."
		sellerPayoutLines(sellerPayoutId: ID!): [SellerPayoutLine!]!
		"Lists what providers reported they settled."
		sellerSettlements: [SellerSettlement!]!
	}

	extend type Mutation {
		"Submits a seller application for review. The seller becomes \`SUBMITTED\` and no further."
		submitSeller(id: ID!): Seller!
		"Activates an approved seller. \`ACTIVE\` is never reached implicitly."
		activateSeller(id: ID!): Seller!
		"Suspends a seller, with a reason the seller can read. Balances are held."
		suspendSeller(id: ID!, reason: String!): Seller!
		"Returns a suspended seller to active."
		reinstateSeller(id: ID!): Seller!
		"Publishes an offering to the given channels, materialising its authored price into a price row."
		publishSellerOffering(id: ID!, channelIds: [String!]): SellerOffering!
		"Pauses an offering, so it stops being sellable and stays resumable."
		pauseSellerOffering(id: ID!): SellerOffering!
		"Withdraws an offering; terminal."
		withdrawSellerOffering(id: ID!): SellerOffering!
		"Advances a ledger row to settleable. The state is advanced, never the amount."
		settleSellerTransaction(id: ID!, note: String): SellerTransaction!
		"Holds a ledger row out of payouts, with a reason a seller can read."
		holdSellerTransaction(id: ID!, reason: String!): SellerTransaction!
		"Creates a payout from named ledger rows, or from the settleable rows of a period."
		createSellerPayout(sellerId: ID!, currency: String!, transactionIds: [String!], note: String): SellerPayout!
		"Approves a payout. Approving is a separate permission from creating, because approving one moves money."
		approveSellerPayout(id: ID!): SellerPayout!
		"Records the provider's execution of a payout, as reported."
		markSellerPayoutPaid(id: ID!, providerKey: String, providerTransferId: String): SellerPayout!
		"Cancels an unpaid payout, returning its ledger rows to settleable."
		cancelSellerPayout(id: ID!, reason: String!): SellerPayout!
		"Records a settlement reported by a provider, as reported: the ledger is never edited to agree with it."
		createSellerSettlement(
			sellerId: ID!
			providerKey: String!
			currency: String!
			grossAmount: String!
			commissionAmount: String
			feeAmount: String
		): SellerSettlement!
	}
`;
