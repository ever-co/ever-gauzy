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

	type ShippingProfileConnection {
		items: [ShippingProfile!]!
		total: Int!
	}

	type ShippingOptionConnection {
		items: [ShippingOption!]!
		total: Int!
	}

	type FulfillmentConnection {
		items: [Fulfillment!]!
		total: Int!
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
		shippingProfiles(page: PageInput): ShippingProfileConnection!
		"Read one shipping profile with its variants."
		shippingProfile(id: ID!): ShippingProfile
		"The profile a variant ships under, which is its own attachment or the organization default."
		shippingProfileForVariant(variantId: ID!): ShippingProfile
		"List shipping options."
		shippingOptions(page: PageInput): ShippingOptionConnection!
		"Read one shipping option."
		shippingOption(id: ID!): ShippingOption
		"The options a cart may choose between, each with the reason it is or is not available."
		shippingOptionsForContext(input: ShippingEligibilityInput): [ShippingOptionEligibility!]!
		"Price one option for a cart context."
		shippingRate(shippingOptionId: ID!, input: ShippingEligibilityInput): ShippingRate
		"List fulfilments."
		fulfillments(orderId: ID, status: String, warehouseId: ID, direction: String, page: PageInput): FulfillmentConnection!
		"Read one fulfilment with its lines."
		fulfillment(id: ID!): Fulfillment
		"What an order line still has to ship."
		fulfillmentOutstanding(orderLineId: ID!): Decimal!
	}

	extend type Mutation {
		createShippingProfile(input: CreateShippingProfileInput!): ShippingProfile!
		updateShippingProfile(id: ID!, input: CreateShippingProfileInput!): ShippingProfile!
		deleteShippingProfile(id: ID!): Boolean!
		assignShippingProfileVariant(input: ShippingOptionAssignmentInput!): [ShippingProfileVariant!]!
		createShippingOption(input: CreateShippingOptionInput!): ShippingOption!
		updateShippingOption(id: ID!, input: CreateShippingOptionInput!): ShippingOption!
		deleteShippingOption(id: ID!): Boolean!
		createFulfillment(input: CreateFulfillmentInput!): Fulfillment!
		updateFulfillment(id: ID!, input: UpdateFulfillmentInput!): Fulfillment!
		shipFulfillment(id: ID!, input: ShipFulfillmentInput): Fulfillment!
		markFulfillmentInTransit(id: ID!): Fulfillment!
		deliverFulfillment(id: ID!): Fulfillment!
		cancelFulfillment(id: ID!, reason: String): Fulfillment!
	}
`;
