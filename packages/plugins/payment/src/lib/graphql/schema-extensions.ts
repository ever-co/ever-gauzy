import { gql } from 'graphql-tag';

/**
 * The payment plugin's contribution to the platform schema.
 *
 * Three conventions shape what follows. **The type names are the concepts' own names** and every
 * field name matches the entity property it is read from, so a REST caller and a GraphQL caller read
 * the same vocabulary and one never has to be translated into the other. **Money is `Decimal`**, a
 * string with six fractional digits, never `Float`: the same value read over GraphQL and over REST is
 * string-identical, which is the whole reason a `numeric(20,6)` column is stored as one. And **every
 * mutation answers with a payload** carrying the resource, the durable operation when the mutation
 * started one, and `userErrors` — so a business rejection ("this refund exceeds what was captured")
 * is a successful operation with something to report rather than a transport error.
 *
 * The kernel already declares `PageInfo`, `PageInput`, `SortDirection`, `UserError`, `Operation` and
 * the `Decimal`, `DateTime` and `JSON` scalars, so nothing of that is redeclared here; two packages
 * contributing one type name is a boot failure by design.
 *
 * **No input type declares a card member.** There is no `number`, `pan`, `cvc`, `cvv`, `iban`,
 * `accountNumber` or free-text `expiry` anywhere below, and none may be added: the platform stores a
 * provider-issued token and holds no primary account number, verification value or bank account
 * number. A caller that supplies one is refused with `PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED`, which
 * is the same answer REST gives for the same attempt.
 *
 * `clientSecret` is deliberately absent from `PaymentSession`: it is a bearer value the caller's own
 * client-side flow uses for the duration of one payment, it is null on an off-session attempt, and it
 * is never part of a projection an authenticated caller reads back.
 */
