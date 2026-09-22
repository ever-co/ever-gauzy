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
 * **Every list root field answers a connection.** `sellers`, `sellerOfferings`, `sellerTransactions`,
 * `sellerPayouts`, `sellerPayoutLines` and `sellerSettlements` used to answer a bare array, which a
 * client can neither page nor count: each now takes the protocol's `page` and answers the one shape the
 * rest of the platform answers with — `nodes`, `edges`, `totalCount` and a non-null `pageInfo` — so a
 * client that can walk one domain's pages can walk them all. The names are the row types' own with
 * `Connection` and `Edge` appended, following the naming the surrounding schema already uses.
 * `sellerSplitReconciliation` is deliberately left as a list: it is an aggregation over settlements
 * rather than a page of rows, and a `totalCount` and a `pageInfo` on it would be two figures it cannot
 * honour.
 *
 * Each of the six also states `withDeleted`, because the REST list route it mirrors reads through
 * `BaseQueryDTO` and therefore lets its caller ask for the rows a tenant retired. A connection query
 * that omitted it would be a field a client cannot ask that question of, while the same question is one
 * query parameter away on the other protocol.
 *
 * The document is one half of the package's GraphQL contribution and the resolvers are the other: a
 * root field declared here with no resolver resolves to null with no error anywhere, and a field a
 * resolver declares without being declared here is never served at all. The two are written and
 * reviewed together, and the plugin hands both to the platform in one `extensions` block.
 *
 * Every mutation that mirrors a route which declares a retry scope carries that scope's name in its
 * description and an `idempotencyKey` beside its other arguments, and the resolver behind it carries
 * the route's own `@Idempotent(...)` declaration. The member is what a key rides in here rather than a
 * header, because a GraphQL request is one `POST` carrying as many mutations as its document selects:
 * a header could neither say which of them a key belongs to nor carry several of them.
 *
 * It is declared **nullable on every one of them, including the mutation whose route requires a key**.
 * A schema-level requirement would refuse a keyless mutation with a validation error the REST caller
 * never sees; leaving it nullable lets the request reach the kernel, which refuses it with the
 * platform's own `IDEMPOTENCY_KEY_REQUIRED` — the same answer, in the same vocabulary, as the route.
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

	"What one item of an offering batch does. The values are the resource's own vocabulary, because none of the four is one of the platform's write kinds: no operation creates a row and none removes one."
	enum SellerOfferingBulkOperation {
		"Moves the offering to \`ACTIVE\`, checking every publication clause first."
		PUBLISH
		"Moves the offering to \`PAUSED\`, so it stops being sellable and stays resumable."
		PAUSE
		"Moves the offering to \`WITHDRAWN\`; the row is kept."
		WITHDRAW
		"Rewrites the offering's price, and the commission it is sold under when the item states one."
		REPRICE
	}

	"How a batch writes the offering an item names. The values are the platform bulk contract's own wire values, copied un-re-cased, so one batch statement reads identically over either protocol."
	enum SellerOfferingBulkMode {
		"Merge into the offering the item names; the platform's default."
		upsert
		"Overwrite the addressed offering rather than merging into it."
		replace
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

	"One band of a graduated commission schedule: \`from <= x < to\`, with \`to\` null meaning open ended. The bounds are in major units for an amount basis and in units for a quantity basis."
	input CommissionTierInput {
		"Inclusive lower bound."
		from: Float!
		"Exclusive upper bound; null is open ended."
		to: Float
		"Rate applied to the whole amount or quantity when the value falls in this band. An exact decimal, never a float."
		rate: Decimal!
	}

	"""
	One item of an offering batch: the operation it performs and the offering it performs it on.

	The members are the members the delivered single-item routes accept, so an item states exactly what the equivalent call states and nothing beside it. A member that is absent is a member the item says nothing about, which is a different request from a member stated as empty — a re-price of the amount alone leaves the currency, the window and the channel set as the offering holds them.

	Each member belongs to the operation that reads it: \`channelIds\` narrows what a \`PUBLISH\` publishes to, the two price members and the three commission members are what a \`REPRICE\` writes, and a \`PAUSE\` and a \`WITHDRAW\` write the status alone.
	"""
	input SellerOfferingBulkItem {
		"The offering the item acts on. Required: no operation of this batch creates or guesses a row."
		id: ID!

		"The operation this item performs. Required: an item that states none is refused."
		operation: SellerOfferingBulkOperation!

		"The price the offering is to carry; read by a re-price."
		priceAmount: Decimal

		"The currency of that price; read by a re-price."
		priceCurrency: String

		"The commission rate the offering overrides the seller's default with; read by a re-price."
		commissionRate: Decimal

		"What that rate multiplies; read by a re-price."
		commissionBasis: CommissionBasis

		"The graduated schedule that replaces the flat rate; read by a re-price."
		commissionTiers: [CommissionTierInput!]

		"The channel subset to publish to; null inherits the seller's set. Read by a publish."
		channelIds: [String!]
	}

	"""
	A page of listings to move in one request.

	\`mode\` is the platform bulk contract's write mode and \`atomic\` is its all-or-nothing flag: an atomic batch applies every item or none of them, and a batch that is not atomic applies what it can and reports the rest. This route creates no row, so the mode names how the platform's contract merges rather than a choice the resource offers.

	\`idempotencyKey\` is the retry key of this batch, and it is optional: the route honours a key and does not demand one. A GraphQL request may carry many mutations in one document and a header cannot say which of them a key belongs to, so the key travels here, beside the input it qualifies, and is read by the same kernel that stores and replays the REST surface's keys.
	"""
	input BulkSellerOfferingsInput {
		"The items of the batch, in caller order. The answer refers to them by position."
		items: [SellerOfferingBulkItem!]!

		"How the addressed offering is written. Null is the platform's default."
		mode: SellerOfferingBulkMode

		"Whether the batch is applied as one write."
		atomic: Boolean

		"The client's retry key for this batch."
		idempotencyKey: String
	}

	"""
	One item's outcome: the offering that moved, or the item's own failure.

	The index is part of the answer because a batch is answered in one piece — a caller that sent a page of listings reads which of them applied without matching rows back to a request by hand.
	"""
	type SellerOfferingBulkItemResult {
		"The item's position in the request."
		index: Int!

		"Whether the item applied."
		ok: Boolean!

		"The offering that moved, when the item applied."
		id: ID

		"The resource that moved, so a mixed batch reads unambiguously."
		resource: String

		"Why the item did not apply, with the code the same item would have produced alone. The path names the item it belongs to."
		error: UserError
	}

	"""
	What a batch of offerings adds up to.

	\`succeeded\` and \`failed\` are the counts of the two kinds of entry in \`results\`, so a client can assert \`succeeded + failed == items.length\` against the same answer rather than against a second number that could disagree with it.
	"""
	type BulkSellerOfferingsPayload {
		"One entry per request item, in request order."
		results: [SellerOfferingBulkItemResult!]!

		"How many items applied."
		succeeded: Int!

		"How many items did not."
		failed: Int!

		"How many items the request carried."
		total: Int!
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

	"A page of sellers."
	type SellerConnection {
		nodes: [Seller!]!
		edges: [SellerEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One seller in a page, with the cursor that addresses it."
	type SellerEdge {
		node: Seller!
		cursor: String!
	}

	"A page of what sellers offer."
	type SellerOfferingConnection {
		nodes: [SellerOffering!]!
		edges: [SellerOfferingEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One offering in a page, with the cursor that addresses it."
	type SellerOfferingEdge {
		node: SellerOffering!
		cursor: String!
	}

	"A page of ledger rows."
	type SellerTransactionConnection {
		nodes: [SellerTransaction!]!
		edges: [SellerTransactionEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One ledger row in a page, with the cursor that addresses it."
	type SellerTransactionEdge {
		node: SellerTransaction!
		cursor: String!
	}

	"A page of payout instructions."
	type SellerPayoutConnection {
		nodes: [SellerPayout!]!
		edges: [SellerPayoutEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One payout in a page, with the cursor that addresses it."
	type SellerPayoutEdge {
		node: SellerPayout!
		cursor: String!
	}

	"A page of the ledger rows one payout covers."
	type SellerPayoutLineConnection {
		nodes: [SellerPayoutLine!]!
		edges: [SellerPayoutLineEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One payout line in a page, with the cursor that addresses it."
	type SellerPayoutLineEdge {
		node: SellerPayoutLine!
		cursor: String!
	}

	"A page of settlements."
	type SellerSettlementConnection {
		nodes: [SellerSettlement!]!
		edges: [SellerSettlementEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One settlement in a page, with the cursor that addresses it."
	type SellerSettlementEdge {
		node: SellerSettlement!
		cursor: String!
	}

	extend type Query {
		"Lists the seller accounts of the caller's organization."
		sellers(page: PageInput, withDeleted: Boolean): SellerConnection!
		"Reads one seller by id or by its human-usable code."
		seller(idOrCode: String!): Seller
		"Reads a seller's statement over a period, in one currency."
		sellerStatement(sellerId: ID!, currency: String): SellerStatement
		"Reads what a seller is owed in one currency. A negative figure is a reported fact rather than an error."
		sellerBalance(sellerId: ID!, currency: String): SellerBalance
		"Lists what sellers offer."
		sellerOfferings(page: PageInput, withDeleted: Boolean): SellerOfferingConnection!
		"Lists the per-seller split of orders: the ledger that says what each seller earned."
		sellerTransactions(page: PageInput, withDeleted: Boolean): SellerTransactionConnection!
		"Reconciles the split of the orders in a window against the money they captured."
		sellerSplitReconciliation(orderId: ID, sellerId: ID): [SellerSplitReconciliation!]!
		"Lists payout instructions."
		sellerPayouts(page: PageInput, withDeleted: Boolean): SellerPayoutConnection!
		"Reads one payout with its lines."
		sellerPayout(id: ID!): SellerPayout
		"Lists the ledger rows one payout covers."
		sellerPayoutLines(sellerPayoutId: ID!, page: PageInput, withDeleted: Boolean): SellerPayoutLineConnection!
		"Lists what providers reported they settled."
		sellerSettlements(page: PageInput, withDeleted: Boolean): SellerSettlementConnection!
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
		"""
		Publishes an offering to the given channels, materialising its authored price into a price row.

		Mirrors the publish route and declares the same \`seller_offering.publish\` scope, so a retry of one
		publication is a retry whichever protocol it arrives on.
		"""
		publishSellerOffering(id: ID!, channelIds: [String!], idempotencyKey: String): SellerOffering!
		"Pauses an offering, so it stops being sellable and stays resumable."
		pauseSellerOffering(id: ID!): SellerOffering!
		"Withdraws an offering; terminal."
		withdrawSellerOffering(id: ID!): SellerOffering!
		"""
		Publishes, pauses, withdraws or re-prices a page of listings in one request.

		Mirrors \`POST /seller-offerings/bulk\` and declares the same \`seller_offering.bulk\` scope, so a retry of one batch is a retry whichever protocol it arrives on. The batch is applied by the platform's executor from the route's own declaration, which is what makes the two surfaces one operation: the same cap, the same single authorisation decision, the same per-item report, and an atomic batch that writes nothing when one item fails.
		"""
		bulkSellerOfferings(input: BulkSellerOfferingsInput!): BulkSellerOfferingsPayload!
		"""
		Advances a ledger row to settleable. The state is advanced, never the amount.

		Mirrors the settle route and declares the same \`seller.transaction.settle\` scope, so a retry of one
		advance is a retry whichever protocol it arrives on.
		"""
		settleSellerTransaction(id: ID!, note: String, idempotencyKey: String): SellerTransaction!
		"Holds a ledger row out of payouts, with a reason a seller can read."
		holdSellerTransaction(id: ID!, reason: String!): SellerTransaction!
		"""
		Creates a payout from named ledger rows, or from the settleable rows of a period.

		Mirrors the create route and declares the same \`seller.payout.create\` scope, so a client that
		presents one key over either protocol receives the payout its first attempt built rather than a
		second one over the same ledger rows.
		"""
		createSellerPayout(
			sellerId: ID!
			currency: String!
			transactionIds: [String!]
			note: String
			idempotencyKey: String
		): SellerPayout!
		"Approves a payout. Approving is a separate permission from creating, because approving one moves money."
		approveSellerPayout(id: ID!): SellerPayout!
		"""
		Records the provider's execution of a payout, as reported.

		Mirrors the execution route, and carries that route's scope and its requirement with it. This is
		the operation that moves money to the seller, so a mutation sent without a key is refused with
		\`IDEMPOTENCY_KEY_REQUIRED\` rather than executed, exactly as the route refuses it. A repeat of one
		key and one body receives the first attempt's payout instead of instructing the provider again.
		"""
		markSellerPayoutPaid(
			id: ID!
			providerKey: String
			providerTransferId: String
			idempotencyKey: String
		): SellerPayout!
		"Cancels an unpaid payout, returning its ledger rows to settleable."
		cancelSellerPayout(id: ID!, reason: String!): SellerPayout!
		"""
		Records a settlement reported by a provider, as reported: the ledger is never edited to agree with it.

		Mirrors the recording route and declares the same \`seller.settlement.record\` scope, so a
		signature-verified callback delivered twice records one settlement over either protocol.
		"""
		createSellerSettlement(
			sellerId: ID!
			providerKey: String!
			currency: String!
			grossAmount: String!
			commissionAmount: String
			feeAmount: String
			idempotencyKey: String
		): SellerSettlement!
	}
`;
