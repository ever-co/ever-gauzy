import { gql } from 'graphql-tag';

/**
 * The GraphQL surface of the subscription domain.
 *
 * Types, inputs, enums and the domain's root fields, declared as one document that is composed into
 * the platform schema at boot. The root operation types belong to the kernel, so this file only
 * extends them — a second declaration of `type Query`, `type Mutation` or `type Subscription` would
 * be a duplicate definition and would fail the schema build.
 *
 * The subscription aggregate's object type is named `CustomerSubscription` for exactly that reason:
 * `Subscription` is the kernel's root operation type for the platform event stream, and a domain
 * never redeclares a root type. The root *fields* keep the domain's own vocabulary —
 * `subscription`, `subscriptions` — so a client reads the concept by the name the domain gives it.
 *
 * Money and quantities are `Decimal`, never `Float`: an amount read here and the same amount read
 * over REST are the same string, and a binary fraction cannot hold a cent exactly.
 *
 * **A mutation that writes a subscription states the version it read, and a mutation that mirrors a
 * retry-safe route declares `idempotencyKey`.** A GraphQL operation always travels over `POST`, so
 * neither a precondition header nor a retry key could say which root field it belongs to: both ride
 * beside the input they qualify, as the nullable `version` and `idempotencyKey` members below, which
 * are siblings of the input where a mutation takes no input object. The requirement to present either
 * is not restated in the schema — the kernel refuses a mutation that must be retried safely without a
 * key with `IDEMPOTENCY_KEY_REQUIRED`, and refuses a write that states a version that has moved on
 * with `ENTITY_VERSION_CONFLICT`, which are the same codes and the same statuses the mirrored routes
 * answer with. Declaring them non-null here would be a second place for them to drift out of step.
 */
