import { gql } from 'graphql-tag';

/**
 * The GraphQL surface of the entitlement domain.
 *
 * Types, inputs, enums and the domain's root fields, declared as one document that is composed into
 * the platform schema at boot. The root operation types belong to the kernel, so this file only
 * extends them — a second declaration of `type Query` would be a duplicate definition and would fail
 * the schema build.
 *
 * `Product` and `ProductVariant` are the catalogue's types and are only *referenced*: a right names
 * what it is over by identifier, and the object is resolved through the catalogue capability when one
 * is registered. Redeclaring them here would be a duplicate type, and copying them would be a second,
 * staler model of another domain's row.
 *
 * Licence key material never appears in this schema. The one field that carries a plaintext is the
 * response to issuing a key, and it carries it once.
 */
export const schemaExtensions = gql`
	"Where a right is in its life."
	enum EntitlementStatus {
		PENDING
		ACTIVE
		SUSPENDED
		EXPIRED
		REVOKED
	}

	"What a purchase granted, which decides what the quantity column counts."
	enum EntitlementKind {
		LICENCE
		SEAT
		TERM
		USAGE
	}

	"What a device, instance or named user is doing with a slot."
	enum EntitlementActivationStatus {
		ACTIVE
		RELEASED
		REVOKED
		EXPIRED
	}

	"What an issued credential may still be used for."
	enum EntitlementKeyStatus {
		ISSUED
		ACTIVATED
		REVOKED
		EXPIRED
	}

	"Which generator rendered a licence key."
	enum LicenceKeyFormat {
		UUID
		"Four groups of four upper-case alphanumerics."
		GROUPED_16
		"Twenty characters of an unambiguous alphabet, grouped in fours."
		BASE32_20
	}

	"The stable code the check answers with."
	enum EntitlementCheckReason {
		ALLOWED
		ENTITLEMENT_NOT_FOUND
		ENTITLEMENT_PENDING
		ENTITLEMENT_SUSPENDED
		ENTITLEMENT_EXPIRED
		ENTITLEMENT_REVOKED
		ENTITLEMENT_TERM_NOT_STARTED
		ENTITLEMENT_QUANTITY_EXHAUSTED
		ENTITLEMENT_ACTIVATION_LIMIT_REACHED
		ENTITLEMENT_REFERENCE_REQUIRED
		ENTITLEMENT_KEY_NOT_FOUND
		ENTITLEMENT_KEY_REVOKED
		ENTITLEMENT_KEY_EXPIRED
		ENTITLEMENT_KEY_USED
		ENTITLEMENT_CONDITIONS_NOT_MET
	}

	"The right a purchase granted."
	type Entitlement {
		id: ID!
		"The party the right was granted to."
		customerId: ID
		"The order that granted it."
		orderId: ID
		"The line that granted it."
		orderLineId: ID
		"The subscription that renews it, when one does."
		subscriptionId: ID
		"The catalogue item it is over, by identifier."
		productId: ID
		"The variant it is over, when it is over one."
		variantId: ID
		"The product it is over, resolved through the catalogue capability."
		product: Product
		"The variant it is over, resolved through the catalogue capability."
		variant: ProductVariant
		"The allocated number, unique inside the organization."
		number: String!
		kind: EntitlementKind!
		"Seats, uses or 1; 0 means unlimited."
		quantity: Int!
		startsAt: DateTime!
		"The instant the right stops being exercisable; null is the perpetual case."
		endsAt: DateTime
		"Days after endsAt during which the right stays in force while a renewal is chased."
		gracePeriodDays: Int!
		"Maximum simultaneous activations, when that is tighter than quantity."
		activationLimit: Int
		"Live activations, as the cache the usage audit re-derives."
		activationCount: Int!
		status: EntitlementStatus!
		revokedAt: DateTime
		revokedByUserId: ID
		revokedReason: String
		suspendedReason: String
		metadata: JSON
		"The point past which the right is expired, grace included; null when it is perpetual."
		validUntil: DateTime
		"Seats or uses still available; null when the right is unlimited."
		remainingQuantity: Int
		"The devices, instances and named seats occupying its slots."
		activations: [EntitlementActivation!]!
		"The credentials issued against it."
		keys: [EntitlementKey!]!
		"""
		The revision of the row. A mutation states the revision it read as the input member 'version'
		and is refused when the right has moved on since, so two callers editing one right cannot
		silently overwrite each other.
		"""
		version: Int!
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One device, instance or named user occupying a slot of a right."
	type EntitlementActivation {
		id: ID!
		entitlementId: ID!
		"The key that was used, when activation went through a licence key."
		entitlementKeyId: ID
		"The stable device or instance identifier the limit is counted over."
		deviceId: String!
		deviceName: String
		fingerprint: String
		"The named seat this activation occupies."
		seatReference: String
		"The buyer who performed the activation, when it came from a logged-in customer."
		activatedByCustomerId: ID
		status: EntitlementActivationStatus!
		activatedAt: DateTime!
		"Refreshed by validation calls, at most once per configured interval."
		lastSeenAt: DateTime
		deactivatedAt: DateTime
		revokedAt: DateTime
		revokedByUserId: ID
		revocationReason: String
		ipAddress: String
		userAgent: String
		metadata: JSON
	}

	"An issued licence key: the credential a customer types into the product."
	type EntitlementKey {
		id: ID!
		entitlementId: ID!
		"The leading characters, in clear, so support can identify a key."
		keyPrefix: String
		format: String!
		status: EntitlementKeyStatus!
		assignedAt: DateTime
		"The recipient of the key, when it was delivered to someone."
		assignedToEmail: String
		assignedToCustomerId: ID
		"Per-key override of the entitlement's activation limit; null inherits."
		activationLimit: Int
		"Live activations of this key, as the cache the usage audit re-derives."
		activationCount: Int!
		"The key's own expiry, which may be earlier than the entitlement's."
		expiresAt: DateTime
		revokedAt: DateTime
		revokedByUserId: ID
		metadata: JSON
		createdAt: DateTime
	}

	"One page of rights."
	type EntitlementConnection {
		edges: [EntitlementEdge!]!
		nodes: [Entitlement!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One right inside a page."
	type EntitlementEdge {
		cursor: String!
		node: Entitlement!
	}

	"One page of activations."
	type EntitlementActivationConnection {
		edges: [EntitlementActivationEdge!]!
		nodes: [EntitlementActivation!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One activation inside a page."
	type EntitlementActivationEdge {
		cursor: String!
		node: EntitlementActivation!
	}

	"One page of licence keys."
	type EntitlementKeyConnection {
		edges: [EntitlementKeyEdge!]!
		nodes: [EntitlementKey!]!
		pageInfo: PageInfo!
		totalCount: Int!
	}

	"One licence key inside a page."
	type EntitlementKeyEdge {
		cursor: String!
		node: EntitlementKey!
	}

	"Filters a page of rights."
	input EntitlementFilter {
		status: EntitlementStatus
		kind: EntitlementKind
		customerId: ID
		orderId: ID
		orderLineId: ID
		subscriptionId: ID
		productId: ID
		variantId: ID
		number: String
	}

	"Filters a page of activations."
	input EntitlementActivationFilter {
		entitlementId: ID
		status: EntitlementActivationStatus
		deviceId: String
		activatedByCustomerId: ID
	}

	"Filters a page of licence keys."
	input EntitlementKeyFilter {
		entitlementId: ID
		status: EntitlementKeyStatus
		assignedToEmail: String
		assignedToCustomerId: ID
	}

	"One condition attached to a right, stored as a rule row."
	input EntitlementConditionInput {
		"Dotted path into the evaluation context, for example context.region."
		attribute: String!
		"The comparison, for example EQ, IN, GTE or IS_NULL."
		operator: String!
		"The operand; an array for IN and BETWEEN."
		value: JSON
		"How the operand is coerced: STRING, NUMBER, DATE, ..."
		valueType: String
		"Wraps the rule in NOT after the operator is applied."
		isNegated: Boolean
		"Rules sharing a group are AND-ed; groups are OR-ed."
		groupIndex: Int
		"Evaluation order inside a group."
		priority: Int
		description: String
	}

	"The request that grants a right."
	input GrantEntitlementInput {
		customerId: ID
		orderId: ID
		orderLineId: ID
		subscriptionId: ID
		productId: ID
		variantId: ID
		kind: EntitlementKind
		quantity: Int
		startsAt: DateTime
		endsAt: DateTime
		gracePeriodDays: Int
		activationLimit: Int
		metadata: JSON
		conditions: [EntitlementConditionInput!]
		"Issue a licence key in the same transaction and return its plaintext once."
		issueKey: Boolean
		keyFormat: LicenceKeyFormat
		"The holder an issued key is assigned to."
		assignedToEmail: String
		"Grant the right already in force instead of PENDING."
		activateImmediately: Boolean
		"""
		The key this grant is retried under, so a client whose response was lost re-states the same
		key rather than granting a second right. Honoured by the surfaces that declare a retry scope;
		a grant that names no key behaves exactly as it always did.
		"""
		idempotencyKey: String
	}

	"The request that occupies a slot."
	input ActivateEntitlementInput {
		entitlementId: ID!
		"The stable device or instance identifier the limit is counted over."
		deviceId: String!
		deviceName: String
		fingerprint: String
		seatReference: String
		"The licence key presented, when activation goes through one."
		key: String
		activatedByCustomerId: ID
		metadata: JSON
		"""
		The key this activation is retried under, so a device that lost the response re-states the same
		key rather than taking a second slot. Honoured by the surfaces that declare a retry scope; an
		activation that states no key behaves exactly as it always did.
		"""
		idempotencyKey: String
	}

	"The request that asks whether a right may be exercised."
	input CheckEntitlementInput {
		entitlementId: ID
		"The licence key the caller holds, in clear."
		key: String
		deviceId: String
		seatReference: String
		"Attributes the attached rule rows are evaluated against."
		context: JSON
	}

	"The request that issues a licence key."
	input IssueEntitlementKeyInput {
		entitlementId: ID!
		format: LicenceKeyFormat
		assignedToEmail: String
		assignedToCustomerId: ID
		activationLimit: Int
		expiresAt: DateTime
		"Store a recoverable ciphertext so an operator can re-display the key."
		storeKey: Boolean
		metadata: JSON
		"""
		The key this issuance is retried under, so a client that lost the response re-states the same
		key rather than issuing a second credential. Honoured by the surfaces that declare a retry
		scope; an issuance that states no key behaves exactly as it always did.
		"""
		idempotencyKey: String
	}

	"""
	The fields an edit to a right may change.

	The route this mirrors validates \`UpdateEntitlementDTO\`, whose live metadata also carries the
	provenance, the allocated number, the kind and the lifecycle state. Those are not members of this
	input: a right's state moves by being suspended, extended, reduced or revoked, each of which is an
	action with its own permission and its own event, and a body that could set \`status\` would move the
	row past every one of them. The suite derives the omitted set from that DTO's class-validator
	metadata rather than restating it here.
	"""
	input UpdateEntitlementInput {
		"Seats, uses or 1; 0 means unlimited."
		quantity: Int
		startsAt: DateTime
		"The instant the right stops being exercisable; null is the perpetual case."
		endsAt: DateTime
		"Days after endsAt during which the right stays in force while a renewal is chased."
		gracePeriodDays: Int
		"Maximum simultaneous activations, when that is tighter than quantity."
		activationLimit: Int
		metadata: JSON
		"The conditions the right should end up with, replacing the rule rows attached to it."
		conditions: [EntitlementConditionInput!]
	}

	"The request that records who holds an issued licence key."
	input AssignEntitlementKeyInput {
		"The recipient. A key that already names a different holder is refused, not reassigned."
		assignedToEmail: String
	}

	"The request that replaces an issued licence key with a freshly generated one."
	input ReissueEntitlementKeyInput {
		"Which generator renders the replacement; absent keeps the replaced key's format."
		format: LicenceKeyFormat
		"Why the key is being replaced, kept on the old row and on its replacement."
		reason: String
		"Store a recoverable ciphertext for the replacement, so an operator can re-display it."
		storeKey: Boolean
	}

	"""
	The recorded fields of an activation, as an edit may state them.

	This is the route's own body type (\`UpdateEntitlementActivationDTO\`) member for member: the descriptive
	fields of a slot, and nothing its lifecycle owns. \`status\`, \`entitlementId\`, \`entitlementKeyId\`,
	\`deviceId\` and \`revocationReason\` are absent from both, because each is written by the operation that
	takes, releases or revokes a slot, and each is what a rule of that operation is decided over — the
	activation limit, the right's ceiling, the key's release on revocation, the device the seat is counted
	over and the bar on a device withdrawn for abuse. A slot is taken through \`activateEntitlement\` and
	given back through \`deactivateEntitlement\`.
	"""
	input UpdateEntitlementActivationInput {
		deviceName: String
		fingerprint: String
		"The named seat this activation occupies."
		seatReference: String
		"The buyer who performed the activation, when it came from a logged-in customer."
		activatedByCustomerId: ID
		"Refreshed by validation calls, at most once per configured interval."
		lastSeenAt: DateTime
		ipAddress: String
		userAgent: String
		metadata: JSON
	}

	"What a check answered."
	type EntitlementCheckResult {
		allowed: Boolean!
		reason: EntitlementCheckReason!
		entitlementId: ID
		kind: EntitlementKind
		status: EntitlementStatus
		"Seats or uses still available; null when the right is unlimited."
		remainingQuantity: Int
		"The instant the right stops being exercisable; null is the perpetual case."
		validUntil: DateTime
		"Whether the rule rows attached to the right matched."
		conditionsMatched: Boolean!
		"The rules that did not match, so a denial is explainable."
		failedRules: [String!]
		"Attributes the evaluation context did not carry."
		unresolvedAttributes: [String!]
	}

	"The outcome of a grant."
	type GrantEntitlementPayload {
		entitlement: Entitlement
		"The credential that was issued, when one was."
		key: EntitlementKey
		"""
		The plaintext of that credential. Returned once, in this response, and never again: only its
		digest is stored.
		"""
		plaintextKey: String
		"True when this call granted the right, false when it returned one an earlier call granted."
		created: Boolean!
		userErrors: [UserError!]!
	}

	"The outcome of a mutation on a right."
	type EntitlementPayload {
		entitlement: Entitlement
		userErrors: [UserError!]!
	}

	"The outcome of occupying a slot."
	type ActivateEntitlementPayload {
		activation: EntitlementActivation
		entitlement: Entitlement
		"True when this call took the slot, false when it returned a slot already held."
		created: Boolean!
		userErrors: [UserError!]!
	}

	"The outcome of giving a slot back."
	type DeactivateEntitlementPayload {
		activation: EntitlementActivation
		entitlement: Entitlement
		userErrors: [UserError!]!
	}

	"""
	The outcome of a mutation on an activation, for the two acts that are not a release or a
	revocation. Declared here because the activation resource had no payload of its own: its other
	mutations answer \`ActivateEntitlementPayload\` or \`DeactivateEntitlementPayload\`, and neither
	states the act a caller performs when it retires a slot recoverably.
	"""
	type EntitlementActivationPayload {
		activation: EntitlementActivation
		userErrors: [UserError!]!
	}

	"The outcome of a mutation on a credential."
	type EntitlementKeyPayload {
		key: EntitlementKey
		userErrors: [UserError!]!
	}

	"The outcome of issuing a credential."
	type IssueEntitlementKeyPayload {
		key: EntitlementKey
		"The plaintext. Returned once, in this response, and never again."
		plaintextKey: String
		userErrors: [UserError!]!
	}

	"The outcome of replacing a credential with a freshly generated one."
	type ReissueEntitlementKeyPayload {
		"The replacement."
		key: EntitlementKey
		"The plaintext of the replacement. Returned once, in this response, and never again."
		plaintextKey: String
		"The credential it replaced, now revoked, with the activations it was used for released."
		replacedKey: EntitlementKey
		userErrors: [UserError!]!
	}

	extend type Query {
		"Rights of the caller's organization."
		entitlements(filter: EntitlementFilter, page: PageInput, withDeleted: Boolean): EntitlementConnection!
		"One right, with its activations and its keys."
		entitlement(id: ID!): Entitlement
		"Activations, by right, device or state."
		entitlementActivations(filter: EntitlementActivationFilter, page: PageInput, withDeleted: Boolean): EntitlementActivationConnection!
		"Issued credentials. The digest and the ciphertext are never part of the answer."
		entitlementKeys(filter: EntitlementKeyFilter, page: PageInput, withDeleted: Boolean): EntitlementKeyConnection!
		"Whether a right may be exercised, with the code that explains the answer."
		checkEntitlement(input: CheckEntitlementInput!): EntitlementCheckResult!
	}

	extend type Mutation {
		"Grants a right. Idempotent on the order line or subscription it names."
		grantEntitlement(input: GrantEntitlementInput!): GrantEntitlementPayload!
		"""
		Withdraws a right, terminally. Its keys and its live activations go with it. The caller states
		the 'version' it read, and a right that has moved on since is refused.
		"""
		revokeEntitlement(id: ID!, reason: String!, version: Int, idempotencyKey: String): EntitlementPayload!
		"""
		Extends the term of a right, which is what a successful renewal does. The caller states the
		'version' it read, and a right that has moved on since is refused.
		"""
		extendEntitlement(
			id: ID!
			endsAt: DateTime!
			quantity: Int
			version: Int
			idempotencyKey: String
		): EntitlementPayload!
		"""
		Edits a right: its ceiling, its term, its grace, its activation limit, its extras and its
		conditions. The caller states the 'version' it read, and a right that has moved on since is
		refused — an edit is the one act here that overwrites fields another operator may be looking at.
		"""
		updateEntitlement(id: ID!, input: UpdateEntitlementInput!, version: Int): EntitlementPayload!
		"""
		Suspends a right temporarily: a failed renewal, a dispute, an operator pause. Its activations
		are retained and refused at use, because a suspended right is expected to come back. The caller
		states the 'version' it read, and a right that has moved on since is refused.
		"""
		suspendEntitlement(id: ID!, reason: String, version: Int, idempotencyKey: String): EntitlementPayload!
		"""
		Returns a suspended right to force, clearing the reason the suspension recorded. A right whose
		term ran out while it was suspended is expired rather than resumed, and the payload carries the
		right as it ends up. The caller states the 'version' it read.
		"""
		resumeEntitlement(id: ID!, version: Int, idempotencyKey: String): EntitlementPayload!
		"""
		Lowers the ceiling a right carries, which is what a partial refund does. The surplus
		activations are revoked newest-first and a right reduced to zero is revoked outright, so this is
		not an edit of the quantity column: it is the act \`10-orders-payments-and-returns-spec.md\` gives
		the refund path, and it is deliberately not answered by \`extendEntitlement\`, which moves the term
		forward and returns a suspended right to force. The caller states the 'version' it read.
		"""
		reduceEntitlement(id: ID!, quantity: Int!, reason: String, version: Int): EntitlementPayload!
		"""
		Retires a right recoverably: the row is kept, with its keys and its activation history, unlike
		\`revokeEntitlement\`, which is terminal.
		"""
		softDeleteEntitlement(id: ID!): EntitlementPayload!
		"Restores a right that was retired recoverably."
		recoverEntitlement(id: ID!): EntitlementPayload!
		"Occupies a slot of a right for a device or a named seat."
		activateEntitlement(input: ActivateEntitlementInput!): ActivateEntitlementPayload!
		"Gives a slot back: released by the holder, or revoked by support."
		deactivateEntitlement(id: ID!, reason: String, revoked: Boolean): DeactivateEntitlementPayload!
		"""
		Corrects the recorded fields of a slot, without giving it back and without taking it away. The
		input is the route's own body type member for member. A slot's state, its right, its key, its device
		and its revocation reason are not in it and are refused by the service: a revoked slot set back to
		\`ACTIVE\` by an edit would sit past the activation limit, because the limit is only counted when a slot
		is taken.
		"""
		updateEntitlementActivation(id: ID!, input: UpdateEntitlementActivationInput!): EntitlementActivationPayload!
		"Retires an activation recoverably, leaving the row and the slot's history in place."
		softDeleteEntitlementActivation(id: ID!): EntitlementActivationPayload!
		"Restores an activation that was retired recoverably."
		recoverEntitlementActivation(id: ID!): EntitlementActivationPayload!
		"Issues a licence key. Its plaintext is returned once, in this response."
		issueEntitlementKey(input: IssueEntitlementKeyInput!): IssueEntitlementKeyPayload!
		"""
		Records who holds an issued credential. A key that already names a different holder is refused
		rather than reassigned, and the documented answer to a genuine reassignment is a new key.
		"""
		assignEntitlementKey(id: ID!, input: AssignEntitlementKeyInput!): EntitlementKeyPayload!
		"Withdraws a credential, releasing the activations it was used for."
		revokeEntitlementKey(id: ID!, reason: String!): EntitlementKeyPayload!
		"""
		Replaces a credential with a freshly generated one: the recovery path for a lost key, and the
		only one. The credential it replaces is revoked in the same transaction, the activations it was
		used for are released, and the pair are linked so "what happened to the key this customer was
		sent" has one answer.
		"""
		reissueEntitlementKey(id: ID!, input: ReissueEntitlementKeyInput!): ReissueEntitlementKeyPayload!
		"Retires a licence key recoverably, leaving the row in place."
		softDeleteEntitlementKey(id: ID!): EntitlementKeyPayload!
		"Restores a licence key that was retired recoverably."
		recoverEntitlementKey(id: ID!): EntitlementKeyPayload!
	}

	extend type Subscription {
		"Streams rights that were granted or changed."
		entitlementChanged(entitlementId: ID): Entitlement!
		"Streams rights that had a slot taken."
		entitlementActivated(entitlementId: ID): Entitlement!
		"Streams rights that were withdrawn."
		entitlementRevoked(entitlementId: ID): Entitlement!
	}
`;
