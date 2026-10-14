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

	"A page of carts."
	type CartConnection {
		nodes: [Cart!]!
		edges: [CartEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One cart in a page, with the cursor that addresses it."
	type CartEdge {
		node: Cart!
		cursor: String!
	}

	"A page of checkout sessions."
	type CheckoutSessionConnection {
		nodes: [CheckoutSession!]!
		edges: [CheckoutSessionEdge!]!
		totalCount: Int!
		pageInfo: PageInfo!
	}

	"One checkout session in a page, with the cursor that addresses it."
	type CheckoutSessionEdge {
		node: CheckoutSession!
		cursor: String!
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
		idempotencyKey: String
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
		version: Int
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
		version: Int
		idempotencyKey: String
	}

	input UpdateCartLineInput {
		cartId: ID!
		lineId: ID!
		quantity: Decimal
		unitPrice: Decimal
		note: String
		warehouseId: ID
		version: Int
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
		version: Int
		idempotencyKey: String
	}

	input ApplyCartPromotionInput {
		cartId: ID!
		promotionId: ID
		couponId: ID
		code: String
		amount: Decimal!
		isAutomatic: Boolean
		version: Int
		idempotencyKey: String
	}

	input StartCheckoutInput {
		cartId: ID!
		step: String
		idempotencyKey: String
	}

	input CompleteCheckoutInput {
		cartId: ID!
		version: Int
		idempotencyKey: String
		paymentSessionId: ID
	}

	"The writable surface of a checkout session, as the session's own update route states it."
	input UpdateCheckoutSessionInput {
		cartId: ID
		status: String
		step: String
		"The steps already completed, in the order they were completed; \`completeStepCommerceCheckoutSession\` appends to it."
		completedSteps: [String!]
		"The input accumulated across the steps."
		data: JSON
	}

	extend type Query {
		"List carts of the caller's organization."
		carts(status: String, customerId: ID, email: String, page: PageInput, withDeleted: Boolean): CartConnection!
		"Read one cart with its lines, delivery choices and promotions."
		cart(id: ID!): Cart
		"Read the cart a buyer token names."
		cartByToken(token: String!): Cart
		"List checkout sessions."
		checkoutSessions(cartId: ID, status: String, page: PageInput, withDeleted: Boolean): CheckoutSessionConnection!
		"Read one checkout session."
		checkoutSession(id: ID!): CheckoutSession
	}

	extend type Mutation {
		createCart(input: CreateCartInput!): Cart!
		updateCart(id: ID!, input: UpdateCartInput!): Cart!
		deleteCart(id: ID!, version: Int): Boolean!
		associateCartWithContact(id: ID!, contactId: ID!, version: Int): Cart!
		mergeCarts(targetCartId: ID!, sourceCartId: ID!, version: Int, idempotencyKey: String): Cart!
		addCartLine(input: AddCartLineInput!): Cart!
		updateCartLine(input: UpdateCartLineInput!): Cart!
		removeCartLine(cartId: ID!, lineId: ID!, version: Int): Cart!
		setCartShippingMethod(input: SetCartShippingMethodInput!): Cart!
		removeCartShippingMethod(cartId: ID!, version: Int): Cart!
		applyCartPromotion(input: ApplyCartPromotionInput!): Cart!
		removeCartPromotion(cartId: ID!, code: String!, version: Int): Cart!
		startCheckout(input: StartCheckoutInput!): CheckoutSession!
		completeCheckout(input: CompleteCheckoutInput!): CheckoutResult!
		abandonCheckout(cartId: ID!, version: Int): Cart!
		# The four write routes of this domain that no field answered at all. A name-based audit matches a
		# route's handler name against the root fields, so it flags a route whose capability a field serves
		# under another name and a child resource's own addressing of a capability the cart already offers;
		# of the twenty-six routes it flags in this package, these four are the ones that are genuinely
		# unserved. The cart's recalculation route recomputes the cart and nothing else does; the checkout
		# session's own update, its step report and its destructive delete are three routes a session
		# answers and no cart field reaches — the cart's abandonCheckout abandons the CART, and the
		# session's recoverable withdrawal keeps the row this one removes. Each field below mirrors one
		# route: the same service method with the same arguments, the same permission the route's own
		# handler states, and the same retry scope and version expectation the route declares. The other
		# twenty-two are read out in the plugin's spec, route by route.
		"Recomputes a cart's prices, promotions and totals. The version argument is the one the caller read the cart at."
		recalculateCommerceCart(id: ID!, version: Int): Cart!
		"Amends a checkout session's own record, as its update route's body states it."
		updateCommerceCheckoutSession(id: ID!, input: UpdateCheckoutSessionInput!): CheckoutSession!
		"Records that a step of a checkout session completed, appending it to the session's path."
		completeStepCommerceCheckoutSession(id: ID!, step: String!, data: JSON, idempotencyKey: String): CheckoutSession!
		"Deletes a checkout session outright. \`softDeleteCommerceCheckoutSession\` retires it recoverably instead."
		deleteCommerceCheckoutSession(id: ID!): Boolean!
		# The recoverable lifecycle pair, one field per resource of this domain: every controller here
		# extends CrudController and overrides both inherited routes only to state a permission, so REST
		# has served a gated withdraw/restore pair over five resources while no field answered either half
		# of it. Each field below mirrors one of those routes — the same service method, the same
		# identifier, the same grant the route states — and each answers the row the route answers, which
		# is what this domain's other mutations answer too (createCart and updateCart answer Cart!,
		# startCheckout answers CheckoutSession!) rather than a result object invented for the pair. The
		# field names carry the resource's own name, CommerceCart and CommerceCheckoutSession included,
		# because that is the name a controller declares and the name the write-parity gate reads; the
		# types stay the concepts' short names, as every other field of this document does.
		"Retires a cart recoverably, keeping its lines, delivery choices and promotions."
		softDeleteCommerceCart(id: ID!): Cart!
		"Restores a soft-deleted cart."
		recoverCommerceCart(id: ID!): Cart!
		"Retires a cart line recoverably, keeping its price snapshot."
		softDeleteCommerceCartLine(id: ID!): CartLine!
		"Restores a soft-deleted cart line."
		recoverCommerceCartLine(id: ID!): CartLine!
		"Retires an applied promotion recoverably, keeping the discount it recorded."
		softDeleteCommerceCartPromotion(id: ID!): CartPromotion!
		"Restores a soft-deleted applied promotion."
		recoverCommerceCartPromotion(id: ID!): CartPromotion!
		"Retires a delivery choice recoverably, keeping the amount it was quoted at."
		softDeleteCommerceCartShippingMethod(id: ID!): CartShippingMethod!
		"Restores a soft-deleted delivery choice."
		recoverCommerceCartShippingMethod(id: ID!): CartShippingMethod!
		"Retires a checkout session recoverably, keeping the progress it recorded."
		softDeleteCommerceCheckoutSession(id: ID!): CheckoutSession!
		"Restores a soft-deleted checkout session."
		recoverCommerceCheckoutSession(id: ID!): CheckoutSession!
	}
`;
