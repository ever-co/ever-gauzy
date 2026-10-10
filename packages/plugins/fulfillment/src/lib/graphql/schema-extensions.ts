import { gql } from 'graphql-tag';

/**
 * The fulfilment domain's contribution to the one GraphQL schema.
 *
 * Only `extend type Query` and `extend type Mutation` blocks and the domain's own types are declared:
 * the root types belong to the core schema, and a second `type Query` block would be a duplicate
 * definition that fails the boot. The type names are the concepts' own names.
 */
export const fulfillmentSchemaExtensions = gql`
	"A set of variants that ship the same way."
	type ShippingProfile {
		id: ID!
		tenantId: ID
		organizationId: ID
		name: String!
		code: String!
		isDefault: Boolean!
		description: String
		metadata: JSON
		variants: [ShippingProfileVariant!]
		createdAt: DateTime
		updatedAt: DateTime
	}

	"The pivot that attaches a variant to a shipping profile."
	type ShippingProfileVariant {
		id: ID!
		profileId: ID!
		variantId: ID!
		metadata: JSON
	}

	"A configured, sellable delivery choice."
	type ShippingOption {
		id: ID!
		tenantId: ID
		organizationId: ID
		name: String!
		code: String!
		priceType: String!
		amount: Decimal
		currency: String
		isTaxInclusive: Boolean!
		taxCategoryId: ID
		providerKey: String
		profileId: ID
		channelId: ID
		regionId: ID
		isActive: Boolean
		priority: Int!
		estimatedMinDays: Int
		estimatedMaxDays: Int
		requiresShippingAddress: Boolean!
		allowPickup: Boolean!
		maxWeight: Decimal
		maxItemCount: Int
		version: Int!
		metadata: JSON
		createdAt: DateTime
	}

	"One shipment against an order."
	type Fulfillment {
		id: ID!
		tenantId: ID
		organizationId: ID
		orderId: ID!
		direction: String!
		warehouseId: ID
		providerId: String
		status: String!
		trackingNumber: String
		trackingUrl: String
		carrier: String
		service: String
		labelUrl: String
		labelData: JSON
		shippedAt: DateTime
		deliveredAt: DateTime
		canceledAt: DateTime
		requiresShipping: Boolean!
		noNotification: Boolean!
		note: String
		version: Int!
		metadata: JSON
		lines: [FulfillmentLine!]
		createdAt: DateTime
		updatedAt: DateTime
	}

	"What is in one shipment."
	type FulfillmentLine {
		id: ID!
		fulfillmentId: ID!
		orderLineId: ID!
		quantity: Decimal!
		warehouseId: ID
		metadata: JSON
	}

	"One option together with why it is or is not available to a cart."
	type ShippingOptionEligibility {
		option: ShippingOption!
		eligible: Boolean!
		reason: String
	}

	"The price of one option for one cart, or the strategy that must be asked for it."
	type ShippingRate {
		amount: Decimal!
		currency: String
		providerKey: String
		eligible: Boolean!
		reason: String
	}

	"A page of shipping profiles."
	type ShippingProfileConnection {
		nodes: [ShippingProfile!]!
		edges: [ShippingProfileEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One shipping profile in a page, with the cursor that addresses it."
	type ShippingProfileEdge {
		node: ShippingProfile!
		cursor: String!
	}

	"A page of shipping options."
	type ShippingOptionConnection {
		nodes: [ShippingOption!]!
		edges: [ShippingOptionEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One shipping option in a page, with the cursor that addresses it."
	type ShippingOptionEdge {
		node: ShippingOption!
		cursor: String!
	}

	"A page of fulfilments."
	type FulfillmentConnection {
		nodes: [Fulfillment!]!
		edges: [FulfillmentEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One fulfilment in a page, with the cursor that addresses it."
	type FulfillmentEdge {
		node: Fulfillment!
		cursor: String!
	}

	input CreateShippingProfileInput {
		name: String!
		code: String!
		isDefault: Boolean
		description: String
		"""
		The client's own key for this request, honoured when one is presented. A request retried under
		the same key is answered with what the first attempt wrote instead of raising a second profile.
		"""
		idempotencyKey: String
	}

	input CreateShippingOptionInput {
		name: String!
		code: String!
		priceType: String!
		amount: Decimal
		currency: String
		isTaxInclusive: Boolean
		taxCategoryId: ID
		providerKey: String
		profileId: ID
		channelId: ID
		regionId: ID
		priority: Int
		estimatedMinDays: Int
		estimatedMaxDays: Int
		requiresShippingAddress: Boolean
		allowPickup: Boolean
		maxWeight: Decimal
		maxItemCount: Int
		"""
		The client's own key for this request, honoured when one is presented. A request retried under
		the same key is answered with what the first attempt wrote instead of raising a second option.
		"""
		idempotencyKey: String
	}

	input ShippingOptionAssignmentInput {
		profileId: ID!
		add: [ID!]
		remove: [ID!]
	}

	input FulfillmentLineInput {
		orderLineId: ID!
		quantity: Decimal!
		warehouseId: ID
	}

	input CreateFulfillmentInput {
		orderId: ID!
		direction: String
		warehouseId: ID
		providerId: String
		trackingNumber: String
		carrier: String
		service: String
		requiresShipping: Boolean
		noNotification: Boolean
		note: String
		lines: [FulfillmentLineInput!]!
		"""
		The client's own key for this request, which this operation requires. A fulfilment that is
		created twice ships the same goods twice, so the mutation is refused without one.
		"""
		idempotencyKey: String
	}

	input UpdateFulfillmentInput {
		trackingNumber: String
		trackingUrl: String
		carrier: String
		service: String
		noNotification: Boolean
		note: String
	}

	"""
	The writable surface of a shipment line, as the line's own edit route validates it.

	Every member is nullable, because an edit states what changed rather than restating the row. The set
	is that route's own DTO member for member: the shipment the line belongs to, the order line it covers,
	the quantity, the location the quantity came from, and the free payload the picking flow reads. The
	tenancy members that DTO inherits are deliberately absent, as they are on every input of this document
	— tenancy is resolved from the caller rather than stated by it, and a member that let a caller name
	another organization's row is a member no service of this platform accepts.
	"""
	input UpdateFulfillmentLineInput {
		fulfillmentId: ID
		orderLineId: ID
		quantity: Decimal
		warehouseId: ID
		metadata: JSON
	}

	input ShipFulfillmentInput {
		trackingNumber: String
		carrier: String
		service: String
		noNotification: Boolean
		"""
		The client's own key for this request, honoured when one is presented. A request retried under
		the same key is answered with the shipment the first attempt handed over.
		"""
		idempotencyKey: String
	}

	input RequestFulfillmentLabelInput {
		"The registered carrier strategy the label is requested from."
		providerId: String!
		"The service level to label the parcel for, when it differs from the one the shipment records."
		service: String
		"""
		The client's own key for this request, honoured when one is presented. A request retried under
		the same key is answered with the label the first attempt recorded, instead of asking the
		carrier a second time.
		"""
		idempotencyKey: String
		"""
		The version the caller read the fulfilment at. A label is written through the version-predicated
		update, so a shipment that moved on since it was read is refused rather than overwritten.
		"""
		version: Int
	}

	input ShippingEligibilityInput {
		channelId: ID
		regionId: ID
		profileIds: [ID!]
		totalWeight: Decimal
		itemCount: Int
		orderTotal: Decimal
	}

	extend type Query {
		"List shipping profiles."
		shippingProfiles(page: PageInput, withDeleted: Boolean): ShippingProfileConnection!
		"Read one shipping profile with its variants."
		shippingProfile(id: ID!): ShippingProfile
		"The profile a variant ships under, which is its own attachment or the organization default."
		shippingProfileForVariant(variantId: ID!): ShippingProfile
		"List shipping options."
		shippingOptions(page: PageInput, withDeleted: Boolean): ShippingOptionConnection!
		"Read one shipping option."
		shippingOption(id: ID!): ShippingOption
		"The options a cart may choose between, each with the reason it is or is not available."
		shippingOptionsForContext(input: ShippingEligibilityInput): [ShippingOptionEligibility!]!
		"Price one option for a cart context."
		shippingRate(shippingOptionId: ID!, input: ShippingEligibilityInput): ShippingRate
		"List fulfilments."
		fulfillments(orderId: ID, status: String, warehouseId: ID, direction: String, page: PageInput, withDeleted: Boolean): FulfillmentConnection!
		"Read one fulfilment with its lines."
		fulfillment(id: ID!): Fulfillment
		"What an order line still has to ship."
		fulfillmentOutstanding(orderLineId: ID!): Decimal!
	}

	extend type Mutation {
		createShippingProfile(input: CreateShippingProfileInput!): ShippingProfile!
		updateShippingProfile(id: ID!, input: CreateShippingProfileInput!): ShippingProfile!
		deleteShippingProfile(id: ID!): Boolean!
		"Retire a shipping profile recoverably, so the variants that ship under it keep their group."
		softDeleteShippingProfile(id: ID!): ShippingProfile!
		"Restore a soft-deleted shipping profile."
		recoverShippingProfile(id: ID!): ShippingProfile!
		assignShippingProfileVariant(input: ShippingOptionAssignmentInput!): [ShippingProfileVariant!]!
		"Retire a variant attachment recoverably, so the variant keeps the group it was placed in."
		softDeleteShippingProfileVariant(id: ID!): ShippingProfileVariant!
		"Restore a soft-deleted variant attachment."
		recoverShippingProfileVariant(id: ID!): ShippingProfileVariant!
		createShippingOption(input: CreateShippingOptionInput!): ShippingOption!
		updateShippingOption(id: ID!, input: CreateShippingOptionInput!): ShippingOption!
		deleteShippingOption(id: ID!): Boolean!
		"Retire a shipping option recoverably, so the carts that selected it keep their record."
		softDeleteShippingOption(id: ID!): ShippingOption!
		"Restore a soft-deleted shipping option."
		recoverShippingOption(id: ID!): ShippingOption!
		createFulfillment(input: CreateFulfillmentInput!): Fulfillment!
		updateFulfillment(id: ID!, input: UpdateFulfillmentInput!): Fulfillment!
		"Correct one shipment line: the quantity, the location, the order line it covers, or its payload."
		updateFulfillmentLine(id: ID!, input: UpdateFulfillmentLineInput!): FulfillmentLine!
		shipFulfillment(id: ID!, input: ShipFulfillmentInput): Fulfillment!
		markFulfillmentInTransit(id: ID!): Fulfillment!
		deliverFulfillment(id: ID!): Fulfillment!
		cancelFulfillment(id: ID!, reason: String): Fulfillment!
		"Request a carrier label for a shipment, or re-fetch the one the carrier already issued."
		requestFulfillmentLabel(id: ID!, input: RequestFulfillmentLabelInput!): Fulfillment!
		"Retire a shipment recoverably, so the order it satisfies keeps its shipping record."
		softDeleteFulfillment(id: ID!): Fulfillment!
		"Restore a soft-deleted shipment."
		recoverFulfillment(id: ID!): Fulfillment!
		"Remove a shipment outright. The recoverable withdrawal is softDeleteFulfillment."
		deleteFulfillment(id: ID!): Boolean!
		"Retire a shipment line recoverably, so what the shipment covered stays readable."
		softDeleteFulfillmentLine(id: ID!): FulfillmentLine!
		"Restore a soft-deleted shipment line."
		recoverFulfillmentLine(id: ID!): FulfillmentLine!
		"Remove a shipment line outright. The recoverable withdrawal is softDeleteFulfillmentLine."
		deleteFulfillmentLine(id: ID!): Boolean!
	}
`;
