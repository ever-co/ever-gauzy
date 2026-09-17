import { gql } from 'graphql-tag';

/**
 * The cart domain's contribution to the one GraphQL schema.
 *
 * Only `extend type Query`, `extend type Mutation` and the domain's own object types are declared
 * here: the root types belong to the core schema, and a second `type Query` block would be a duplicate
 * definition that fails the boot. Every type name is the concept's own name — `Cart`, not
 * `CommerceCart` — because inside one schema `Cart` is unambiguous; only the tables keep the prefix,
 * and the mapping is one-way.
 *
 * Money is `Decimal`, never `Float`: the value is the exact decimal string a `numeric(20,6)` column
 * carries, so a value read over GraphQL and the same value read over REST are string-identical.
 */
export const cartSchemaExtensions = gql`
	"A cart: what a buyer assembles before it becomes an order."
	type Cart {
		id: ID!
		tenantId: ID
		organizationId: ID
		channelId: ID!
		regionId: ID
		customerId: ID
		userId: ID
		email: String
		currency: String!
		currencyDecimals: Int!
		locale: String
		status: String!
		orderId: ID
		note: String
		isTaxExempt: Boolean!
		version: Int!
		itemSubtotal: Decimal!
		itemDiscountTotal: Decimal!
		itemTaxTotal: Decimal!
		shippingSubtotal: Decimal!
		shippingDiscountTotal: Decimal!
		shippingTaxTotal: Decimal!
		discountTotal: Decimal!
		taxTotal: Decimal!
		grandTotal: Decimal!
		paidTotal: Decimal!
		refundedTotal: Decimal!
		expiresAt: DateTime
		lastActivityAt: DateTime
		completedAt: DateTime
		abandonedAt: DateTime
		externalId: String
		metadata: JSON
		lines: [CartLine!]
		shippingMethods: [CartShippingMethod!]
		promotions: [CartPromotion!]
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One line of a cart, with its price snapshot."
	type CartLine {
		id: ID!
		cartId: ID!
		productId: ID
		variantId: ID
		sellerId: ID
		title: String!
		sku: String
		thumbnail: String
		quantity: Decimal!
		unitPrice: Decimal!
		originalUnitPrice: Decimal!
		isTaxInclusive: Boolean!
		taxCategoryId: ID
		isDiscountable: Boolean!
		requiresShipping: Boolean!
		weight: Decimal
		position: Int!
		note: String
		warehouseId: ID
		subscriptionPlanId: ID
		metadata: JSON
	}

	"A delivery choice held against a cart."
	type CartShippingMethod {
		id: ID!
		cartId: ID!
		shippingOptionId: ID
		name: String!
		amount: Decimal!
		isTaxInclusive: Boolean!
		isManual: Boolean!
		taxCategoryId: ID
		position: Int!
		data: JSON
		metadata: JSON
	}

	"A promotion as it was applied to a cart."
	type CartPromotion {
		id: ID!
		cartId: ID!
		promotionId: ID
		couponId: ID
		code: String
		amount: Decimal!
		isAutomatic: Boolean!
		appliedAt: DateTime
	}

	"The state of an in-progress checkout."
	type CheckoutSession {
		id: ID!
		cartId: ID!
		status: String!
		step: String
		completedSteps: [String!]
		data: JSON
		expiresAt: DateTime
		operationId: ID
		createdAt: DateTime
		updatedAt: DateTime
	}

	"The totals an order placed from a cart was computed with."
	type CartTotals {
		itemSubtotal: Decimal!
		itemDiscountTotal: Decimal!
		itemTaxTotal: Decimal!
		shippingSubtotal: Decimal!
		shippingDiscountTotal: Decimal!
		shippingTaxTotal: Decimal!
		discountTotal: Decimal!
		taxTotal: Decimal!
		grandTotal: Decimal!
		currency: String!
		currencyDecimals: Int!
	}

	type CartConnection {
		items: [Cart!]!
		total: Int!
	}

	type CheckoutSessionConnection {
		items: [CheckoutSession!]!
		total: Int!
	}

	"The outcome of a checkout: the order the cart became."
	type CheckoutResult {
		orderId: ID!
		orderNumber: String!
		cart: Cart!
	}

	input CreateCartInput {
		channelId: ID!
		regionId: ID
		customerId: ID
		email: String
		currency: String!
		currencyDecimals: Int
		locale: String
		note: String
		externalId: String
	}

	input UpdateCartInput {
		email: String
		regionId: ID
		customerId: ID
		shippingAddressId: ID
		billingAddressId: ID
		note: String
		isTaxExempt: Boolean
		externalId: String
	}

	input AddCartLineInput {
		cartId: ID!
		productId: ID
		variantId: ID!
		title: String
		sku: String
		thumbnail: String
		quantity: Decimal!
		unitPrice: Decimal!
		originalUnitPrice: Decimal
		isTaxInclusive: Boolean
		taxCategoryId: ID
		isDiscountable: Boolean
		requiresShipping: Boolean
		weight: Decimal
		note: String
		warehouseId: ID
		subscriptionPlanId: ID
	}

	input UpdateCartLineInput {
		cartId: ID!
		lineId: ID!
		quantity: Decimal
		unitPrice: Decimal
		note: String
		warehouseId: ID
	}

	input SetCartShippingMethodInput {
		cartId: ID!
		shippingOptionId: ID
		name: String!
		amount: Decimal!
		isTaxInclusive: Boolean
		isManual: Boolean
		taxCategoryId: ID
		data: JSON
	}

	input ApplyCartPromotionInput {
		cartId: ID!
		promotionId: ID
		couponId: ID
		code: String
		amount: Decimal!
		isAutomatic: Boolean
	}

	input StartCheckoutInput {
		cartId: ID!
		step: String
	}

	input CompleteCheckoutInput {
		cartId: ID!
		idempotencyKey: String
		paymentSessionId: ID
	}

	extend type Query {
		"List carts of the caller's organization."
		carts(status: String, customerId: ID, email: String, page: PageInput): CartConnection!
		"Read one cart with its lines, delivery choices and promotions."
		cart(id: ID!): Cart
		"Read the cart a buyer token names."
		cartByToken(token: String!): Cart
		"List checkout sessions."
		checkoutSessions(cartId: ID, status: String, page: PageInput): CheckoutSessionConnection!
		"Read one checkout session."
		checkoutSession(id: ID!): CheckoutSession
	}

	extend type Mutation {
		createCart(input: CreateCartInput!): Cart!
		updateCart(id: ID!, input: UpdateCartInput!): Cart!
		deleteCart(id: ID!): Boolean!
		associateCartWithContact(id: ID!, contactId: ID!): Cart!
		mergeCarts(targetCartId: ID!, sourceCartId: ID!): Cart!
		addCartLine(input: AddCartLineInput!): Cart!
		updateCartLine(input: UpdateCartLineInput!): Cart!
		removeCartLine(cartId: ID!, lineId: ID!): Cart!
		setCartShippingMethod(input: SetCartShippingMethodInput!): Cart!
		removeCartShippingMethod(cartId: ID!): Cart!
		applyCartPromotion(input: ApplyCartPromotionInput!): Cart!
		removeCartPromotion(cartId: ID!, code: String!): Cart!
		startCheckout(input: StartCheckoutInput!): CheckoutSession!
		completeCheckout(input: CompleteCheckoutInput!): CheckoutResult!
		abandonCheckout(cartId: ID!): Cart!
	}
`;
