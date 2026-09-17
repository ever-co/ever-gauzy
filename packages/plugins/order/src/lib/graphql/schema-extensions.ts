import { gql } from 'graphql-tag';

/**
 * The order domain's contribution to the one GraphQL schema.
 *
 * Only `extend type Query` and `extend type Mutation` blocks and the domain's own types are declared —
 * the root types belong to the core schema, and a second `type Query` block would be a duplicate
 * definition that fails the boot.
 *
 * Money is `Decimal`, never `Float`: the value is the exact decimal string a `numeric(20,6)` column
 * carries, so a value read over GraphQL and the same value read over REST are string-identical.
 *
 * The root fields declared here are the ones this package resolves. The invoice, quote and approval
 * mutations of the order domain are deliberately absent: they are performed through the core invoice
 * service and the platform approval module, and a root field with no resolver would fail at request time
 * rather than at boot, which is worse than a field that does not exist yet.
 */
export const orderSchemaExtensions = gql`
	"An order: the immutable commercial record."
	type Order {
		id: ID!
		tenantId: ID
		organizationId: ID
		number: String!
		displayId: String
		channelId: ID!
		regionId: ID
		customerId: ID
		userId: ID
		email: String
		phone: String
		currency: String!
		currencyDecimals: Int!
		locale: String
		status: String!
		paymentStatus: String!
		fulfillmentStatus: String!
		isDraft: Boolean!
		isTest: Boolean!
		cartId: ID
		parentOrderId: ID
		invoiceId: ID
		quoteInvoiceId: ID
		source: String
		sellerCount: Int!
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
		creditTotal: Decimal!
		outstandingTotal: Decimal!
		version: Int!
		placedAt: DateTime
		completedAt: DateTime
		canceledAt: DateTime
		cancelReason: String
		purchaseOrderNumber: String
		"The settlement schedule the order was placed against; null when none was agreed."
		paymentTermId: ID
		"The date the goods were promised: a cache of the lines, never authored."
		promisedAt: DateTime
		externalId: String
		metadata: JSON
		lines: [OrderLine!]
		addresses: [OrderAddress!]
		shippingMethods: [OrderShippingMethod!]
		creditLines: [OrderCreditLine!]
		changes: [OrderChange!]
		history: [OrderHistory!]
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One line of an order, with the price snapshot it was bought at."
	type OrderLine {
		id: ID!
		orderId: ID!
		productId: ID
		variantId: ID
		sellerId: ID
		invoiceItemId: ID
		title: String!
		sku: String
		barcode: String
		thumbnail: String
		quantity: Decimal!
		unitPrice: Decimal!
		originalUnitPrice: Decimal!
		isTaxInclusive: Boolean!
		isDiscountable: Boolean!
		requiresShipping: Boolean!
		taxCategoryId: ID
		weight: Decimal
		position: Int!
		note: String
		warehouseId: ID
		subscriptionId: ID
		fulfilledQuantity: Decimal!
		shippedQuantity: Decimal!
		deliveredQuantity: Decimal!
		returnRequestedQuantity: Decimal!
		returnReceivedQuantity: Decimal!
		returnDismissedQuantity: Decimal!
		writtenOffQuantity: Decimal!
		"Quantity delivered beyond what was outstanding, recorded rather than clamped."
		overFulfilledQuantity: Decimal!
		"What kind of line this is: a real line, a heading or a note."
		kind: OrderLineKind!
		"Cache: the quantity actually billed, over the line's invoice links."
		invoicedQuantity: Decimal!
		"Cache: the same links with direction CREDIT."
		creditedQuantity: Decimal!
		"Derived from the billing basis and the two counters; never authored."
		invoiceStatus: OrderLineInvoiceStatus!
		"Cache: the quantity paid back, over the refund lines of succeeded refunds."
		refundedQuantity: Decimal!
		"Cache: the money paid back, in the order's currency, as a positive magnitude."
		refundedAmount: Decimal!
		"The date this line was promised to the customer."
		promisedAt: DateTime
		"The lead time the promise was computed from."
		leadTimeDays: Int
		metadata: JSON
		"Every invoice item and credit-note item this line was billed through."
		invoiceLinks: [OrderLineInvoice!]
	}

	"One line-to-invoice link: the pivot that makes a partial invoice expressible."
	type OrderLineInvoice {
		id: ID!
		orderLineId: ID!
		"The invoice item, or the credit-note item, this link records."
		invoiceItemId: ID!
		"Which way this link moves the line's counters."
		direction: OrderLineInvoiceDirection!
		"The quantity the item actually billed, in the line's unit."
		quantity: Decimal!
		"The signed amount the item carried; negative for a credit."
		amount: Decimal!
		currency: String!
		metadata: JSON
		createdAt: DateTime
		updatedAt: DateTime
	}

	"What one line's invoicing counters say, and what is left to bill."
	type OrderLineInvoicingPosition {
		"The quantity the line is invoiced against."
		basisQuantity: Decimal!
		invoicedQuantity: Decimal!
		creditedQuantity: Decimal!
		"The basis less what has been invoiced, never negative."
		toInvoiceQuantity: Decimal!
		invoiceStatus: OrderLineInvoiceStatus!
	}

	"What kind of line this is."
	enum OrderLineKind {
		"A real line: priced, fulfilled, invoiced."
		ITEM
		"A presentation heading, which carries no quantity and no price."
		SECTION
		"A free-text line between items."
		NOTE
	}

	"How much of a line has been billed."
	enum OrderLineInvoiceStatus {
		NOT_INVOICED
		PARTIALLY_INVOICED
		INVOICED
		OVER_INVOICED
	}

	"Which way a line-to-invoice link moves the counters."
	enum OrderLineInvoiceDirection {
		"A positive invoice item that bills part of the line."
		INVOICE
		"A negative credit-note item that credits part of the line."
		CREDIT
	}

	"A frozen address of an order."
	type OrderAddress {
		id: ID!
		orderId: ID!
		type: String!
		sourceAddressId: ID
		contactName: String
		company: String
		firstName: String
		lastName: String
		phone: String
		email: String
		line1: String!
		line2: String
		city: String!
		province: String
		provinceCode: String
		postalCode: String
		countryCode: String!
		countryId: ID
		latitude: Decimal
		longitude: Decimal
	}

	"A delivery choice frozen on an order."
	type OrderShippingMethod {
		id: ID!
		orderId: ID!
		shippingOptionId: ID
		name: String!
		amount: Decimal!
		isTaxInclusive: Boolean!
		taxCategoryId: ID
		position: Int!
		data: JSON
		metadata: JSON
	}

	"The totals of one committed order version."
	type OrderSummary {
		id: ID!
		orderId: ID!
		version: Int!
		totals: JSON!
		currency: String!
		reason: String
		createdAt: DateTime
	}

	"One movement of money against an order. Append-only."
	type OrderTransaction {
		id: ID!
		orderId: ID!
		amount: Decimal!
		currency: String!
		type: String!
		referenceType: String
		referenceId: ID
		description: String
		occurredAt: DateTime
		metadata: JSON
	}

	"A post-placement modification of an order."
	type OrderChange {
		id: ID!
		orderId: ID!
		version: Int!
		changeType: String!
		status: String!
		returnId: ID
		claimId: ID
		exchangeId: ID
		subscriptionId: ID
		requestedAt: DateTime
		confirmedAt: DateTime
		declinedAt: DateTime
		canceledAt: DateTime
		note: String
		priceChange: Decimal
		isSettled: Boolean!
		metadata: JSON
		actions: [OrderChangeAction!]
		createdAt: DateTime
	}

	"One action inside a change."
	type OrderChangeAction {
		id: ID!
		changeId: ID!
		action: String!
		details: JSON
		amount: Decimal
		referenceType: String
		referenceId: ID
		ordering: Int!
		applied: Boolean!
		appliedAt: DateTime
	}

	"Money owed back to the buyer."
	type OrderCreditLine {
		id: ID!
		orderId: ID!
		version: Int!
		referenceType: String
		referenceId: ID
		amount: Decimal!
		currency: String!
		description: String
	}

	"One entry of an order's own timeline. Append-only."
	type OrderHistory {
		id: ID!
		orderId: ID!
		action: String!
		title: String
		description: String
		userId: ID
		metadata: JSON
		createdAt: DateTime
	}

	"The computed totals of an order."
	type OrderTotals {
		itemSubtotal: Decimal!
		itemDiscountTotal: Decimal!
		itemTaxTotal: Decimal!
		shippingSubtotal: Decimal!
		shippingDiscountTotal: Decimal!
		shippingTaxTotal: Decimal!
		discountTotal: Decimal!
		taxTotal: Decimal!
		grandTotal: Decimal!
		creditTotal: Decimal!
		paidTotal: Decimal!
		refundedTotal: Decimal!
		outstandingTotal: Decimal!
		currency: String!
		currencyDecimals: Int!
	}

	type OrderConnection {
		items: [Order!]!
		total: Int!
	}

	type OrderChangeConnection {
		items: [OrderChange!]!
		total: Int!
	}

	type OrderSummaryConnection {
		items: [OrderSummary!]!
		total: Int!
	}

	type OrderTransactionConnection {
		items: [OrderTransaction!]!
		total: Int!
	}

	input CreateOrderInput {
		channelId: ID!
		regionId: ID
		customerId: ID
		email: String
		phone: String
		currency: String!
		currencyDecimals: Int
		locale: String
		isTest: Boolean
		source: String
		"The settlement schedule the order is placed against."
		paymentTermId: ID
		externalId: String
	}

	input UpdateOrderInput {
		email: String
		phone: String
		locale: String
		note: String
		externalId: String
		cancelReason: String
		paymentTermId: ID
	}

	"The request that records one line-to-invoice link."
	input OrderLineInvoiceInput {
		orderLineId: ID!
		invoiceItemId: ID!
		"Which way the link moves the counters; a bill when omitted."
		direction: OrderLineInvoiceDirection
		"The quantity the item actually billed, in the line's unit."
		quantity: Decimal!
		"The signed amount the item carried; negative for a credit."
		amount: Decimal!
		currency: String!
		"The quantity the line is invoiced against; the ordered quantity when omitted."
		basisQuantity: Decimal
		metadata: JSON
	}

	"The answer to recording a link."
	type OrderLineInvoicePayload {
		link: OrderLineInvoice
		"The line as it stands after the counters moved."
		line: OrderLine
	}

	input OrderChangeActionInput {
		action: String!
		details: JSON
		amount: Decimal
		referenceType: String
		referenceId: ID
	}

	input RequestOrderEditInput {
		orderId: ID!
		changeType: String
		note: String
		actions: [OrderChangeActionInput!]!
	}

	extend type Query {
		"List orders of the caller's organization."
		orders(
			status: String
			paymentStatus: String
			fulfillmentStatus: String
			customerId: ID
			channelId: ID
			page: PageInput
		): OrderConnection!
		"Read one order."
		order(id: ID!): Order
		"Read one order by its human number."
		orderByNumber(number: String!): Order
		"The computed totals of one order."
		orderTotals(id: ID!): OrderTotals
		"The totals history of one order, one row per version."
		orderSummaries(orderId: ID!): OrderSummaryConnection!
		"The money ledger of one order."
		orderTransactions(orderId: ID!, type: String): OrderTransactionConnection!
		"The timeline of one order."
		orderHistory(orderId: ID!): [OrderHistory!]!
		"The changes of one order."
		orderChanges(orderId: ID!, status: String): OrderChangeConnection!
		"Read one change with its actions."
		orderChange(id: ID!): OrderChange
		"Every item and credit-note item one order line was billed through, oldest first."
		orderLineInvoices(orderLineId: ID!): [OrderLineInvoice!]!
		"How much of one order line is left to bill."
		orderLineInvoicingPosition(orderLineId: ID!, basisQuantity: Decimal): OrderLineInvoicingPosition!
	}

	extend type Mutation {
		createOrder(input: CreateOrderInput!): Order!
		updateOrder(id: ID!, input: UpdateOrderInput!): Order!
		cancelOrder(id: ID!, reason: String): Order!
		archiveOrder(id: ID!): Order!
		placeOrder(id: ID!): Order!
		confirmOrder(id: ID!): Order!
		recalculateOrder(id: ID!): Order!
		"Create a change: the only way a placed order is modified."
		requestOrderEdit(input: RequestOrderEditInput!): OrderChange!
		confirmOrderChange(id: ID!): OrderChange!
		declineOrderChange(id: ID!, reason: String): OrderChange!
		cancelOrderChange(id: ID!, reason: String): OrderChange!
		"Records a link and moves the line's counters with it, in one transaction."
		recordOrderLineInvoice(input: OrderLineInvoiceInput!): OrderLineInvoicePayload!
		"Amends a link's tenant extras; the rest of the row describes an issued document."
		updateOrderLineInvoice(id: ID!, metadata: JSON): OrderLineInvoice!
		"Removes a link and re-derives the line's counters from what remains."
		deleteOrderLineInvoice(id: ID!): DeleteOrderLineInvoicePayload!
		"Re-derives the counters of a line from its links — the reconciliation read."
		recomputeOrderLineInvoices(orderLineId: ID!, basisQuantity: Decimal): OrderLine!
		"Records one refund against a line, in as many parts as it was paid in."
		recordOrderLineRefund(input: OrderLineRefundInput!): OrderLine!
	}

	"The request that records one refund against an order line."
	input OrderLineRefundInput {
		orderLineId: ID!
		"The quantity paid back, as a positive magnitude."
		quantity: Decimal!
		"The money paid back, in the order currency, as a positive magnitude."
		amount: Decimal!
		"Currency of the amount; checked against the order the line belongs to."
		currency: String!
	}

	"What removing a link did."
	type DeleteOrderLineInvoicePayload {
		id: ID!
		deleted: Boolean!
	}
`;