export const schemaExtensions = gql`
	enum PaymentCollectionStatus {
		NOT_PAID
		AWAITING
		AUTHORIZED
		PARTIALLY_AUTHORIZED
		PARTIALLY_CAPTURED
		COMPLETED
		CANCELED
		FAILED
	}

	enum PaymentSessionStatus {
		PENDING
		PENDING_AUTHORIZATION
		REQUIRES_MORE
		AUTHORIZED
		CAPTURED
		CANCELED
		ERROR
		EXPIRED
	}

	enum RefundStatus {
		PENDING
		SUCCEEDED
		FAILED
		CANCELED
	}

	enum PaymentWebhookEventStatus {
		RECEIVED
		PROCESSED
		FAILED
		IGNORED
	}

	enum PaymentCaptureMode {
		MANUAL
		AUTOMATIC
	}

	enum PaymentProviderSortField {
		CODE
		NAME
		SORT_ORDER
		CREATED_AT
		UPDATED_AT
	}

	enum PaymentCollectionSortField {
		AMOUNT
		STATUS
		CAPTURED_AT
		CREATED_AT
		UPDATED_AT
	}

	enum PaymentSessionSortField {
		AMOUNT
		STATUS
		EXPIRES_AT
		AUTHORIZED_AT
		CREATED_AT
		UPDATED_AT
	}

	enum PaymentCaptureSortField {
		AMOUNT
		CAPTURED_AT
		CREATED_AT
		UPDATED_AT
	}

	enum RefundSortField {
		AMOUNT
		STATUS
		REFUNDED_AT
		CREATED_AT
		UPDATED_AT
	}

	enum RefundReasonSortField {
		CODE
		LABEL
		CREATED_AT
		UPDATED_AT
	}

	enum PaymentWebhookEventSortField {
		TYPE
		STATUS
		RECEIVED_AT
		PROCESSED_AT
		CREATED_AT
		UPDATED_AT
	}

	type PaymentProvider {
		id: ID!
		code: String!
		name: String!
		isEnabled: Boolean!
		isTestMode: Boolean!
		integrationId: ID
		supportedCurrencies: [String!]
		supportedCountries: [String!]
		supportedPaymentMethods: [String!]
		sortOrder: Int!
		configuration: JSON
		metadata: JSON
		isActive: Boolean
		isArchived: Boolean
		archivedAt: DateTime
		tenantId: ID
		organizationId: ID
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	type PaymentCollection {
		id: ID!
		orderId: ID
		cartId: ID
		amount: Decimal!
		currency: String!
		status: PaymentCollectionStatus!
		authorizedAmount: Decimal!
		capturedAmount: Decimal!
		refundedAmount: Decimal!
		canceledAmount: Decimal!
		settlementCurrency: String
		settlementAmount: Decimal
		fxRate: Decimal
		fxRateId: ID
		fxCapturedAt: DateTime
		completedAt: DateTime
		metadata: JSON
		sessions: [PaymentSession!]
		isActive: Boolean
		isArchived: Boolean
		archivedAt: DateTime
		tenantId: ID
		organizationId: ID
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	type PaymentSession {
		id: ID!
		collectionId: ID!
		providerId: ID!
		status: PaymentSessionStatus!
		amount: Decimal!
		currency: String!
		externalId: String
		paymentMethodTokenId: ID
		data: JSON
		idempotencyKey: String
		expiresAt: DateTime
		authorizedAt: DateTime
		metadata: JSON
		collection: PaymentCollection
		provider: PaymentProvider
		isActive: Boolean
		isArchived: Boolean
		archivedAt: DateTime
		tenantId: ID
		organizationId: ID
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	type PaymentCapture {
		id: ID!
		paymentId: ID!
		amount: Decimal!
		currency: String!
		externalId: String
		capturedAt: DateTime!
		metadata: JSON
		isActive: Boolean
		isArchived: Boolean
		archivedAt: DateTime
		tenantId: ID
		organizationId: ID
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	type Refund {
		id: ID!
		orderId: ID!
		paymentId: ID
		returnId: ID
		claimId: ID
		amount: Decimal!
		currency: String!
		reasonId: ID
		reason: String
		status: RefundStatus!
		externalId: String
		refundedAt: DateTime
		note: String
		metadata: JSON
		refundReason: RefundReason
		isActive: Boolean
		isArchived: Boolean
		archivedAt: DateTime
		tenantId: ID
		organizationId: ID
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	type RefundReason {
		id: ID!
		code: String!
		label: String!
		description: String
		parentId: ID
		parent: RefundReason
		children: [RefundReason!]
		isActive: Boolean
		isArchived: Boolean
		archivedAt: DateTime
		tenantId: ID
		organizationId: ID
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	type PaymentWebhookEvent {
		id: ID!
		providerId: ID!
		eventId: String!
		type: String!
		payload: JSON!
		signature: String
		receivedAt: DateTime!
		processedAt: DateTime
		status: PaymentWebhookEventStatus!
		lastError: String
		attemptCount: Int!
		provider: PaymentProvider
		isActive: Boolean
		isArchived: Boolean
		archivedAt: DateTime
		tenantId: ID
		organizationId: ID
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	type PaymentProviderEdge {
		cursor: String!
		node: PaymentProvider!
	}

	type PaymentCollectionEdge {
		cursor: String!
		node: PaymentCollection!
	}

	type PaymentSessionEdge {
		cursor: String!
		node: PaymentSession!
	}

	type PaymentCaptureEdge {
		cursor: String!
		node: PaymentCapture!
	}

	type RefundEdge {
		cursor: String!
		node: Refund!
	}

	type RefundReasonEdge {
		cursor: String!
		node: RefundReason!
	}

	type PaymentWebhookEventEdge {
		cursor: String!
		node: PaymentWebhookEvent!
	}

	type PaymentProviderConnection {
		items: [PaymentProvider!]!
		edges: [PaymentProviderEdge!]
		total: Int!
		pageInfo: PageInfo
	}

	type PaymentCollectionConnection {
		items: [PaymentCollection!]!
		edges: [PaymentCollectionEdge!]
		total: Int!
		pageInfo: PageInfo
	}

	type PaymentSessionConnection {
		items: [PaymentSession!]!
		edges: [PaymentSessionEdge!]
		total: Int!
		pageInfo: PageInfo
	}

	type PaymentCaptureConnection {
		items: [PaymentCapture!]!
		edges: [PaymentCaptureEdge!]
		total: Int!
		pageInfo: PageInfo
	}

	type RefundConnection {
		items: [Refund!]!
		edges: [RefundEdge!]
		total: Int!
		pageInfo: PageInfo
	}

	type RefundReasonConnection {
		items: [RefundReason!]!
		edges: [RefundReasonEdge!]
		total: Int!
		pageInfo: PageInfo
	}

	type PaymentWebhookEventConnection {
		items: [PaymentWebhookEvent!]!
		edges: [PaymentWebhookEventEdge!]
		total: Int!
		pageInfo: PageInfo
	}

	input PaymentProviderFilter {
		id: ID
		code: String
		isEnabled: Boolean
		isTestMode: Boolean
		integrationId: ID
	}

	input PaymentCollectionFilter {
		id: ID
		orderId: ID
		cartId: ID
		status: PaymentCollectionStatus
		currency: String
	}

	input PaymentSessionFilter {
		id: ID
		collectionId: ID
		providerId: ID
		status: PaymentSessionStatus
		externalId: String
		paymentMethodTokenId: ID
	}

	input PaymentCaptureFilter {
		id: ID
		paymentId: ID
		externalId: String
		capturedAtFrom: DateTime
		capturedAtTo: DateTime
	}

	input RefundFilter {
		id: ID
		orderId: ID
		paymentId: ID
		returnId: ID
		claimId: ID
		reasonId: ID
		status: RefundStatus
	}

	input RefundReasonFilter {
		id: ID
		code: String
		parentId: ID
		isActive: Boolean
	}

	input PaymentWebhookEventFilter {
		id: ID
		providerId: ID
		eventId: String
		type: String
		status: PaymentWebhookEventStatus
		receivedAtFrom: DateTime
		receivedAtTo: DateTime
	}

	input PaymentProviderSort {
		field: PaymentProviderSortField!
		direction: SortDirection
	}

	input PaymentCollectionSort {
		field: PaymentCollectionSortField!
		direction: SortDirection
	}

	input PaymentSessionSort {
		field: PaymentSessionSortField!
		direction: SortDirection
	}

	input PaymentCaptureSort {
		field: PaymentCaptureSortField!
		direction: SortDirection
	}

	input RefundSort {
		field: RefundSortField!
		direction: SortDirection
	}

	input RefundReasonSort {
		field: RefundReasonSortField!
		direction: SortDirection
	}

	input PaymentWebhookEventSort {
		field: PaymentWebhookEventSortField!
		direction: SortDirection
	}

	input CreatePaymentProviderInput {
		code: String!
		name: String!
		isEnabled: Boolean
		isTestMode: Boolean
		integrationId: ID
		supportedCurrencies: [String!]
		supportedCountries: [String!]
		supportedPaymentMethods: [String!]
		sortOrder: Int
		configuration: JSON
		metadata: JSON
		idempotencyKey: String
	}

	input UpdatePaymentProviderInput {
		id: ID!
		name: String
		isEnabled: Boolean
		isTestMode: Boolean
		integrationId: ID
		supportedCurrencies: [String!]
		supportedCountries: [String!]
		supportedPaymentMethods: [String!]
		sortOrder: Int
		configuration: JSON
		metadata: JSON
	}

	input CreatePaymentCollectionInput {
		orderId: ID
		cartId: ID
		amount: Decimal!
		currency: String!
		settlementCurrency: String
		settlementAmount: Decimal
		fxRate: Decimal
		fxRateId: ID
		fxCapturedAt: DateTime
		metadata: JSON
		idempotencyKey: String
	}

	input UpdatePaymentCollectionInput {
		id: ID!
		settlementCurrency: String
		settlementAmount: Decimal
		fxRate: Decimal
		fxRateId: ID
		fxCapturedAt: DateTime
		metadata: JSON
	}

	input OpenPaymentSessionInput {
		collectionId: ID!
		providerId: ID
		providerCode: String
		amount: Decimal!
		currency: String
		paymentMethod: String
		data: JSON
		paymentMethodTokenId: ID
		idempotencyKey: String
		expiresAt: DateTime
	}

	input AuthorizePaymentSessionInput {
		id: ID!
		amount: Decimal
		data: JSON
		idempotencyKey: String
	}

	input VoidPaymentSessionInput {
		id: ID!
		reason: String
	}

	input CapturePaymentInput {
		paymentId: ID!
		amount: Decimal!
		currency: String
		externalId: String
		capturedAt: DateTime
		finalize: Boolean
		metadata: JSON
		idempotencyKey: String
	}

	input CreateRefundInput {
		orderId: ID!
		paymentId: ID
		returnId: ID
		claimId: ID
		amount: Decimal!
		currency: String!
		reasonId: ID
		reason: String
		note: String
		storeCredit: Boolean
		metadata: JSON
		idempotencyKey: String
	}

	input UpdateRefundInput {
		id: ID!
		reasonId: ID
		reason: String
		note: String
		metadata: JSON
	}

	input ApproveRefundInput {
		id: ID!
		note: String
		idempotencyKey: String
	}

	input CancelRefundInput {
		id: ID!
		reason: String
	}

	input CreateRefundReasonInput {
		code: String!
		label: String!
		description: String
		parentId: ID
		idempotencyKey: String
	}

	input UpdateRefundReasonInput {
		id: ID!
		label: String
		description: String
		parentId: ID
		isActive: Boolean
	}

	input ReprocessPaymentWebhookEventInput {
		id: ID!
		force: Boolean
		idempotencyKey: String
	}

	type CreatePaymentProviderPayload {
		paymentProvider: PaymentProvider
		operation: Operation
		userErrors: [UserError!]!
	}

	type UpdatePaymentProviderPayload {
		paymentProvider: PaymentProvider
		operation: Operation
		userErrors: [UserError!]!
	}

	type DeletePaymentProviderPayload {
		paymentProvider: PaymentProvider
		deleted: Boolean!
		operation: Operation
		userErrors: [UserError!]!
	}

	type CreatePaymentCollectionPayload {
		paymentCollection: PaymentCollection
		operation: Operation
		userErrors: [UserError!]!
	}

	type UpdatePaymentCollectionPayload {
		paymentCollection: PaymentCollection
		operation: Operation
		userErrors: [UserError!]!
	}

	type OpenPaymentSessionPayload {
		paymentSession: PaymentSession
		operation: Operation
		userErrors: [UserError!]!
	}

	type AuthorizePaymentSessionPayload {
		paymentSession: PaymentSession
		operation: Operation
		userErrors: [UserError!]!
	}

	type VoidPaymentSessionPayload {
		paymentSession: PaymentSession
		operation: Operation
		userErrors: [UserError!]!
	}

	type CapturePaymentPayload {
		paymentCapture: PaymentCapture
		operation: Operation
		userErrors: [UserError!]!
	}

	type CreateRefundPayload {
		refund: Refund
		operation: Operation
		userErrors: [UserError!]!
	}

	type UpdateRefundPayload {
		refund: Refund
		operation: Operation
		userErrors: [UserError!]!
	}

	type ApproveRefundPayload {
		refund: Refund
		operation: Operation
		userErrors: [UserError!]!
	}

	type CancelRefundPayload {
		refund: Refund
		operation: Operation
		userErrors: [UserError!]!
	}

	type CreateRefundReasonPayload {
		refundReason: RefundReason
		operation: Operation
		userErrors: [UserError!]!
	}

	type UpdateRefundReasonPayload {
		refundReason: RefundReason
		operation: Operation
		userErrors: [UserError!]!
	}

	type DeleteRefundReasonPayload {
		refundReason: RefundReason
		deleted: Boolean!
		operation: Operation
		userErrors: [UserError!]!
	}

	type ReprocessPaymentWebhookEventPayload {
		paymentWebhookEvent: PaymentWebhookEvent
		operation: Operation
		userErrors: [UserError!]!
	}

	extend type Query {
		paymentProviders(
			filter: PaymentProviderFilter
			sort: PaymentProviderSort
			page: PageInput
			limit: Int
			offset: Int
		): PaymentProviderConnection!
		paymentProvider(id: ID!): PaymentProvider
		paymentCollections(
			filter: PaymentCollectionFilter
			sort: PaymentCollectionSort
			page: PageInput
			limit: Int
			offset: Int
		): PaymentCollectionConnection!
		paymentCollection(id: ID!): PaymentCollection
		paymentSessions(
			filter: PaymentSessionFilter
			sort: PaymentSessionSort
			page: PageInput
			limit: Int
			offset: Int
		): PaymentSessionConnection!
		paymentSession(id: ID!): PaymentSession
		paymentCaptures(
			filter: PaymentCaptureFilter
			sort: PaymentCaptureSort
			page: PageInput
			limit: Int
			offset: Int
		): PaymentCaptureConnection!
		paymentCapture(id: ID!): PaymentCapture
		refunds(filter: RefundFilter, sort: RefundSort, page: PageInput, limit: Int, offset: Int): RefundConnection!
		refund(id: ID!): Refund
		refundReasons(
			filter: RefundReasonFilter
			sort: RefundReasonSort
			page: PageInput
			limit: Int
			offset: Int
		): RefundReasonConnection!
		refundReason(id: ID!): RefundReason
		paymentWebhookEvents(
			filter: PaymentWebhookEventFilter
			sort: PaymentWebhookEventSort
			page: PageInput
			limit: Int
			offset: Int
		): PaymentWebhookEventConnection!
		paymentWebhookEvent(id: ID!): PaymentWebhookEvent
	}

	extend type Mutation {
		createPaymentProvider(input: CreatePaymentProviderInput!): CreatePaymentProviderPayload!
		updatePaymentProvider(input: UpdatePaymentProviderInput!): UpdatePaymentProviderPayload!
		deletePaymentProvider(id: ID!): DeletePaymentProviderPayload!
		createPaymentCollection(input: CreatePaymentCollectionInput!): CreatePaymentCollectionPayload!
		updatePaymentCollection(input: UpdatePaymentCollectionInput!): UpdatePaymentCollectionPayload!
		openPaymentSession(input: OpenPaymentSessionInput!): OpenPaymentSessionPayload!
		authorizePaymentSession(input: AuthorizePaymentSessionInput!): AuthorizePaymentSessionPayload!
		voidPaymentSession(input: VoidPaymentSessionInput!): VoidPaymentSessionPayload!
		capturePayment(input: CapturePaymentInput!): CapturePaymentPayload!
		createRefund(input: CreateRefundInput!): CreateRefundPayload!
		updateRefund(input: UpdateRefundInput!): UpdateRefundPayload!
		approveRefund(input: ApproveRefundInput!): ApproveRefundPayload!
		cancelRefund(input: CancelRefundInput!): CancelRefundPayload!
		createRefundReason(input: CreateRefundReasonInput!): CreateRefundReasonPayload!
		updateRefundReason(input: UpdateRefundReasonInput!): UpdateRefundReasonPayload!
		deleteRefundReason(id: ID!): DeleteRefundReasonPayload!
		reprocessPaymentWebhookEvent(
			input: ReprocessPaymentWebhookEventInput!
		): ReprocessPaymentWebhookEventPayload!
	}

	extend type Subscription {
		paymentAuthorized(organizationId: ID): PaymentSession!
		paymentCaptured(organizationId: ID): PaymentCapture!
		paymentFailed(organizationId: ID): PaymentSession!
		paymentCanceled(organizationId: ID): PaymentSession!
		paymentRefunded(organizationId: ID): Refund!
		refundCreated(organizationId: ID): Refund!
	}
`;
