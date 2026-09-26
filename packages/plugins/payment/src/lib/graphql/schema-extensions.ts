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
 * **A mutation that mirrors a retry-safe route declares `idempotencyKey`, and declares it nullable.**
 * A GraphQL request is one `POST` carrying as many mutations as its document selects, so the key rides
 * beside the input it qualifies rather than in a header, and the requirement to present one is not
 * restated in the schema: the kernel answers a mutation that must be retried safely without a key with
 * `IDEMPOTENCY_KEY_REQUIRED`, which is the same code and the same status the REST route answers with.
 * Stating it a second time as a non-null member would be a second place for it to drift out of step.
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

	enum PaymentAccountHolderType {
		CUSTOMER
		SELLER
		ORGANIZATION
	}

	enum PaymentAccountHolderStatus {
		PENDING
		ACTIVE
		RESTRICTED
		REJECTED
		DISABLED
	}

	enum PaymentAccountVerificationStatus {
		UNVERIFIED
		PENDING
		VERIFIED
		REJECTED
		EXPIRED
	}

	enum PaymentMethodTokenType {
		CARD
		BANK_ACCOUNT
		WALLET
		DIRECT_DEBIT
	}

	enum PaymentMethodTokenStatus {
		ACTIVE
		EXPIRED
		REVOKED
		FAILED
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

	enum RefundLineSortField {
		ORDER_LINE_ID
		QUANTITY
		AMOUNT
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

	enum PaymentAccountHolderSortField {
		TYPE
		STATUS
		VERIFICATION_STATUS
		CREATED_AT
		UPDATED_AT
	}

	enum PaymentMethodTokenSortField {
		TYPE
		BRAND
		STATUS
		IS_DEFAULT
		EXPIRY_YEAR
		LAST_USED_AT
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
		lines: [RefundLine!]
		isActive: Boolean
		isArchived: Boolean
		archivedAt: DateTime
		tenantId: ID
		organizationId: ID
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	type RefundLine {
		id: ID!
		refundId: ID!
		orderLineId: ID!
		quantity: Decimal!
		amount: Decimal!
		currency: String!
		metadata: JSON
		legacy: Boolean
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

	type PaymentAccountHolder {
		id: ID!
		contactId: ID
		paymentProviderId: ID
		providerKey: String!
		externalAccountId: String
		type: PaymentAccountHolderType!
		status: PaymentAccountHolderStatus!
		verificationStatus: PaymentAccountVerificationStatus!
		country: String
		defaultCurrency: String
		mandateReference: String
		mandateAcceptedAt: DateTime
		metadata: JSON
		methodTokens: [PaymentMethodToken!]
		isActive: Boolean
		isArchived: Boolean
		archivedAt: DateTime
		tenantId: ID
		organizationId: ID
		createdAt: DateTime!
		updatedAt: DateTime!
	}

	type PaymentMethodToken {
		id: ID!
		accountHolderId: ID!
		paymentProviderId: ID
		providerKey: String!
		token: String
		type: PaymentMethodTokenType!
		brand: String
		last4: String
		expiryMonth: Int
		expiryYear: Int
		holderName: String
		billingAddressId: ID
		isDefault: Boolean!
		status: PaymentMethodTokenStatus!
		lastUsedAt: DateTime
		revokedAt: DateTime
		metadata: JSON
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

	type RefundLineEdge {
		cursor: String!
		node: RefundLine!
	}

	type PaymentWebhookEventEdge {
		cursor: String!
		node: PaymentWebhookEvent!
	}

	type PaymentAccountHolderEdge {
		cursor: String!
		node: PaymentAccountHolder!
	}

	type PaymentMethodTokenEdge {
		cursor: String!
		node: PaymentMethodToken!
	}

	type PaymentProviderConnection {
		nodes: [PaymentProvider!]!
		edges: [PaymentProviderEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	type PaymentCollectionConnection {
		nodes: [PaymentCollection!]!
		edges: [PaymentCollectionEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	type PaymentSessionConnection {
		nodes: [PaymentSession!]!
		edges: [PaymentSessionEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	type PaymentCaptureConnection {
		nodes: [PaymentCapture!]!
		edges: [PaymentCaptureEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	type RefundConnection {
		nodes: [Refund!]!
		edges: [RefundEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	type RefundReasonConnection {
		nodes: [RefundReason!]!
		edges: [RefundReasonEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	type RefundLineConnection {
		nodes: [RefundLine!]!
		edges: [RefundLineEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	type PaymentWebhookEventConnection {
		nodes: [PaymentWebhookEvent!]!
		edges: [PaymentWebhookEventEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	type PaymentAccountHolderConnection {
		nodes: [PaymentAccountHolder!]!
		edges: [PaymentAccountHolderEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	type PaymentMethodTokenConnection {
		nodes: [PaymentMethodToken!]!
		edges: [PaymentMethodTokenEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
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

	input RefundLineFilter {
		id: ID
		refundId: ID
		orderLineId: ID
		currency: String
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

	input PaymentAccountHolderFilter {
		id: ID
		contactId: ID
		paymentProviderId: ID
		providerKey: String
		type: PaymentAccountHolderType
		status: PaymentAccountHolderStatus
		verificationStatus: PaymentAccountVerificationStatus
		defaultCurrency: String
	}

	input PaymentMethodTokenFilter {
		id: ID
		contactId: ID
		accountHolderId: ID
		paymentProviderId: ID
		providerKey: String
		type: PaymentMethodTokenType
		status: PaymentMethodTokenStatus
		isDefault: Boolean
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

	input RefundLineSort {
		field: RefundLineSortField!
		direction: SortDirection
	}

	input PaymentWebhookEventSort {
		field: PaymentWebhookEventSortField!
		direction: SortDirection
	}

	input PaymentAccountHolderSort {
		field: PaymentAccountHolderSortField!
		direction: SortDirection
	}

	input PaymentMethodTokenSort {
		field: PaymentMethodTokenSortField!
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
		idempotencyKey: String
	}

	# The repair of an attempt's own recorded fields, which is what PUT /payment-sessions/:id is for.
	# The members are the ones the service's own update writes: the status, the amount, the currency, the
	# provider and the collection are dropped by that method, so no input promises them here, and the
	# client secret is left off for the reason the session type states — it belongs to the caller's own
	# client-side flow rather than to a row this schema reads back.
	input UpdatePaymentSessionInput {
		id: ID!
		externalId: String
		paymentMethodTokenId: ID
		data: JSON
		expiresAt: DateTime
		authorizedAt: DateTime
		metadata: JSON
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
		lines: [RefundLineInput!]
		idempotencyKey: String
	}

	input RefundLineInput {
		orderLineId: ID!
		quantity: Decimal!
		amount: Decimal!
		currency: String
		metadata: JSON
	}

	input CreateRefundLineInput {
		refundId: ID!
		orderLineId: ID!
		quantity: Decimal!
		amount: Decimal!
		currency: String
		metadata: JSON
		idempotencyKey: String
	}

	input UpdateRefundLineInput {
		id: ID!
		quantity: Decimal
		amount: Decimal
		currency: String
		metadata: JSON
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

	input CreatePaymentAccountHolderInput {
		contactId: ID
		paymentProviderId: ID
		providerKey: String!
		type: PaymentAccountHolderType
		country: String
		defaultCurrency: String
		metadata: JSON
		idempotencyKey: String
	}

	input UpdatePaymentAccountHolderInput {
		id: ID!
		contactId: ID
		paymentProviderId: ID
		providerKey: String
		verificationStatus: PaymentAccountVerificationStatus
		country: String
		defaultCurrency: String
		mandateReference: String
		mandateAcceptedAt: DateTime
		metadata: JSON
	}

	input VerifyPaymentAccountHolderInput {
		id: ID!
		verificationStatus: PaymentAccountVerificationStatus!
		status: PaymentAccountHolderStatus
		reference: String
		expiresAt: DateTime
		note: String
		idempotencyKey: String
	}

	input PaymentMethodTokenConfirmationInput {
		token: String!
		confirmedAt: DateTime!
	}

	input CreatePaymentMethodTokenInput {
		accountHolderId: ID!
		providerKey: String!
		token: String!
		providerConfirmation: PaymentMethodTokenConfirmationInput!
		type: PaymentMethodTokenType
		brand: String
		last4: String
		expiryMonth: Int
		expiryYear: Int
		holderName: String
		billingAddressId: ID
		isDefault: Boolean
		metadata: JSON
		idempotencyKey: String
	}

	# The repair of an instrument's display facts, which is what PUT /payment-method-tokens/:id is for.
	# The members are the kernel's own update input: the stored reference, the account, the provider key
	# and the kind are not descriptive facts, so the reference is stated once at creation, an instrument
	# never moves between accounts or providers, and the kind decides the default rule and whether a
	# mandate is required before an off-session charge.
	input UpdatePaymentMethodTokenInput {
		id: ID!
		brand: String
		last4: String
		expiryMonth: Int
		expiryYear: Int
		holderName: String
		billingAddressId: ID
		metadata: JSON
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

	type UpdatePaymentSessionPayload {
		paymentSession: PaymentSession
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of re-reading an attempt, closing one that has outlived its lifetime."
	type RefreshPaymentSessionPayload {
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

	type CreateRefundLinePayload {
		refundLine: RefundLine
		operation: Operation
		userErrors: [UserError!]!
	}

	type UpdateRefundLinePayload {
		refundLine: RefundLine
		operation: Operation
		userErrors: [UserError!]!
	}

	type DeleteRefundLinePayload {
		refundLine: RefundLine
		deleted: Boolean!
		operation: Operation
		userErrors: [UserError!]!
	}

	type ReprocessPaymentWebhookEventPayload {
		paymentWebhookEvent: PaymentWebhookEvent
		operation: Operation
		userErrors: [UserError!]!
	}

	type CreatePaymentAccountHolderPayload {
		paymentAccountHolder: PaymentAccountHolder
		operation: Operation
		userErrors: [UserError!]!
	}

	type UpdatePaymentAccountHolderPayload {
		paymentAccountHolder: PaymentAccountHolder
		operation: Operation
		userErrors: [UserError!]!
	}

	type VerifyPaymentAccountHolderPayload {
		paymentAccountHolder: PaymentAccountHolder
		operation: Operation
		userErrors: [UserError!]!
	}

	type DeletePaymentAccountHolderPayload {
		paymentAccountHolder: PaymentAccountHolder
		deleted: Boolean!
		revokedTokenCount: Int!
		operation: Operation
		userErrors: [UserError!]!
	}

	type CreatePaymentMethodTokenPayload {
		paymentMethodToken: PaymentMethodToken
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of repairing the display facts of a saved instrument."
	type UpdatePaymentMethodTokenPayload {
		paymentMethodToken: PaymentMethodToken
		operation: Operation
		userErrors: [UserError!]!
	}

	type SetDefaultPaymentMethodTokenPayload {
		paymentMethodToken: PaymentMethodToken
		previousDefaultId: ID
		operation: Operation
		userErrors: [UserError!]!
	}

	type RevokePaymentMethodTokenPayload {
		paymentMethodToken: PaymentMethodToken
		deleted: Boolean!
		operation: Operation
		userErrors: [UserError!]!
	}

	# The recoverable lifecycle pair, one payload per resource and act: every controller of this plugin
	# extends CrudController and overrides the two inherited lifecycle routes only to state a permission
	# the base leaves unstated, so REST has served a gated withdraw/restore pair over ten resources while
	# no field answered either half of it.
	#
	# The shape is this document's own payload convention — the resource under the member its siblings
	# use, the durable operation when the mutation started one, and userErrors, where a refusal rides
	# rather than being thrown. The two halves are deliberately the same shape: a soft delete answers
	# the row as it left it, exactly as a recover answers the row it put back, so neither carries a
	# deleted flag — the row is the report, and a refusal is the one thing userErrors exists for.

	"The outcome of retiring a provider registration recoverably."
	type SoftDeletePaymentProviderPayload {
		paymentProvider: PaymentProvider
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of restoring a soft-deleted provider registration."
	type RecoverPaymentProviderPayload {
		paymentProvider: PaymentProvider
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of retiring a collection recoverably."
	type SoftDeletePaymentCollectionPayload {
		paymentCollection: PaymentCollection
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of restoring a soft-deleted collection."
	type RecoverPaymentCollectionPayload {
		paymentCollection: PaymentCollection
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of retiring a session recoverably."
	type SoftDeletePaymentSessionPayload {
		paymentSession: PaymentSession
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of restoring a soft-deleted session."
	type RecoverPaymentSessionPayload {
		paymentSession: PaymentSession
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of retiring a capture recoverably."
	type SoftDeletePaymentCapturePayload {
		paymentCapture: PaymentCapture
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of restoring a soft-deleted capture."
	type RecoverPaymentCapturePayload {
		paymentCapture: PaymentCapture
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of retiring a refund recoverably."
	type SoftDeleteRefundPayload {
		refund: Refund
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of restoring a soft-deleted refund."
	type RecoverRefundPayload {
		refund: Refund
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of retiring a governed refund reason recoverably."
	type SoftDeleteRefundReasonPayload {
		refundReason: RefundReason
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of restoring a soft-deleted refund reason."
	type RecoverRefundReasonPayload {
		refundReason: RefundReason
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of retiring a line of a refund's breakdown recoverably."
	type SoftDeleteRefundLinePayload {
		refundLine: RefundLine
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of restoring a soft-deleted line of a refund's breakdown."
	type RecoverRefundLinePayload {
		refundLine: RefundLine
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of retiring an inbound callback recoverably."
	type SoftDeletePaymentWebhookEventPayload {
		paymentWebhookEvent: PaymentWebhookEvent
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of restoring a soft-deleted inbound callback."
	type RecoverPaymentWebhookEventPayload {
		paymentWebhookEvent: PaymentWebhookEvent
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of retiring a party's account at a provider recoverably."
	type SoftDeletePaymentAccountHolderPayload {
		paymentAccountHolder: PaymentAccountHolder
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of restoring a soft-deleted account at a provider."
	type RecoverPaymentAccountHolderPayload {
		paymentAccountHolder: PaymentAccountHolder
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of retiring a saved instrument recoverably."
	type SoftDeletePaymentMethodTokenPayload {
		paymentMethodToken: PaymentMethodToken
		operation: Operation
		userErrors: [UserError!]!
	}

	"The outcome of restoring a soft-deleted saved instrument."
	type RecoverPaymentMethodTokenPayload {
		paymentMethodToken: PaymentMethodToken
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
			withDeleted: Boolean
		): PaymentProviderConnection!
		paymentProvider(id: ID!): PaymentProvider
		paymentCollections(
			filter: PaymentCollectionFilter
			sort: PaymentCollectionSort
			page: PageInput
			limit: Int
			offset: Int
			withDeleted: Boolean
		): PaymentCollectionConnection!
		paymentCollection(id: ID!): PaymentCollection
		paymentSessions(
			filter: PaymentSessionFilter
			sort: PaymentSessionSort
			page: PageInput
			limit: Int
			offset: Int
			withDeleted: Boolean
		): PaymentSessionConnection!
		paymentSession(id: ID!): PaymentSession
		paymentCaptures(
			filter: PaymentCaptureFilter
			sort: PaymentCaptureSort
			page: PageInput
			limit: Int
			offset: Int
			withDeleted: Boolean
		): PaymentCaptureConnection!
		paymentCapture(id: ID!): PaymentCapture
		refunds(
			filter: RefundFilter
			sort: RefundSort
			page: PageInput
			limit: Int
			offset: Int
			withDeleted: Boolean
		): RefundConnection!
		refund(id: ID!): Refund
		refundReasons(
			filter: RefundReasonFilter
			sort: RefundReasonSort
			page: PageInput
			limit: Int
			offset: Int
			withDeleted: Boolean
		): RefundReasonConnection!
		refundReason(id: ID!): RefundReason
		refundLines(
			filter: RefundLineFilter
			sort: RefundLineSort
			page: PageInput
			limit: Int
			offset: Int
			withDeleted: Boolean
		): RefundLineConnection!
		refundLine(id: ID!): RefundLine
		paymentWebhookEvents(
			filter: PaymentWebhookEventFilter
			sort: PaymentWebhookEventSort
			page: PageInput
			limit: Int
			offset: Int
			withDeleted: Boolean
		): PaymentWebhookEventConnection!
		paymentWebhookEvent(id: ID!): PaymentWebhookEvent
		paymentAccountHolders(
			filter: PaymentAccountHolderFilter
			sort: PaymentAccountHolderSort
			page: PageInput
			limit: Int
			offset: Int
			withDeleted: Boolean
		): PaymentAccountHolderConnection!
		paymentAccountHolder(id: ID!): PaymentAccountHolder
		paymentMethodTokens(
			filter: PaymentMethodTokenFilter
			sort: PaymentMethodTokenSort
			page: PageInput
			limit: Int
			offset: Int
			withDeleted: Boolean
		): PaymentMethodTokenConnection!
		paymentMethodToken(id: ID!): PaymentMethodToken
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
		"Corrects the recorded fields of an attempt, without running any of its four verbs."
		updatePaymentSession(input: UpdatePaymentSessionInput!): UpdatePaymentSessionPayload!
		"""
		Re-reads the state of an attempt and closes one that has outlived its lifetime. It does not
		re-poll the provider: what the provider answered is written by the call that reached it, and
		this operation is the package's own expiry half, which a caller otherwise waits for the sweep to
		perform.
		"""
		refreshPaymentSession(id: ID!): RefreshPaymentSessionPayload!
		capturePayment(input: CapturePaymentInput!): CapturePaymentPayload!
		createRefund(input: CreateRefundInput!): CreateRefundPayload!
		updateRefund(input: UpdateRefundInput!): UpdateRefundPayload!
		approveRefund(input: ApproveRefundInput!): ApproveRefundPayload!
		cancelRefund(input: CancelRefundInput!): CancelRefundPayload!
		createRefundReason(input: CreateRefundReasonInput!): CreateRefundReasonPayload!
		updateRefundReason(input: UpdateRefundReasonInput!): UpdateRefundReasonPayload!
		deleteRefundReason(id: ID!): DeleteRefundReasonPayload!
		createRefundLine(input: CreateRefundLineInput!): CreateRefundLinePayload!
		updateRefundLine(input: UpdateRefundLineInput!): UpdateRefundLinePayload!
		deleteRefundLine(id: ID!): DeleteRefundLinePayload!
		reprocessPaymentWebhookEvent(
			input: ReprocessPaymentWebhookEventInput!
		): ReprocessPaymentWebhookEventPayload!
		createPaymentAccountHolder(
			input: CreatePaymentAccountHolderInput!
		): CreatePaymentAccountHolderPayload!
		updatePaymentAccountHolder(
			input: UpdatePaymentAccountHolderInput!
		): UpdatePaymentAccountHolderPayload!
		verifyPaymentAccountHolder(
			input: VerifyPaymentAccountHolderInput!
		): VerifyPaymentAccountHolderPayload!
		deletePaymentAccountHolder(id: ID!): DeletePaymentAccountHolderPayload!
		createPaymentMethodToken(input: CreatePaymentMethodTokenInput!): CreatePaymentMethodTokenPayload!
		"Corrects the display facts of a saved instrument. The stored reference is not among them."
		updatePaymentMethodToken(input: UpdatePaymentMethodTokenInput!): UpdatePaymentMethodTokenPayload!
		setDefaultPaymentMethodToken(id: ID!): SetDefaultPaymentMethodTokenPayload!
		revokePaymentMethodToken(id: ID!): RevokePaymentMethodTokenPayload!

		# The recoverable lifecycle pair, one field per resource of this domain: every controller here
		# extends CrudController and overrides both inherited routes only to state a permission, so REST
		# has served a gated withdraw/restore pair over ten resources while no field answered either half
		# of it. Each field below mirrors one of those routes — the same service method, the same
		# identifier, and the permission that route's own override states, which is not one grant for the
		# whole plugin: a capture carries the capture grant, a collection the authorise grant, a session
		# the cancel grant, a callback the reprocess grant, a provider the delete grant, the three refund
		# resources the create grant, and the account and the saved instrument the two edit grants the
		# kernel catalogue publishes for them.
		"Retires a provider registration recoverably, keeping the sessions it served."
		softDeletePaymentProvider(id: ID!): SoftDeletePaymentProviderPayload!
		"Restores a soft-deleted provider registration."
		recoverPaymentProvider(id: ID!): RecoverPaymentProviderPayload!
		"Retires a collection recoverably, keeping the amounts it reconciled."
		softDeletePaymentCollection(id: ID!): SoftDeletePaymentCollectionPayload!
		"Restores a soft-deleted collection."
		recoverPaymentCollection(id: ID!): RecoverPaymentCollectionPayload!
		"Retires a payment attempt recoverably, keeping the authorisation it recorded."
		softDeletePaymentSession(id: ID!): SoftDeletePaymentSessionPayload!
		"Restores a soft-deleted payment attempt."
		recoverPaymentSession(id: ID!): RecoverPaymentSessionPayload!
		"Retires a capture recoverably, keeping the ledger row the money was taken against."
		softDeletePaymentCapture(id: ID!): SoftDeletePaymentCapturePayload!
		"Restores a soft-deleted capture."
		recoverPaymentCapture(id: ID!): RecoverPaymentCapturePayload!
		"Retires a refund recoverably, keeping what it explains about the money given back."
		softDeleteRefund(id: ID!): SoftDeleteRefundPayload!
		"Restores a soft-deleted refund."
		recoverRefund(id: ID!): RecoverRefundPayload!
		"Retires a governed refund reason recoverably, so the refunds citing it stay explainable."
		softDeleteRefundReason(id: ID!): SoftDeleteRefundReasonPayload!
		"Restores a soft-deleted refund reason."
		recoverRefundReason(id: ID!): RecoverRefundReasonPayload!
		"Retires a line of a refund's breakdown recoverably, keeping the refund it accounted for."
		softDeleteRefundLine(id: ID!): SoftDeleteRefundLinePayload!
		"Restores a soft-deleted line of a refund's breakdown."
		recoverRefundLine(id: ID!): RecoverRefundLinePayload!
		"Retires an inbound callback recoverably, keeping the record that it arrived."
		softDeletePaymentWebhookEvent(id: ID!): SoftDeletePaymentWebhookEventPayload!
		"Restores a soft-deleted inbound callback."
		recoverPaymentWebhookEvent(id: ID!): RecoverPaymentWebhookEventPayload!
		"Retires a party's account at a provider recoverably, keeping the charges that point at it."
		softDeletePaymentAccountHolder(id: ID!): SoftDeletePaymentAccountHolderPayload!
		"Restores a soft-deleted account at a provider."
		recoverPaymentAccountHolder(id: ID!): RecoverPaymentAccountHolderPayload!
		"Retires a saved instrument recoverably, keeping the charge history that references it."
		softDeletePaymentMethodToken(id: ID!): SoftDeletePaymentMethodTokenPayload!
		"Restores a soft-deleted saved instrument."
		recoverPaymentMethodToken(id: ID!): RecoverPaymentMethodTokenPayload!
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
