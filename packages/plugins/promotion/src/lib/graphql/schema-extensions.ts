import { gql } from 'graphql-tag';

/**
 * The promotion domain's contribution to the platform schema.
 *
 * The types are named for the concepts and the fields are named for the entity properties they are
 * read from, so a GraphQL caller and a REST caller read the same vocabulary and neither has to be
 * translated into the other. Nothing here is declared twice: the root operation types are extended
 * rather than declared, and `PageInfo`, `PageInput`, `SortDirection`, the filter family, the three
 * scalars, `Operation` and `UserError` belong to the kernel and are referenced as they stand.
 *
 * Two conventions are load-bearing. **Money is always `Decimal`** — an exact decimal serialised as a
 * string — because a binary fraction cannot hold a cent, so a discount read here and the same
 * discount read over REST are string-identical. And **a mutation answers with a payload**, never
 * with a bare entity: the payload carries the resource it changed, the operation the change belongs
 * to, and the caller-correctable outcomes in `userErrors`, so a business rejection is a successful
 * operation with a documented outcome rather than a transport error.
 *
 * A page is the Relay shape the platform settled on — `nodes`, `edges`, `totalCount`, `pageInfo` —
 * and money, windows and instants use the kernel's own scalars and filters.
 */
export const schemaExtensions = gql`
	# ------------------------------------------------------------------------------------------------
	# The domain's value sets.
	# ------------------------------------------------------------------------------------------------

	"Lifecycle of a campaign."
	enum CampaignStatus {
		DRAFT
		ACTIVE
		INACTIVE
	}

	"What a campaign budget counts."
	enum CampaignBudgetType {
		"A money ceiling across the campaign."
		SPEND
		"A redemption count."
		USAGE
		"A money ceiling per value of the budget's attribute."
		SPEND_BY_ATTRIBUTE
		"A redemption count per value of the budget's attribute."
		USAGE_BY_ATTRIBUTE
	}

	"Lifecycle of a promotion."
	enum PromotionStatus {
		DRAFT
		ACTIVE
		INACTIVE
		"Set once the window has closed."
		EXPIRED
	}

	"The shape of an offer, which decides the action types that are legal for it."
	enum PromotionType {
		"A plain discount: fixed, percentage or tiered percentage."
		STANDARD
		"Buy some, get some: needs a buy scope and a buy quantity."
		BUY_GET
		"Shipping is discounted to zero."
		FREE_SHIPPING
		"A set of items is discounted down to a bundle price."
		BUNDLE
		"Target items are given away."
		FREE_ITEM
	}

	"What a promotion action does."
	enum PromotionActionType {
		"Subtract a fixed amount."
		FIXED
		"Subtract a fraction of the discountable amount."
		PERCENTAGE
		"Discount shipping to zero."
		FREE_SHIPPING
		"Add the target units as free lines."
		FREE_ITEM
		"Discount a target set down to a bundle price."
		BUNDLE_PRICE
		"A percentage selected by a threshold."
		TIERED_PERCENTAGE
	}

	"What an action's benefit lands on."
	enum PromotionActionTargetType {
		ORDER
		ITEMS
		SHIPPING
	}

	"How an action's benefit is spread over its targets."
	enum PromotionActionAllocation {
		"Spread once over the whole targeted set, by largest remainder."
		ACROSS
		"Once per discounted unit, so a partial return can reverse whole units."
		EACH
		"Once, on a single selected unit or on the set as a whole."
		ONCE
	}

	"Lifecycle of one application of a promotion."
	enum PromotionUsageStatus {
		"Held while the basket is being checked out."
		RESERVED
		"The order was placed; the discount stands."
		REGISTERED
		"Cancelled, expired or returned under the reversibility policy."
		REVERTED
	}

	"""
	Why a promotion was excluded, or was applied only in part.

	Every exclusion is reported, because a promotion that silently does nothing is the defect an
	operator cannot diagnose. The set is closed: a notice the enum does not carry is an answer the
	protocol cannot deliver, so a new reason is added here and to the domain enumeration together.
	"""
	enum PromotionNoticeCode {
		"The promotion is not active."
		PROMOTION_INACTIVE
		"The promotion window is closed."
		PROMOTION_EXPIRED
		"The campaign the promotion belongs to has closed its window."
		CAMPAIGN_WINDOW_CLOSED
		"The promotion's rules did not match the context."
		RULES_NOT_MATCHED
		"The promotion is scoped to another seller."
		SELLER_SCOPE_MISMATCH
		"The promotion is priced in another currency."
		CURRENCY_MISMATCH
		"The promotion's global usage limit is reached."
		USAGE_LIMIT_EXCEEDED
		"The customer has already used the promotion as often as it allows."
		PER_CUSTOMER_LIMIT_EXCEEDED
		"No promotion carries the code presented."
		COUPON_INACTIVE
		"The coupon's own window is closed."
		COUPON_EXPIRED
		"The coupon's own usage limit is reached."
		COUPON_LIMIT_EXCEEDED
		"The coupon's own per-customer limit is reached."
		COUPON_CUSTOMER_LIMIT_EXCEEDED
		"The budget behind the promotion is spent."
		BUDGET_EXCEEDED
		"The budget admitted only part of the computed discount."
		PARTIALLY_APPLIED_BUDGET
		"Another promotion of the same stacking group is exclusive and already applied."
		STACKING_CONFLICT
		"The action matched nothing to discount."
		NO_TARGETS
		"Nothing was left to discount by the time this promotion ran."
		NO_DISCOUNTABLE_AMOUNT
		"The promotion's own discount ceiling capped the benefit."
		PROMOTION_CAPPED
		"The evaluation stopped after its candidate limit."
		PROMOTION_CANDIDATE_LIMIT
	}

	"Which side of a basket an allocation lands on."
	enum PromotionAllocationOwner {
		"A line of the basket."
		LINE
		"A shipping method of the basket."
		SHIPPING
	}

	"Lifecycle of a stored-value instrument."
	enum GiftCardStatus {
		ACTIVE
		"The balance reached zero."
		REDEEMED
		"The expiry instant passed."
		EXPIRED
		"Withdrawn by an operator; the ledger is kept."
		CANCELED
	}

	"What a gift-card ledger row records."
	enum GiftCardTransactionType {
		"The card was created and credited with its face value."
		ISSUE
		"The balance was spent; the amount is negative."
		REDEEM
		"Value was returned to the card."
		REFUND
		"A manual correction, in either direction."
		ADJUST
		"A forfeited balance at expiry."
		EXPIRE
	}

	# ------------------------------------------------------------------------------------------------
	# The aggregates.
	# ------------------------------------------------------------------------------------------------

	"""
	A promotion: the offer itself.

	Its conditions are not a column — they are \`rule\` rows the kernel's rule engine owns and this
	domain reads — and the money it moves is recorded in the kernel's adjustment ledger. What is
	declared here is what the promotion *is*: what it gives (its action set), when it runs, who may
	use it, and how much of it may be given away.
	"""
	type Promotion {
		id: ID!
		"Optional code. A promotion with no code and \`isAutomatic\` applies itself."
		code: String
		"Customer-facing name of the offer."
		title: String!
		description: String
		type: PromotionType!
		status: PromotionStatus!
		"Applies without a code when its rules match."
		isAutomatic: Boolean!
		"When false the promotion closes its stacking group."
		isCombinable: Boolean!
		"Group key for the combination policy."
		stackingGroup: String
		"Ordering weight; lower runs earlier."
		priority: Int!
		"The campaign whose window and budget bound this promotion."
		campaignId: ID
		"The sales channel the promotion is restricted to; null means all channels."
		channelId: ID
		"The currency the fixed-amount actions are restricted to; null means currency-agnostic."
		currency: String
		"The contact group the promotion is restricted to; null means all customers."
		customerGroupId: ID
		startsAt: DateTime
		"End of the window, exclusive."
		endsAt: DateTime
		"Global redemption cap; null means unlimited."
		usageLimit: Int
		"Redemptions so far, including reservations."
		usageCount: Int!
		"Redemption cap per customer; null means unlimited."
		perCustomerUsageLimit: Int
		"Inline budget for a promotion that has no campaign. Exact decimal."
		budgetAmount: Decimal
		"Consumption of the inline budget. Exact decimal."
		budgetSpent: Decimal!
		"Whether the discount is computed on the tax-inclusive amount."
		isTaxInclusive: Boolean!
		"Funding mode, revert-on-return policy and the other open-ended settings."
		metadata: JSON
		campaign: Campaign
		"The effect of the offer, in application order."
		actions: [PromotionAction!]
		"The codes that grant it."
		coupons: [Coupon!]
		"Its applications, as reservations and registrations."
		usages: [PromotionUsage!]
		tenantId: ID
		organizationId: ID
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	"""
	One thing a promotion does when it matches.

	An action's position is part of its meaning: the actions of one promotion compose in order, and
	replacing the set is the only way to remove one without renumbering the rest.
	"""
	type PromotionAction {
		id: ID!
		promotionId: ID!
		type: PromotionActionType!
		targetType: PromotionActionTargetType!
		allocation: PromotionActionAllocation!
		"The amount, the fraction or the bundle price. Exact decimal."
		value: Decimal!
		"The currency of a fixed-amount action; null for a proportional one."
		currency: String
		"Upper bound on the benefit. Exact decimal."
		maxQuantity: Decimal
		"Units the benefit applies to. Exact decimal."
		applyToQuantity: Decimal
		"Units that must be bought before a buy-get action fires. Exact decimal."
		buyRulesMinQuantity: Decimal
		isTaxInclusive: Boolean!
		"Position in the application order."
		position: Int!
		"Tier list, bundle size and the other per-action settings."
		metadata: JSON
		promotion: Promotion
		tenantId: ID
		organizationId: ID
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	"""
	One promotion that was applied, with the amount it gave away.
	"""
	type PromotionApplication {
		promotionId: ID!
		"The coupon the application came through, when it came through one."
		couponId: ID
		"The code presented, when the application came from one."
		code: String
		"Whether the promotion applied itself rather than being asked for by a code."
		isAutomatic: Boolean!
		"The discount granted. Exact decimal."
		amount: Decimal!
		currency: String!
	}

	"""
	Why a promotion was excluded, or was applied only in part.
	"""
	type PromotionNotice {
		"The promotion the notice is about; empty when the notice is about a code that names none."
		promotionId: ID!
		"The code presented, when the notice is about a code."
		code: String
		notice: PromotionNoticeCode!
		"What a person should read."
		message: String!
		"The figures that make the notice actionable, when it carries any."
		details: JSON
	}

	"""
	What one evaluation decided.

	It is deterministic: the same context and the same promotion set always produce the same
	applications and the same allocations, which is what makes a simulation a promise rather than an
	estimate.
	"""
	type PromotionEvaluationResult {
		"The promotions that applied, in the order they ran."
		applications: [PromotionApplication!]!
		"Every exclusion and every partial application, with its reason."
		notices: [PromotionNotice!]!
		"The discount the evaluation grants, as a negative decimal. Exact decimal."
		discountTotal: Decimal!
		currency: String!
	}

	"""
	One owner an action decided to take money off.

	An allocation is money that was or would be granted to a line or a shipping method, never what an
	action computed: a discount the budget truncated is re-allocated, so Σ allocations is the amount
	actually given away, to the last minor unit.
	"""
	type PromotionAllocation {
		ownerType: PromotionAllocationOwner!
		"The line or shipping method the amount lands on."
		ownerId: ID!
		promotionId: ID!
		actionId: ID!
		code: String
		"The amount taken off this owner, negative. Exact decimal."
		amount: Decimal!
	}

	"""
	A campaign: a window and a budget, nothing more.

	It holds no rules of its own. Every promotion that names it inherits its window — outside which
	that promotion is not a candidate at all — and is bounded by its budget.
	"""
	type Campaign {
		id: ID!
		"Stable handle used by imports and by every external caller. Unique per organization."
		identifier: String!
		name: String!
		description: String
		status: CampaignStatus!
		"Start of the window; null means already open."
		startsAt: DateTime
		"End of the window, exclusive; null means it never closes."
		endsAt: DateTime
		"Owner, cost centre and free-form notes."
		metadata: JSON
		"The single ceiling of this campaign."
		budget: CampaignBudget
		"The promotions it bounds."
		promotions: [Promotion!]
		tenantId: ID
		organizationId: ID
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	"""
	The spend or usage ceiling of one campaign.

	\`used\` is a cache of the usage ledger rather than an authority: the checkout consumes it through a
	single conditional statement and the reconciliation job re-derives it, so reading it here and
	reading the ledger can disagree only between those two events.
	"""
	type CampaignBudget {
		id: ID!
		campaignId: ID!
		type: CampaignBudgetType!
		"The ceiling: money for the spend types, a count for the usage types. Exact decimal."
		limit: Decimal!
		"Consumption so far, including reservations. Exact decimal."
		used: Decimal!
		"Context attribute path the budget is split by, for the *_BY_ATTRIBUTE types."
		attribute: String
		"Currency of the ceiling, for the spend types."
		currency: String
		campaign: Campaign
		"The per-value consumption of a split budget."
		usages: [CampaignBudgetUsage!]
		tenantId: ID
		organizationId: ID
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	"""
	What a budget split by attribute has spent for one value of that attribute.

	The row is the gate: a consumption against a value is admitted here and the parent budget is
	advanced by the same amount in the same transaction, so an exhausted value blocks its own value
	and nothing else.
	"""
	type CampaignBudgetUsage {
		id: ID!
		budgetId: ID!
		"The value of the budget's attribute this row counts."
		attributeValue: String!
		"Consumption against that value. Exact decimal."
		used: Decimal!
		budget: CampaignBudget
		tenantId: ID
		organizationId: ID
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	"""
	A redeemable code belonging to a promotion.

	The code is stored upper-cased, so \`save10\` and \`SAVE10\` cannot both exist in one organization,
	and its own window and limits narrow the promotion's rather than widening them.
	"""
	type Coupon {
		id: ID!
		"The code the customer types, stored upper-cased."
		code: String!
		"The promotion a redemption grants; null means the code is not attached yet."
		promotionId: ID
		"Groups the coupons produced by one mailing."
		batchId: String
		"Per-code cap; null inherits the promotion limit."
		usageLimit: Int
		"Redemptions so far, including reservations."
		usageCount: Int!
		"Per-code, per-customer cap."
		perCustomerLimit: Int
		startsAt: DateTime
		"End of the code window, exclusive."
		endsAt: DateTime
		"Issued-to, mailing and single-use markers."
		metadata: JSON
		promotion: Promotion
		"The redemptions this code granted."
		usages: [PromotionUsage!]
		tenantId: ID
		organizationId: ID
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	"""
	One application of a promotion: the row the limits and the budget are checked against.

	A row is written by the checkout — reserved while the basket is being paid for, registered when
	the order is placed — and moved to \`REVERTED\` by a cancellation or a return. It is a fact, not a
	record an operator maintains.
	"""
	type PromotionUsage {
		id: ID!
		promotionId: ID!
		couponId: ID
		orderId: ID
		cartId: ID
		customerId: ID
		"The code presented, when the application came from one."
		code: String
		"The discount granted. Exact decimal."
		amount: Decimal!
		currency: String!
		usedAt: DateTime!
		status: PromotionUsageStatus!
		promotion: Promotion
		coupon: Coupon
		tenantId: ID
		organizationId: ID
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	"""
	A stored-value instrument.

	\`balance\` is a materialised cache of the card's ledger, never the authority; the ledger is what a
	redemption is actually checked against.
	"""
	type GiftCard {
		id: ID!
		"The redeemable string."
		code: String!
		"Face value at issue. Exact decimal."
		initialAmount: Decimal!
		"Current balance. Exact decimal."
		balance: Decimal!
		"The card currency. A card is only redeemable against an order in it."
		currency: String!
		status: GiftCardStatus!
		"The registered holder."
		customerId: ID
		"The order that issued the card, on a refund-to-card flow."
		orderId: ID
		expiresAt: DateTime
		"Reloadable marker, issuer, recipient and message."
		metadata: JSON
		"Every movement on the card, most recent first."
		transactions: [GiftCardTransaction!]
		tenantId: ID
		organizationId: ID
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	"""
	One movement on a gift card. Append-only.

	Each row records the amount, the balance it left behind and what caused it, which is what makes a
	card's history explainable without recomputing it.
	"""
	type GiftCardTransaction {
		id: ID!
		giftCardId: ID!
		orderId: ID
		"The movement's amount. Exact decimal; negative when value was spent."
		amount: Decimal!
		"The balance after this movement. Exact decimal."
		balanceAfter: Decimal!
		type: GiftCardTransactionType!
		"Why a manual correction was made."
		note: String
		occurredAt: DateTime!
		giftCard: GiftCard
		tenantId: ID
		organizationId: ID
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	# ------------------------------------------------------------------------------------------------
	# Pages.
	# ------------------------------------------------------------------------------------------------

	"One promotion inside a page."
	type PromotionEdge {
		node: Promotion!
		"The page's opaque cursor at this row."
		cursor: String!
	}

	"One page of promotions."
	type PromotionConnection {
		nodes: [Promotion!]!
		edges: [PromotionEdge!]!
		"The number of rows the filter selects, not the number in this page."
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One action inside a page."
	type PromotionActionEdge {
		node: PromotionAction!
		cursor: String!
	}

	"One page of promotion actions."
	type PromotionActionConnection {
		nodes: [PromotionAction!]!
		edges: [PromotionActionEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One campaign inside a page."
	type CampaignEdge {
		node: Campaign!
		cursor: String!
	}

	"One page of campaigns."
	type CampaignConnection {
		nodes: [Campaign!]!
		edges: [CampaignEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One budget inside a page."
	type CampaignBudgetEdge {
		node: CampaignBudget!
		cursor: String!
	}

	"One page of campaign budgets."
	type CampaignBudgetConnection {
		nodes: [CampaignBudget!]!
		edges: [CampaignBudgetEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One per-value consumption row inside a page."
	type CampaignBudgetUsageEdge {
		node: CampaignBudgetUsage!
		cursor: String!
	}

	"One page of per-value consumption rows."
	type CampaignBudgetUsageConnection {
		nodes: [CampaignBudgetUsage!]!
		edges: [CampaignBudgetUsageEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One coupon inside a page."
	type CouponEdge {
		node: Coupon!
		cursor: String!
	}

	"One page of coupons."
	type CouponConnection {
		nodes: [Coupon!]!
		edges: [CouponEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One application inside a page."
	type PromotionUsageEdge {
		node: PromotionUsage!
		cursor: String!
	}

	"One page of promotion applications."
	type PromotionUsageConnection {
		nodes: [PromotionUsage!]!
		edges: [PromotionUsageEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One gift card inside a page."
	type GiftCardEdge {
		node: GiftCard!
		cursor: String!
	}

	"One page of gift cards."
	type GiftCardConnection {
		nodes: [GiftCard!]!
		edges: [GiftCardEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One movement inside a page."
	type GiftCardTransactionEdge {
		node: GiftCardTransaction!
		cursor: String!
	}

	"One page of gift-card movements."
	type GiftCardTransactionConnection {
		nodes: [GiftCardTransaction!]!
		edges: [GiftCardTransactionEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	# ------------------------------------------------------------------------------------------------
	# Filters and ordering.
	#
	# A filter is flat: every member names one column and every member is an equality, so the object a
	# caller sends is the object the services receive as their \`where\`. An absent member filters
	# nothing, which is what makes a filter built up field by field behave.
	# ------------------------------------------------------------------------------------------------

	"Which promotions to read."
	input PromotionFilter {
		id: ID
		code: String
		title: String
		type: PromotionType
		status: PromotionStatus
		isAutomatic: Boolean
		isCombinable: Boolean
		stackingGroup: String
		campaignId: ID
		channelId: ID
		customerGroupId: ID
		currency: String
		startsAt: DateTime
		endsAt: DateTime
	}

	"The fields a promotion page may be ordered by."
	enum PromotionSortField {
		CODE
		TITLE
		TYPE
		STATUS
		PRIORITY
		STARTS_AT
		ENDS_AT
		USAGE_COUNT
		CREATED_AT
		UPDATED_AT
	}

	"How to order a promotion page."
	input PromotionSort {
		field: PromotionSortField!
		direction: SortDirection
	}

	"Which actions to read."
	input PromotionActionFilter {
		id: ID
		promotionId: ID
		type: PromotionActionType
		targetType: PromotionActionTargetType
		allocation: PromotionActionAllocation
		position: Int
	}

	"The fields a promotion-action page may be ordered by."
	enum PromotionActionSortField {
		POSITION
		TYPE
		VALUE
		CREATED_AT
		UPDATED_AT
	}

	"How to order a promotion-action page."
	input PromotionActionSort {
		field: PromotionActionSortField!
		direction: SortDirection
	}

	"Which campaigns to read."
	input CampaignFilter {
		id: ID
		identifier: String
		name: String
		status: CampaignStatus
		startsAt: DateTime
		endsAt: DateTime
	}

	"The fields a campaign page may be ordered by."
	enum CampaignSortField {
		IDENTIFIER
		NAME
		STATUS
		STARTS_AT
		ENDS_AT
		CREATED_AT
		UPDATED_AT
	}

	"How to order a campaign page."
	input CampaignSort {
		field: CampaignSortField!
		direction: SortDirection
	}

	"Which budgets to read."
	input CampaignBudgetFilter {
		id: ID
		campaignId: ID
		type: CampaignBudgetType
		attribute: String
		currency: String
		limit: Decimal
		used: Decimal
	}

	"The fields a budget page may be ordered by."
	enum CampaignBudgetSortField {
		TYPE
		LIMIT
		USED
		CREATED_AT
		UPDATED_AT
	}

	"How to order a budget page."
	input CampaignBudgetSort {
		field: CampaignBudgetSortField!
		direction: SortDirection
	}

	"Which per-value consumption rows to read."
	input CampaignBudgetUsageFilter {
		id: ID
		budgetId: ID
		attributeValue: String
		used: Decimal
	}

	"The fields a per-value consumption page may be ordered by."
	enum CampaignBudgetUsageSortField {
		ATTRIBUTE_VALUE
		USED
		CREATED_AT
		UPDATED_AT
	}

	"How to order a per-value consumption page."
	input CampaignBudgetUsageSort {
		field: CampaignBudgetUsageSortField!
		direction: SortDirection
	}

	"Which coupons to read."
	input CouponFilter {
		id: ID
		code: String
		promotionId: ID
		batchId: String
		startsAt: DateTime
		endsAt: DateTime
	}

	"The fields a coupon page may be ordered by."
	enum CouponSortField {
		CODE
		BATCH_ID
		USAGE_COUNT
		STARTS_AT
		ENDS_AT
		CREATED_AT
		UPDATED_AT
	}

	"How to order a coupon page."
	input CouponSort {
		field: CouponSortField!
		direction: SortDirection
	}

	"Which applications to read."
	input PromotionUsageFilter {
		id: ID
		promotionId: ID
		couponId: ID
		orderId: ID
		cartId: ID
		customerId: ID
		code: String
		status: PromotionUsageStatus
		currency: String
		usedAt: DateTime
	}

	"The fields an application page may be ordered by."
	enum PromotionUsageSortField {
		USED_AT
		AMOUNT
		STATUS
		CREATED_AT
	}

	"How to order an application page."
	input PromotionUsageSort {
		field: PromotionUsageSortField!
		direction: SortDirection
	}

	"Which gift cards to read."
	input GiftCardFilter {
		id: ID
		code: String
		status: GiftCardStatus
		currency: String
		customerId: ID
		orderId: ID
		balance: Decimal
		expiresAt: DateTime
	}

	"The fields a gift-card page may be ordered by."
	enum GiftCardSortField {
		CODE
		BALANCE
		STATUS
		EXPIRES_AT
		CREATED_AT
		UPDATED_AT
	}

	"How to order a gift-card page."
	input GiftCardSort {
		field: GiftCardSortField!
		direction: SortDirection
	}

	"Which movements to read."
	input GiftCardTransactionFilter {
		id: ID
		giftCardId: ID
		orderId: ID
		type: GiftCardTransactionType
		occurredAt: DateTime
	}

	"The fields a movement page may be ordered by."
	enum GiftCardTransactionSortField {
		OCCURRED_AT
		AMOUNT
		TYPE
		CREATED_AT
	}

	"How to order a movement page."
	input GiftCardTransactionSort {
		field: GiftCardTransactionSortField!
		direction: SortDirection
	}

	# ------------------------------------------------------------------------------------------------
	# The writable shapes.
	# ------------------------------------------------------------------------------------------------

	"One action of a promotion, as it is written."
	input PromotionActionInput {
		"""
		The action this entry names; omit it to add a new one.

		The identifier is accepted and **not** honoured as an identity: a replacement rewrites the
		promotion's whole action set — every stored row is deleted and the set this input carries is written
		in its place — so an action named here does not keep its row across the write, and the identifiers
		the mutation answers with are the new ones. It is carried for symmetry with the action resource's own
		identifier-addressed routes, and a caller that needs a particular action to keep its identity has to
		read the stored set back and address the row it finds.
		"""
		id: ID
		type: PromotionActionType!
		targetType: PromotionActionTargetType!
		allocation: PromotionActionAllocation
		value: Decimal!
		currency: String
		maxQuantity: Decimal
		applyToQuantity: Decimal
		buyRulesMinQuantity: Decimal
		isTaxInclusive: Boolean
		"Where the action sits in the application order; defaults to its position in the list."
		position: Int
		metadata: JSON
	}

	"The fields a promotion is created with."
	input CreatePromotionInput {
		code: String
		title: String!
		description: String
		type: PromotionType
		status: PromotionStatus
		isAutomatic: Boolean
		isCombinable: Boolean
		stackingGroup: String
		priority: Int
		campaignId: ID
		channelId: ID
		currency: String
		customerGroupId: ID
		startsAt: DateTime
		endsAt: DateTime
		usageLimit: Int
		perCustomerUsageLimit: Int
		budgetAmount: Decimal
		isTaxInclusive: Boolean
		metadata: JSON
		"""
		The effect of the offer, applied as a whole set after the promotion is stored.
		A promotion without one has none, which is a legitimate draft.
		"""
		actions: [PromotionActionInput!]
	}

	"The fields of a promotion that may be changed. Every one of them is optional."
	input UpdatePromotionInput {
		code: String
		title: String
		description: String
		type: PromotionType
		status: PromotionStatus
		isAutomatic: Boolean
		isCombinable: Boolean
		stackingGroup: String
		priority: Int
		campaignId: ID
		channelId: ID
		currency: String
		customerGroupId: ID
		startsAt: DateTime
		endsAt: DateTime
		usageLimit: Int
		perCustomerUsageLimit: Int
		budgetAmount: Decimal
		isTaxInclusive: Boolean
		metadata: JSON
		"When present, replaces the whole action set rather than merging into it."
		actions: [PromotionActionInput!]
	}

	"The fields a campaign is created with."
	input CreateCampaignInput {
		identifier: String!
		name: String!
		description: String
		status: CampaignStatus
		startsAt: DateTime
		endsAt: DateTime
		metadata: JSON
	}

	"The fields of a campaign that may be changed."
	input UpdateCampaignInput {
		identifier: String
		name: String
		description: String
		status: CampaignStatus
		startsAt: DateTime
		endsAt: DateTime
		metadata: JSON
	}

	"""
	The ceiling to store on a campaign. Omitted fields keep their stored values.

	\`limit\` is what a campaign that has no budget yet cannot do without: setting a ceiling for the
	first time stores one, so a request that leaves it out can only succeed against a budget that
	already exists.
	"""
	input UpdateCampaignBudgetInput {
		type: CampaignBudgetType
		"Exact decimal."
		limit: Decimal
		attribute: String
		currency: String
	}

	"""
	Why a campaign's ceiling is being re-opened.

	The reason is optional and is not passed to the service, which keeps none: the figure is reset and
	the explanation belongs with the activity log entry that recorded the act, which is where the route
	leaves it too.
	"""
	input ResetCampaignBudgetInput {
		reason: String
	}

	"The fields a coupon is created with."
	input CreateCouponInput {
		code: String!
		promotionId: ID
		batchId: String
		usageLimit: Int
		perCustomerLimit: Int
		startsAt: DateTime
		endsAt: DateTime
		metadata: JSON
	}

	"The fields of a coupon that may be changed."
	input UpdateCouponInput {
		promotionId: ID
		batchId: String
		usageLimit: Int
		perCustomerLimit: Int
		startsAt: DateTime
		endsAt: DateTime
		metadata: JSON
	}

	"The fields a gift card is issued with."
	input IssueGiftCardInput {
		"The redeemable string; generated from the platform alphabet when absent."
		code: String
		"Face value at issue. Exact decimal, and positive."
		initialAmount: Decimal!
		currency: String!
		customerId: ID
		orderId: ID
		expiresAt: DateTime
		metadata: JSON
	}

	"""
	The code format a batch is minted in.

	Every member is optional, and the platform's own alphabet, length and grouping stand in for the ones
	a caller leaves out — so a batch that states no format is generated the way the platform generates
	one, which is what makes the format a narrowing of the default rather than a thing to restate.
	"""
	input CouponCodeFormatInput {
		"Regular expression every generated code matches."
		pattern: String
		"Alphabet the significant characters are drawn from."
		alphabet: String
		"Number of significant characters."
		significantLength: Int
		"Characters per group."
		groupSize: Int
		"Separator between groups."
		separator: String
		"Optional fixed prefix."
		prefix: String
		"Optional fixed suffix."
		suffix: String
	}

	"""
	The batch of codes to mint.

	\`code\` is carried because the route's body is the create shape plus the two members a batch adds, and
	it names nothing here: every code of a batch is minted from the format, so the member is accepted and
	never read, exactly as it is on the route. \`count\` is the one member a batch cannot do without.

	The remaining members are the shared fields of every code in the batch — they are what makes a
	mailing one request rather than a thousand, and they are applied to each code as it is written.
	"""
	input CreateCouponBatchInput {
		"Accepted and never read: a batch mints its own codes."
		code: String
		"The promotion every code of the batch grants."
		promotionId: ID
		"Groups the codes of this batch; generated when absent."
		batchId: String
		"Per-code cap; null inherits the promotion limit."
		usageLimit: Int
		"Per-code, per-customer cap."
		perCustomerLimit: Int
		"Start of the window every code shares."
		startsAt: DateTime
		"End of the window every code shares, exclusive."
		endsAt: DateTime
		"Issued-to, mailing and single-use markers carried onto every code."
		metadata: JSON
		"How many codes to mint. Required: a batch of nothing is not a batch."
		count: Int!
		"The format the codes are minted in; the platform's own when absent."
		couponCodeFormat: CouponCodeFormatInput
	}

	"""
	The fields of a gift card that may be changed.

	The shape is the route's own body minus the three members whose write the card's rules refuse.
	\`initialAmount\` is the base the balance is derived from, so changing it after the card was issued
	rewrites the derivation rather than the card; \`balance\` is the materialised cache of that derivation,
	whose correction is \`adjustGiftCard\`; and \`pin\` is the second factor, which is stored as a digest and
	which no field of this schema reads or writes. Carrying them would hand a GraphQL caller a write over
	the ledger's own arithmetic — a write no act of the domain offers on either surface.

	Every member is optional, because an update states what changed rather than restating the card.
	"""
	input UpdateGiftCardInput {
		"The redeemable string."
		code: String
		"The card currency. A card is only redeemable against an order in it."
		currency: String
		"Active, redeemed, expired or canceled."
		status: GiftCardStatus
		"The registered holder."
		customerId: ID
		"The order that issued the card, on a refund-to-card flow."
		orderId: ID
		"Expiry instant; null means the card never expires."
		expiresAt: DateTime
		"Reloadable marker, issuer, recipient and message."
		metadata: JSON
	}

	"How much of a card is returned, and against what."
	input RefundGiftCardInput {
		"The amount to return. Exact decimal."
		amount: Decimal!
		"The order the value came from."
		orderId: ID
		"Why the value is being returned; the movement carries it."
		note: String
	}

	"""
	The correction to make to a card's balance.

	The note is required here as it is on the route, because the movement this writes is the only place
	the correction is ever explained: an adjustment without a reason is indistinguishable from a defect,
	and a caller that has no reason to state has no correction to make.
	"""
	input AdjustGiftCardInput {
		"The signed amount. Exact decimal: negative debits the card, positive credits it."
		amount: Decimal!
		"Why the correction was made."
		note: String!
	}

	"How much of a card is spent, and against what."
	input RedeemGiftCardInput {
		"The amount requested. Exact decimal."
		amount: Decimal!
		orderId: ID
		"The order's currency, which must be the card's."
		orderCurrency: String
		"What the order still owes, so the card never overpays it. Exact decimal."
		outstanding: Decimal
	}

	"Why a card is being withdrawn."
	input VoidGiftCardInput {
		reason: String
	}

	"Why a promotion is being closed before its window ends."
	input ExpirePromotionInput {
		reason: String
	}

	"""
	Why a promotion is being stopped.

	The reason is optional and is not passed to the service, which keeps none: an operator's
	explanation belongs with the activity that recorded the act, which is where the REST route leaves
	it too.
	"""
	input DeactivatePromotionInput {
		reason: String
	}

	"The action set that replaces a promotion's own, in application order."
	input ReplacePromotionActionsInput {
		"""
		The new set, applied as a whole: an action's position is part of its meaning, so a replacement
		is the only way to remove one without renumbering the rest. An empty set is refused.
		"""
		actions: [PromotionActionInput!]!
	}

	"One line an evaluation may discount."
	input PromotionEvaluationLineInput {
		id: ID!
		"The line's amount. Exact decimal."
		amount: Decimal!
		quantity: Int!
		variantId: ID
		sku: String
	}

	"One shipping method an evaluation may discount."
	input PromotionEvaluationShippingInput {
		id: ID!
		"The method's amount. Exact decimal."
		amount: Decimal!
	}

	"""
	The basket and the customer a promotion is simulated against.

	The context is stated by the caller rather than taken from its session, which is what lets an
	analyst answer "what would this cost us" for a basket nobody has assembled yet.
	"""
	input PromotionSimulationInput {
		"The currency the basket is priced in. A promotion in another currency is excluded with a notice."
		currency: String!
		channelId: ID
		customerId: ID
		customerGroupIds: [ID!]
		"The codes the basket presents. A code that names nothing is a notice, not a failure."
		codes: [String!]
		"The lines that may be discounted."
		lines: [PromotionEvaluationLineInput!]!
		"The shipping methods that may be discounted."
		shipping: [PromotionEvaluationShippingInput!]
		"The instant the evaluation is made at; defaults to now."
		at: DateTime
	}

	# ------------------------------------------------------------------------------------------------
	# Mutation payloads. A payload always carries the resource, the operation and the caller-correctable
	# outcomes; a business rejection is a successful operation with a \`userError\`.
	# ------------------------------------------------------------------------------------------------

	"The outcome of creating a promotion."
	type CreatePromotionPayload {
		promotion: Promotion
		"The durable operation the write belongs to, when it spans more than one step."
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of changing a promotion."
	type UpdatePromotionPayload {
		promotion: Promotion
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of deleting a promotion."
	type DeletePromotionPayload {
		"The promotion as it was, so a caller can report what it removed."
		promotion: Promotion
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of starting a promotion."
	type ActivatePromotionPayload {
		promotion: Promotion
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of closing a promotion before its window ends."
	type ExpirePromotionPayload {
		promotion: Promotion
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of stopping a promotion."
	type DeactivatePromotionPayload {
		promotion: Promotion
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of replacing a promotion's action set."
	type ReplacePromotionActionsPayload {
		"The stored actions, in application order."
		actions: [PromotionAction!]!
		operation: Operation
		userErrors: [UserError!]!
	}

	"""
	The outcome of simulating a promotion against a basket.

	Nothing was written: no reservation, no budget consumption, no usage row. The payload states what
	the evaluation decided, which is the same answer the checkout path computes.
	"""
	type SimulatePromotionPayload {
		"The applications, the notices and the total the promotion would produce."
		result: PromotionEvaluationResult
		"Every owner the discount would land on, to the last minor unit."
		allocations: [PromotionAllocation!]!
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of retiring a promotion recoverably."
	type SoftDeletePromotionPayload {
		"The promotion as the soft delete left it: still queryable, its ledger intact."
		promotion: Promotion
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of restoring a soft-deleted promotion."
	type RecoverPromotionPayload {
		promotion: Promotion
		operation: Operation
		userErrors: [UserError!]!
	}

	# The same pair, on the seven resources behind the promotion.
	#
	# Every one of these is the shape the promotion pair above answers with, and it is that shape for the
	# same reason: the soft-delete and recover routes are inherited from the CRUD base class by every
	# controller of this plugin, so a capability the promotion itself answers over GraphQL was served
	# over REST by all eight of them and by no field at all. The member names each resource in the
	# shortest form that is not ambiguous — a campaign's ceiling answers \`budget\`, and one value of that
	# ceiling's attribute answers \`budgetUsage\` — and the outcome the caller can act on is carried in
	# \`userErrors\`, because a row that cannot be retired is a successful operation with a documented
	# result rather than a transport failure.

	"The outcome of retiring a campaign recoverably."
	type SoftDeleteCampaignPayload {
		campaign: Campaign
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of restoring a soft-deleted campaign."
	type RecoverCampaignPayload {
		campaign: Campaign
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of retiring a campaign's ceiling recoverably."
	type SoftDeleteCampaignBudgetPayload {
		budget: CampaignBudget
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of restoring a soft-deleted campaign ceiling."
	type RecoverCampaignBudgetPayload {
		budget: CampaignBudget
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of retiring one per-value consumption row recoverably."
	type SoftDeleteCampaignBudgetUsagePayload {
		budgetUsage: CampaignBudgetUsage
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of restoring a soft-deleted per-value consumption row."
	type RecoverCampaignBudgetUsagePayload {
		budgetUsage: CampaignBudgetUsage
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of retiring a coupon recoverably."
	type SoftDeleteCouponPayload {
		coupon: Coupon
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of restoring a soft-deleted coupon."
	type RecoverCouponPayload {
		coupon: Coupon
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of retiring a gift card recoverably."
	type SoftDeleteGiftCardPayload {
		giftCard: GiftCard
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of restoring a soft-deleted gift card."
	type RecoverGiftCardPayload {
		giftCard: GiftCard
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of retiring one gift-card movement recoverably."
	type SoftDeleteGiftCardTransactionPayload {
		transaction: GiftCardTransaction
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of restoring a soft-deleted gift-card movement."
	type RecoverGiftCardTransactionPayload {
		transaction: GiftCardTransaction
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of retiring one promotion action recoverably."
	type SoftDeletePromotionActionPayload {
		action: PromotionAction
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of restoring a soft-deleted promotion action."
	type RecoverPromotionActionPayload {
		action: PromotionAction
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of retiring one application of a promotion recoverably."
	type SoftDeletePromotionUsagePayload {
		usage: PromotionUsage
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of restoring a soft-deleted application of a promotion."
	type RecoverPromotionUsagePayload {
		usage: PromotionUsage
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of creating a campaign."
	type CreateCampaignPayload {
		campaign: Campaign
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of changing a campaign."
	type UpdateCampaignPayload {
		campaign: Campaign
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of deleting a campaign."
	type DeleteCampaignPayload {
		campaign: Campaign
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of setting a campaign's ceiling."
	type UpdateCampaignBudgetPayload {
		budget: CampaignBudget
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of re-opening a campaign's ceiling."
	type ResetCampaignBudgetPayload {
		"The ceiling after the reset, with its consumption back at zero."
		budget: CampaignBudget
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of creating a coupon."
	type CreateCouponPayload {
		coupon: Coupon
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of changing a coupon."
	type UpdateCouponPayload {
		coupon: Coupon
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of deleting a coupon."
	type DeleteCouponPayload {
		coupon: Coupon
		operation: Operation
		userErrors: [UserError!]!
	}

	"""
	What a batch of codes adds up to.

	The identifier and the two counts travel together because the batch is all-or-nothing: a caller that
	holds the identifier its mailing is keyed on and the counts it was answered with can prove the
	mailing it asked for is the mailing it got, without counting rows. \`failed\` is not a partial success
	to be retried one code at a time — it is the figure that says the request did not deliver, which is
	why the service refuses a shortfall rather than reporting one.
	"""
	type CouponBatchResult {
		"The identifier every code of the batch carries."
		batchId: String!
		"How many codes were asked for."
		requested: Int!
		"How many codes were written."
		created: Int!
		"How many codes were not."
		failed: Int!
	}

	"The outcome of minting a batch of codes."
	type CreateCouponBatchPayload {
		"The batch identifier and the counts."
		batch: CouponBatchResult
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of issuing a gift card."
	type IssueGiftCardPayload {
		giftCard: GiftCard
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of spending part of a card's balance."
	type RedeemGiftCardPayload {
		giftCard: GiftCard
		"The amount actually applied, which is never more than the card carried. Exact decimal."
		applied: Decimal!
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of withdrawing a card from circulation."
	type VoidGiftCardPayload {
		giftCard: GiftCard
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of changing what a card says about itself."
	type UpdateGiftCardPayload {
		giftCard: GiftCard
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of returning value to a card."
	type RefundGiftCardPayload {
		giftCard: GiftCard
		"The amount actually returned, which is never more than the card was spent from. Exact decimal."
		applied: Decimal!
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of correcting a card's balance by hand."
	type AdjustGiftCardPayload {
		giftCard: GiftCard
		"The signed amount actually applied. Exact decimal."
		applied: Decimal!
		operation: Operation
		userErrors: [UserError!]!
	}

	"The answer to a code presented without applying it."
	type CouponValidationPayload {
		"Whether the code may be used."
		valid: Boolean!
		"The coupon, when the code exists."
		coupon: Coupon
		"Why it may not be used, as a stable platform code."
		reason: String
		"The discount the code's promotion would give. Exact decimal."
		discount: Decimal
	}

	"The balance of a card, answered from its ledger."
	type GiftCardBalancePayload {
		balance: Decimal!
		currency: String!
		status: GiftCardStatus!
	}

	# ------------------------------------------------------------------------------------------------
	# Subscription payloads. Each mirrors the domain event the service publishes: the identity of the
	# fact and the figures that belong to it, never an entity dump, because a subscriber that needs the
	# whole row reads it through the query it already holds permission for.
	# ------------------------------------------------------------------------------------------------

	"""
	A promotion was created, activated or expired.

	The state the promotion moved to travels with the event, so a subscriber that caches a promotion
	set — the checkout path does — can purge on it rather than on a timer: a promotion that has expired
	must stop applying at the instant it expired, not at the next refresh.
	"""
	type PromotionChangedPayload {
		"The event's own identity, which is the idempotency key a consumer applies its effects under."
		id: ID!
		"When the fact was recorded, as opposed to when it was dispatched."
		createdAt: DateTime!
		"The promotion that changed."
		promotionId: ID!
		"The state it moved to."
		status: PromotionStatus!
		"The organization the promotion belongs to."
		organizationId: ID!
	}

	"""
	A campaign budget reached its ceiling.

	Emitted by the evaluation path when a reservation is refused, which is the moment an operator can
	still act: a budget reported as spent at the end of the month cannot be topped up in time.
	"""
	type PromotionBudgetExhaustedPayload {
		id: ID!
		createdAt: DateTime!
		"The promotion whose budget refused the reservation."
		promotionId: ID!
		"The budget that refused it."
		budgetId: ID!
		"The ceiling that was reached. Exact decimal."
		limit: Decimal!
		"What has been consumed, including reservations. Exact decimal."
		used: Decimal!
		"The organization the budget belongs to."
		organizationId: ID!
	}

	"""
	A code was redeemed.

	The code travels because the usage counters and any mailing report are keyed on it, and the amount
	because that is the figure a campaign's spend is reconciled against.
	"""
	type CouponRedeemedPayload {
		id: ID!
		createdAt: DateTime!
		"The coupon that was redeemed."
		couponId: ID!
		"The code as presented."
		code: String!
		"The discount the redemption granted. Exact decimal."
		amount: Decimal!
		"The currency of the discount."
		currency: String!
		"The order the redemption was registered against, when it has one yet."
		orderId: ID
		"The organization the coupon belongs to."
		organizationId: ID!
	}

	"""
	Stored value was spent.

	The balance after the movement travels with the event, because the consumer that reacts to a
	redemption — a notification, a balance display — needs the figure the customer will see next, and
	reading it separately would race with the next movement on the same card.
	"""
	type GiftCardRedeemedPayload {
		id: ID!
		createdAt: DateTime!
		"The card that was debited."
		giftCardId: ID!
		"The amount taken off the card. Exact decimal."
		amount: Decimal!
		"The balance the card holds afterwards. Exact decimal."
		balanceAfter: Decimal!
		"The order the value settled."
		orderId: ID
		"The organization the card belongs to."
		organizationId: ID!
	}

	# ------------------------------------------------------------------------------------------------
	# The root fields.
	# ------------------------------------------------------------------------------------------------

	extend type Query {
		"One page of the promotions of the caller's organization, most specific first."
		promotions(filter: PromotionFilter, sort: PromotionSort, page: PageInput, limit: Int, offset: Int, withDeleted: Boolean): PromotionConnection!
		"One promotion by id."
		promotion(id: ID!): Promotion
		"""
		Whether a code may be used, and why not when it may not. Nothing is consumed.

		\`cartId\` is the basket the code would be applied to; it is carried so a GraphQL caller sends
		the same request the REST route takes, and the answer is computed from the coupon's own window
		and limits.
		"""
		validateCoupon(code: String!, cartId: ID, customerId: ID): CouponValidationPayload!
		"One page of campaigns."
		campaigns(filter: CampaignFilter, sort: CampaignSort, page: PageInput, limit: Int, offset: Int, withDeleted: Boolean): CampaignConnection!
		"One campaign by id."
		campaign(id: ID!): Campaign
		"One page of campaign ceilings, with the per-value consumption of a split one."
		campaignBudgets(
			filter: CampaignBudgetFilter
			sort: CampaignBudgetSort
			page: PageInput
			limit: Int
			offset: Int
			withDeleted: Boolean
		): CampaignBudgetConnection!
		"One page of coupons."
		coupons(filter: CouponFilter, sort: CouponSort, page: PageInput, limit: Int, offset: Int, withDeleted: Boolean): CouponConnection!
		"One coupon by id."
		coupon(id: ID!): Coupon
		"One page of the redemption ledger, most recent first."
		promotionUsages(
			filter: PromotionUsageFilter
			sort: PromotionUsageSort
			page: PageInput
			limit: Int
			offset: Int
			withDeleted: Boolean
		): PromotionUsageConnection!
		"One page of gift cards."
		giftCards(filter: GiftCardFilter, sort: GiftCardSort, page: PageInput, limit: Int, offset: Int, withDeleted: Boolean): GiftCardConnection!
		"One gift card by id."
		giftCard(id: ID!): GiftCard
		" The balance of a card, read from its code and answered from its ledger."
		giftCardBalance(code: String!, pin: String): GiftCardBalancePayload!
	}

	extend type Mutation {
		"Creates a promotion in draft."
		createPromotion(input: CreatePromotionInput!): CreatePromotionPayload!
		"Changes a promotion. The status is moved by the activation and expiry mutations."
		updatePromotion(id: ID!, input: UpdatePromotionInput!): UpdatePromotionPayload!
		"Deletes a promotion."
		deletePromotion(id: ID!): DeletePromotionPayload!
		"Starts a promotion, so its rules may match."
		activatePromotion(id: ID!): ActivatePromotionPayload!
		"""
		Stops a promotion, so its rules no longer match anything.

		Deactivation and expiry are separate acts, not one field with a status argument: a promotion an
		operator pulled is \`INACTIVE\` and can be started again, while one whose window closed is
		\`EXPIRED\`.
		"""
		deactivatePromotion(id: ID!, input: DeactivatePromotionInput): DeactivatePromotionPayload!
		"Replaces the whole action set of a promotion, rather than merging into it."
		replacePromotionActions(id: ID!, input: ReplacePromotionActionsInput!): ReplacePromotionActionsPayload!
		"""
		Dry-runs one promotion against a basket, writing nothing.

		The evaluation the checkout runs, restricted to the promotion named, so "why did this offer not
		fire" is answerable before it is published.
		"""
		simulatePromotion(id: ID!, input: PromotionSimulationInput!): SimulatePromotionPayload!
		"Retires a promotion recoverably: its counters and its redemption ledger are kept."
		softDeletePromotion(id: ID!): SoftDeletePromotionPayload!
		"Restores a soft-deleted promotion."
		recoverPromotion(id: ID!): RecoverPromotionPayload!
		"Retires one action of a promotion recoverably, keeping its place in the application order."
		softDeletePromotionAction(id: ID!): SoftDeletePromotionActionPayload!
		"Restores a soft-deleted action of a promotion."
		recoverPromotionAction(id: ID!): RecoverPromotionActionPayload!
		"Retires one application of a promotion recoverably, keeping the counters it was counted in."
		softDeletePromotionUsage(id: ID!): SoftDeletePromotionUsagePayload!
		"Restores a soft-deleted application of a promotion."
		recoverPromotionUsage(id: ID!): RecoverPromotionUsagePayload!
		"Closes a promotion before its window ends."
		expirePromotion(id: ID!, input: ExpirePromotionInput): ExpirePromotionPayload!
		"Creates a campaign."
		createCampaign(input: CreateCampaignInput!): CreateCampaignPayload!
		"Changes a campaign."
		updateCampaign(id: ID!, input: UpdateCampaignInput!): UpdateCampaignPayload!
		"Deletes a campaign."
		deleteCampaign(id: ID!): DeleteCampaignPayload!
		"Retires a campaign recoverably, so the promotions that name it keep their window."
		softDeleteCampaign(id: ID!): SoftDeleteCampaignPayload!
		"Restores a soft-deleted campaign."
		recoverCampaign(id: ID!): RecoverCampaignPayload!
		"Sets or replaces the single budget of a campaign."
		updateCampaignBudget(campaignId: ID!, input: UpdateCampaignBudgetInput!): UpdateCampaignBudgetPayload!
		"""
		Resets the consumption of a campaign's ceiling, re-opening a budget that has been spent.

		It is the one act that makes a ceiling forget what it paid out, which is why it is a field of its
		own rather than a member of \`updateCampaignBudget\`: moving a ceiling leaves the consumption
		recorded against it alone, and an operator has to be able to tell the two acts apart.
		"""
		resetCampaignBudget(campaignId: ID!, input: ResetCampaignBudgetInput): ResetCampaignBudgetPayload!
		"Retires a campaign's ceiling recoverably, so the spend behind it stays attributable."
		softDeleteCampaignBudget(id: ID!): SoftDeleteCampaignBudgetPayload!
		"Restores a soft-deleted campaign ceiling."
		recoverCampaignBudget(id: ID!): RecoverCampaignBudgetPayload!
		"Retires one per-value consumption row recoverably, without giving its value back."
		softDeleteCampaignBudgetUsage(id: ID!): SoftDeleteCampaignBudgetUsagePayload!
		"Restores a soft-deleted per-value consumption row."
		recoverCampaignBudgetUsage(id: ID!): RecoverCampaignBudgetUsagePayload!
		"Creates one coupon."
		createCoupon(input: CreateCouponInput!): CreateCouponPayload!
		"""
		Mints a batch of codes that share one promotion, one window and one set of limits.

		The batch is all-or-nothing, because a mailing that quietly comes back a thousand codes short is
		worse than a request that fails and is retried: the service refuses a shortfall rather than
		reporting one, and a refusal reaches the caller as a \`userError\` on this payload.
		"""
		createCouponBatch(input: CreateCouponBatchInput!): CreateCouponBatchPayload!
		"Changes a coupon's promotion, window or limits."
		updateCoupon(id: ID!, input: UpdateCouponInput!): UpdateCouponPayload!
		"Deletes a coupon."
		deleteCoupon(id: ID!): DeleteCouponPayload!
		"Retires a coupon recoverably, so the redemptions it granted stay explainable."
		softDeleteCoupon(id: ID!): SoftDeleteCouponPayload!
		"Restores a soft-deleted coupon."
		recoverCoupon(id: ID!): RecoverCouponPayload!
		"Issues a gift card, crediting its face value as the ledger's first row."
		issueGiftCard(input: IssueGiftCardInput!): IssueGiftCardPayload!
		"Spends part of a card's balance against an order."
		redeemGiftCard(id: ID!, input: RedeemGiftCardInput!): RedeemGiftCardPayload!
		"""
		Returns value to a card, on a refund that was paid back onto it.

		The amount returned is the smaller of what was asked for and what the card paid out and has not
		already been given back, so a card can never be refunded more than it was spent from. The payload
		carries the figure actually applied rather than the one requested, because the two differ whenever
		the request exceeds what is returnable.
		"""
		refundGiftCard(id: ID!, input: RefundGiftCardInput!): RefundGiftCardPayload!
		"""
		Corrects a card's balance by hand, in either direction.

		A correction is this field and never an edit of a ledger row, which is what keeps the chain of
		balances a card is explained by replayable. The note is required: the movement written here is the
		only place the correction is ever explained, and an adjustment without a reason is
		indistinguishable from a defect.
		"""
		adjustGiftCard(id: ID!, input: AdjustGiftCardInput!): AdjustGiftCardPayload!
		"Withdraws a card from circulation, keeping its ledger."
		voidGiftCard(id: ID!, input: VoidGiftCardInput): VoidGiftCardPayload!
		"""
		Changes what a card says about itself: its code, its placement, its status and its window.

		The ledger is not editable through this field. \`initialAmount\` is the base the balance is derived
		from, \`balance\` is the materialised cache of that derivation whose correction is \`adjustGiftCard\`,
		and \`pin\` is the second factor — none of the three is on the input, because none of the three is
		an act the card's own rules offer.
		"""
		updateGiftCard(id: ID!, input: UpdateGiftCardInput!): UpdateGiftCardPayload!
		"Retires a card recoverably; its ledger and its balance are kept."
		softDeleteGiftCard(id: ID!): SoftDeleteGiftCardPayload!
		"Restores a soft-deleted gift card."
		recoverGiftCard(id: ID!): RecoverGiftCardPayload!
		"Retires one gift-card movement recoverably, so a correction can be undone."
		softDeleteGiftCardTransaction(id: ID!): SoftDeleteGiftCardTransactionPayload!
		"Restores a soft-deleted gift-card movement."
		recoverGiftCardTransaction(id: ID!): RecoverGiftCardTransactionPayload!
	}

	extend type Subscription {
		"""
		A promotion was created, activated or expired.

		The stream is the promotion domain's own event stream, so a subscriber sees exactly the facts
		the domain already publishes for its outbox rather than a second, transport-shaped copy of
		them. \`promotionId\` narrows the stream to one promotion; it can only narrow what the caller is
		already allowed to read.
		"""
		promotionChanged(promotionId: ID): PromotionChangedPayload!
		"""
		A campaign budget reached its ceiling and its promotions stopped being applied.
		"""
		promotionBudgetExhausted(promotionId: ID, budgetId: ID): PromotionBudgetExhaustedPayload!
		"""
		A code was redeemed, whether by a basket being checked out or by an order being placed.
		"""
		couponRedeemed(couponId: ID): CouponRedeemedPayload!
		"""
		Stored value was spent with a card.
		"""
		giftCardRedeemed(giftCardId: ID): GiftCardRedeemedPayload!
	}
`;
