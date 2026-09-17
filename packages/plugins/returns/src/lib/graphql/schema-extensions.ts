import { gql } from 'graphql-tag';

/**
 * The GraphQL surface of the returns domain.
 *
 * Types, inputs, enums and the domain's root fields, declared as one document that is composed into
 * the platform schema at boot. The root operation types belong to the kernel, so this file only
 * extends them — a second declaration of `type Query` would be a duplicate definition and would fail
 * the schema build.
 *
 * Money and quantities are `Decimal`, never `Float`: an amount read here and the same amount read
 * over REST are the same string, and a binary fraction cannot hold a cent exactly.
 */
export const schemaExtensions = gql`
	"Where a return is in its lifecycle."
	enum OrderReturnStatus {
		OPEN
		REQUESTED
		APPROVED
		RECEIVED
		PARTIALLY_RECEIVED
		REJECTED
		CANCELED
		CLOSED
	}

	"The resolution a claim asks for."
	enum OrderClaimType {
		REFUND
		REPLACE
	}

	"Where a claim is in its lifecycle."
	enum OrderClaimStatus {
		OPEN
		REQUESTED
		APPROVED
		REJECTED
		CANCELED
		CLOSED
	}

	"Why a claim line is being claimed."
	enum OrderClaimReason {
		MISSING_ITEM
		WRONG_ITEM
		PRODUCTION_FAILURE
		DAMAGED
		OTHER
	}

	"Where an exchange is in its lifecycle."
	enum OrderExchangeStatus {
		OPEN
		REQUESTED
		APPROVED
		REJECTED
		CANCELED
		CLOSED
	}

	"Goods coming back against a delivered order."
	type OrderReturn {
		id: ID!
		"The order the goods came from."
		orderId: ID
		"The allocated return number."
		number: String!
		status: OrderReturnStatus!
		"Receiving location."
		warehouseId: ID
		"The governed reason the return was filed under."
		reasonId: ID
		reasonCode: OrderReturnReason
		"Free-text explanation kept beside the governed reason."
		reason: String
		"What the tenant expects to refund."
		refundAmount: Decimal
		currency: String!
		requestedAt: DateTime
		approvedAt: DateTime
		receivedAt: DateTime
		canceledAt: DateTime
		closedAt: DateTime
		"The claim this return was created by, when it was."
		claimId: ID
		"The exchange this return is the inbound half of, when it is."
		exchangeId: ID
		shippingOptionId: ID
		noNotification: Boolean!
		note: String
		metadata: JSON
		lines: [OrderReturnLine!]!
		"The quantity still expected back across the return's lines."
		outstandingQuantity: Decimal!
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One line of a return."
	type OrderReturnLine {
		id: ID!
		returnId: ID
		orderLineId: ID
		quantity: Decimal!
		receivedQuantity: Decimal!
		damagedQuantity: Decimal!
		reasonId: ID
		restock: Boolean!
		warehouseId: ID
		note: String
		metadata: JSON
		"The quantity still expected back on this line."
		outstandingQuantity: Decimal!
	}

	"A governed reason code for returns."
	type OrderReturnReason {
		id: ID!
		code: String!
		label: String!
		description: String
		parentId: ID
		isActive: Boolean
		children: [OrderReturnReason!]!
	}

	"A complaint about a delivered order and the resolution chosen for it."
	type OrderClaim {
		id: ID!
		orderId: ID
		number: String!
		type: OrderClaimType!
		status: OrderClaimStatus!
		refundAmount: Decimal
		currency: String!
		"The return created for this claim, when the goods have to come back."
		returnId: ID
		returnOfClaim: OrderReturn
		reason: String
		note: String
		canceledAt: DateTime
		metadata: JSON
		lines: [OrderClaimLine!]!
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One line of a claim."
	type OrderClaimLine {
		id: ID!
		claimId: ID
		orderLineId: ID
		variantId: ID
		quantity: Decimal!
		reason: OrderClaimReason!
		isAdditionalItem: Boolean!
		note: String
		metadata: JSON
	}

	"A return that immediately becomes a new shipment."
	type OrderExchange {
		id: ID!
		orderId: ID
		number: String!
		status: OrderExchangeStatus!
		"Outbound value minus inbound value: positive when the customer owes money."
		differenceDue: Decimal
		currency: String!
		"The inbound half."
		returnId: ID
		returnOfExchange: OrderReturn
		allowBackorder: Boolean!
		note: String
		canceledAt: DateTime
		metadata: JSON
		lines: [OrderExchangeLine!]!
		createdAt: DateTime
		updatedAt: DateTime
	}

	"One outbound line of an exchange."
	type OrderExchangeLine {
		id: ID!
		exchangeId: ID
		orderLineId: ID
		variantId: ID
		quantity: Decimal!
		"The replacement price, snapshotted so the difference stays explainable."
		unitPrice: Decimal!
		note: String
		metadata: JSON
		"""
		The value of this line: quantity multiplied by the snapshotted unit price, expressed in the
		currency the caller states. The currency is an argument rather than a stored field because a
		line belongs to an exchange, and the exchange is where the currency lives.
		"""
		lineTotal(currency: String!): Decimal!
	}

	"One page of returns."
	type OrderReturnConnection {
		edges: [OrderReturnEdge!]!
		nodes: [OrderReturn!]!
		pageInfo: PageInfo!
		total: Int!
	}

	"One return inside a page."
	type OrderReturnEdge {
		cursor: String!
		node: OrderReturn!
	}

	"One page of return reasons."
	type OrderReturnReasonConnection {
		edges: [OrderReturnReasonEdge!]!
		nodes: [OrderReturnReason!]!
		pageInfo: PageInfo!
		total: Int!
	}

	"One return reason inside a page."
	type OrderReturnReasonEdge {
		cursor: String!
		node: OrderReturnReason!
	}

	"One page of claims."
	type OrderClaimConnection {
		edges: [OrderClaimEdge!]!
		nodes: [OrderClaim!]!
		pageInfo: PageInfo!
		total: Int!
	}

	"One claim inside a page."
	type OrderClaimEdge {
		cursor: String!
		node: OrderClaim!
	}

	"One page of exchanges."
	type OrderExchangeConnection {
		edges: [OrderExchangeEdge!]!
		nodes: [OrderExchange!]!
		pageInfo: PageInfo!
		total: Int!
	}

	"One exchange inside a page."
	type OrderExchangeEdge {
		cursor: String!
		node: OrderExchange!
	}

	"Filters a page of returns."
	input OrderReturnFilter {
		status: OrderReturnStatus
		orderId: ID
		number: String
		warehouseId: ID
	}

	"Filters a page of return reasons."
	input OrderReturnReasonFilter {
		isActive: Boolean
		parentId: ID
		code: String
	}

	"Filters a page of claims."
	input OrderClaimFilter {
		status: OrderClaimStatus
		type: OrderClaimType
		orderId: ID
		number: String
	}

	"Filters a page of exchanges."
	input OrderExchangeFilter {
		status: OrderExchangeStatus
		orderId: ID
		number: String
	}

	"One requested line of a return."
	input OrderReturnLineInput {
		orderLineId: ID!
		quantity: Decimal!
		reasonId: ID
		restock: Boolean
		warehouseId: ID
		note: String
	}

	"The request that opens a return."
	input RequestOrderReturnInput {
		orderId: ID!
		lines: [OrderReturnLineInput!]!
		warehouseId: ID
		reasonId: ID
		reason: String
		currency: String!
		shippingOptionId: ID
		noNotification: Boolean
		note: String
	}

	"One line as it is received back."
	input ReceiveOrderReturnLineInput {
		lineId: ID!
		receivedQuantity: Decimal!
		damagedQuantity: Decimal
		restock: Boolean
	}

	"The receipt of a return's goods."
	input ReceiveOrderReturnInput {
		lines: [ReceiveOrderReturnLineInput!]!
		warehouseId: ID
		refund: Decimal
		note: String
	}

	"The definition of a governed return reason."
	input OrderReturnReasonInput {
		code: String!
		label: String!
		description: String
		parentId: ID
		isActive: Boolean
	}

	"One claimed line."
	input OrderClaimLineInput {
		orderLineId: ID
		variantId: ID
		quantity: Decimal!
		reason: OrderClaimReason
		isAdditionalItem: Boolean
		note: String
	}

	"The request that opens a claim."
	input RequestOrderClaimInput {
		orderId: ID!
		type: OrderClaimType!
		currency: String!
		lines: [OrderClaimLineInput!]!
		reason: String
		note: String
	}

	"One requested replacement line."
	input OrderExchangeLineInput {
		orderLineId: ID
		variantId: ID!
		quantity: Decimal!
		unitPrice: Decimal
		note: String
	}

	"The request that opens an exchange."
	input RequestOrderExchangeInput {
		orderId: ID!
		currency: String!
		lines: [OrderExchangeLineInput!]!
		returnId: ID
		allowBackorder: Boolean
		note: String
	}

	"The outcome of a mutation on a return."
	type RequestOrderReturnPayload {
		orderReturn: OrderReturn
		userErrors: [UserError!]!
	}

	"The outcome of receiving a return's goods."
	type ReceiveOrderReturnPayload {
		orderReturn: OrderReturn
		"The stock movements the receipt wrote."
		movementIds: [ID!]!
		"The refund that was issued, when one was."
		refundId: ID
		refundAmount: Decimal
		"Completed quantity across the received lines."
		receivedQuantity: Decimal!
		"Quantity still expected back."
		outstandingQuantity: Decimal!
		userErrors: [UserError!]!
	}

	"The outcome of a mutation on a claim."
	type RequestOrderClaimPayload {
		orderClaim: OrderClaim
		"The refund that was issued, when the resolution settled in money."
		refundId: ID
		userErrors: [UserError!]!
	}

	"The outcome of a mutation on an exchange."
	type RequestOrderExchangePayload {
		orderExchange: OrderExchange
		userErrors: [UserError!]!
	}

	"The outcome of a mutation on a return reason."
	type OrderReturnReasonPayload {
		orderReturnReason: OrderReturnReason
		userErrors: [UserError!]!
	}

	"The outcome of removing a return reason."
	type DeleteOrderReturnReasonPayload {
		id: ID
		userErrors: [UserError!]!
	}

	extend type Query {
		"Returns of the caller's organization."
		orderReturns(filter: OrderReturnFilter, page: PageInput): OrderReturnConnection!
		"One return, with its lines and its governed reason."
		orderReturn(id: ID!): OrderReturn
		"Governed return reasons, as a two-level tree."
		orderReturnReasons(filter: OrderReturnReasonFilter, page: PageInput): OrderReturnReasonConnection!
		"One governed return reason."
		orderReturnReason(id: ID!): OrderReturnReason
		"Claims of the caller's organization."
		orderClaims(filter: OrderClaimFilter, page: PageInput): OrderClaimConnection!
		"One claim, with its lines and its linked return."
		orderClaim(id: ID!): OrderClaim
		"Exchanges of the caller's organization."
		orderExchanges(filter: OrderExchangeFilter, page: PageInput): OrderExchangeConnection!
		"One exchange, with its outbound lines and its inbound return."
		orderExchange(id: ID!): OrderExchange
		"The lines of a return."
		orderReturnLines(returnId: ID!): [OrderReturnLine!]!
		"The lines of a claim."
		orderClaimLines(claimId: ID!): [OrderClaimLine!]!
		"The outbound lines of an exchange."
		orderExchangeLines(exchangeId: ID!): [OrderExchangeLine!]!
	}

	extend type Mutation {
		"Requests a return against an order."
		requestOrderReturn(input: RequestOrderReturnInput!): RequestOrderReturnPayload!
		"Approves a requested return."
		approveOrderReturn(id: ID!, note: String): RequestOrderReturnPayload!
		"Rejects a requested return."
		rejectOrderReturn(id: ID!, reason: String): RequestOrderReturnPayload!
		"Receives returned goods, writing the stock movements and issuing the refund."
		receiveOrderReturn(id: ID!, input: ReceiveOrderReturnInput!): ReceiveOrderReturnPayload!
		"Cancels a return."
		cancelOrderReturn(id: ID!, reason: String): RequestOrderReturnPayload!
		"Closes a fully received return."
		closeOrderReturn(id: ID!): RequestOrderReturnPayload!
		"Creates a governed return reason."
		createOrderReturnReason(input: OrderReturnReasonInput!): OrderReturnReasonPayload!
		"Updates a governed return reason."
		updateOrderReturnReason(id: ID!, input: OrderReturnReasonInput!): OrderReturnReasonPayload!
		"Deactivates a governed return reason."
		deleteOrderReturnReason(id: ID!): DeleteOrderReturnReasonPayload!
		"Raises a claim against an order."
		requestOrderClaim(input: RequestOrderClaimInput!): RequestOrderClaimPayload!
		"Approves and settles a claim."
		approveOrderClaim(id: ID!, refundAmount: Decimal, note: String): RequestOrderClaimPayload!
		"Rejects a claim."
		rejectOrderClaim(id: ID!, reason: String): RequestOrderClaimPayload!
		"Requests an exchange against an order."
		requestOrderExchange(input: RequestOrderExchangeInput!): RequestOrderExchangePayload!
		"Approves an exchange and prices the difference."
		approveOrderExchange(id: ID!, settleDifference: Boolean, note: String): RequestOrderExchangePayload!
		"Rejects an exchange."
		rejectOrderExchange(id: ID!, reason: String): RequestOrderExchangePayload!
	}
`;