export const schemaExtensions = gql`
	"How often a plan bills; the interval multiplies the period."
	enum SubscriptionBillingPeriod {
		DAILY
		WEEKLY
		MONTHLY
		QUARTERLY
		YEARLY
	}

	"Where a subscription stands."
	enum SubscriptionStatus {
		PENDING
		ACTIVE
		PAUSED
		CANCELED
		EXPIRED
		FAILED
	}

	"Where one billing cycle stands."
	enum SubscriptionBillingStatus {
		PENDING
		INVOICED
		PAID
		FAILED
		REFUNDED
		WAIVED
	}

	"How a mid-cycle change settled the difference it produced."
	enum SubscriptionSettlement {
		"Charged now, through the ordinary order path."
		CHARGED
		"Carried as a credit against the next cycle."
		DEFERRED
		"Smaller than the cost of collecting it, so forgiven."
		WAIVED
		"Scheduled to apply from the next period; no money moved."
		SCHEDULED
	}

	"What can be subscribed to, and on what terms."
	type SubscriptionPlan {
		id: ID!
		name: String!
		"The tenant's own key for the plan, unique inside the organization."
		code: String!
		description: String
		"Plan attached to a whole product, when it is."
		productId: ID
		"Plan attached to one variant, when it is."
		variantId: ID
		billingPeriod: SubscriptionBillingPeriod!
		"How many periods pass between two billings."
		billingInterval: Int!
		"Cycles after which a subscription expires; null means it runs until cancelled."
		maxBillingCycles: Int
		"Days the first period is free for."
		trialDays: Int
		"Charged once, with the first paid cycle."
		setupFee: Decimal
		"Recurring discount as a fraction: 0.1 is ten per cent."
		discountPercentage: Decimal
		currency: String!
		"Whether a new subscription may be created from this plan."
		isActive: Boolean
		metadata: JSON
		createdAt: DateTime
		updatedAt: DateTime
	}

	"A running agreement with a customer."
	type CustomerSubscription {
		id: ID!
		planId: ID!
		plan: SubscriptionPlan
		customerId: ID!
		"The order that started the subscription, when there was one."
		originOrderId: ID
		"The account at the provider renewals are charged against, when one is remembered."
		paymentAccountHolderId: ID
		"The instrument renewals are charged against, when one is remembered."
		paymentMethodTokenId: ID
		status: SubscriptionStatus!
		quantity: Decimal!
		currentPeriodStart: DateTime
		currentPeriodEnd: DateTime
		"The due-billing scan key: set while the subscription bills."
		nextBillingAt: DateTime
		"Cycles billed so far."
		billingCycleCount: Int!
		"Resume instant for a paused subscription; null means the pause is indefinite."
		pausedUntil: DateTime
		canceledAt: DateTime
		cancelReason: String
		currency: String!
		metadata: JSON
		"Optimistic lock: the value a caller states back on the mutation that writes this subscription."
		version: Int!
		"The recurring lines each cycle bills."
		items: [SubscriptionItem!]!
		"Every cycle that was billed, or attempted."
		billings: [SubscriptionBilling!]!
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One recurring line of a subscription."
	type SubscriptionItem {
		id: ID!
		subscriptionId: ID!
		variantId: ID!
		quantity: Decimal!
		"Recurring unit price, snapshotted when the line was written or last repriced."
		unitPrice: Decimal!
		position: Int!
		metadata: JSON
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One billing cycle's attempt and result."
	type SubscriptionBilling {
		id: ID!
		subscriptionId: ID!
		"The order this cycle produced, once it has one."
		orderId: ID
		periodStart: DateTime!
		periodEnd: DateTime!
		"The recurring amount for the period, less the plan discount."
		amount: Decimal!
		currency: String!
		status: SubscriptionBillingStatus!
		"When the cycle became payable."
		dueAt: DateTime
		"When the payment settled; set exactly when the cycle is paid."
		paidAt: DateTime
		"How many attempts the cycle has used."
		attemptCount: Int!
		"Why the last attempt failed."
		lastError: String
		"When the next dunning attempt is owed."
		nextRetryAt: DateTime
		metadata: JSON
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One page of subscription plans."
	type SubscriptionPlanConnection {
		edges: [SubscriptionPlanEdge!]!
		nodes: [SubscriptionPlan!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One plan inside a page."
	type SubscriptionPlanEdge {
		cursor: String!
		node: SubscriptionPlan!
	}

	"One page of subscriptions."
	type CustomerSubscriptionConnection {
		edges: [CustomerSubscriptionEdge!]!
		nodes: [CustomerSubscription!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One subscription inside a page."
	type CustomerSubscriptionEdge {
		cursor: String!
		node: CustomerSubscription!
	}

	"One page of recurring lines."
	type SubscriptionItemConnection {
		edges: [SubscriptionItemEdge!]!
		nodes: [SubscriptionItem!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One recurring line inside a page."
	type SubscriptionItemEdge {
		cursor: String!
		node: SubscriptionItem!
	}

	"One page of billing cycles."
	type SubscriptionBillingConnection {
		edges: [SubscriptionBillingEdge!]!
		nodes: [SubscriptionBilling!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One billing cycle inside a page."
	type SubscriptionBillingEdge {
		cursor: String!
		node: SubscriptionBilling!
	}

	"Filters a page of plans."
	input SubscriptionPlanFilter {
		code: String
		isActive: Boolean
		billingPeriod: SubscriptionBillingPeriod
		productId: ID
		variantId: ID
	}

	"Filters a page of subscriptions."
	input SubscriptionFilter {
		status: SubscriptionStatus
		planId: ID
		customerId: ID
		originOrderId: ID
		currency: String
	}

	"Filters a page of recurring lines."
	input SubscriptionItemFilter {
		subscriptionId: ID
		variantId: ID
	}

	"Filters a page of billing cycles."
	input SubscriptionBillingFilter {
		status: SubscriptionBillingStatus
		subscriptionId: ID
		orderId: ID
	}

	"The plan as it is created."
	input CreateSubscriptionPlanInput {
		name: String!
		code: String!
		currency: String!
		description: String
		productId: ID
		variantId: ID
		billingPeriod: SubscriptionBillingPeriod
		billingInterval: Int
		maxBillingCycles: Int
		trialDays: Int
		setupFee: Decimal
		discountPercentage: Decimal
		metadata: JSON
	}

	"The plan as it is updated."
	input UpdateSubscriptionPlanInput {
		name: String
		code: String
		description: String
		productId: ID
		variantId: ID
		billingPeriod: SubscriptionBillingPeriod
		billingInterval: Int
		maxBillingCycles: Int
		trialDays: Int
		setupFee: Decimal
		discountPercentage: Decimal
		isActive: Boolean
		metadata: JSON
	}

	"One recurring line as it is stated."
	input SubscriptionItemInput {
		variantId: ID!
		quantity: Decimal
		"Omitted means the price is resolved through the ordinary pricing pipeline."
		unitPrice: Decimal
		position: Int
	}

	"The request that puts a customer on a plan."
	input CreateSubscriptionInput {
		planId: ID!
		customerId: ID!
		originOrderId: ID
		quantity: Decimal
		currency: String
		items: [SubscriptionItemInput!]
		paymentAccountHolderId: ID
		paymentMethodTokenId: ID
		"Bill the first period as part of creation."
		activate: Boolean
		"Leave the subscription inside the plan's trial."
		startTrial: Boolean
		discountPercentage: Decimal
		metadata: JSON
		idempotencyKey: String
	}

	"The fields a subscription's caller may move."
	input UpdateSubscriptionInput {
		paymentAccountHolderId: ID
		paymentMethodTokenId: ID
		quantity: Decimal
		metadata: JSON
		"The version the caller read the subscription at."
		version: Int
		idempotencyKey: String
	}

	"The request that moves a subscription to another plan."
	input ChangeSubscriptionPlanInput {
		planId: ID!
		quantity: Decimal
		effective: String
		note: String
		"The version the caller read the subscription at."
		version: Int
		idempotencyKey: String
	}

	"The request that suspends billing."
	input PauseSubscriptionInput {
		until: DateTime
		reason: String
		"The version the caller read the subscription at."
		version: Int
		idempotencyKey: String
	}

	"The request that ends a subscription."
	input CancelSubscriptionInput {
		reason: String
		"True stops billing now; false lets the paid period run out."
		immediate: Boolean
		"The version the caller read the subscription at."
		version: Int
		idempotencyKey: String
	}

	"The request that ends a subscription because it ran out."
	input ExpireSubscriptionInput {
		reason: String
		"The version the caller read the subscription at."
		version: Int
		idempotencyKey: String
	}

	"The request that bills one cycle of one subscription."
	input BillSubscriptionInput {
		asOf: DateTime
		"The version the caller read the subscription at."
		version: Int
		idempotencyKey: String
	}

	"The request that runs a billing pass."
	input RunSubscriptionBillingInput {
		subscriptionId: ID
		limit: Int
		asOf: DateTime
	}

	"One recurring line as it is added."
	input CreateSubscriptionItemInput {
		subscriptionId: ID!
		variantId: ID!
		quantity: Decimal
		unitPrice: Decimal
		position: Int
	}

	"One recurring line as it is corrected."
	input UpdateSubscriptionItemInput {
		quantity: Decimal
		unitPrice: Decimal
		position: Int
		metadata: JSON
	}

	"A billing cycle as it is opened by hand."
	input CreateSubscriptionBillingInput {
		subscriptionId: ID!
		periodStart: DateTime!
		periodEnd: DateTime!
		amount: Decimal!
		currency: String!
		dueAt: DateTime
	}

	"A billing cycle as it is corrected."
	input UpdateSubscriptionBillingInput {
		amount: Decimal
		dueAt: DateTime
		metadata: JSON
	}

	"The request that records a cycle's payment."
	input PaySubscriptionBillingInput {
		paidAt: DateTime
		note: String
	}

	"The request that deliberately does not charge a cycle."
	input WaiveSubscriptionBillingInput {
		reason: String!
	}

	"The outcome of a mutation on a plan."
	type SubscriptionPlanPayload {
		subscriptionPlan: SubscriptionPlan
		userErrors: [UserError!]!
	}

	"The outcome of deactivating a plan."
	type DeleteSubscriptionPlanPayload {
		id: ID
		userErrors: [UserError!]!
	}

	"The outcome of a mutation on a subscription."
	type CustomerSubscriptionPayload {
		subscription: CustomerSubscription
		userErrors: [UserError!]!
	}

	"The outcome of a mutation on a recurring line."
	type SubscriptionItemPayload {
		subscriptionItem: SubscriptionItem
		userErrors: [UserError!]!
	}

	"The outcome of removing a recurring line."
	type DeleteSubscriptionItemPayload {
		id: ID
		userErrors: [UserError!]!
	}

	"The outcome of a mutation on a billing cycle."
	type SubscriptionBillingPayload {
		subscriptionBilling: SubscriptionBilling
		userErrors: [UserError!]!
	}

	"What a mid-cycle change decided and what it settled."
	type SubscriptionPlanChangePayload {
		subscription: CustomerSubscription
		"What the old plan's unused time was worth."
		credit: Decimal!
		"What the new plan costs for the same remaining time."
		charge: Decimal!
		"charge minus credit: positive is owed by the customer."
		net: Decimal!
		settlement: SubscriptionSettlement!
		currency: String!
		userErrors: [UserError!]!
	}

	"What one billing cycle did."
	type SubscriptionBillingOutcomePayload {
		subscriptionId: ID!
		billingId: ID
		status: SubscriptionBillingStatus!
		"True when the cycle was already settled and nothing was charged a second time."
		replayed: Boolean!
		orderId: ID
		amount: Decimal
		currency: String
		periodStart: DateTime
		periodEnd: DateTime
		nextRetryAt: DateTime
		"A platform code explaining a failure."
		errorCode: String
		message: String
		userErrors: [UserError!]!
	}

	"What one billing pass did."
	type SubscriptionBillingRunPayload {
		examined: Int!
		billed: Int!
		failed: Int!
		skipped: Int!
		results: [SubscriptionBillingOutcomePayload!]!
		userErrors: [UserError!]!
	}

	extend type Query {
		"Subscription plans of the caller's organization."
		subscriptionPlans(filter: SubscriptionPlanFilter, page: PageInput, withDeleted: Boolean): SubscriptionPlanConnection!
		"One plan."
		subscriptionPlan(id: ID!): SubscriptionPlan
		"A plan by the code the organization knows it by."
		subscriptionPlanByCode(code: String!): SubscriptionPlan
		"Subscriptions of the caller's organization."
		subscriptions(filter: SubscriptionFilter, page: PageInput, withDeleted: Boolean): CustomerSubscriptionConnection!
		"One subscription, with its lines and its billing history."
		subscription(id: ID!): CustomerSubscription
		"The recurring lines of a subscription."
		subscriptionItems(filter: SubscriptionItemFilter, page: PageInput, withDeleted: Boolean): SubscriptionItemConnection!
		"One recurring line."
		subscriptionItem(id: ID!): SubscriptionItem
		"Billing cycles of the caller's organization."
		subscriptionBillings(filter: SubscriptionBillingFilter, page: PageInput, withDeleted: Boolean): SubscriptionBillingConnection!
		"One billing cycle."
		subscriptionBilling(id: ID!): SubscriptionBilling
	}

	extend type Mutation {
		"Creates a plan."
		createSubscriptionPlan(input: CreateSubscriptionPlanInput!): SubscriptionPlanPayload!
		"Updates a plan."
		updateSubscriptionPlan(id: ID!, input: UpdateSubscriptionPlanInput!): SubscriptionPlanPayload!
		"Deactivates a plan, refusing while it still has live subscriptions."
		deleteSubscriptionPlan(id: ID!): DeleteSubscriptionPlanPayload!
		"Puts a customer on a plan."
		createSubscription(input: CreateSubscriptionInput!): CustomerSubscriptionPayload!
		"Moves a subscription's payer, quantity or metadata."
		updateSubscription(id: ID!, input: UpdateSubscriptionInput!): CustomerSubscriptionPayload!
		"Starts billing a pending subscription."
		activateSubscription(id: ID!, version: Int, idempotencyKey: String): CustomerSubscriptionPayload!
		"Suspends billing."
		pauseSubscription(id: ID!, input: PauseSubscriptionInput): CustomerSubscriptionPayload!
		"Resumes a paused subscription."
		resumeSubscription(id: ID!, version: Int, idempotencyKey: String): CustomerSubscriptionPayload!
		"Ends a subscription."
		cancelSubscription(id: ID!, input: CancelSubscriptionInput): CustomerSubscriptionPayload!
		"Ends a subscription because it ran out."
		expireSubscription(id: ID!, input: ExpireSubscriptionInput): CustomerSubscriptionPayload!
		"Moves a subscription to another plan, settling the remainder of the current period."
		changeSubscriptionPlan(id: ID!, input: ChangeSubscriptionPlanInput!): SubscriptionPlanChangePayload!
		"Adds a recurring line mid-cycle, settling the remainder of the period."
		addSubscriptionItem(
			id: ID!
			input: SubscriptionItemInput!
			version: Int
			idempotencyKey: String
		): SubscriptionPlanChangePayload!
		"Changes a recurring line's quantity mid-cycle, settling the remainder of the period."
		changeSubscriptionItemQuantity(
			id: ID!
			variantId: ID!
			quantity: Decimal!
			version: Int
			idempotencyKey: String
		): SubscriptionPlanChangePayload!
		"Removes a recurring line mid-cycle, settling the remainder of the period."
		removeSubscriptionItem(id: ID!, variantId: ID!): SubscriptionPlanChangePayload!
		"Adds a recurring line without settling a proration."
		createSubscriptionItem(input: CreateSubscriptionItemInput!): SubscriptionItemPayload!
		"Corrects a recurring line's quantity or price."
		updateSubscriptionItem(id: ID!, input: UpdateSubscriptionItemInput!): SubscriptionItemPayload!
		"Removes a recurring line without settling a proration."
		deleteSubscriptionItem(id: ID!): DeleteSubscriptionItemPayload!
		"Opens a billing cycle by hand, for a backfill."
		createSubscriptionBilling(input: CreateSubscriptionBillingInput!): SubscriptionBillingPayload!
		"Corrects a billing cycle that has not been charged."
		updateSubscriptionBilling(id: ID!, input: UpdateSubscriptionBillingInput!): SubscriptionBillingPayload!
		"Bills one cycle of one subscription."
		billSubscription(id: ID!, input: BillSubscriptionInput): SubscriptionBillingOutcomePayload!
		"Runs a billing pass over every due subscription."
		runSubscriptionBilling(input: RunSubscriptionBillingInput): SubscriptionBillingRunPayload!
		"Records that a cycle's money arrived."
		paySubscriptionBilling(id: ID!, input: PaySubscriptionBillingInput): SubscriptionBillingPayload!
		"Records that a cycle was deliberately not charged."
		waiveSubscriptionBilling(id: ID!, input: WaiveSubscriptionBillingInput!): SubscriptionBillingPayload!
		"Records that a paid cycle was refunded."
		refundSubscriptionBilling(id: ID!): SubscriptionBillingPayload!
	}
`;
